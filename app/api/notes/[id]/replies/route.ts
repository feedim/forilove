import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { NOTE_MAX_LENGTH } from "@/lib/constants";
import { checkTextContent } from "@/lib/moderation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = Number(id);
    const admin = createAdminClient();
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: { user } } = await supabase.auth.getUser();

    // Block list
    let blockedIds: string[] = [];
    if (user) {
      const { data: blocks } = await admin
        .from("blocks")
        .select("blocked_id, blocker_id")
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
      if (blocks) {
        blockedIds = blocks.map(b => b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
      }
    }

    let query = admin
      .from("note_replies")
      .select(`
        id, note_id, author_id, content, like_count, created_at,
        profiles!note_replies_author_id_fkey(user_id, username, full_name, avatar_url, is_verified, premium_plan)
      `)
      .eq("note_id", noteId)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .range(from, to);

    if (blockedIds.length > 0) {
      for (const bid of blockedIds) {
        query = query.neq("author_id", bid);
      }
    }

    const { data: replies, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (replies || []).map((r: any) => ({
      ...r,
      profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
    }));

    return NextResponse.json({
      replies: normalized,
      hasMore: (replies || []).length >= limit,
    });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

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

    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "İçerik gerekli" }, { status: 400 });
    }
    const trimmed = content.trim();
    if (trimmed.length > NOTE_MAX_LENGTH) {
      return NextResponse.json({ error: `Yanıt en fazla ${NOTE_MAX_LENGTH} karakter olabilir` }, { status: 400 });
    }

    // Moderation
    const modResult = await checkTextContent("", trimmed);
    if (modResult.severity === "block") {
      return NextResponse.json(
        { error: modResult.reason || "İçerik politikamıza aykırı içerik tespit edildi" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check note exists
    const { data: note } = await admin
      .from("community_notes")
      .select("id, author_id")
      .eq("id", noteId)
      .eq("status", "published")
      .single();

    if (!note) {
      return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
    }

    const { data: reply, error } = await admin
      .from("note_replies")
      .insert({
        note_id: noteId,
        author_id: user.id,
        content: trimmed,
        status: modResult.severity === "flag" ? "removed" : "approved",
      })
      .select(`
        id, note_id, author_id, content, like_count, created_at,
        profiles!note_replies_author_id_fkey(user_id, username, full_name, avatar_url, is_verified, premium_plan)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notification
    if (note.author_id !== user.id) {
      await createNotification({
        admin,
        user_id: note.author_id,
        actor_id: user.id,
        type: "note_reply",
        object_type: "note",
        object_id: noteId,
        content: "notuna yanıt verdi",
      });
    }

    return NextResponse.json({
      reply: {
        ...reply,
        profiles: Array.isArray(reply.profiles) ? reply.profiles[0] : reply.profiles,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
