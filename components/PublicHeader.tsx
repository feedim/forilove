"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import DashboardNav from "@/components/DashboardNav";

interface PublicHeaderProps {
  variant?: "home" | "back";
  backLabel?: string;
}

export default function PublicHeader({ variant = "back", backLabel = "Geri" }: PublicHeaderProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setIsLoggedIn(!!session?.user);
    });
  }, []);

  // Giriş yapılmışsa tam dashboard nav göster
  if (isLoggedIn) {
    return (
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl">
        <DashboardNav />
      </header>
    );
  }

  return (
    <header>
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Forilove Ana Sayfa">
          <Heart className="h-7 w-7 text-pink-500 fill-pink-500" aria-hidden="true" />
          <span className="text-xl font-bold">Forilove</span>
        </Link>
        {variant === "home" ? (
          <div className="flex items-center gap-3">
            {isLoggedIn === null ? (
              <div className="w-24 h-10" />
            ) : (
              <Link href="/login" className="btn-secondary px-4 py-3 sm:px-8">
                Giriş Yap
              </Link>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={() => { if (window.history.length > 2) { router.back(); } else { router.push('/'); } }} className="flex items-center gap-2 text-zinc-400 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
              <span>{backLabel}</span>
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
