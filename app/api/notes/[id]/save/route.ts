import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPlan, checkDailyLimit, logRateLimitHit } from "@/lib/limits";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = Number(id);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check if already saved
    const { data: existing } = await admin
      .from("note_bookmarks")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("note_id", noteId)
      .single();

    if (existing) {
      // Unsave
      await admin.from("note_bookmarks").delete().eq("user_id", user.id).eq("note_id", noteId);
      const { data: noteData } = await admin.from("community_notes").select("save_count").eq("id", noteId).single();
      return NextResponse.json({ saved: false, save_count: noteData?.save_count ?? 0 });
    }

    // Daily save limit check
    const plan = await getUserPlan(admin, user.id);
    const { allowed, limit } = await checkDailyLimit(admin, user.id, "save", plan);
    if (!allowed) {
      logRateLimitHit(admin, user.id, "save", req.headers.get("x-forwarded-for")?.split(",")[0]?.trim());
      return NextResponse.json(
        { error: `Günlük kaydetme limitine ulaştın (${limit}). Premium ile artır.`, limit, remaining: 0 },
        { status: 429 }
      );
    }

    // Save
    const { error } = await admin
      .from("note_bookmarks")
      .insert({ user_id: user.id, note_id: noteId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: noteData } = await admin.from("community_notes").select("save_count").eq("id", noteId).single();
    return NextResponse.json({ saved: true, save_count: noteData?.save_count ?? 0 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
