"use client";

import { useEffect, useState } from "react";
import { Heart, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import CTASection from "@/components/CTASection";
import BundleCard from "@/components/BundleCard";

export default function PaketlerPage() {
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadBundles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBundles = async () => {
    try {
      const { data } = await supabase
        .from("bundles")
        .select(
          "id, name, slug, description, bundle_templates(template_id, templates(id, name, coin_price, discount_price, discount_expires_at, html_content))"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      setBundles(data || []);
    } catch (error) {
      console.error("Error loading bundles:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Forilove Şablon Paketleri",
            description:
              "Özel olarak seçilmiş şablon paketleri ile %20 indirim kazanın.",
            numberOfItems: bundles.length,
            itemListElement: bundles.map((bundle, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "Product",
                name: bundle.name,
                description: bundle.description,
              },
            })),
          }),
        }}
      />

      <div className="min-h-screen bg-black text-white">
        <PublicHeader variant="home" />

        {/* Hero Section */}
        <section className="pt-20 pb-12 border-b border-white/10">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl">
              <h1
                className="text-3xl sm:text-4xl font-bold mb-6"
                style={{ lineHeight: 1.2 }}
              >
                Şablon Paketleri
              </h1>
              <p className="text-lg text-zinc-400">
                Birden fazla şablonu bir arada alın, %20 indirimden yararlanın.
                Sevdikleriniz için daha fazla seçenek, daha uygun fiyat.
              </p>
            </div>
          </div>
        </section>

        {/* Bundles Grid */}
        <main className="container mx-auto px-6 py-16">
          {loading ? (
            <div className="flex justify-center py-20" aria-label="Yükleniyor">
              <Heart
                className="h-12 w-12 text-pink-500 fill-pink-500 animate-pulse"
                aria-hidden="true"
              />
            </div>
          ) : bundles.length === 0 ? (
            <div className="text-center py-20">
              <Package
                className="h-20 w-20 text-pink-500/30 mx-auto mb-6"
                aria-hidden="true"
              />
              <p className="text-xl text-zinc-400">
                Henüz paket eklenmedi.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {bundles.map((bundle) => (
                <BundleCard key={bundle.id} bundle={bundle} />
              ))}
            </div>
          )}
        </main>

        <CTASection />
        <PublicFooter />
      </div>
    </>
  );
}
