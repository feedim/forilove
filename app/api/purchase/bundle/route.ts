import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateBundlePrice } from "@/lib/bundle-price";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bundleId, couponCode } = await request.json();
    if (!bundleId) {
      return NextResponse.json(
        { error: "bundleId gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Bundle + template fiyatlarını getir
    const { data: bundle, error: bErr } = await admin
      .from("bundles")
      .select(
        "id, name, is_active, bundle_templates(template_id, templates(id, name, coin_price, discount_price, discount_expires_at))"
      )
      .eq("id", bundleId)
      .single();

    if (bErr || !bundle) {
      return NextResponse.json(
        { error: "Paket bulunamadı" },
        { status: 404 }
      );
    }

    if (!bundle.is_active) {
      return NextResponse.json(
        { error: "Bu paket aktif değil" },
        { status: 400 }
      );
    }

    const allTemplates = (bundle.bundle_templates || [])
      .map((bt: any) => bt.templates)
      .filter(Boolean);

    if (allTemplates.length < 2) {
      return NextResponse.json(
        { error: "Paket geçersiz — yeterli şablon yok" },
        { status: 400 }
      );
    }

    // 2. Kullanıcının zaten satın aldığı şablonları filtrele
    const templateIds = allTemplates.map((t: any) => t.id);
    const { data: existingPurchases } = await admin
      .from("purchases")
      .select("template_id")
      .eq("user_id", user.id)
      .in("template_id", templateIds);

    const ownedIds = new Set(
      (existingPurchases || []).map((p: any) => p.template_id)
    );
    const newTemplates = allTemplates.filter(
      (t: any) => !ownedIds.has(t.id)
    );

    if (newTemplates.length === 0) {
      return NextResponse.json(
        { error: "Bu paketteki tüm şablonlara zaten sahipsiniz" },
        { status: 400 }
      );
    }

    // 3. Fiyat hesapla (sadece yeni şablonlar için)
    let { bundlePrice } = calculateBundlePrice(newTemplates);

    if (bundlePrice <= 0) {
      return NextResponse.json(
        { error: "Bu paket ücretsiz şablonlardan oluşuyor" },
        { status: 400 }
      );
    }

    // 4. Kupon doğrulama (opsiyonel)
    let couponId: string | null = null;
    if (couponCode) {
      const { data: couponCheck } = await admin.rpc("validate_coupon", {
        p_code: couponCode,
        p_user_id: user.id,
      });
      if (couponCheck?.valid) {
        bundlePrice = Math.max(
          0,
          Math.round(bundlePrice * (1 - couponCheck.discount_percent / 100))
        );
        couponId = couponCheck.coupon_id;
      } else {
        return NextResponse.json(
          { success: false, error: couponCheck?.error || "Geçersiz kupon" },
          { status: 400 }
        );
      }
    }

    // 5. Coin harca
    let newBalance = 0;
    if (bundlePrice > 0) {
      const { data: spendResult, error: spendError } = await admin.rpc(
        "spend_coins",
        {
          p_user_id: user.id,
          p_amount: bundlePrice,
          p_description: `Paket satın alındı: ${bundle.name}`,
          p_reference_id: bundle.id,
          p_reference_type: "bundle",
        }
      );
      if (spendError) {
        return NextResponse.json(
          { success: false, error: "Coin harcama hatası" },
          { status: 500 }
        );
      }
      if (!spendResult[0]?.success) {
        return NextResponse.json(
          {
            success: false,
            error: spendResult[0]?.message || "Yetersiz bakiye",
          },
          { status: 400 }
        );
      }
      newBalance = spendResult[0].new_balance;
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("coin_balance")
        .eq("user_id", user.id)
        .single();
      newBalance = profile?.coin_balance ?? 0;
    }

    // 6. Her template için purchases tablosuna INSERT
    const purchaseRows = newTemplates.map((t: any) => ({
      user_id: user.id,
      template_id: t.id,
      coins_spent: 0, // toplam paket fiyatı bundle_purchases'da
      payment_method: "coins",
      payment_status: "completed",
    }));

    const { error: purchaseError } = await admin
      .from("purchases")
      .insert(purchaseRows);

    if (purchaseError) {
      return NextResponse.json(
        { success: false, error: "Satın alma kaydı oluşturulamadı" },
        { status: 500 }
      );
    }

    // 7. bundle_purchases tablosuna INSERT
    await admin.from("bundle_purchases").insert({
      user_id: user.id,
      bundle_id: bundle.id,
      coins_spent: bundlePrice,
    });

    // 8. Kupon kullanımı kaydet
    if (couponId) {
      await admin.rpc("record_coupon_usage", {
        p_coupon_id: couponId,
        p_user_id: user.id,
      });
    }

    return NextResponse.json({
      success: true,
      newBalance,
      templatesUnlocked: newTemplates.length,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
