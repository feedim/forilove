import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_PAYOUT = 100;
const TOTAL_ALLOCATION = 35;
const AUTO_PAYOUT_INTERVAL_DAYS = 7;

async function verifyAffiliate(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "affiliate" && profile?.role !== "admin") return null;
  return { ...user, role: profile?.role };
}

// Calculate affiliate earnings
async function calculateEarnings(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: promos } = await admin
    .from("promo_links")
    .select("id, discount_percent")
    .eq("created_by", userId);

  if (!promos || promos.length === 0) {
    return { totalEarnings: 0, commissionRate: 0 };
  }

  const promoIds = promos.map(p => p.id);

  const { data: signups } = await admin
    .from("promo_signups")
    .select("user_id")
    .in("promo_link_id", promoIds);

  if (!signups || signups.length === 0) {
    return { totalEarnings: 0, commissionRate: TOTAL_ALLOCATION - promos[0].discount_percent };
  }

  const userIds = signups.map(s => s.user_id).filter(Boolean);

  const { data: payments } = await admin
    .from("coin_payments")
    .select("price_paid")
    .in("user_id", userIds)
    .eq("status", "completed");

  const totalRevenue = payments?.reduce((sum, p) => sum + (p.price_paid || 0), 0) || 0;
  const commissionRate = TOTAL_ALLOCATION - promos[0].discount_percent;
  const totalEarnings = Math.round((totalRevenue * commissionRate / 100) * 100) / 100;

  return { totalEarnings, commissionRate };
}

// Try auto-payout: if 7+ days since last payout request and balance >= MIN_PAYOUT
async function tryAutoPayout(admin: ReturnType<typeof createAdminClient>, userId: string, available: number, allPayouts: any[]) {
  if (available < MIN_PAYOUT) return null;

  // Check no pending payout exists
  const hasPending = allPayouts.some(p => p.status === "pending");
  if (hasPending) return null;

  // Check IBAN exists
  const { data: profile } = await admin
    .from("profiles")
    .select("affiliate_iban, affiliate_holder_name")
    .eq("user_id", userId)
    .single();

  if (!profile?.affiliate_iban || !profile?.affiliate_holder_name) return null;

  // Check 7+ days since last payout request (any status)
  const lastPayout = allPayouts[0]; // already sorted desc by requested_at
  if (lastPayout) {
    const daysSince = (Date.now() - new Date(lastPayout.requested_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < AUTO_PAYOUT_INTERVAL_DAYS) return null;
  }

  // Auto-create payout request
  const { data: payout, error } = await admin
    .from("affiliate_payouts")
    .insert({
      affiliate_user_id: userId,
      amount: available,
      status: "pending",
      admin_note: "Otomatik talep (7 gün)",
    })
    .select()
    .single();

  if (error) {
    console.error("Auto-payout error:", error);
    return null;
  }

  return payout;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await verifyAffiliate(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();

    const { totalEarnings, commissionRate } = await calculateEarnings(admin, user.id);

    // Get all payouts
    const { data: payouts } = await admin
      .from("affiliate_payouts")
      .select("*")
      .eq("affiliate_user_id", user.id)
      .order("requested_at", { ascending: false });

    let allPayouts = payouts || [];
    const totalPaidOut = allPayouts
      .filter(p => p.status === "approved")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPending = allPayouts
      .filter(p => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    let availableBalance = Math.round((totalEarnings - totalPaidOut - totalPending) * 100) / 100;

    // Try auto-payout if conditions are met
    const autoPayout = await tryAutoPayout(admin, user.id, availableBalance, allPayouts);
    if (autoPayout) {
      allPayouts = [autoPayout, ...allPayouts];
      availableBalance = Math.max(0, Math.round((availableBalance - Number(autoPayout.amount)) * 100) / 100);
    }

    // Calculate next auto-payout date
    const lastRequest = allPayouts[0];
    const nextAutoDate = lastRequest
      ? new Date(new Date(lastRequest.requested_at).getTime() + AUTO_PAYOUT_INTERVAL_DAYS * 86400000).toISOString()
      : null;

    return NextResponse.json({
      balance: {
        totalEarnings,
        totalPaidOut: Math.round(totalPaidOut * 100) / 100,
        totalPending: Math.round((totalPending + (autoPayout ? Number(autoPayout.amount) : 0)) * 100) / 100,
        available: Math.max(0, availableBalance),
        commissionRate,
        canRequestPayout: availableBalance >= MIN_PAYOUT && !allPayouts.some(p => p.status === "pending"),
        minPayout: MIN_PAYOUT,
        nextAutoDate,
        autoPayoutDays: AUTO_PAYOUT_INTERVAL_DAYS,
      },
      payouts: allPayouts,
    });
  } catch (error) {
    console.error("Affiliate payouts GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await verifyAffiliate(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Check for existing pending payout
    const { data: existingPending } = await admin
      .from("affiliate_payouts")
      .select("id")
      .eq("affiliate_user_id", user.id)
      .eq("status", "pending")
      .limit(1);

    if (existingPending && existingPending.length > 0) {
      return NextResponse.json({ error: "Zaten bekleyen bir ödeme talebiniz var" }, { status: 400 });
    }

    // Calculate available balance
    const { totalEarnings } = await calculateEarnings(admin, user.id);

    const { data: payouts } = await admin
      .from("affiliate_payouts")
      .select("amount, status")
      .eq("affiliate_user_id", user.id);

    const totalPaidOut = (payouts || [])
      .filter(p => p.status === "approved")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPending = (payouts || [])
      .filter(p => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const available = Math.round((totalEarnings - totalPaidOut - totalPending) * 100) / 100;

    if (available < MIN_PAYOUT) {
      return NextResponse.json({ error: `Minimum ödeme tutarı ${MIN_PAYOUT} TRY'dir. Mevcut bakiye: ${available.toFixed(2)} TRY` }, { status: 400 });
    }

    // Check IBAN exists
    const { data: profile } = await admin
      .from("profiles")
      .select("affiliate_iban, affiliate_holder_name")
      .eq("user_id", user.id)
      .single();

    if (!profile?.affiliate_iban || !profile?.affiliate_holder_name) {
      return NextResponse.json({ error: "Önce ödeme bilgilerinizi (IBAN) kaydedin" }, { status: 400 });
    }

    // Create payout request
    const { data: payout, error } = await admin
      .from("affiliate_payouts")
      .insert({
        affiliate_user_id: user.id,
        amount: available,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ payout });
  } catch (error) {
    console.error("Affiliate payouts POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
