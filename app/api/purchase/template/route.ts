import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActivePrice } from "@/lib/discount";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId, couponCode } = await request.json();
    if (!templateId) {
      return NextResponse.json(
        { error: "templateId gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Template fiyatını DB'den getir
    const { data: template, error: tplErr } = await admin
      .from("templates")
      .select(
        "id, name, coin_price, discount_price, discount_expires_at"
      )
      .eq("id", templateId)
      .single();

    if (tplErr || !template) {
      return NextResponse.json(
        { error: "Şablon bulunamadı" },
        { status: 404 }
      );
    }

    let coinPrice = getActivePrice(template);
    if (coinPrice <= 0) {
      return NextResponse.json(
        { error: "Bu şablon ücretsiz — /api/purchase/free kullanın" },
        { status: 400 }
      );
    }

    // 2. Kupon doğrulama (opsiyonel)
    let couponId: string | null = null;
    if (couponCode) {
      const { data: couponCheck } = await admin.rpc("validate_coupon", {
        p_code: couponCode,
        p_user_id: user.id,
      });
      if (couponCheck?.valid) {
        coinPrice = Math.max(
          0,
          Math.round(coinPrice * (1 - couponCheck.discount_percent / 100))
        );
        couponId = couponCheck.coupon_id;
      } else {
        return NextResponse.json(
          { success: false, error: couponCheck?.error || "Geçersiz kupon" },
          { status: 400 }
        );
      }
    }

    // 3. Coin harca
    let newBalance = 0;
    if (coinPrice > 0) {
      const { data: spendResult, error: spendError } = await admin.rpc(
        "spend_coins",
        {
          p_user_id: user.id,
          p_amount: coinPrice,
          p_description: `Şablon satın alındı: ${template.name}`,
          p_reference_id: template.id,
          p_reference_type: "template",
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

    // 4. Purchase kaydı
    const { error: purchaseError } = await admin.from("purchases").insert({
      user_id: user.id,
      template_id: template.id,
      coins_spent: coinPrice,
      payment_method: "coins",
      payment_status: "completed",
    });
    if (purchaseError) {
      return NextResponse.json(
        { success: false, error: "Satın alma kaydı oluşturulamadı" },
        { status: 500 }
      );
    }

    // 5. Kupon kullanımı kaydet
    if (couponId) {
      await admin.rpc("record_coupon_usage", {
        p_coupon_id: couponId,
        p_user_id: user.id,
      });
    }

    return NextResponse.json({ success: true, newBalance });
  } catch {
    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
