import type { Metadata } from "next";
import HelpContent from "./HelpContent";

export const metadata: Metadata = {
  title: "Yardım Merkezi - Feedim",
  description: "Feedim nasıl kullanılır? Sık sorulan sorular ve yardım rehberi.",
  keywords: ["feedim yardım", "nasıl kullanılır", "sss"],
};

export default function HelpPage() {
  return <HelpContent />;
}
