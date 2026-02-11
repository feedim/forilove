import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Şablonlar | Forilove",
  description:
    "Sevdikleriniz için özel olarak tasarlanmış romantik web sayfası şablonları. Yıldönümü, doğum günü ve özel günler için hazır tasarımlar.",
  openGraph: {
    title: "Şablonlar | Forilove",
    description:
      "Sevdikleriniz için özel olarak tasarlanmış romantik web sayfası şablonları.",
  },
};

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
