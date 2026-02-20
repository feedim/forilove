import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PLAN_PRICES: Record<string, number> = {
  basic: 39.99,
  pro: 79.99,
  max: 129,
  business: 249,
};

/**
 * GET /api/payment/proration?plan_id=max
 * Mevcut abonelikten yeni plana geçişte iade/indirim hesapla
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const planId = request.nextUrl.searchParams.get("plan_id");
    if (!planId || !PLAN_PRICES[planId]) {
      return NextResponse.json({ error: "plan_id gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Hedef planı bul (DB veya fallback)
    const { data: dbPlan } = await admin
      .from("premium_plans")
      .select("id, name, price")
      .eq("id", planId)
      .single();

    const planPrice = dbPlan ? Number(dbPlan.price) : PLAN_PRICES[planId];

    // Mevcut aktif aboneliği kontrol et
    const { data: activeSub } = await admin
      .from("premium_subscriptions")
      .select("id, plan_id, amount_paid, started_at, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!activeSub) {
      return NextResponse.json({
        has_active: false,
        credit: 0,
        original_price: planPrice,
        final_price: planPrice,
        remaining_days: 0,
      });
    }

    const now = Date.now();
    const expiresMs = new Date(activeSub.expires_at).getTime();
    const startedMs = new Date(activeSub.started_at).getTime();
    const totalDays = Math.max(1, Math.ceil((expiresMs - startedMs) / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.max(0, Math.ceil((expiresMs - now) / (1000 * 60 * 60 * 24)));
    const oldPrice = Number(activeSub.amount_paid) || 0;
    const credit = Math.round((oldPrice * remainingDays / totalDays) * 100) / 100;
    const originalPrice = planPrice;
    const finalPrice = Math.max(0, Math.round((originalPrice - credit) * 100) / 100);

    return NextResponse.json({
      has_active: true,
      current_plan: activeSub.plan_id,
      credit,
      remaining_days: remainingDays,
      original_price: originalPrice,
      final_price: finalPrice,
    });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
