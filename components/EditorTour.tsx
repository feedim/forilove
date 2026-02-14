"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

interface TourStep {
  /** data-tour attribute on a parent-page element (null = iframe-based) */
  target: string | null;
  targetMobile: string | null;
  /** For iframe-based steps: selector to find inside iframe */
  iframeSelector?: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    target: null,
    targetMobile: null,
    iframeSelector: '[data-editable]:not([data-type="image"]):not([data-type="background-image"]):not([data-type="color"])',
    title: "Metni Düzenle",
    description: "Bir metne dokunarak düzenleyebilirsin. Açılan pencereden değiştir ve kaydet.",
  },
  {
    target: null,
    targetMobile: null,
    iframeSelector: '[data-editable][data-type="image"], [data-editable][data-type="background-image"]',
    title: "Görseli Değiştir",
    description: "Bir görsele dokunarak değiştirebilirsin. Galerinden veya kamerandan yükle.",
  },
  {
    target: "ai-fill",
    targetMobile: "ai-fill-mobile",
    title: "AI ile Doldur",
    description: "Tüm alanları yapay zeka ile otomatik doldur.",
  },
  {
    target: "music",
    targetMobile: "music-mobile",
    title: "Müzik Ekle",
    description: "Sayfana arka plan müziği ekle.",
  },
  {
    target: "preview-btn",
    targetMobile: "preview-btn-mobile",
    title: "Önizleme",
    description: "Sayfanın son halini tam ekran görüntüle.",
  },
  {
    target: "publish",
    targetMobile: "publish-mobile",
    title: "Yayınla",
    description: "Sayfanı yayınla ve sevdiklerinle paylaş!",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface EditorTourProps {
  onComplete: () => void;
}

export default function EditorTour({ onComplete }: EditorTourProps) {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ---- helpers ---- */

  /** Resolve the bounding rect for the current step's target element */
  const measureStep = useCallback(
    (step: TourStep): DOMRect | null => {
      // --- iframe-based target ---
      if (step.iframeSelector) {
        const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
        if (!iframe) return null;
        try {
          const iDoc = iframe.contentDocument;
          if (!iDoc) return null;
          const el = iDoc.querySelector(step.iframeSelector) as HTMLElement | null;
          if (!el) return null;
          const iframeRect = iframe.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          // Translate iframe-local coords to viewport coords
          return new DOMRect(
            iframeRect.left + elRect.left,
            iframeRect.top + elRect.top,
            elRect.width,
            elRect.height
          );
        } catch {
          return null;
        }
      }

      // --- normal data-tour target ---
      const attr = isMobile ? step.targetMobile : step.target;
      if (!attr) return null;
      const el = document.querySelector(`[data-tour="${attr}"]`) as HTMLElement | null;
      if (!el) return null;
      return el.getBoundingClientRect();
    },
    [isMobile]
  );

  const measure = useCallback(() => {
    setRect(measureStep(STEPS[current]));
  }, [current, measureStep]);

  /** Scroll a data-tour element into view (toolbar items) */
  const scrollTargetIntoView = useCallback(
    (step: TourStep) => {
      if (step.iframeSelector) return; // iframe elements don't need parent scroll
      const attr = isMobile ? step.targetMobile : step.target;
      if (!attr) return;
      const el = document.querySelector(`[data-tour="${attr}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    },
    [isMobile]
  );

  /* ---- effects ---- */

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // On step change: scroll into view + measure multiple times to catch animations
  useEffect(() => {
    scrollTargetIntoView(STEPS[current]);
    measure();
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [current, scrollTargetIntoView, measure]);

  // Re-measure on resize / scroll
  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  /* ---- actions ---- */

  const next = () => {
    if (current < STEPS.length - 1) setCurrent((c) => c + 1);
    else onComplete();
  };
  const skip = () => onComplete();

  /* ---- rendering calculations ---- */

  const PAD = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // Clip-path: punch a hole where the target is
  const clipPath = rect
    ? (() => {
        const x = Math.max(0, rect.left - PAD);
        const y = Math.max(0, rect.top - PAD);
        const x2 = Math.min(vw, rect.right + PAD);
        const y2 = Math.min(vh, rect.bottom + PAD);
        return `polygon(0% 0%, 0% 100%, ${x}px 100%, ${x}px ${y}px, ${x2}px ${y}px, ${x2}px ${y2}px, ${x}px ${y2}px, ${x}px 100%, 100% 100%, 100% 0%)`;
      })()
    : undefined;

  // Responsive tooltip width
  const tooltipW = isMobile ? Math.min(vw - 24, 280) : 300;
  const GAP = 12;
  const EST_H = 140; // estimated tooltip height

  const tooltipStyle: React.CSSProperties = { width: tooltipW };

  if (rect) {
    // Horizontal: center on target, clamp to viewport edges
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(12, Math.min(left, vw - tooltipW - 12));
    tooltipStyle.left = left;

    // Vertical: prefer below target, go above if not enough room
    const spaceBelow = vh - rect.bottom - PAD - GAP;
    const spaceAbove = rect.top - PAD - GAP;

    if (spaceBelow >= EST_H || spaceBelow >= spaceAbove) {
      tooltipStyle.top = Math.min(rect.bottom + PAD + GAP, vh - EST_H - 12);
    } else {
      tooltipStyle.bottom = Math.max(vh - rect.top + PAD + GAP, 12);
    }
  } else {
    // Fallback: center of screen
    tooltipStyle.top = "50%";
    tooltipStyle.left = "50%";
    tooltipStyle.transform = "translate(-50%, -50%)";
  }

  /* ---- JSX ---- */

  const overlay = (
    <div
      ref={overlayRef}
      className="fixed inset-0"
      style={{ zIndex: 99999 }}
      onClick={(e) => { if (e.target === overlayRef.current) next(); }}
    >
      {/* Dark overlay with spotlight hole */}
      <div
        className="absolute inset-0 bg-black/70"
        style={{ clipPath, transition: "clip-path 0.3s ease", pointerEvents: "none" }}
      />

      {/* Spotlight glow ring */}
      {rect && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.15), 0 0 20px rgba(255,255,255,0.05)",
            transition: "all 0.3s ease",
          }}
        />
      )}

      {/* Clickable area over spotlight */}
      {rect && (
        <div
          className="absolute cursor-pointer"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          onClick={next}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute bg-[#161616]/95 backdrop-blur-xl rounded-2xl p-4"
        style={{
          ...tooltipStyle,
          border: "1px solid rgba(255,255,255,0.08)",
          animation: "scaleIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-white font-bold text-[15px] mb-1">{STEPS[current].title}</h4>
        <p className="text-zinc-400 text-sm leading-relaxed mb-4">{STEPS[current].description}</p>

        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs font-medium">
            {current + 1}/{STEPS.length}
          </span>
          <div className="flex items-center gap-3">
            <button onClick={skip} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              Atla
            </button>
            <button onClick={next} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
              {current === STEPS.length - 1 ? "Bitir" : "İleri"}
              {current < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
