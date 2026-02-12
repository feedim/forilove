"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface PaymentData {
  package_id: string;
  package_name: string;
  price: number;
  coins: number;
  bonus_coins: number;
}

export default function PaymentPage() {
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeUrl, setIframeUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const raw = sessionStorage.getItem("forilove_payment");
    if (!raw) {
      router.push("/dashboard/coins");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PaymentData;
      if (!parsed.package_id) {
        router.push("/dashboard/coins");
        return;
      }
      setData(parsed);
      initiatePayment(parsed.package_id);
    } catch {
      router.push("/dashboard/coins");
    }
  }, []);

  const initiatePayment = async (package_id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Giriş yapılmadı");
        router.push("/login");
        return;
      }

      const response = await fetch("/api/payment/payttr/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || "Ödeme başlatılamadı");
        toast.error(result.error || "Ödeme başlatılamadı");
        return;
      }

      if (result.payment_url) {
        sessionStorage.removeItem("forilove_payment");
        sessionStorage.setItem("forilove_payment_pending", "true");
        setIframeUrl(result.payment_url);
      } else {
        setError("Ödeme işlenemedi");
        toast.error("Ödeme işlenemedi");
      }
    } catch (err: any) {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      toast.error("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  if (!data && !error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Heart className="h-12 w-12 text-pink-500 fill-pink-500 animate-pulse" />
      </div>
    );
  }

  const totalCoins = data ? data.coins + data.bonus_coins : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px]">
        <nav className="container mx-auto px-3 sm:px-6 flex items-center justify-between min-h-[73px]">
          <button onClick={() => { if (window.history.length > 1) { router.back(); } else { router.push('/dashboard'); } }} className="flex items-center gap-2 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Geri</span>
          </button>
          <h1 className="text-lg font-semibold">Ödeme</h1>
          <div className="w-16" />
        </nav>
      </header>

      <main className="container mx-auto px-3 sm:px-6 pt-6 pb-24 md:pb-16 max-w-[520px]">
        {/* Order Summary */}
        {data && (
          <div className="bg-zinc-900 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">{data.package_name}</p>
                <p className="text-xl font-bold text-yellow-500">
                  {totalCoins.toLocaleString()} FL Coin
                </p>
                {data.bonus_coins > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    +{data.bonus_coins.toLocaleString()} bonus dahil
                  </p>
                )}
              </div>
              <p className="text-2xl font-bold">{data.price}₺</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Heart className="h-10 w-10 text-pink-500 fill-pink-500 animate-pulse" />
            <p className="text-gray-400 text-sm">Ödeme formu yükleniyor...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-zinc-900 rounded-2xl p-6 text-center space-y-4">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => { setError(""); setLoading(true); data && initiatePayment(data.package_id); }}
              className="btn-primary px-6 py-3"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* PayTR iFrame — kart bilgileri burada girilir */}
        {iframeUrl && (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white">
              <iframe
                src={iframeUrl}
                className="w-full border-0"
                style={{ minHeight: 520 }}
                allow="payment"
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Lock className="h-3.5 w-3.5" />
              <span>256-bit SSL + 3D Secure ile korunmaktadır</span>
            </div>

            <p className="text-center text-xs text-gray-500">
              Ödeme süresince sayfayı kapatmayın. Tamamlandığında otomatik yönlendirileceksiniz.
            </p>

            {/* Legal Links */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs font-semibold pt-2">
              <Link href="/payment-security" className="text-gray-500 hover:text-white transition">
                Ödeme Güvenliği
              </Link>
              <Link href="/refund-policy" className="text-gray-500 hover:text-white transition">
                İade Politikası
              </Link>
              <Link href="/distance-sales-contract" className="text-gray-500 hover:text-white transition">
                Mesafeli Satış Sözleşmesi
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
