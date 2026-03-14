"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wallet } from "lucide-react";
import Link from "next/link";

export function CoinWallet() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('user_id', session.user.id)
        .single();

      setBalance(profile?.coin_balance || 0);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 rounded-lg animate-pulse" aria-label="Bakiye yükleniyor">
        <Wallet className="h-4 w-4 text-yellow-500" aria-hidden="true" />
        <span className="font-bold">...</span>
      </div>
    );
  }

  return (
    <Link href="/dashboard/coins" aria-label={`Bakiye: ${balance.toLocaleString()}₺`}>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg transition-all cursor-pointer group">
        <Wallet className="h-4 w-4 text-yellow-500" aria-hidden="true" />
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-bold text-yellow-500">{balance.toLocaleString()}</span>
          <span className="text-xs text-yellow-500 font-medium">₺</span>
        </div>
      </div>
    </Link>
  );
}
