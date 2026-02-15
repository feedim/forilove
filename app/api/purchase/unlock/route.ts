import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATE_UNLOCK_COST } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, unlockedKeys, couponCode } = await request.json();
    if (!projectId || !Array.isArray(unlockedKeys)) {
      return NextResponse.json(
        { error: "projectId ve unlockedKeys gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Proje sahipliği doğrula
    const { data: proj, error: projErr } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .single();

    if (projErr || !proj || proj.user_id !== user.id) {
      return NextResponse.json(
        { error: "Proje bulunamadı veya yetkiniz yok" },
        { status: 403 }
      );
    }

    let cost = TEMPLATE_UNLOCK_COST;

    // 2. Kupon doğrulama (opsiyonel)
    let couponId: string | null = null;
    if (couponCode) {
      const { data: couponCheck } = await admin.rpc("validate_coupon", {
        p_code: couponCode,
        p_user_id: user.id,
      });
      if (couponCheck?.valid) {
        cost = Math.max(
          0,
          Math.round(cost * (1 - couponCheck.discount_percent / 100))
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
    const { data: spendResult, error: spendError } = await admin.rpc(
      "spend_coins",
      {
        p_user_id: user.id,
        p_amount: cost,
        p_description: "Ücretsiz şablon kilitleri açıldı",
        p_reference_id: projectId,
        p_reference_type: "template_unlock",
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

    // 4. Proje unlocked_fields güncelle
    const { error: updateError } = await admin
      .from("projects")
      .update({
        unlocked_fields: unlockedKeys,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Proje güncellenemedi" },
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

    return NextResponse.json({
      success: true,
      newBalance: spendResult[0].new_balance,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
