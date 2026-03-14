"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Heart, ShoppingCart, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateBundlePrice } from "@/lib/bundle-price";
import { getActivePrice } from "@/lib/discount";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import TemplateCard from "@/components/TemplateCard";
import toast from "react-hot-toast";

interface BundleDetailClientProps {
  bundle: any;
}

export default function BundleDetailClient({ bundle }: BundleDetailClientProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const templates = (bundle.bundle_templates || [])
    .map((bt: any) => bt.templates)
    .filter(Boolean);

  const { totalOriginal, bundlePrice, savings } = calculateBundlePrice(templates);

  useEffect(() => {
    loadUserData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const u = session.user;
    setUser(u);

    const { data: profile } = await supabase
      .from("profiles")
      .select("coin_balance")
      .eq("user_id", u.id)
      .single();

    setCoinBalance(profile?.coin_balance ?? 0);

    // Kullanıcının sahip olduğu şablonları kontrol et
    const templateIds = templates.map((t: any) => t.id);
    if (templateIds.length > 0) {
      const { data: purchases } = await supabase
        .from("purchases")
        .select("template_id")
        .eq("user_id", u.id)
        .in("template_id", templateIds);

      setOwnedTemplateIds(
        new Set((purchases || []).map((p: any) => p.template_id))
      );
    }

    // Paket zaten satın alınmış mı?
    const { data: bundlePurchase } = await supabase
      .from("bundle_purchases")
      .select("id")
      .eq("user_id", u.id)
      .eq("bundle_id", bundle.id)
      .limit(1);

    if (bundlePurchase && bundlePurchase.length > 0) {
      setPurchased(true);
    }
  };

  // Kullanıcının henüz sahip olmadığı şablonlar için hesapla
  const newTemplates = templates.filter(
    (t: any) => !ownedTemplateIds.has(t.id)
  );
  const effectivePrice =
    newTemplates.length > 0
      ? calculateBundlePrice(newTemplates)
      : { totalOriginal: 0, bundlePrice: 0, savings: 0 };

  const allOwned = newTemplates.length === 0;

  const handlePurchase = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (allOwned || purchased) return;

    if (effectivePrice.bundlePrice > coinBalance) {
      toast.error("Yetersiz bakiye. Bakiye yükleyin.");
      router.push("/dashboard/coins");
      return;
    }

    setPurchasing(true);
    try {
      const res = await fetch("/api/purchase/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: bundle.id,
          couponCode: couponCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Satın alma başarısız");
        setPurchasing(false);
        return;
      }

      setCoinBalance(data.newBalance);
      setPurchased(true);
      // Tüm şablonları sahip olarak işaretle
      setOwnedTemplateIds(new Set(templates.map((t: any) => t.id)));
      toast.success(
        `Paket satın alındı! ${data.templatesUnlocked} şablon açıldı.`
      );
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <PublicHeader variant="back" backLabel="Paketler" />

      <main className="container mx-auto px-6 py-8 pb-24 md:pb-16">
        {/* Bundle Info */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-pink-500/10">
              <Package className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{bundle.name}</h1>
              <p className="text-sm text-zinc-500">
                {templates.length} şablon
              </p>
            </div>
          </div>

          {bundle.description && (
            <p className="text-zinc-400 mb-6">{bundle.description}</p>
          )}

          {/* Price Card */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-zinc-400">Toplam Değer</span>
              <span className="text-lg text-zinc-500 line-through">
                {totalOriginal}₺
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-pink-400">
                Paket Fiyatı (%20 İndirim)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-yellow-500">
                  {allOwned ? 0 : effectivePrice.bundlePrice}₺
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs text-pink-400">Tasarruf</span>
              <span className="text-sm text-pink-400 font-medium">
                {savings}₺
              </span>
            </div>

            {user && ownedTemplateIds.size > 0 && !allOwned && !purchased && (
              <p className="text-xs text-zinc-500 mb-4">
                Zaten sahip olduğunuz {ownedTemplateIds.size} şablon fiyattan
                düşüldü.
              </p>
            )}

            {user && !purchased && !allOwned && (
              <div className="mb-4">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Kupon kodu (opsiyonel)"
                  className="input-modern w-full text-sm"
                />
              </div>
            )}

            {purchased || allOwned ? (
              <div className="flex items-center justify-center gap-2 py-3 bg-pink-500/10 rounded-xl text-pink-400 font-medium">
                <Check className="h-5 w-5" />
                {purchased
                  ? "Bu paketi satın aldınız"
                  : "Tüm şablonlara zaten sahipsiniz"}
              </div>
            ) : (
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                {purchasing
                  ? "Satın alınıyor..."
                  : user
                  ? `Paketi Satın Al (${effectivePrice.bundlePrice}₺)`
                  : "Giriş Yap ve Satın Al"}
              </button>
            )}

            {user && !purchased && !allOwned && (
              <p className="text-xs text-zinc-500 text-center mt-2">
                Mevcut bakiye: {coinBalance}₺
              </p>
            )}
          </div>
        </div>

        {/* Templates in Bundle */}
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold mb-6">Paketteki Şablonlar</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template: any) => (
              <TemplateCard
                key={template.id}
                template={template}
                isPurchased={ownedTemplateIds.has(template.id)}
                isSaved={false}
                showSaveButton={false}
                showPrice={true}
                onClick={() => {
                  window.location.href = `/editor/${template.id}`;
                }}
                tags={(template.template_tags || [])
                  .map((tt: any) => tt.tags)
                  .filter(Boolean)}
              />
            ))}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
