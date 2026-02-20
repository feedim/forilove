"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FeedimIcon } from "@/components/FeedimLogo";
import { useUser } from "@/components/UserContext";

const pageTitles: Record<string, string> = {
  "/dashboard": "Ana Sayfa",
  "/dashboard/explore": "Keşfet",
  "/dashboard/notifications": "Bildirimler",
  "/dashboard/bookmarks": "Kaydedilenler",
  "/dashboard/write": "Yeni Gönderi",
  "/dashboard/coins": "Bakiye",
  "/dashboard/coins/buy": "Jeton Satın Al",
  "/dashboard/security": "Güvenlik",
  "/dashboard/payment": "Jeton Satın Al",
  "/dashboard/subscription-payment": "Abonelik",
  "/dashboard/transactions": "İşlem Geçmişi",
  "/dashboard/withdrawal": "Ödeme Alma",
  "/dashboard/community-notes": "Topluluk",
};

interface ColumnHeaderProps {
  rightAction?: React.ReactNode;
  onBack?: () => void;
  customTitle?: string;
  scrollable?: boolean;
}

export default function ColumnHeader({ rightAction, onBack, customTitle, scrollable }: ColumnHeaderProps = {}) {
  const { user, isLoggedIn } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === "/dashboard";
  const isPublicContent = pathname.startsWith("/post/") || pathname.startsWith("/u/") || pathname.startsWith("/note/");
  const pageTitle = customTitle || pageTitles[pathname] || (pathname.startsWith("/post/") ? "Gönderi" : null) || (pathname.startsWith("/note/") ? "Not" : null) || (pathname.startsWith("/u/") ? "Profil" : null);

  const handleBack = onBack || (() => router.back());

  return (
    <header className={`${scrollable ? "" : "sticky top-0 md:relative"} z-50 bg-bg-primary`}>
      <nav className="relative flex items-center justify-between px-4 h-[53px]">
        {/* Left */}
        {isHome && !customTitle ? (
          <>
            <div className="md:hidden" />
            <Link href="/dashboard" aria-label="Feedim" className="md:hidden absolute left-1/2 -translate-x-1/2">
              <FeedimIcon className="h-14 w-14" />
            </Link>
            <h1 className="hidden md:block text-[1.35rem] sm:text-[1.25rem] font-bold">Ana Sayfa</h1>
          </>
        ) : (
          <div className="flex items-center gap-2.5">
            <button onClick={handleBack} className="i-btn !w-8 !h-8 text-text-primary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            {isPublicContent && (
              <Link href="/dashboard" aria-label="Feedim" className="shrink-0 md:hidden">
                <FeedimIcon className="h-10 w-10" />
              </Link>
            )}
            {pageTitle && (
              <>
                {isPublicContent && <div className="w-px h-5 bg-border-primary md:hidden" />}
                <h1 className="text-[1.35rem] sm:text-[1.25rem] font-bold">{pageTitle}</h1>
              </>
            )}
          </div>
        )}

        {/* Right */}
        <div className="flex items-center gap-2.5">
          <div id="header-right-slot" />
          {rightAction ? (
            <>{rightAction}</>
          ) : isHome && !customTitle ? (
            <div className="flex items-center gap-2.5 md:hidden">
            <Link href="/dashboard/profile">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <img className="default-avatar-auto w-8 h-8 rounded-full object-cover" alt="" />
              )}
            </Link>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
