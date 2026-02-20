import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function verifyAdmin(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return profile?.role === "admin";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await verifyAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ posts: data || [] });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await verifyAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, slug, description, keywords, content, read_time, cover_image_url, is_published } =
      await request.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });
    }

    const finalSlug = slug?.trim() || toSlug(title.trim());
    if (finalSlug.length < 2) {
      return NextResponse.json(
        { error: "Geçerli bir slug oluşturulamadı" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .insert({
        title: title.trim(),
        slug: finalSlug,
        description: (description || "").trim(),
        keywords: keywords || [],
        content: content || "",
        read_time: read_time || "1 dk",
        cover_image_url: cover_image_url || null,
        is_published: is_published || false,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Bu slug zaten kullanılıyor" },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, postId: data.id });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await verifyAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { postId, ...fields } = await request.json();
    if (!postId) {
      return NextResponse.json({ error: "postId gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();

    const updates: Record<string, any> = {};
    if (fields.title !== undefined) updates.title = fields.title.trim();
    if (fields.slug !== undefined) updates.slug = fields.slug.trim();
    if (fields.description !== undefined) updates.description = fields.description.trim();
    if (fields.keywords !== undefined) updates.keywords = fields.keywords;
    if (fields.content !== undefined) updates.content = fields.content;
    if (fields.read_time !== undefined) updates.read_time = fields.read_time;
    if (fields.cover_image_url !== undefined) updates.cover_image_url = fields.cover_image_url || null;
    if (fields.is_published !== undefined) updates.is_published = fields.is_published;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
    }

    const { error } = await admin
      .from("blog_posts")
      .update(updates)
      .eq("id", postId);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Bu slug zaten kullanılıyor" },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await verifyAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { postId } = await request.json();
    if (!postId) {
      return NextResponse.json({ error: "postId gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("blog_posts")
      .delete()
      .eq("id", postId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
