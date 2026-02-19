import { Metadata } from "next";
import MobileBottomNav from "@/components/MobileBottomNav";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[1400px] mx-auto w-full">
      {children}
      <MobileBottomNav />
    </div>
  );
}
