import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Şablonlar | Forilove",
  description:
    "Sevdikleriniz için özel olarak tasarlanmış romantik web sayfası şablonları. Yıldönümü, doğum günü ve özel günler için hazır tasarımlar.",
  keywords: ["şablon", "romantik sayfa şablonu", "sevgiliye özel tasarım", "web sayfası şablonu", "forilove şablonlar"],
  openGraph: {
    title: "Şablonlar | Forilove",
    description:
      "Sevdikleriniz için özel olarak tasarlanmış romantik web sayfası şablonları.",
    type: "website",
    locale: "tr_TR",
    siteName: "Forilove",
  },
  twitter: {
    card: "summary_large_image",
    title: "Şablonlar | Forilove",
    description: "Sevdikleriniz için özel olarak tasarlanmış romantik web sayfası şablonları.",
  },
};

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
