import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap | Forilove",
  description:
    "Forilove hesabınıza giriş yapın veya yeni bir hesap oluşturun. Sevdikleriniz için özel romantik web sayfaları tasarlayın.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
