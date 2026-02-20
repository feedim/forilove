"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/UserContext";
import { useAuthModal } from "@/components/AuthModal";
import FollowButton from "@/components/FollowButton";
import { feedimAlert } from "@/components/FeedimAlert";

interface PostFollowButtonProps {
  authorUsername: string;
  authorUserId: string;
}

export default function PostFollowButton({ authorUsername, authorUserId }: PostFollowButtonProps) {
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);
  const { user: ctxUser, isLoggedIn } = useUser();
  const { requireAuth } = useAuthModal();

  const isOwn = ctxUser?.id === authorUserId;

  useEffect(() => {
    if (!isLoggedIn || !ctxUser || isOwn) { setReady(true); return; }

    const supabase = createClient();
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", ctxUser.id)
      .eq("following_id", authorUserId)
      .single()
      .then(({ data }) => {
        setFollowing(!!data);
        setReady(true);
      });
  }, [authorUserId, ctxUser, isLoggedIn, isOwn]);

  const handleFollow = async () => {
    const user = await requireAuth();
    if (!user) return;

    const wasFollowing = following;
    setFollowing(!wasFollowing);

    try {
      const res = await fetch(`/api/users/${authorUsername}/follow`, { method: "POST" });
      if (!res.ok) {
        setFollowing(wasFollowing);
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          feedimAlert("error", data.error || "Günlük takip limitine ulaştın.");
        }
      }
    } catch {
      setFollowing(wasFollowing);
    }
  };

  if (isOwn || !ready) return null;

  return <FollowButton following={following} onClick={handleFollow} />;
}
