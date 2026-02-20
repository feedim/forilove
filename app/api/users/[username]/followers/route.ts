import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .single();

  if (!profile) return NextResponse.json({ error: "Kullanici bulunamadi" }, { status: 404 });

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: follows } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", profile.user_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!follows || follows.length === 0) {
    return NextResponse.json({ users: [], hasMore: false });
  }

  const ids = follows.map(f => f.follower_id);
  const { data: users } = await supabase
    .from("profiles")
    .select("user_id, name, surname, full_name, username, avatar_url, is_verified, premium_plan, bio")
    .in("user_id", ids)
    .eq("status", "active");

  // Check which users the current user follows
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  let followingSet = new Set<string>();
  if (currentUser) {
    const { data: myFollows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUser.id)
      .in("following_id", ids);
    followingSet = new Set((myFollows || []).map(f => f.following_id));
  }

  const enrichedUsers = (users || []).map(u => ({
    ...u,
    is_following: followingSet.has(u.user_id),
    is_own: currentUser?.id === u.user_id,
  }));

  return NextResponse.json({
    users: enrichedUsers,
    hasMore: follows.length >= limit,
  });
}
