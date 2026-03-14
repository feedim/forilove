"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/pixels";

const ALL_EVENTS = [
  { name: "ViewContent", params: { content_name: "Test Template", content_type: "template" } },
  { name: "AddToCart", params: { content_type: "template", content_id: "test-123" } },
  { name: "AddToWishlist", params: { content_type: "template", content_id: "test-123" } },
  { name: "InitiateCheckout", params: { content_type: "product", value: 49.99, currency: "TRY" } },
  { name: "Purchase", params: { content_type: "product", value: 49.99, currency: "TRY" } },
  { name: "CompleteRegistration", params: {} },
  { name: "Lead", params: { content_name: "affiliate_application" } },
  { name: "Subscribe", params: { content_type: "product", content_id: "test-123" } },
  { name: "PlaceAnOrder", params: { content_type: "product", content_id: "test-123" } },
];

export default function PixelTestPage() {
  const [fired, setFired] = useState<string[]>([]);
  const [allFired, setAllFired] = useState(false);

  useEffect(() => {
    // PageView is already fired automatically by the global pixel in layout.tsx
    setFired(["PageView (auto)"]);
  }, []);

  const fireAll = () => {
    const results: string[] = ["PageView (auto)"];
    for (const event of ALL_EVENTS) {
      try {
        trackEvent(event.name, event.params);
        results.push(event.name);
      } catch {
        results.push(`${event.name} (FAIL)`);
      }
    }
    setFired(results);
    setAllFired(true);
  };

  const fireSingle = (event: typeof ALL_EVENTS[number]) => {
    trackEvent(event.name, event.params);
    setFired((prev) => [...prev, event.name]);
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "system-ui", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Facebook Pixel Test</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Pixel ID: <strong>1253812686725971</strong>
      </p>

      <button
        onClick={fireAll}
        style={{
          width: "100%",
          padding: "14px 24px",
          fontSize: 16,
          fontWeight: 600,
          color: "#fff",
          background: allFired ? "#16a34a" : "#ec4899",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        {allFired ? "Tum Eventler Tetiklendi!" : "Tum Eventleri Tetikle"}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {ALL_EVENTS.map((event) => (
          <button
            key={event.name}
            onClick={() => fireSingle(event)}
            style={{
              padding: "10px 16px",
              fontSize: 14,
              textAlign: "left",
              background: fired.includes(event.name) ? "#dcfce7" : "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {fired.includes(event.name) ? "✓" : "○"} {event.name}
          </button>
        ))}
      </div>

      <div style={{ background: "#f9fafb", padding: 16, borderRadius: 8, fontSize: 13 }}>
        <strong>Tetiklenen eventler:</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          {fired.map((e, i) => (
            <li key={i} style={{ color: "#16a34a" }}>{e}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 24, padding: 16, background: "#fef3c7", borderRadius: 8, fontSize: 13 }}>
        <strong>Nasil test edilir:</strong>
        <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          <li>Facebook Events Manager &gt; Test Events sekmesine git</li>
          <li>Website URL&apos;ine <code>https://www.forilove.com/pixel-test</code> yaz</li>
          <li>&quot;Open Website&quot; tikla</li>
          <li>Bu sayfada &quot;Tum Eventleri Tetikle&quot; butonuna tikla</li>
          <li>Facebook&apos;ta eventlerin gorunup gorunmedigini kontrol et</li>
        </ol>
      </div>
    </div>
  );
}
