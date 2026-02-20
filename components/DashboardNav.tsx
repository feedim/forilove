"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, ChevronDown, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CoinWallet } from "@/components/CoinWallet";

export default function DashboardNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [moreOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <nav className="w-full px-3 sm:px-6 lg:px-10 py-5 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="Forilove Ana Sayfa">
        <Heart className="h-7 w-7 text-pink-500 fill-pink-500" aria-hidden="true" />
        <span className="text-2xl font-bold">Forilove</span>
      </Link>
      <div className="flex items-center gap-1 lg:gap-3">
        <Link href="/dashboard/explore" className="hidden md:block text-zinc-400 hover:text-white px-3 py-2 transition font-semibold text-sm whitespace-nowrap">
          Keşfet
        </Link>
        <Link href="/dashboard/my-pages" className="hidden md:block text-zinc-400 hover:text-white px-3 py-2 transition font-semibold text-sm whitespace-nowrap">
          Sayfalarım
        </Link>
        <Link href="/dashboard/purchased" className="hidden md:block text-zinc-400 hover:text-white px-3 py-2 transition font-semibold text-sm whitespace-nowrap">
          Satın Alınanlar
        </Link>
        <Link href="/dashboard/profile" className="hidden md:block text-zinc-400 hover:text-white px-3 py-2 transition font-semibold text-sm whitespace-nowrap">
          Profil
        </Link>
        {/* Diğer dropdown */}
        <div ref={moreRef} className="relative hidden md:block">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex items-center gap-1 text-zinc-400 hover:text-white px-3 py-2 transition font-semibold text-sm whitespace-nowrap"
          >
            Diğer
            <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
              <Link href="/paketler" className="block px-4 py-3 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition" onClick={() => setMoreOpen(false)}>
                Paketler
              </Link>
              <Link href="/dashboard/saved" className="block px-4 py-3 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition" onClick={() => setMoreOpen(false)}>
                Kaydedilenler
              </Link>
              <Link href="/dashboard/transactions" className="block px-4 py-3 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition" onClick={() => setMoreOpen(false)}>
                İşlem Geçmişi
              </Link>
              <div className="border-t border-white/10">
                <button
                  onClick={() => { setMoreOpen(false); handleSignOut(); }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış Yap
                </button>
              </div>
            </div>
          )}
        </div>
        <Link href="/dashboard/profile" className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition" aria-label="Profil">
          <User className="h-5 w-5" />
        </Link>
        <div className="hidden md:block">
          <CoinWallet />
        </div>
      </div>
    </nav>
  );
}
