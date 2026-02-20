"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import CTASection from "@/components/CTASection";
import TemplateCard from "@/components/TemplateCard";

const ITEMS_PER_PAGE = 6;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [tags, setTags] = useState<{ id: string; name: string; slug: string }[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadTemplates();
    loadTags();
  }, []);

  useEffect(() => {
    if (page > 0) {
      loadMoreTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadTemplates = async () => {
    try {
      const { data: templatesData } = await supabase
        .from("templates")
        .select("id, name, slug, coin_price, discount_price, discount_label, discount_expires_at, description, html_content, purchase_count, template_tags(tags(name, slug))")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("coin_price", { ascending: true })
        .order("purchase_count", { ascending: false, nullsFirst: false })
        .range(0, ITEMS_PER_PAGE - 1);

      setHasMore((templatesData?.length || 0) === ITEMS_PER_PAGE);
      setTemplates(templatesData || []);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await supabase
        .from("tags")
        .select("id, name, slug")
        .order("name");
      setTags(data || []);
    } catch (error) {
      console.error("Error loading tags:", error);
    }
  };

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadMoreTemplates = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const prevCount = templates.length;
    await new Promise(r => setTimeout(r, 1000));
    try {
      const start = page * ITEMS_PER_PAGE;
      const { data: templatesData } = await supabase
        .from("templates")
        .select("id, name, slug, coin_price, discount_price, discount_label, discount_expires_at, description, html_content, purchase_count, template_tags(tags(name, slug))")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("coin_price", { ascending: true })
        .order("purchase_count", { ascending: false, nullsFirst: false })
        .range(start, start + ITEMS_PER_PAGE - 1);

      setHasMore((templatesData?.length || 0) === ITEMS_PER_PAGE);
      setTemplates(prev => [...prev, ...(templatesData || [])]);

      // Scroll to first new card after render
      if (templatesData && templatesData.length > 0) {
        requestAnimationFrame(() => {
          const grid = loadMoreRef.current?.previousElementSibling;
          if (!grid) return;
          const newFirstCard = grid.children[prevCount] as HTMLElement;
          if (newFirstCard) {
            newFirstCard.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
    } catch (error) {
      console.error("Error loading more templates:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTemplateClick = (templateId: string) => {
    window.location.href = `/editor/${templateId}`;
  };

  return (
    <>
      {/* SEO Metadata in head */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Forilove Şablonları",
            "description": "Sevdikleriniz için özel olarak tasarlanmış romantik web sayfası şablonları. Yıldönümü, doğum günü ve özel günler için hazır tasarımlar.",
            "numberOfItems": templates.length,
            "itemListElement": templates.map((template, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "Product",
                "name": template.name,
                "description": template.description,
                "offers": {
                  "@type": "Offer",
                  "price": (template.coin_price || 0) / 10, // Convert coins to approximate TRY
                  "priceCurrency": "TRY"
                }
              }
            }))
          })
        }}
      />

      <div className="min-h-screen bg-black text-white">
        <PublicHeader variant="home" />

        {/* Hero Section */}
        <section className="pt-20 pb-12 border-b border-white/10">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-4xl font-bold mb-6" style={{ lineHeight: 1.2 }}>
                Sevgi Dolu Şablonlar
              </h1>
              <p className="text-lg text-zinc-400">
                Sevdikleriniz için özel olarak tasarlanmış profesyonel şablonlar. Yıldönümü, doğum günü ve özel günleriniz için hazır tasarımlar.
              </p>
            </div>
          </div>
        </section>

        {/* Tag Pills */}
        {tags.length > 0 && (
          <section className="container mx-auto px-6 pt-8">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="bg-white/10 hover:bg-white/15 rounded-full px-4 py-2 text-sm text-zinc-300 transition-colors"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Templates Grid */}
        <main className="container mx-auto px-6 py-16">
          {loading ? (
            <div className="flex justify-center py-20" aria-label="Yükleniyor">
              <Heart className="h-12 w-12 text-pink-500 fill-pink-500 animate-pulse" aria-hidden="true" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-20">
              <Heart className="h-20 w-20 text-pink-500/30 mx-auto mb-6" aria-hidden="true" />
              <p className="text-xl text-zinc-400">Henüz şablon eklenmedi.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <div key={template.id}>
                    <TemplateCard
                      template={template}
                      isPurchased={false}
                      isSaved={false}
                      showSaveButton={true}
                      showPrice={true}
                      onClick={() => handleTemplateClick(template.id)}
                      tags={(template.template_tags || []).map((tt: any) => tt.tags).filter(Boolean)}
                    />
                  </div>
                ))}
              </div>

              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center mt-12">
                  {loadingMore ? (
                    <Heart className="h-10 w-10 text-pink-500 fill-pink-500 animate-pulse" aria-hidden="true" />
                  ) : (
                    <button
                      onClick={() => setPage(p => p + 1)}
                      className="px-8 py-3 bg-white/10 hover:bg-white/15 text-white rounded-full font-medium transition active:scale-95"
                    >
                      Daha Fazla Gör
                    </button>
                  )}
                </div>
              )}
            </>
          )}

        </main>

        <CTASection />

        <PublicFooter />
      </div>
    </>
  );
}
