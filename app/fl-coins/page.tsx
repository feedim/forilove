import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import CTASection from "@/components/CTASection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bakiye Sistemi - Forilove",
  description: "Forilove bakiye sistemi ile premium şablonlara erişin. Güvenli ödeme, bonus bakiye ve kalıcı kullanım hakkı. Bakiye sistemi hakkında detaylı bilgi.",
  keywords: ["bakiye", "premium şablon", "bakiye yükle", "bonus bakiye"],
};

export default function LPCoinsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: "Bakiye Sistemi - Forilove", description: "Forilove bakiye sistemi ile premium şablonlara erişin.", url: "https://forilove.com/fl-coins", isPartOf: { "@id": "https://forilove.com/#website" } }) }} />
      <PublicHeader variant="back" />

      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-6">Bakiye Sistemi</h1>

        <div className="space-y-6 text-zinc-400">
          <p>
            Forilove platformunda premium şablonlara erişim sağlamak için bakiye sistemi kullanılmaktadır.
            Hesabınıza TL cinsinden bakiye yükleyerek özel tasarlanmış şablonları kullanabilir ve sevdikleriniz için
            benzersiz sayfalar oluşturabilirsiniz.
          </p>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Nasıl Çalışır?</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Hesabınıza ₺ bakiye yükleyin</li>
              <li>Premium şablonları keşfedin</li>
              <li>Beğendiğiniz şablonu bakiyenizle satın alın</li>
              <li>Sınırsız kez kullanın ve düzenleyin</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Avantajlar</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Bonus bakiye fırsatları ile daha fazla kazanın</li>
              <li>Satın aldığınız şablonlar kalıcı olarak sizindir</li>
              <li>Güvenli ödeme altyapısı</li>
              <li>Anında kullanıma hazır</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Bakiye Paketleri</h2>
            <p>
              Farklı ihtiyaçlara uygun bakiye paketlerimiz bulunmaktadır. Daha büyük paketlerde
              bonus bakiye kazanabilirsiniz. Bakiye yüklemek için{" "}
              <Link href="/dashboard/coins" className="text-pink-500 hover:text-pink-400">
                buraya tıklayın
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Güvenli Ödeme</h2>
            <p>
              Tüm ödemeleriniz güvenli ödeme altyapımız üzerinden gerçekleştirilir. Kredi kartı
              bilgileriniz şifrelenir ve güvenli bir şekilde işlenir. Detaylı bilgi için{" "}
              <Link href="/payment-security" className="text-pink-500 hover:text-pink-400">
                ödeme güvenliği
              </Link>{" "}
              sayfamızı ziyaret edebilirsiniz.
            </p>
          </section>
        </div>
      </main>

      <CTASection />

      <PublicFooter />
    </div>
  );
}
