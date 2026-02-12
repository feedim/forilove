import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HTMLTemplateRender } from "./HTMLTemplateRender";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forilove.com';

  const { data: project } = await supabase
    .from("projects")
    .select("title, slug, description, is_published, hook_values")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_published) {
    return { title: "Sayfa Bulunamadı - Forilove" };
  }

  const pageUrl = `${baseUrl}/p/${project.slug}`;
  const title = `${project.title} - Forilove`;
  const description = project.description || `${project.title} - Forilove ile oluşturuldu.`;

  // Extract first image URL from hook_values for OG thumbnail
  let ogImage = `${baseUrl}/icon.png`;
  const hookValues = (project.hook_values || {}) as Record<string, string>;
  for (const val of Object.values(hookValues)) {
    if (typeof val === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)/i.test(val)) {
      ogImage = val;
      break;
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "website",
      siteName: "Forilove",
      locale: "tr_TR",
      images: [{ url: ogImage, width: 1200, height: 630, alt: project.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function PublishedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Load project
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, slug, description, hook_values, is_published, music_url, view_count, templates(html_content, name)")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_published) {
    notFound();
  }

  // Increment view count (fire-and-forget — don't block page render)
  Promise.resolve(supabase.rpc('increment_view_count', {
    p_project_id: project.id
  })).catch(() => {});

  return <HTMLTemplateRender project={project} musicUrl={project.music_url} />;
}
