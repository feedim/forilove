import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { commentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: comment } = await supabase
    .from("comments")
    .select("id, author_id")
    .eq("id", commentId)
    .single();

  if (!comment) return NextResponse.json({ error: "Yorum bulunamadı" }, { status: 404 });
  if (comment.author_id !== user.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
