import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, target_id, reason, description } = await request.json();

  if (!type || !target_id || !reason) {
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  }

  if (!["post", "user", "comment"].includes(type)) {
    return NextResponse.json({ error: "Geçersiz şikayet türü" }, { status: 400 });
  }

  // Check for duplicate report
  const { data: existing } = await admin
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("content_type", type)
    .eq("content_id", Number(target_id))
    .single();

  if (existing) {
    return NextResponse.json({ error: "Bu içeriği zaten şikayet ettiniz" }, { status: 409 });
  }

  const { error } = await admin
    .from("reports")
    .insert({
      reporter_id: user.id,
      content_type: type,
      content_id: Number(target_id),
      reason,
      description: description?.trim().slice(0, 500) || null,
      status: "pending",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
