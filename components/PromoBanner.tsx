"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Percent } from "lucide-react";

const PROMO_STORAGE_KEY = "forilove_pending_promo";
const PROMO_INFO_KEY = "forilove_promo_info";

export default function PromoBanner() {
  const [promoInfo, setPromoInfo] = useState<{ code: string; discount: number } | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const init = async () => {
      // 1. Check URL for ?promo=CODE
      const urlPromo = searchParams.get("promo");
      if (urlPromo && /^[a-zA-Z0-9]{3,20}$/.test(urlPromo)) {
        // Save to localStorage immediately
        localStorage.setItem(PROMO_STORAGE_KEY, urlPromo);
        // Validate via API
        try {
          const res = await fetch(`/api/promo/check?code=${urlPromo}`);
          const data = await res.json();
          if (data.valid) {
            const info = { code: urlPromo, discount: data.discount_percent };
            localStorage.setItem(PROMO_INFO_KEY, JSON.stringify(info));
            setPromoInfo(info);
          } else {
            // Invalid promo - clean up
            localStorage.removeItem(PROMO_STORAGE_KEY);
            localStorage.removeItem(PROMO_INFO_KEY);
          }
        } catch {
          // Network error - still keep the code, just don't show banner
        }
        return;
      }

      // 2. No URL param - check localStorage for existing promo
      const stored = localStorage.getItem(PROMO_INFO_KEY);
      if (stored) {
        try {
          const info = JSON.parse(stored);
          if (info.code && info.discount) {
            setPromoInfo(info);
          }
        } catch {
          localStorage.removeItem(PROMO_INFO_KEY);
        }
      }
    };
    init();
  }, [searchParams]);

  if (!promoInfo) return null;

  return (
    <div className="w-full bg-pink-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 z-50 relative">
      <Percent className="h-3.5 w-3.5" />
      <span>%{promoInfo.discount} indirim kodu uygulandı!</span>
    </div>
  );
}
