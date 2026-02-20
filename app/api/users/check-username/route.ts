import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) return NextResponse.json({ error: "Username gerekli" }, { status: 400 });

  const usernameRegex = /^(?!.*[._]{2})[A-Za-z0-9](?:[A-Za-z0-9._]{1,13})[A-Za-z0-9]$/;
  if (!usernameRegex.test(username)) {
    return NextResponse.json({ available: false, reason: "Geçersiz format" });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username.toLowerCase())
    .single();

  return NextResponse.json({ available: !data });
}
