import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-20 px-5 border-t border-white/5">
      <div className="max-w-2xl mx-auto text-center">
        <Heart className="h-12 w-12 text-pink-500 fill-pink-500 mx-auto mb-5 animate-pulse" />
        <h2 className="text-2xl font-bold mb-3">Bugün bir sürpriz yap</h2>
        <p className="text-sm text-zinc-400 mb-8">
          Binlerce kişi Forilove ile sevdiklerini mutlu etti. Sıra sende.
        </p>
        <Link href="/register" className="btn-primary text-base px-8 py-3.5 inline-flex items-center gap-2">
          Ücretsiz Kayıt Ol
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}
