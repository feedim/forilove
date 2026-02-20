"use client";

import { UserPlus, Check } from "lucide-react";

interface FollowButtonProps {
  following: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** "default" = Takip Et/Takip, "profile" = Takip Et/Takip Ediliyor, "tag" = Takip Et/Takipte */
  variant?: "default" | "profile" | "tag";
  className?: string;
}

const TEXT_MAP = {
  default: { follow: "Takip Et", following: "Takip" },
  profile: { follow: "Takip Et", following: "Takip Ediliyor" },
  tag: { follow: "Takip Et", following: "Takipte" },
};

export default function FollowButton({
  following,
  onClick,
  disabled,
  variant = "default",
  className = "",
}: FollowButtonProps) {
  const texts = TEXT_MAP[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`follow-btn ${following ? "following" : ""} ${className}`}
    >
      {following ? (
        <><Check className="h-3.5 w-3.5" /> {texts.following}</>
      ) : (
        <><UserPlus className="h-3.5 w-3.5" /> {texts.follow}</>
      )}
    </button>
  );
}
