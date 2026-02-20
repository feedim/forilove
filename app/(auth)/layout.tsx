import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Giriş Yap | Feedim",
  description: "Feedim hesabınıza giriş yapın veya yeni bir hesap oluşturun.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
