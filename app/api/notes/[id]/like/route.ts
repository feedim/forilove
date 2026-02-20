import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { getUserPlan, checkDailyLimit, logRateLimitHit } from "@/lib/limits";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = Number(id);
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if already liked
    const { data: existing } = await admin
      .from("note_likes")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("note_id", noteId)
      .single();

    if (existing) {
      // Unlike
      await admin.from("note_likes").delete().eq("user_id", user.id).eq("note_id", noteId);

      // Remove notification
      await admin.from("notifications").delete()
        .eq("actor_id", user.id)
        .eq("type", "note_like")
        .eq("object_type", "note")
        .eq("object_id", noteId);

      const { data: updated } = await admin.from("community_notes").select("like_count").eq("id", noteId).single();
      return NextResponse.json({ liked: false, like_count: updated?.like_count || 0 });
    }

    // Daily like limit check
    const plan = await getUserPlan(admin, user.id);
    const { allowed, limit } = await checkDailyLimit(admin, user.id, "like", plan);
    if (!allowed) {
      logRateLimitHit(admin, user.id, "like", req.headers.get("x-forwarded-for")?.split(",")[0]?.trim());
      return NextResponse.json(
        { error: `Günlük beğeni limitine ulaştın (${limit}). Premium ile artır.`, limit, remaining: 0 },
        { status: 429 }
      );
    }

    // Like
    const { error } = await admin
      .from("note_likes")
      .insert({ user_id: user.id, note_id: noteId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: updated } = await admin.from("community_notes").select("like_count, author_id").eq("id", noteId).single();

    // Notification
    if (updated && updated.author_id !== user.id) {
      await createNotification({
        admin,
        user_id: updated.author_id,
        actor_id: user.id,
        type: "note_like",
        object_type: "note",
        object_id: noteId,
        content: "notunu beğendi",
      });
    }

    return NextResponse.json({ liked: true, like_count: updated?.like_count || 0 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
