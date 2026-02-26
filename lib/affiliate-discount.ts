import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check if user is an affiliate with zero completed purchases.
 * When true, they get a one-time 100% discount on any template.
 */
export async function checkAffiliateDiscount(
  admin: SupabaseClient,
  userId: string
): Promise<{ affiliateFreeActive: boolean }> {
  // 1. Check if user is an affiliate
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (profile?.role !== "affiliate") {
    return { affiliateFreeActive: false };
  }

  // 2. Check if they have any completed purchases
  const { count } = await admin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("payment_status", "completed");

  return { affiliateFreeActive: (count ?? 0) === 0 };
}
