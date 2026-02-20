import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST — freeze account (reversible)
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse optional reason from body
  let reason: string | null = null;
  try {
    const body = await request.json();
    if (body.reason && typeof body.reason === "string") {
      reason = body.reason.slice(0, 500);
    }
  } catch {}

  const { error } = await admin
    .from("profiles")
    .update({
      status: "frozen",
      frozen_at: new Date().toISOString(),
      freeze_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sign out the user
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}

// DELETE — unfreeze account (reactivate)
export async function DELETE() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("status, frozen_at")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.status !== "frozen") {
    return NextResponse.json({ error: "Hesap dondurulmamış" }, { status: 400 });
  }

  // Check if within 14-day window (pending delete)
  if (profile.frozen_at) {
    const frozenAt = new Date(profile.frozen_at).getTime();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    if (Date.now() - frozenAt > fourteenDays) {
      return NextResponse.json({ error: "Hesap silme süresi dolmuş" }, { status: 410 });
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      status: "active",
      frozen_at: null,
      freeze_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
