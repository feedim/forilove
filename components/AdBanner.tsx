"use client";

import { useUser } from "@/components/UserContext";

type AdSlot = "feed" | "post-detail" | "post-bottom" | "explore" | "sidebar";
type AdSize = "leaderboard" | "rectangle" | "banner";

interface AdBannerProps {
  slot: AdSlot;
  size?: AdSize;
  className?: string;
}

const sizeMap: Record<AdSize, { width: number; height: number }> = {
  leaderboard: { width: 728, height: 90 },
  rectangle: { width: 336, height: 280 },
  banner: { width: 468, height: 60 },
};

export default function AdBanner({ slot, size = "banner", className = "" }: AdBannerProps) {
  const { user, isLoggedIn } = useUser();

  // Premium subscribers (basic, pro, max) see no ads
  if (user?.isPremium) return null;

  const dimensions = sizeMap[size];

  return (
    <div
      className={`ad-container flex items-center justify-center mx-auto overflow-hidden ${className}`}
      data-ad-slot={slot}
      data-ad-size={size}
      data-ad-user={isLoggedIn ? "free" : "guest"}
      style={{ maxWidth: dimensions.width, minHeight: dimensions.height }}
    >
      {/* AdSense script will be injected here */}
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: dimensions.height }}
        data-ad-client=""
        data-ad-slot=""
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

interface FeedAdProps {
  index: number;
}

/**
 * Use between feed posts. Shows ads at different intervals:
 * - Guests: every 3rd post
 * - Free users: every 5th post
 * - Premium: never
 */
export function FeedAdSlot({ index }: FeedAdProps) {
  const { user, isLoggedIn } = useUser();

  if (user?.isPremium) return null;

  const interval = isLoggedIn ? 5 : 3;
  if ((index + 1) % interval !== 0) return null;

  return <AdBanner slot="feed" size="banner" className="my-3 px-3" />;
}
