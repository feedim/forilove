import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTES_PAGE_SIZE } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, account_private")
      .eq("username", username)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    // Private account check
    const { data: { user } } = await supabase.auth.getUser();
    const isOwn = user?.id === profile.user_id;

    if (profile.account_private && !isOwn) {
      if (!user) {
        return NextResponse.json({ notes: [], hasMore: false });
      }
      const { data: follow } = await admin
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profile.user_id)
        .single();
      if (!follow) {
        return NextResponse.json({ notes: [], hasMore: false });
      }
    }

    const from = (page - 1) * NOTES_PAGE_SIZE;
    const to = from + NOTES_PAGE_SIZE - 1;

    const { data: notes, error } = await admin
      .from("community_notes")
      .select(`
        id, author_id, content, images, like_count, reply_count, save_count, view_count, created_at,
        profiles!community_notes_author_id_fkey(user_id, username, full_name, avatar_url, is_verified, premium_plan),
        note_tags(tag_id, tags(id, name, slug))
      `)
      .eq("author_id", profile.user_id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check like/save status
    let likedNoteIds = new Set<number>();
    let savedNoteIds = new Set<number>();

    if (user && notes && notes.length > 0) {
      const ids = notes.map((n: any) => n.id);
      const [{ data: likes }, { data: saves }] = await Promise.all([
        admin.from("note_likes").select("note_id").eq("user_id", user.id).in("note_id", ids),
        admin.from("note_bookmarks").select("note_id").eq("user_id", user.id).in("note_id", ids),
      ]);
      if (likes) likedNoteIds = new Set(likes.map(l => l.note_id));
      if (saves) savedNoteIds = new Set(saves.map(s => s.note_id));
    }

    const normalized = (notes || []).map((n: any) => {
      const profile = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles;
      const tags = (n.note_tags || []).map((nt: any) => {
        const tag = Array.isArray(nt.tags) ? nt.tags[0] : nt.tags;
        return tag;
      }).filter(Boolean);
      return {
        id: n.id,
        author_id: n.author_id,
        content: n.content,
        images: n.images || [],
        like_count: n.like_count,
        reply_count: n.reply_count,
        save_count: n.save_count,
        view_count: n.view_count,
        created_at: n.created_at,
        profiles: profile,
        tags,
        is_liked: likedNoteIds.has(n.id),
        is_saved: savedNoteIds.has(n.id),
      };
    });

    return NextResponse.json({
      notes: normalized,
      hasMore: (notes || []).length >= NOTES_PAGE_SIZE,
    });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
