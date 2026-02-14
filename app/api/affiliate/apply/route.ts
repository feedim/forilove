import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is already affiliate/admin
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, name, surname")
      .eq("user_id", user.id)
      .single();

    if (profile?.role === "affiliate" || profile?.role === "admin") {
      return NextResponse.json({ error: "Zaten affiliate veya admin hesabınız var" }, { status: 400 });
    }

    // Check if already has a pending application
    const { data: existing } = await admin
      .from("affiliate_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Zaten bekleyen bir başvurunuz var" }, { status: 400 });
    }

    const body = await request.json();
    const { socialMedia, followers, description } = body;

    if (!socialMedia || typeof socialMedia !== "string" || !socialMedia.trim()) {
      return NextResponse.json({ error: "Sosyal medya hesabı zorunludur" }, { status: 400 });
    }
    if (!followers || typeof followers !== "string" || !followers.trim()) {
      return NextResponse.json({ error: "Takipçi sayısı zorunludur" }, { status: 400 });
    }

    const fullName = [profile?.name, profile?.surname].filter(Boolean).join(" ") || user.email?.split("@")[0] || "";

    const { error } = await admin
      .from("affiliate_applications")
      .insert({
        user_id: user.id,
        email: user.email,
        full_name: fullName,
        social_media: socialMedia.trim().slice(0, 200),
        followers: followers.trim().slice(0, 20),
        description: (description || "").trim().slice(0, 300),
        status: "pending",
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Affiliate apply error:", error);
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 });
  }
}
