import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ users: [] });

  // Get target profile
  const { data: target } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .single();
  if (!target || target.user_id === user.id) return NextResponse.json({ users: [] });

  // Get people the current user follows
  const { data: myFollowing } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  if (!myFollowing || myFollowing.length === 0) return NextResponse.json({ users: [] });
  const myFollowingIds = myFollowing.map(f => f.following_id);

  // Find who among my following also follows the target
  const { data: mutuals } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", target.user_id)
    .in("follower_id", myFollowingIds);

  if (!mutuals || mutuals.length === 0) return NextResponse.json({ users: [] });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, full_name, avatar_url, is_verified, premium_plan")
    .in("user_id", mutuals.map(m => m.follower_id));

  return NextResponse.json({ users: profiles || [] });
}
