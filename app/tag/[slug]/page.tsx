import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import CTASection from "@/components/CTASection";
import TagTemplatesGrid from "./TagTemplatesGrid";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getTag(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

async function getTagTemplates(tagId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("template_tags")
    .select(
      "template_id, templates(id, name, slug, coin_price, discount_price, discount_label, discount_expires_at, description, html_content, purchase_count, template_tags(tags(name, slug)))"
    )
    .eq("tag_id", tagId);

  return (data || [])
    .map((row: any) => row.templates)
    .filter(Boolean);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTag(slug);
  if (!tag) return { title: "Etiket Bulunamadı" };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.forilove.com";

  return {
    title: `${tag.name} Şablonları - Forilove`,
    description: tag.description || `${tag.name} için özel olarak tasarlanmış şablonlar`,
    keywords: [tag.name, "şablon", "forilove", "özel gün", "hediye"],
    openGraph: {
      title: `${tag.name} Şablonları - Forilove`,
      description: tag.description || `${tag.name} için özel olarak tasarlanmış şablonlar`,
      url: `${baseUrl}/tag/${tag.slug}`,
      siteName: "Forilove",
      type: "website",
    },
    alternates: {
      canonical: `${baseUrl}/tag/${tag.slug}`,
    },
  };
}

export default async function EtiketPage({ params }: Props) {
  const { slug } = await params;
  const tag = await getTag(slug);
  if (!tag) notFound();

  const templates = await getTagTemplates(tag.id);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.forilove.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${tag.name} Şablonları`,
    description: tag.description,
    url: `${baseUrl}/tag/${tag.slug}`,
    numberOfItems: templates.length,
    itemListElement: templates.map((t: any, i: number) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: t.name,
        description: t.description,
        offers: {
          "@type": "Offer",
          price: (t.coin_price || 0) / 10,
          priceCurrency: "TRY",
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
                {tag.name} Şablonları
              </h1>
              {tag.description && (
                <p className="text-lg text-zinc-400">{tag.description}</p>
              )}
            </div>
          </div>
        </section>

        {/* Templates Grid */}
        <main className="container mx-auto px-6 py-16">
          <TagTemplatesGrid initialTemplates={templates} />
        </main>

        <CTASection />
        <PublicFooter />
      </div>
    </>
  );
}
