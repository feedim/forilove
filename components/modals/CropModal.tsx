"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface CropModalProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  /** width / height — default 16/9 */
  aspectRatio?: number;
  onCrop: (croppedDataUrl: string) => void;
}

export default function CropModal({
  open,
  onClose,
  imageSrc,
  aspectRatio = 16 / 9,
  onCrop,
}: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [mounted, setMounted] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Natural image size
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);

  // Drag state
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Pinch state
  const pinchDist = useRef(0);
  const pinchZoom = useRef(1);

  useEffect(() => { setMounted(true); }, []);

  // Reset state when new image
  useEffect(() => {
    if (open && imageSrc) {
      setZoom(1);
      setPos({ x: 0, y: 0 });
      setImgLoaded(false);
    }
  }, [open, imageSrc]);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setNaturalW(img.naturalWidth);
    setNaturalH(img.naturalHeight);
    setImgLoaded(true);
  }, []);

  // Compute the base scale so image covers the crop area
  const getCropAreaSize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { cw: 300, ch: 200 };
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    // Crop area fits inside container with some padding
    const pad = 20;
    const maxW = cw - pad * 2;
    const maxH = ch - pad * 2;
    let cropW: number, cropH: number;
    if (maxW / maxH > aspectRatio) {
      cropH = maxH;
      cropW = cropH * aspectRatio;
    } else {
      cropW = maxW;
      cropH = cropW / aspectRatio;
    }
    return { cw: cropW, ch: cropH };
  }, [aspectRatio]);

  // Clamp position
  const clampPos = useCallback(
    (x: number, y: number, z: number) => {
      if (!naturalW || !naturalH) return { x, y };
      const { cw, ch } = getCropAreaSize();
      // Image display size at zoom
      const imgAr = naturalW / naturalH;
      let dispW: number, dispH: number;
      if (imgAr > aspectRatio) {
        dispH = ch * z;
        dispW = dispH * imgAr;
      } else {
        dispW = cw * z;
        dispH = dispW / imgAr;
      }
      const maxX = Math.max(0, (dispW - cw) / 2);
      const maxY = Math.max(0, (dispH - ch) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [naturalW, naturalH, getCropAreaSize, aspectRatio]
  );

  // Mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const clamped = clampPos(dragStart.current.px + dx, dragStart.current.py + dy, zoom);
      setPos(clamped);
    };
    const handleMouseUp = () => { dragStart.current = null; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [open, zoom, clampPos]);

  // Touch drag + pinch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragStart.current = { x: t.clientX, y: t.clientY, px: pos.x, py: pos.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist.current = Math.hypot(dx, dy);
      pinchZoom.current = zoom;
    }
  }, [pos, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragStart.current) {
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.x;
      const dy = t.clientY - dragStart.current.y;
      const clamped = clampPos(dragStart.current.px + dx, dragStart.current.py + dy, zoom);
      setPos(clamped);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchDist.current > 0) {
        const newZoom = Math.max(1, Math.min(4, pinchZoom.current * (dist / pinchDist.current)));
        setZoom(newZoom);
        setPos(prev => clampPos(prev.x, prev.y, newZoom));
      }
    }
  }, [zoom, clampPos]);

  const handleTouchEnd = useCallback(() => {
    dragStart.current = null;
    pinchDist.current = 0;
  }, []);

  // Scroll zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    const newZoom = Math.max(1, Math.min(4, zoom + delta));
    setZoom(newZoom);
    setPos(prev => clampPos(prev.x, prev.y, newZoom));
  }, [zoom, clampPos]);

  // Crop using canvas
  const handleCrop = useCallback(() => {
    if (!imgRef.current || !naturalW || !naturalH) return;
    const { cw, ch } = getCropAreaSize();
    const imgAr = naturalW / naturalH;
    let dispW: number, dispH: number;
    if (imgAr > aspectRatio) {
      dispH = ch * zoom;
      dispW = dispH * imgAr;
    } else {
      dispW = cw * zoom;
      dispH = dispW / imgAr;
    }

    // Scale from display coords to natural coords
    const scaleX = naturalW / dispW;
    const scaleY = naturalH / dispH;

    // Center of display is (dispW/2, dispH/2), offset by pos
    const cropX = (dispW / 2 - pos.x - cw / 2) * scaleX;
    const cropY = (dispH / 2 - pos.y - ch / 2) * scaleY;
    const cropW = cw * scaleX;
    const cropH = ch * scaleY;

    const canvas = document.createElement("canvas");
    // Output at reasonable resolution
    const outputW = Math.min(cropW, 2048);
    const outputH = Math.min(cropH, 2048);
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(imgRef.current, cropX, cropY, cropW, cropH, 0, 0, outputW, outputH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCrop(dataUrl);
    onClose();
  }, [naturalW, naturalH, zoom, pos, getCropAreaSize, aspectRatio, onCrop, onClose]);

  if (!open || !mounted) return null;

  const { cw: cropW, ch: cropH } = getCropAreaSize();
  const imgAr = naturalW && naturalH ? naturalW / naturalH : 1;
  let dispW: number, dispH: number;
  if (imgAr > aspectRatio) {
    dispH = cropH * zoom;
    dispW = dispH * imgAr;
  } else {
    dispW = cropW * zoom;
    dispH = dispW / imgAr;
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={onClose}
          className="text-sm text-white/70 hover:text-white transition font-medium"
        >
          İptal
        </button>
        <span className="text-sm text-white font-semibold">Kırp</span>
        <button
          onClick={handleCrop}
          disabled={!imgLoaded}
          className="flex items-center gap-1.5 text-sm text-accent-main font-semibold disabled:opacity-40 transition"
        >
          <Check className="h-4 w-4" />
          Uygula
        </button>
      </div>

      {/* Crop area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Image */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            width: dispW,
            height: dispH,
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
            transition: dragStart.current ? "none" : "transform 0.1s ease-out",
          }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            onLoad={handleImgLoad}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Overlay mask — darkens outside crop */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/60"
            style={{ height: `calc(50% - ${cropH / 2}px)` }}
          />
          {/* Bottom */}
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/60"
            style={{ height: `calc(50% - ${cropH / 2}px)` }}
          />
          {/* Left */}
          <div
            className="absolute left-0 bg-black/60"
            style={{
              top: `calc(50% - ${cropH / 2}px)`,
              width: `calc(50% - ${cropW / 2}px)`,
              height: cropH,
            }}
          />
          {/* Right */}
          <div
            className="absolute right-0 bg-black/60"
            style={{
              top: `calc(50% - ${cropH / 2}px)`,
              width: `calc(50% - ${cropW / 2}px)`,
              height: cropH,
            }}
          />
          {/* Crop border */}
          <div
            className="absolute border-2 border-white/40 rounded-sm"
            style={{
              left: `calc(50% - ${cropW / 2}px)`,
              top: `calc(50% - ${cropH / 2}px)`,
              width: cropW,
              height: cropH,
            }}
          />
          {/* Grid lines */}
          <div
            className="absolute"
            style={{
              left: `calc(50% - ${cropW / 2}px)`,
              top: `calc(50% - ${cropH / 2}px)`,
              width: cropW,
              height: cropH,
            }}
          >
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-6 px-4 py-4 shrink-0">
        <button
          onClick={() => {
            const z = Math.max(1, zoom - 0.25);
            setZoom(z);
            setPos(prev => clampPos(prev.x, prev.y, z));
          }}
          className="p-2 text-white/60 hover:text-white transition"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <div className="w-32 h-1 bg-white/20 rounded-full relative">
          <div
            className="absolute h-1 bg-white rounded-full transition-all"
            style={{ width: `${((zoom - 1) / 3) * 100}%` }}
          />
        </div>
        <button
          onClick={() => {
            const z = Math.min(4, zoom + 0.25);
            setZoom(z);
            setPos(prev => clampPos(prev.x, prev.y, z));
          }}
          className="p-2 text-white/60 hover:text-white transition"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }}
          className="p-2 text-white/60 hover:text-white transition"
          title="Sıfırla"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
