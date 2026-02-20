import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPlan, checkDailyLimit, logRateLimitHit } from "@/lib/limits";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) return NextResponse.json({ error: "Geçersiz ID" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { platform } = await request.json();
    if (!platform || typeof platform !== "string") {
      return NextResponse.json({ error: "Platform gerekli" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify post exists
    const { data: post } = await admin
      .from("posts")
      .select("id")
      .eq("id", postId)
      .single();

    if (!post) return NextResponse.json({ error: "Gönderi bulunamadı" }, { status: 404 });

    // Daily share limit check
    const plan = await getUserPlan(admin, user.id);
    const { allowed, limit } = await checkDailyLimit(admin, user.id, "share", plan);
    if (!allowed) {
      logRateLimitHit(admin, user.id, "share", request.headers.get("x-forwarded-for")?.split(",")[0]?.trim());
      return NextResponse.json(
        { error: `Günlük paylaşım limitine ulaştın (${limit}). Premium ile artır.`, limit, remaining: 0 },
        { status: 429 }
      );
    }

    // Insert into shares table — trigger updates share_count on posts
    await admin.from("shares").insert({
      user_id: user.id,
      post_id: postId,
      platform,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
