"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Coins, ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FeedimIcon } from "@/components/FeedimLogo";

const pageTitles: Record<string, string> = {
  "/dashboard/explore": "Keşfet",
  "/dashboard/notifications": "Bildirimler",
  "/dashboard/bookmarks": "Kaydedilenler",
  "/dashboard/write": "Yeni Gönderi",
  "/dashboard/coins": "Bakiye",
  "/dashboard/coins/buy": "Jeton Satın Al",
  "/dashboard/security": "Güvenlik",
  "/dashboard/payment": "Jeton Satın Al",
  "/dashboard/subscription-payment": "Abonelik",
  "/dashboard/withdrawal": "Ödeme Alma",
};

export default function DashboardHeader() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");
  const [coinBalance, setCoinBalance] = useState(0);
  const [scores, setScores] = useState<{ profile: number; spam: number; trust: number } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const pageTitle = pageTitles[pathname] || null;
  const isHome = pathname === "/dashboard";

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("name, surname, avatar_url, coin_balance, profile_score, spam_score, trust_level")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setAvatarUrl(data.avatar_url);
      setInitials(
        ((data.name?.[0] || "") + (data.surname?.[0] || "")).toUpperCase() || "U"
      );
      setCoinBalance(data.coin_balance || 0);
      setScores({
        profile: data.profile_score ?? 0,
        spam: data.spam_score ?? 0,
        trust: data.trust_level ?? 0,
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-bg-primary md:hidden">
      {/* DEBUG: Profile Score Banner */}
      {scores && (
        <div className="flex items-center justify-center gap-3 px-3 py-1.5 bg-accent-main/10 border-b border-accent-main/20 text-xs font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-accent-main" />
            <span className="text-text-muted">Profil:</span>
            <span className="font-bold text-accent-main">{scores.profile}</span>
          </span>
          <span className="text-border-primary">|</span>
          <span>
            <span className="text-text-muted">Spam:</span>
            <span className={`font-bold ml-1 ${scores.spam >= 40 ? "text-error" : scores.spam >= 20 ? "text-warning" : "text-success"}`}>{scores.spam}</span>
          </span>
          <span className="text-border-primary">|</span>
          <span>
            <span className="text-text-muted">Güven:</span>
            <span className="font-bold text-accent-main ml-1">L{scores.trust}</span>
          </span>
        </div>
      )}
      <nav className="flex items-center justify-between px-4 py-3">
        {/* Left: Logo or Back + Title */}
        {isHome ? (
          <Link href="/dashboard" aria-label="Feedim">
            <FeedimIcon className="h-7 w-7" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="i-btn !w-8 !h-8 text-text-muted hover:text-text-primary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            {pageTitle && (
              <h1 className="text-[0.95rem] font-semibold">{pageTitle}</h1>
            )}
          </div>
        )}

        {/* Right: Coin + Avatar */}
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/coins" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-secondary rounded-full border border-border-primary">
            <Coins className="h-4 w-4 text-accent-main" />
            <span className="text-sm font-semibold text-accent-main">{coinBalance.toLocaleString()}</span>
          </Link>
          <Link href="/dashboard/profile">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <img className="default-avatar-auto w-8 h-8 rounded-full object-cover" alt="" />
            )}
          </Link>
        </div>
      </nav>
    </header>
  );
}
