"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

interface TourStep {
  target: string;
  targetMobile: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    target: "preview",
    targetMobile: "preview",
    title: "Canlı Önizleme",
    description: "Düzenlemek istediğin alana dokun.",
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

interface EditorTourProps {
  onComplete: () => void;
}

export default function EditorTour({ onComplete }: EditorTourProps) {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [tooltipAbove, setTooltipAbove] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getTarget = useCallback(
    (step: TourStep) => {
      const attr = isMobile ? step.targetMobile : step.target;
      return document.querySelector(`[data-tour="${attr}"]`) as HTMLElement | null;
    },
    [isMobile]
  );

  const measure = useCallback(() => {
    const el = getTarget(STEPS[current]);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect(r);
    // If target is in the bottom half of viewport, show tooltip above
    setTooltipAbove(r.bottom > window.innerHeight * 0.65);
  }, [current, getTarget]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Measure on step change, resize, scroll
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Re-measure after a brief delay to catch layout shifts
  useEffect(() => {
    const t = setTimeout(measure, 100);
    return () => clearTimeout(t);
  }, [current, measure]);

  const next = () => {
    if (current < STEPS.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      onComplete();
    }
  };

  const skip = () => onComplete();

  // Padding around target element
  const PAD = 8;

  const clipPath = rect
    ? (() => {
        const x = Math.max(0, rect.left - PAD);
        const y = Math.max(0, rect.top - PAD);
        const x2 = Math.min(window.innerWidth, rect.right + PAD);
        const y2 = Math.min(window.innerHeight, rect.bottom + PAD);
        return `polygon(0% 0%, 0% 100%, ${x}px 100%, ${x}px ${y}px, ${x2}px ${y}px, ${x2}px ${y2}px, ${x}px ${y2}px, ${x}px 100%, 100% 100%, 100% 0%)`;
      })()
    : undefined;

  // Tooltip position
  const tooltipStyle: React.CSSProperties = {};
  if (rect) {
    const tooltipWidth = 300;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    // Clamp to viewport
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    tooltipStyle.left = left;
    tooltipStyle.width = tooltipWidth;

    if (tooltipAbove) {
      tooltipStyle.bottom = window.innerHeight - rect.top + PAD + 12;
    } else {
      tooltipStyle.top = rect.bottom + PAD + 12;
    }
  } else {
    // Fallback: center
    tooltipStyle.top = "50%";
    tooltipStyle.left = "50%";
    tooltipStyle.transform = "translate(-50%, -50%)";
    tooltipStyle.width = 300;
  }

  const overlay = (
    <div
      ref={overlayRef}
      className="fixed inset-0"
      style={{ zIndex: 99999 }}
      onClick={(e) => {
        // Clicking the overlay (dark area) advances to next
        if (e.target === overlayRef.current) next();
      }}
    >
      {/* Dark overlay with spotlight hole */}
      <div
        className="absolute inset-0 bg-black/70"
        style={{
          clipPath,
          transition: "clip-path 0.3s ease",
          pointerEvents: "none",
        }}
      />

      {/* Spotlight border glow */}
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

      {/* Clickable transparent area over the spotlight hole to capture clicks */}
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

      {/* Tooltip */}
      <div
        className="absolute bg-[#161616]/95 backdrop-blur-xl rounded-2xl p-4"
        style={{
          ...tooltipStyle,
          border: "1px solid rgba(255,255,255,0.08)",
          animation: "scaleIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-white font-bold text-base mb-1">{STEPS[current].title}</h4>
        <p className="text-zinc-400 text-sm leading-relaxed mb-4">{STEPS[current].description}</p>

        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs font-medium">
            {current + 1}/{STEPS.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={skip}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Atla
            </button>
            <button
              onClick={next}
              className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
            >
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
