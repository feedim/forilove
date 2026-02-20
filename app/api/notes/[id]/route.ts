import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: note, error } = await admin
      .from("community_notes")
      .select(`
        id, author_id, content, images, like_count, reply_count, save_count, view_count, created_at, status,
        profiles!community_notes_author_id_fkey(user_id, username, full_name, avatar_url, is_verified, premium_plan, status),
        note_tags(tag_id, tags(id, name, slug))
      `)
      .eq("id", id)
      .single();

    if (error || !note) {
      return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
    }

    // Only published or own notes
    if (note.status !== "published") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== note.author_id) {
        return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
      }
    }

    const profile = Array.isArray(note.profiles) ? note.profiles[0] : note.profiles;
    const tags = (note.note_tags || []).map((nt: any) => {
      const tag = Array.isArray(nt.tags) ? nt.tags[0] : nt.tags;
      return tag;
    }).filter(Boolean);

    // Check like/save status
    const { data: { user } } = await supabase.auth.getUser();
    let is_liked = false;
    let is_saved = false;
    if (user) {
      const [{ data: like }, { data: save }] = await Promise.all([
        admin.from("note_likes").select("user_id").eq("user_id", user.id).eq("note_id", note.id).single(),
        admin.from("note_bookmarks").select("user_id").eq("user_id", user.id).eq("note_id", note.id).single(),
      ]);
      is_liked = !!like;
      is_saved = !!save;
    }

    return NextResponse.json({
      note: {
        ...note,
        profiles: profile,
        tags,
        note_tags: undefined,
        is_liked,
        is_saved,
      },
    });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("community_notes")
      .select("id, author_id")
      .eq("id", id)
      .single();

    if (!existing || existing.author_id !== user.id) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 403 });
    }

    const { error } = await admin.from("community_notes").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
