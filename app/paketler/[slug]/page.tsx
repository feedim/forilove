import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import BundleDetailClient from "./BundleDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: bundle } = await supabase
    .from("bundles")
    .select("name, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!bundle) return { title: "Paket Bulunamadı" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.forilove.com";

  return {
    title: `${bundle.name} - Şablon Paketi | Forilove`,
    description:
      bundle.description ||
      `${bundle.name} şablon paketi ile %20 indirimli fiyattan yararlanın.`,
    openGraph: {
      title: `${bundle.name} - Şablon Paketi`,
      description:
        bundle.description ||
        `${bundle.name} şablon paketi ile %20 indirimli fiyattan yararlanın.`,
      url: `${siteUrl}/paketler/${slug}`,
      siteName: "Forilove",
      type: "website",
    },
  };
}

export default async function BundleDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: bundle } = await supabase
    .from("bundles")
    .select(
      "id, name, slug, description, is_active, created_at, bundle_templates(template_id, templates(id, name, slug, coin_price, discount_price, discount_expires_at, description, html_content, purchase_count, template_tags(tags(name, slug))))"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!bundle) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.forilove.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bundle.name,
    description:
      bundle.description ||
      `${bundle.name} şablon paketi`,
    url: `${siteUrl}/paketler/${slug}`,
    offers: {
      "@type": "AggregateOffer",
      offerCount: bundle.bundle_templates.length,
      priceCurrency: "TRY",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BundleDetailClient bundle={bundle} />
    </>
  );
}
