"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";

interface QRCodeModalProps {
  url: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

/* Inline heart SVG as data URI for QR center overlay */
const HEART_SVG = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23e30076"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
)}`;

export default function QRCodeModal({ url, title, isOpen, onClose }: QRCodeModalProps) {
  const prevOverflow = useRef("");

  useEffect(() => {
    if (!isOpen) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow.current;
    };
  }, [isOpen]);

  const handleDownload = useCallback(() => {
    const qrCanvas = document.querySelector<HTMLCanvasElement>("#qr-canvas canvas");
    if (!qrCanvas) return;

    const W = 1080;
    const H = 1920;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;

    /* ── Pink gradient background ── */
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#ff006e");
    grad.addColorStop(0.5, "#e30076");
    grad.addColorStop(1, "#b5005f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    /* ── Decorative blurred circles ── */
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(180, 340, 200, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(900, 1600, 250, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(850, 300, 120, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    /* ── White rounded card ── */
    const cardW = 680;
    const cardH = 640;
    const cardX = (W - cardW) / 2;
    const cardY = (H - cardH) / 2 - 40;
    const r = 48;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardW - r, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
    ctx.lineTo(cardX + cardW, cardY + cardH - r);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
    ctx.lineTo(cardX + r, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
    ctx.lineTo(cardX, cardY + r);
    ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
    ctx.closePath();
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    ctx.fill();
    ctx.shadowColor = "transparent";

    /* ── QR code inside card ── */
    const qrSize = 520;
    const qrX = (W - qrSize) / 2;
    const qrY = cardY + 60;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    /* ── Title above card ── */
    if (title) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 52px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      const maxTitleW = W - 120;
      const displayTitle = title.length > 30 ? title.slice(0, 30) + "…" : title;
      ctx.fillText(displayTitle, W / 2, cardY - 60, maxTitleW);
    }

    /* ── URL below card ── */
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "32px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    const shortUrl = url.replace(/^https?:\/\//, "");
    ctx.fillText(shortUrl, W / 2, cardY + cardH + 80, W - 120);

    /* ── forilove branding at bottom ── */
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("forilove.com", W / 2, H - 100);

    /* ── Download ── */
    const dataUrl = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "qr-kod.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [url, title]);

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: 360,
          background: "rgba(22,22,22,0.95)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderRadius: 24,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          animation: "scaleIn 0.2s ease-out",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>QR Kod</h3>
            {title && (
              <p
                style={{
                  margin: 0,
                  marginTop: 2,
                  fontSize: 14,
                  color: "#9ca3af",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 240,
                }}
              >
                {title}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 9999,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#9ca3af",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            id="qr-canvas"
            style={{
              width: 200,
              height: 200,
              borderRadius: 20,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
              boxSizing: "border-box",
            }}
          >
            <QRCodeCanvas
              value={url}
              size={800}
              level="H"
              marginSize={0}
              imageSettings={{
                src: HEART_SVG,
                x: undefined,
                y: undefined,
                height: 160,
                width: 160,
                excavate: true,
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 14,
            background: "#e30076",
            border: "none",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          QR Story İndir
        </button>

        {/* URL preview */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#9ca3af",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {url}
          </p>
        </div>
      </div>

      {/* Animation keyframe */}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
