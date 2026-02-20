"use client";

import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import { X } from "lucide-react";
import { getCroppedImageBlob, type Area } from "@/lib/utils/cropImage";

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export default function ImageCropModal({ isOpen, imageSrc, onConfirm, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setProcessing(false);
    }
  }, [isOpen, imageSrc]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onCancel}
      >
        {/* Modal Content */}
        <div
          className="bg-[#161616]/85 backdrop-blur-2xl w-full sm:w-[500px] rounded-t-3xl sm:rounded-4xl p-5 space-y-4 animate-slide-up sm:animate-scale-in max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-white">Görseli Kırp</h3>
              <p className="text-xs text-zinc-400">Kaydır ve yakınlaştır</p>
            </div>
            <button
              onClick={onCancel}
              aria-label="Kapat"
              className="rounded-full p-2 bg-white/10 text-zinc-400 hover:text-white hover:bg-white/15 transition-all"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Crop Area */}
          <div className="relative w-full h-[180px] sm:h-[220px] rounded-2xl overflow-hidden bg-black shrink-0">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-zinc-500 shrink-0">1x</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="crop-zoom-slider flex-1"
            />
            <span className="text-[11px] text-zinc-500 shrink-0">3x</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2 shrink-0">
            <button onClick={onCancel} className="flex-1 btn-secondary py-3">
              İptal
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing || !croppedAreaPixels}
              className="flex-1 btn-primary py-3"
            >
              {processing ? "Kırpılıyor..." : "Onayla"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
