import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTE_MAX_LENGTH, NOTE_MAX_TAGS, NOTE_MAX_IMAGES, NOTES_PAGE_SIZE } from "@/lib/constants";
import { slugify, formatTagName } from "@/lib/utils";
import { checkTextContent } from "@/lib/moderation";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "for-you";
    const page = parseInt(searchParams.get("page") || "1");
    const tagSlug = searchParams.get("tag");

    const { data: { user } } = await supabase.auth.getUser();

    const from = (page - 1) * NOTES_PAGE_SIZE;
    const to = from + NOTES_PAGE_SIZE - 1;

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
      .from("community_notes")
      .select(`
        id, author_id, content, images, like_count, reply_count, save_count, view_count, created_at,
        profiles!community_notes_author_id_fkey(user_id, username, full_name, avatar_url, is_verified, premium_plan, status, account_private),
        note_tags(tag_id, tags(id, name, slug))
      `)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(from, to);

    // Tag filter
    if (tagSlug) {
      const { data: tag } = await admin.from("tags").select("id").eq("slug", tagSlug).single();
      if (tag) {
        const { data: noteIds } = await admin
          .from("note_tags")
          .select("note_id")
          .eq("tag_id", tag.id);
        if (noteIds && noteIds.length > 0) {
          query = query.in("id", noteIds.map(n => n.note_id));
        } else {
          return NextResponse.json({ notes: [], hasMore: false });
        }
      }
    }

    // Following tab
    if (tab === "following" && user) {
      const { data: following } = await admin
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      if (following && following.length > 0) {
        query = query.in("author_id", following.map(f => f.following_id));
      } else {
        return NextResponse.json({ notes: [], hasMore: false });
      }
    }

    // Block filter
    if (blockedIds.length > 0) {
      for (const bid of blockedIds) {
        query = query.neq("author_id", bid);
      }
    }

    const { data: notes, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add is_liked + is_saved for logged-in user
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

    // Normalize
    const normalized = (notes || [])
      .filter((n: any) => {
        const profile = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles;
        return profile?.status === "active";
      })
      .map((n: any) => {
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content, tags, images } = body;

    // Validate content
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "İçerik gerekli" }, { status: 400 });
    }
    const trimmed = content.trim();
    if (trimmed.length > NOTE_MAX_LENGTH) {
      return NextResponse.json({ error: `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir` }, { status: 400 });
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
    const noteStatus = modResult.severity === "flag" ? "moderation" : "published";

    // Validate images
    const imageUrls: string[] = [];
    if (images && Array.isArray(images)) {
      for (const url of images.slice(0, NOTE_MAX_IMAGES)) {
        if (typeof url === "string" && url.startsWith("http")) {
          imageUrls.push(url);
        }
      }
    }

    // Insert note
    const { data: note, error } = await admin
      .from("community_notes")
      .insert({
        author_id: user.id,
        content: trimmed,
        images: imageUrls.length > 0 ? imageUrls : [],
        status: noteStatus,
        spam_score: modResult.severity === "flag" ? 50 : 0,
      })
      .select("id, content, images, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagIds: number[] = [];
      for (const tagItem of tags.slice(0, NOTE_MAX_TAGS)) {
        if (typeof tagItem !== "string" || !tagItem.trim()) continue;
        const tagSlug = slugify(tagItem.trim());
        if (!tagSlug) continue;

        const { data: existing } = await admin
          .from("tags")
          .select("id")
          .eq("slug", tagSlug)
          .single();

        if (existing) {
          tagIds.push(existing.id);
        } else {
          const { data: newTag } = await admin
            .from("tags")
            .insert({ name: formatTagName(tagItem.trim()), slug: tagSlug })
            .select("id")
            .single();
          if (newTag) tagIds.push(newTag.id);
        }
      }

      if (tagIds.length > 0) {
        await admin
          .from("note_tags")
          .insert(tagIds.map(tag_id => ({ note_id: note.id, tag_id })));
      }
    }

    const response: Record<string, unknown> = { note };
    if (noteStatus === "moderation") {
      response.moderation = true;
      response.message = "Notunuz incelemeye alındı. Moderatörler onayladıktan sonra yayınlanacak.";
    }

    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
