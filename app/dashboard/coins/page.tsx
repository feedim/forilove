"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import TransactionCard from "@/components/TransactionCard";
import { CoinPageSkeleton } from "@/components/Skeletons";
import { trackEvent } from "@/lib/pixels";

// Tutar seçenekleri: 30-100 arası 10'ar, 100-1000 arası 20'şer
function getAmountSteps(): number[] {
  const steps: number[] = [];
  for (let i = 30; i <= 100; i += 10) steps.push(i);
  for (let i = 120; i <= 1000; i += 20) steps.push(i);
  return steps;
}

const AMOUNT_STEPS = getAmountSteps();

export default function CoinsPage() {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState(30);
  const [transactions, setTransactions] = useState<any[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }
      const user = session.user;

      const { data: profile } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('user_id', user.id)
        .single();

      setBalance(profile?.coin_balance || 0);

      // Load last 5 transactions
      const { data: txns } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setTransactions(txns || []);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  const sliderIndex = AMOUNT_STEPS.indexOf(selectedAmount);

  const purchaseCoins = () => {
    if (selectedAmount < 30 || selectedAmount > 1000) {
      toast.error("Geçersiz tutar");
      return;
    }

    if (balance + selectedAmount > 1000) {
      toast.error(`Maksimum bakiye limiti 1.000₺. Mevcut bakiyeniz: ${balance}₺`);
      return;
    }

    sessionStorage.setItem('forilove_payment', JSON.stringify({
      amount: selectedAmount,
    }));

    trackEvent('InitiateCheckout', { content_type: 'product', value: selectedAmount, currency: 'TRY' });
    router.push('/dashboard/payment');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px]">
          <nav className="container mx-auto px-3 sm:px-6 flex items-center justify-between min-h-[73px]">
            <div className="flex items-center gap-2"><ArrowLeft className="h-5 w-5" /><span className="font-medium">Geri</span></div>
            <h1 className="text-lg font-semibold">Bakiye Yükle</h1>
            <div className="w-16" />
          </nav>
        </header>
        <main className="container mx-auto px-3 sm:px-6 pt-16 pb-24 md:pb-16 max-w-[600px]">
          <CoinPageSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px]">
        <nav className="container mx-auto px-3 sm:px-6 flex items-center justify-between min-h-[73px]">
          <button onClick={() => { if (window.history.length > 1) { router.back(); } else { router.push('/dashboard'); } }} className="flex items-center gap-2 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Geri</span>
          </button>
          <h1 className="text-lg font-semibold">Bakiye Yükle</h1>
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <Wallet className="h-5 w-5 text-yellow-500" />
            <div className="flex items-baseline gap-0.5">
              <span className="font-bold text-yellow-500">{balance.toLocaleString()}</span>
              <span className="text-sm text-yellow-500 font-medium">₺</span>
            </div>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-3 sm:px-6 pt-16 pb-24 md:pb-16 max-w-xl">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <div className="text-5xl font-bold text-yellow-500">
              {selectedAmount}₺
            </div>
            <p className="text-sm text-zinc-400 font-semibold">Yüklenecek bakiye</p>
          </div>

          <input
            type="range"
            min="0"
            max={AMOUNT_STEPS.length - 1}
            step="1"
            value={sliderIndex >= 0 ? sliderIndex : 0}
            onChange={(e) => {
              const index = parseInt(e.target.value);
              setSelectedAmount(AMOUNT_STEPS[index]);
            }}
            className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-8
              [&::-webkit-slider-thumb]:h-8
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-yellow-500
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-moz-range-thumb]:w-8
              [&::-moz-range-thumb]:h-8
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-yellow-500
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-thumb]:shadow-lg"
          />


          <button
            onClick={purchaseCoins}
            disabled={balance + selectedAmount > 1000}
            className="btn-primary w-full py-3 sm:py-4 text-sm sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'var(--color-yellow-500)', color: 'black' }}
          >
            {balance + selectedAmount > 1000 ? 'Bakiye limiti aşılıyor' : 'Ödeme'}
          </button>

          <div className="text-center space-y-4 pt-8 border-t border-white/10">
            <p className="text-sm text-zinc-400">
              Premium şablonların kilidini açmak için bakiye kullanın
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm">
              <Link href="/fl-coins" className="text-zinc-400 hover:text-white transition">
                Bakiye Hakkında
              </Link>
              <Link href="/payment-security" className="text-zinc-400 hover:text-white transition">
                Ödeme Güvenliği
              </Link>
              <Link href="/refund-policy" className="text-zinc-400 hover:text-white transition">
                İade Politikası
              </Link>
            </div>
          </div>

          {/* Recent Transactions */}
          {transactions.length > 0 && (
            <div className="pt-8 border-t border-white/5">
              <div className="space-y-4">
                {transactions.map((txn) => (
                  <TransactionCard key={txn.id} transaction={txn} />
                ))}
              </div>
            </div>
          )}

          {/* İşlem Geçmişi Link */}
          <div className="pt-6 text-center">
            <Link href="/dashboard/transactions">
              <button className="btn-secondary px-6 py-3">
                İşlem Geçmişi
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
