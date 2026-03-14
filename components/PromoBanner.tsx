"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Gift, Copy, Check } from "lucide-react";

const PROMO_STORAGE_KEY = "forilove_pending_promo";
const PROMO_EXPIRY_KEY = "forilove_promo_expiry";
const PROMO_VALIDITY_MINUTES = 20;

function CountdownTimer({ expiresAt }: { expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, expiresAt - Date.now());
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("00:00");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className={`text-center ${expired ? "text-red-400" : "text-white"}`}>
      <div className="text-3xl font-mono font-bold tracking-widest">{timeLeft}</div>
      <p className="text-xs text-zinc-500 mt-1">{expired ? "Süre doldu" : "Kalan süre"}</p>
    </div>
  );
}

function MiniCountdown({ expiresAt }: { expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, expiresAt - Date.now());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <p className="text-xs font-mono font-bold text-pink-400">{timeLeft}</p>;
}

export default function PromoBanner() {
  const [modalData, setModalData] = useState<{ couponCode: string; discount: number; expiresAt: number } | null>(null);
  const [miniWidget, setMiniWidget] = useState<{ couponCode: string; expiresAt: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();
  const generating = useRef(false);

  useEffect(() => {
    const urlPromo = searchParams.get("promo");
    if (!urlPromo || !/^[a-zA-ZİŞĞÜÖÇışğüöç0-9]{3,20}$/.test(urlPromo)) return;
    if (generating.current) return;
    generating.current = true;

    const normalizedCode = urlPromo.toLocaleUpperCase('tr-TR');

    // URL'den promo parametresini temizle
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("promo");
      window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
    } catch {}

    const showWithDelay = (modalInfo: { couponCode: string; discount: number; expiresAt: number }) => {
      setTimeout(() => setModalData(modalInfo), 5000);
    };

    // Aynı promo için daha önce kod üretilmiş mi kontrol et
    const existingCode = localStorage.getItem(PROMO_STORAGE_KEY);
    const existingExpiry = localStorage.getItem(PROMO_EXPIRY_KEY);
    if (existingCode && existingExpiry && Date.now() < parseInt(existingExpiry)) {
      showWithDelay({
        couponCode: existingCode,
        discount: 0,
        expiresAt: parseInt(existingExpiry),
      });
      return;
    }

    // Yeni kupon kodu üret
    fetch("/api/promo/generate-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoCode: normalizedCode }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.valid && data.coupon_code) {
          const expiresAt = new Date(data.expires_at).getTime();

          localStorage.setItem(PROMO_STORAGE_KEY, data.coupon_code);
          localStorage.setItem(PROMO_EXPIRY_KEY, expiresAt.toString());

          showWithDelay({
            couponCode: data.coupon_code,
            discount: data.discount_percent,
            expiresAt,
          });
        }
      })
      .catch(() => {});
  }, [searchParams]);

  // promo-cleared dinle
  useEffect(() => {
    const handleCleared = () => setModalData(null);
    window.addEventListener("promo-cleared", handleCleared);
    return () => window.removeEventListener("promo-cleared", handleCleared);
  }, []);

  const handleCopy = () => {
    const code = modalData?.couponCode || miniWidget?.couponCode;
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    if (modalData) {
      setMiniWidget({ couponCode: modalData.couponCode, expiresAt: modalData.expiresAt });
    }
    setModalData(null);
  };

  if (!modalData && !miniWidget) return null;

  // Mini widget (sağ altta)
  if (!modalData && miniWidget) {
    if (Date.now() > miniWidget.expiresAt) {
      return null;
    }
    return (
      <button
        onClick={() => {
          setModalData({ couponCode: miniWidget.couponCode, discount: 0, expiresAt: miniWidget.expiresAt });
          setMiniWidget(null);
        }}
        className="fixed bottom-4 right-3 z-[9999] flex items-center gap-2.5 px-4 py-3 bg-zinc-900 border border-pink-500/30 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-pink-500/50 transition-all group"
      >
        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
          <Gift className="h-4 w-4 text-pink-500" />
        </div>
        <div className="text-left">
          <p className="text-[11px] text-zinc-400">İndirim kodun</p>
          <MiniCountdown expiresAt={miniWidget.expiresAt} />
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={closeModal}
      className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 sm:p-8 text-center animate-[slideUp_0.3s_ease-out]"
      >
        {/* İkon */}
        <div className="w-14 h-14 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
          <Gift className="h-7 w-7 text-pink-500" />
        </div>

        {/* Başlık */}
        <h3 className="text-xl font-bold mb-1 text-white">Daha fazla indirim!</h3>
        <p className="text-sm text-zinc-400 mb-5">
          {modalData!.discount > 0 ? `%${modalData!.discount} indirim kodun hazır.` : "İndirim kodun hazır."} Acele et, süre sınırlı!
        </p>

        {/* Geri sayım */}
        <div className="mb-5">
          <CountdownTimer expiresAt={modalData!.expiresAt} />
        </div>

        {/* Kod */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border-2 border-dashed border-pink-500/40 hover:border-pink-500/60 transition mb-5 group"
        >
          <span className="text-xl font-mono font-bold tracking-[0.3em] text-pink-400">
            {modalData!.couponCode}
          </span>
          {copied ? (
            <Check className="h-4 w-4 text-pink-400 shrink-0" />
          ) : (
            <Copy className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
          )}
        </button>

        <p className="text-[11px] text-zinc-500 mb-5">
          Satın alma sırasında kupon alanına yapıştır. {PROMO_VALIDITY_MINUTES} dakika geçerli.
        </p>

        {/* CTA */}
        <button
          onClick={() => { handleCopy(); closeModal(); }}
          className="btn-primary w-full py-3 text-sm font-semibold"
        >
          Tamam
        </button>

        <button
          onClick={closeModal}
          className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition"
        >
          Şimdi değil
        </button>
      </div>
    </div>
  );
}
