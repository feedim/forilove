import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_COST } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, couponCode } = await request.json();

    const admin = createAdminClient();

    let cost = AI_COST;

    // Kupon doğrulama (opsiyonel)
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

    // Coin harca
    const { data: spendResult, error: spendError } = await admin.rpc(
      "spend_coins",
      {
        p_user_id: user.id,
        p_amount: cost,
        p_description: "AI ile Doldur kullanımı",
        p_reference_id: projectId || null,
        p_reference_type: "ai_generate",
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

    // Kupon kullanımı kaydet
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
