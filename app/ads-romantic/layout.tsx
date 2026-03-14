import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sevgiline Özel Sürpriz Sayfa Oluştur | Forilove",
  description: "Fotoğraflarınız, şarkınız ve özel mesajlarınızla sevgilinize unutulmaz bir dijital anı sayfası hazırlayın. 10 dakikada hazır, kod bilgisi gerektirmez.",
  keywords: [
    "sevgiliye sürpriz",
    "yıldönümü hediyesi",
    "romantik hediye",
    "sevgiliye hediye",
    "dijital anı sayfası",
    "sevgililer günü hediyesi",
    "doğum günü sürprizi",
    "özel web sayfası",
    "sevgiliye özel sayfa",
    "forilove",
  ],
  openGraph: {
    title: "Sevgiline Özel Sürpriz Sayfa Oluştur | Forilove",
    description: "Fotoğraflarınız, şarkınız ve mesajlarınızla sevgilinize unutulmaz bir sürpriz hazırlayın. 10 dakikada hazır.",
    url: "https://forilove.com/ads-romantic",
    siteName: "Forilove",
    type: "website",
    locale: "tr_TR",
    images: [
      {
        url: "https://forilove.com/og-romantic.jpg",
        width: 1200,
        height: 630,
        alt: "Forilove - Sevgiline özel sürpriz sayfa oluştur",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sevgiline Özel Sürpriz Sayfa Oluştur | Forilove",
    description: "Fotoğraflarınız, şarkınız ve mesajlarınızla sevgilinize unutulmaz bir sürpriz hazırlayın.",
    images: ["https://forilove.com/og-romantic.jpg"],
  },
  alternates: {
    canonical: "https://forilove.com/ads-romantic",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdsRomanticLayout({ children }: { children: React.ReactNode }) {
  return children;
}
