"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { calculateBundlePrice } from "@/lib/bundle-price";

const PREVIEW_OVERRIDE =
  '<style>.fl-anim{opacity:1!important}body{overflow:hidden}</style>';

function injectPreviewCSS(html: string): string {
  if (html.includes("</head>"))
    return html.replace("</head>", PREVIEW_OVERRIDE + "</head>");
  return PREVIEW_OVERRIDE + html;
}

interface BundleTemplate {
  id?: string;
  name?: string;
  coin_price: number;
  discount_price?: number | null;
  discount_expires_at?: string | null;
  html_content?: string;
}

interface BundleCardProps {
  bundle: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    bundle_templates: { templates: BundleTemplate }[];
  };
}

/** Gerçek önizleme — sadece öndeki kartlar için (iframe) */
function MiniPreview({
  html,
  style,
  className,
}: {
  html: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [sanitized, setSanitized] = useState("");

  useEffect(() => {
    import("isomorphic-dompurify").then(({ default: DOMPurify }) => {
      const clean = DOMPurify.sanitize(html, {
        WHOLE_DOCUMENT: true,
        ADD_TAGS: ["style", "link"],
        ADD_ATTR: ["data-editable", "data-type", "data-label", "data-locked"],
      });
      setSanitized(injectPreviewCSS(clean));
    });
  }, [html]);

  return (
    <div
      className={`absolute overflow-hidden ${className || ""}`}
      style={{
        borderRadius: "14px",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#18181b",
        ...style,
      }}
    >
      {sanitized ? (
        <iframe
          srcDoc={sanitized}
          className="w-full h-full pointer-events-none scale-[0.25] origin-top-left"
          style={{ width: "400%", height: "400%" }}
          sandbox="allow-same-origin"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart className="h-6 w-6 text-pink-500/20" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/** Hafif placeholder — arkadaki kartlar için (iframe yok, sadece boş kutu) */
function PlaceholderCard({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`absolute overflow-hidden ${className || ""}`}
      style={{
        borderRadius: "14px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(145deg, #1e1e22 0%, #18181b 50%, #111114 100%)",
        ...style,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Heart className="h-5 w-5 text-pink-500/10" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Iskambil yelpazesi — kartlar iç içe geçecek şekilde yakın,
 * soldan sağa hafif açılır.
 */
function getFanTransforms(total: number) {
  const n = Math.min(total, 5);
  const CARD_W = 40;
  const CARD_H = 55;
  // Daha dar aralık — kartlar birbirine yakın
  const GAP = n <= 2 ? 14 : n <= 3 ? 10 : 8;
  const ANGLE_STEP = n <= 2 ? 6 : n <= 3 ? 5 : 4;
  const HOVER_EXTRA_GAP = 3;
  const HOVER_EXTRA_ANGLE = 1;

  const totalWidth = CARD_W + (n - 1) * GAP;
  const startLeft = (100 - totalWidth) / 2;
  const midIdx = (n - 1) / 2;

  return Array.from({ length: n }, (_, i) => {
    const angle = (i - midIdx) * ANGLE_STEP;
    const hoverAngle = (i - midIdx) * (ANGLE_STEP + HOVER_EXTRA_ANGLE);
    const left = startLeft + i * GAP;
    const hoverLeft =
      startLeft +
      i * (GAP + HOVER_EXTRA_GAP) -
      ((n - 1) * HOVER_EXTRA_GAP) / 2;
    const dist = Math.abs(i - midIdx);
    const yOffset = dist * dist * 1.5;

    return {
      base: {
        width: `${CARD_W}%`,
        height: `${CARD_H}%`,
        left: `${left}%`,
        bottom: `${30 - yOffset}%`,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "bottom center",
        zIndex: i + 1,
      } as React.CSSProperties,
      hover: {
        width: `${CARD_W}%`,
        height: `${CARD_H}%`,
        left: `${hoverLeft}%`,
        bottom: `${31 - yOffset}%`,
        transform: `rotate(${hoverAngle}deg)`,
        transformOrigin: "bottom center",
        zIndex: i + 1,
      } as React.CSSProperties,
    };
  });
}

export default function BundleCard({ bundle }: BundleCardProps) {
  const templates = bundle.bundle_templates
    .map((bt) => bt.templates)
    .filter(Boolean);

  const { totalOriginal, bundlePrice, savings } =
    calculateBundlePrice(templates);

  // Max 5 kart göster, sadece html_content olanları al
  const previews = templates.filter((t) => t.html_content).slice(0, 5);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fanData = getFanTransforms(previews.length);

  // Sadece öndeki 2 kart iframe alır, gerisine placeholder
  const IFRAME_LIMIT = 2;

  return (
    <Link href={`/paketler/${bundle.slug}`} className="group block">
      <div
        ref={cardRef}
        className="relative aspect-[3/4] overflow-hidden border border-white/10 hover:border-pink-500/30 transition-all cursor-pointer"
        style={{
          borderRadius: "29px",
          background:
            "linear-gradient(170deg, #0c0c0f 0%, #18181b 50%, #0c0c0f 100%)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Glow */}
        <div
          className="absolute transition-opacity duration-500"
          style={{
            width: "70%",
            height: "50%",
            left: "15%",
            bottom: "25%",
            background:
              "radial-gradient(ellipse, rgba(236,72,153,0.08) 0%, transparent 70%)",
            opacity: hovered ? 1 : 0.4,
          }}
        />

        {/* Fan of cards */}
        {isVisible && previews.length > 0
          ? previews.map((p, i) => {
              const isFront = i >= previews.length - IFRAME_LIMIT;
              const st = hovered
                ? fanData[i]?.hover
                : fanData[i]?.base;

              return isFront ? (
                <MiniPreview
                  key={p.id || i}
                  html={p.html_content!}
                  className="transition-all duration-500 ease-out"
                  style={st}
                />
              ) : (
                <PlaceholderCard
                  key={p.id || i}
                  className="transition-all duration-500 ease-out"
                  style={st}
                />
              );
            })
          : !isVisible ? null : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Heart
                  className="h-16 w-16 text-pink-500/20"
                  aria-hidden="true"
                />
              </div>
            )}

        {/* Discount Badge */}
        <div className="absolute top-4 left-4 z-20">
          <span
            className="text-white text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide"
            style={{
              background: "linear-gradient(135deg, #ec4899, #be185d)",
            }}
          >
            %20 İNDİRİM
          </span>
        </div>

        {/* Template count badge */}
        <div className="absolute top-4 right-4 z-20">
          <span className="bg-white/10 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
            {templates.length} şablon
          </span>
        </div>

        {/* Bottom Info */}
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-6 z-20"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)",
            paddingTop: "40%",
          }}
        >
          <h3 className="text-xl font-bold mb-1 truncate group-hover:text-pink-400 transition-colors">
            {bundle.name}
          </h3>
          {bundle.description && (
            <p className="text-sm text-zinc-400 mb-3 line-clamp-2">
              {bundle.description}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-zinc-500 line-through decoration-red-500/70 decoration-2">
              {totalOriginal}₺
            </span>
            <span className="text-3xl font-black text-yellow-500">
              {bundlePrice}₺
            </span>
            <div className="w-px h-7 bg-white/15 shrink-0" />
            <span className="text-xs text-pink-400 font-semibold">
              {savings}₺
              <br />
              tasarruf
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
