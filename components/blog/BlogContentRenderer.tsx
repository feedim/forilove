"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TemplateCard from "@/components/TemplateCard";
import BundleCard from "@/components/BundleCard";

type Segment =
  | { type: "html"; html: string }
  | { type: "template"; id: string }
  | { type: "bundle"; slug: string };

const EMBED_REGEX = /<!--\s*embed:(template|bundle):([^\s]+)\s*-->/g;

function parseContent(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(EMBED_REGEX)) {
    const before = content.slice(lastIndex, match.index);
    if (before) segments.push({ type: "html", html: before });

    if (match[1] === "template") {
      segments.push({ type: "template", id: match[2] });
    } else {
      segments.push({ type: "bundle", slug: match[2] });
    }
    lastIndex = match.index! + match[0].length;
  }

  const rest = content.slice(lastIndex);
  if (rest) segments.push({ type: "html", html: rest });

  return segments;
}

export default function BlogContentRenderer({ content }: { content: string }) {
  const segments = parseContent(content);
  const hasEmbeds = segments.some((s) => s.type !== "html");

  if (!hasEmbeds) {
    return (
      <article
        className="prose-blog"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <article className="prose-blog">
      {segments.map((seg, i) => {
        if (seg.type === "html") {
          return (
            <div
              key={i}
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          );
        }
        if (seg.type === "template") {
          return <EmbeddedTemplate key={i} templateId={seg.id} />;
        }
        return <EmbeddedBundle key={i} bundleSlug={seg.slug} />;
      })}
    </article>
  );
}

function EmbeddedTemplate({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("templates")
      .select("id, name, coin_price, discount_price, discount_expires_at, html_content, slug, preview_url, view_count")
      .eq("id", templateId)
      .single()
      .then(({ data }: { data: any }) => {
        setTemplate(data);
        setLoading(false);
      });
  }, [templateId]);

  if (loading) {
    return (
      <div className="my-6 h-64 rounded-2xl bg-zinc-800 animate-pulse" />
    );
  }

  if (!template) return null;

  return (
    <div className="my-6 max-w-sm mx-auto">
      <TemplateCard
        template={template}
        showPrice
        onClick={() => {
          window.location.href = `/templates`;
        }}
      />
    </div>
  );
}

function EmbeddedBundle({ bundleSlug }: { bundleSlug: string }) {
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("bundles")
      .select(
        "id, name, slug, description, bundle_templates(template_id, templates(id, name, coin_price, discount_price, discount_expires_at, html_content))"
      )
      .eq("slug", bundleSlug)
      .eq("is_active", true)
      .single()
      .then(({ data }: { data: any }) => {
        setBundle(data);
        setLoading(false);
      });
  }, [bundleSlug]);

  if (loading) {
    return (
      <div className="my-6 h-64 rounded-2xl bg-zinc-800 animate-pulse" />
    );
  }

  if (!bundle) return null;

  return (
    <div className="my-6 max-w-md mx-auto">
      <BundleCard bundle={bundle} />
    </div>
  );
}
