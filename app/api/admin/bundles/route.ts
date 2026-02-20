import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toSlug(name: string) {
  return name
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

async function verifyCreatorOrAdmin(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  const role = profile?.role;
  if (role !== "admin" && role !== "creator") return null;
  return role as "admin" | "creator";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await verifyCreatorOrAdmin(supabase, user.id);
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    let query = admin
      .from("bundles")
      .select(
        "id, name, slug, description, created_by, is_active, created_at, updated_at, bundle_templates(template_id, templates(id, name, coin_price, discount_price, discount_expires_at))"
      )
      .order("created_at", { ascending: false });

    // Creator sadece kendi paketlerini görür
    if (role === "creator") {
      query = query.eq("created_by", user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ bundles: data || [] });
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

    const role = await verifyCreatorOrAdmin(supabase, user.id);
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, description, templateIds } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Paket adı gerekli" },
        { status: 400 }
      );
    }
    if (!templateIds || templateIds.length < 2) {
      return NextResponse.json(
        { error: "En az 2 şablon seçmelisiniz" },
        { status: 400 }
      );
    }
    if (templateIds.length > 20) {
      return NextResponse.json(
        { error: "Bir pakette en fazla 20 şablon olabilir" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Creator sadece kendi şablonlarını paketleyebilir
    if (role === "creator") {
      const { data: ownTemplates } = await admin
        .from("templates")
        .select("id")
        .eq("created_by", user.id)
        .in("id", templateIds);

      if (!ownTemplates || ownTemplates.length !== templateIds.length) {
        return NextResponse.json(
          { error: "Sadece kendi şablonlarınızı paketleyebilirsiniz" },
          { status: 403 }
        );
      }
    }

    const slug = toSlug(name.trim());
    if (slug.length < 2) {
      return NextResponse.json(
        { error: "Geçerli bir slug oluşturulamadı" },
        { status: 400 }
      );
    }

    // Paket oluştur
    const { data: bundle, error: bundleError } = await admin
      .from("bundles")
      .insert({
        name: name.trim(),
        slug,
        description: (description || "").trim(),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (bundleError) {
      if (bundleError.code === "23505") {
        return NextResponse.json(
          { error: "Bu slug zaten kullanılıyor" },
          { status: 400 }
        );
      }
      throw bundleError;
    }

    // Şablonları bağla
    const junctionRows = templateIds.map((tid: string) => ({
      bundle_id: bundle.id,
      template_id: tid,
    }));

    const { error: jtError } = await admin
      .from("bundle_templates")
      .insert(junctionRows);

    if (jtError) throw jtError;

    return NextResponse.json({ success: true, bundleId: bundle.id });
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

    const role = await verifyCreatorOrAdmin(supabase, user.id);
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { bundleId, name, description, templateIds, is_active } =
      await request.json();

    if (!bundleId) {
      return NextResponse.json(
        { error: "bundleId gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Sahiplik kontrolü
    const { data: bundle } = await admin
      .from("bundles")
      .select("id, created_by")
      .eq("id", bundleId)
      .single();

    if (!bundle) {
      return NextResponse.json(
        { error: "Paket bulunamadı" },
        { status: 404 }
      );
    }

    if (role !== "admin" && bundle.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Güncelleme objesi
    const updates: Record<string, any> = {};
    if (name !== undefined) {
      updates.name = name.trim();
      updates.slug = toSlug(name.trim());
    }
    if (description !== undefined) updates.description = description.trim();
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin
        .from("bundles")
        .update(updates)
        .eq("id", bundleId);

      if (updateError) {
        if (updateError.code === "23505") {
          return NextResponse.json(
            { error: "Bu slug zaten kullanılıyor" },
            { status: 400 }
          );
        }
        throw updateError;
      }
    }

    // Şablon listesini güncelle
    if (templateIds !== undefined) {
      if (templateIds.length < 2) {
        return NextResponse.json(
          { error: "En az 2 şablon gerekli" },
          { status: 400 }
        );
      }
      if (templateIds.length > 20) {
        return NextResponse.json(
          { error: "Bir pakette en fazla 20 şablon olabilir" },
          { status: 400 }
        );
      }

      // Creator sahiplik kontrolü
      if (role === "creator") {
        const { data: ownTemplates } = await admin
          .from("templates")
          .select("id")
          .eq("created_by", user.id)
          .in("id", templateIds);

        if (!ownTemplates || ownTemplates.length !== templateIds.length) {
          return NextResponse.json(
            { error: "Sadece kendi şablonlarınızı paketleyebilirsiniz" },
            { status: 403 }
          );
        }
      }

      // Mevcut bağlantıları sil, yenilerini ekle
      await admin.from("bundle_templates").delete().eq("bundle_id", bundleId);

      const junctionRows = templateIds.map((tid: string) => ({
        bundle_id: bundleId,
        template_id: tid,
      }));

      const { error: jtError } = await admin
        .from("bundle_templates")
        .insert(junctionRows);

      if (jtError) throw jtError;
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

    const role = await verifyCreatorOrAdmin(supabase, user.id);
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { bundleId } = await request.json();
    if (!bundleId) {
      return NextResponse.json(
        { error: "bundleId gerekli" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Sahiplik kontrolü
    const { data: bundle } = await admin
      .from("bundles")
      .select("id, created_by")
      .eq("id", bundleId)
      .single();

    if (!bundle) {
      return NextResponse.json(
        { error: "Paket bulunamadı" },
        { status: 404 }
      );
    }

    if (role !== "admin" && bundle.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin
      .from("bundles")
      .delete()
      .eq("id", bundleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
