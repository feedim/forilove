"use client";

import { useState } from "react";
import { Gift, Send, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const QUICK_AMOUNTS = [10, 25, 50, 100];

export default function GiftSection({
  userId,
  coinBalance,
  onSent,
}: {
  userId: string;
  coinBalance: number;
  onSent?: (amount: number) => void;
}) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [sending, setSending] = useState(false);

  const numericAmount = typeof amount === "number" ? amount : 0;
  const insufficientBalance = numericAmount > coinBalance;

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error("Lütfen bir e-posta adresi girin.");
      return;
    }
    if (!numericAmount || numericAmount < 1) {
      toast.error("Lütfen geçerli bir miktar girin.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), amount: numericAmount }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Bir hata oluştu.");
        return;
      }

      toast.success(`${numericAmount} FL başarıyla gönderildi!`);
      onSent?.(numericAmount);
      setEmail("");
      setAmount("");
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSending(false);
    }
  };

  return (
    <details className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 rounded-xl border border-pink-500/20 group">
      <summary className="flex items-center justify-between p-4 sm:p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3 text-left min-w-0">
          <div className="p-2 bg-pink-500/20 rounded-lg shrink-0">
            <Gift className="h-6 w-6 text-pink-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg">Hediye Gönder</h3>
            <p className="text-sm text-zinc-400">
              Sevdiklerine FL bakiye hediye et
            </p>
          </div>
        </div>
        <svg
          className="h-5 w-5 text-zinc-400 transition-transform group-open:rotate-180 shrink-0 ml-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>

      <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4">
        {/* Bakiye */}
        <div className="bg-black/20 rounded-lg p-3 sm:p-4 flex items-center justify-between">
          <span className="text-sm text-zinc-400">Mevcut Bakiye</span>
          <span className="text-lg font-bold text-yellow-500">
            {coinBalance} <span className="text-sm">FL</span>
          </span>
        </div>

        {/* E-posta */}
        <div className="bg-black/20 rounded-lg p-3 sm:p-4">
          <label className="block text-sm text-zinc-400 mb-2">
            Alıcı E-posta
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@email.com"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 sm:px-4 py-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>

        {/* Miktar */}
        <div className="bg-black/20 rounded-lg p-3 sm:p-4">
          <label className="block text-sm text-zinc-400 mb-2">
            Miktar (FL)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  amount === q
                    ? "bg-pink-500 text-white"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {q} FL
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => {
              const v = e.target.value;
              setAmount(v === "" ? "" : Math.max(1, parseInt(v, 10) || 0));
            }}
            placeholder="Farklı miktar girin"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 sm:px-4 py-3 text-sm text-white placeholder:text-zinc-600"
          />
        </div>

        {/* Yetersiz bakiye uyarısı */}
        {insufficientBalance && numericAmount > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4 text-sm text-red-400 flex items-center justify-between">
            <span>Yetersiz bakiye.</span>
            <Link
              href="/dashboard/coins"
              className="text-pink-500 font-semibold hover:text-pink-400 transition"
            >
              Bakiye Yükle
            </Link>
          </div>
        )}

        {/* Gönder */}
        <button
          onClick={handleSend}
          disabled={
            sending || !email.trim() || !numericAmount || insufficientBalance
          }
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {sending ? "Gönderiliyor..." : "Gönder"}
        </button>
      </div>
    </details>
  );
}
