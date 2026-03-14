import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dijital Davetiye Oluştur | Forilove",
  description: "Düğün, nişan, kına gecesi ve özel günleriniz için dijital davetiye oluşturun. Fotoğraf, müzik ve konum ekleyin, WhatsApp'tan paylaşın.",
  keywords: [
    "dijital davetiye",
    "online davetiye",
    "düğün davetiyesi",
    "nişan davetiyesi",
    "kına gecesi davetiyesi",
    "whatsapp davetiye",
    "davetiye oluştur",
    "ücretsiz davetiye",
    "forilove",
  ],
  openGraph: {
    title: "Dijital Davetiye Oluştur | Forilove",
    description: "Düğün, nişan ve özel günleriniz için dijital davetiye oluşturun. WhatsApp'tan kolayca paylaşın.",
    url: "https://forilove.com/ads-davetiye",
    siteName: "Forilove",
    type: "website",
    locale: "tr_TR",
    images: [
      {
        url: "https://forilove.com/og-davetiye.jpg",
        width: 1200,
        height: 630,
        alt: "Forilove - Dijital davetiye oluştur",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dijital Davetiye Oluştur | Forilove",
    description: "Düğün, nişan ve özel günleriniz için dijital davetiye oluşturun.",
    images: ["https://forilove.com/og-davetiye.jpg"],
  },
  alternates: {
    canonical: "https://forilove.com/ads-davetiye",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdsDavetiyeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
