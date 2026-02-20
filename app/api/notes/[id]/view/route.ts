import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = Number(id);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ recorded: false });
    }

    const admin = createAdminClient();

    // Upsert — unique(note_id, viewer_id) ensures one view per user
    const { error } = await admin
      .from("note_views")
      .upsert(
        { note_id: noteId, viewer_id: user.id },
        { onConflict: "note_id,viewer_id", ignoreDuplicates: true }
      );

    if (error) {
      return NextResponse.json({ recorded: false });
    }

    return NextResponse.json({ recorded: true });
  } catch {
    return NextResponse.json({ recorded: false });
  }
}
