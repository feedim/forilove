"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ArrowRight, Star, ChevronDown, Sparkles, Eye, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/pixels";
import TemplateCard from "@/components/TemplateCard";
import { TemplateGridSkeleton } from "@/components/Skeletons";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

// --- Canlı izleyici ---
function useLiveViewers() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(Math.floor(Math.random() * 20) + 18);
    const id = setInterval(() => setCount((c) => Math.max(10, c + Math.floor(Math.random() * 5) - 2)), 5000);
    return () => clearInterval(id);
  }, []);
  return count;
}

// --- Bildirim popup ---
function useNotifications() {
  const entries = [
    { name: "Ayşe & Mehmet", title: "Düğünümüze davetlisiniz" },
    { name: "Fatma & Ali", title: "Nişanımıza bekleriz" },
    { name: "Zeynep & Can", title: "Kına gecemize davetlisiniz" },
    { name: "Elif & Burak", title: "Evleniyoruz!" },
    { name: "Selin & Emre", title: "Söz törenimize bekleriz" },
    { name: "Merve & Kerem", title: "Düğün davetiyemiz" },
    { name: "Gizem & Arda", title: "Nikahımıza davetlisiniz" },
    { name: "Büşra & Onur", title: "Nişan davetiyemiz" },
  ];
  const [notif, setNotif] = useState<{ name: string; title: string; show: boolean }>({ name: "", title: "", show: false });

  useEffect(() => {
    const show = () => {
      const entry = entries[Math.floor(Math.random() * entries.length)];
      setNotif({ ...entry, show: true });
      setTimeout(() => setNotif((n) => ({ ...n, show: false })), 4000);
    };
    const first = setTimeout(show, 6000);
    const interval = setInterval(show, 20000 + Math.random() * 10000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  return notif;
}

// --- Yorumlar ---
const reviews = [
  {
    name: "Fatma K.", city: "İstanbul", when: "3 gün önce",
    text: "Düğün davetiyemizi dijital yaptık, 300 kişiye WhatsApp'tan gönderdik. Herkes 'çok modern, çok güzel' dedi. Basılı davetiyeye binlerce lira vermek yerine bunu tercih ettik.",
  },
  {
    name: "Zeynep A.", city: "Ankara", when: "1 hafta önce",
    text: "Nişan davetiyemizi burada hazırladık. Fotoğraflarımızı, mekan bilgisini ekledik. Davetliler 'böyle davetiye ilk kez görüyorum' dedi.",
  },
  {
    name: "Selin M.", city: "İzmir", when: "2 gün önce",
    text: "Kına gecesi için hazırladım. Müzik ekleme özelliği harika — davetiyeyi açan herkes müziği duyunca çok beğendi. 10 dakikada hazırladım.",
  },
  {
    name: "Büşra T.", city: "Bursa", when: "5 gün önce",
    text: "Düğünümüze 2 ay kala basılı davetiye bastırmaya kalktık, fiyatları görünce vazgeçtik. Burada hem daha güzel hem bedavaya yakın oldu.",
  },
];

export default function AdsInvitationLanding() {
  const viewers = useLiveViewers();
  const notif = useNotifications();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [exitPopup, setExitPopup] = useState(false);
  const exitShown = useRef(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    trackEvent("ViewContent", { content_name: "Ads Invitation Landing", content_type: "product" });

    const loadTemplates = async () => {
      try {
        const { data: taggedData } = await supabase
          .from("template_tags")
          .select("templates(id, name, slug, coin_price, discount_price, discount_label, discount_expires_at, description, html_content, purchase_count, template_tags(tags(name, slug))), tags!inner(slug)")
          .eq("tags.slug", "davetiye")
          .limit(12);

        let filtered = (taggedData || []).map((t: any) => t.templates).filter(Boolean);

        if (filtered.length === 0) {
          const { data } = await supabase
            .from("templates")
            .select("id, name, slug, coin_price, discount_price, discount_label, discount_expires_at, description, html_content, purchase_count, template_tags(tags(name, slug))")
            .eq("is_active", true)
            .eq("is_public", true)
            .order("purchase_count", { ascending: false, nullsFirst: false })
            .limit(6);
          filtered = data || [];
        }

        const sorted = filtered.sort((a: any, b: any) => {
          const aFree = a.coin_price === 0 ? 0 : 1;
          const bFree = b.coin_price === 0 ? 0 : 1;
          if (aFree !== bFree) return aFree - bFree;
          return (b.purchase_count || 0) - (a.purchase_count || 0);
        }).slice(0, 6);
        setTemplates(sorted);
      } catch {}
      finally { setLoadingTemplates(false); }
    };
    loadTemplates();

    const handleExit = (e: MouseEvent) => {
      if (e.clientY < 5 && !exitShown.current) {
        exitShown.current = true;
        setExitPopup(true);
      }
    };
    document.addEventListener("mouseleave", handleExit);
    return () => document.removeEventListener("mouseleave", handleExit);
  }, []);

  const handleCTA = () => {
    trackEvent("Lead", { content_name: "invitation_landing_cta" });
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" role="main" lang="tr">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Dijital Davetiye Oluştur",
        description: "Düğün, nişan ve özel günleriniz için dijital davetiye oluşturun.",
        url: "https://forilove.com/ads-invitation",
        isPartOf: { "@id": "https://forilove.com/#website" },
        provider: {
          "@type": "Organization",
          name: "Forilove",
          url: "https://forilove.com",
        },
      }) }} />
      <PublicHeader variant="home" />

      {/* Bildirim popup */}
      <div className={`fixed bottom-4 left-4 z-[60] max-w-[300px] bg-zinc-900 border border-white/10 rounded-2xl p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-500 md:bottom-6 ${notif.show ? "translate-x-0 opacity-100" : "-translate-x-[120%] opacity-0"}`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-400 flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
            {notif.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-white font-semibold">{notif.name} sayfa yayınladı</p>
            <p className="text-[11px] text-pink-400 leading-snug truncate font-semibold">&ldquo;{notif.title}&rdquo;</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">az önce</p>
          </div>
          <Heart className="h-3.5 w-3.5 text-pink-500 fill-pink-500 shrink-0 mt-1" />
        </div>
      </div>

      {/* ===== HERO ===== */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center px-5 py-12 sm:py-16 -mt-[73px] pt-[73px] text-center" style={{ zIndex: 1 }}>

        {/* Sosyal kanıt badge */}
        <div className="relative flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-pink-500/10 border border-pink-500/30 mb-5">
          <Heart className="h-3.5 w-3.5 text-pink-500 fill-pink-500" />
          <span className="text-[11px] sm:text-xs font-medium text-pink-300">5.000+ davetiye oluşturuldu</span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span className="text-[10px] sm:text-[11px] text-zinc-400">{viewers} kişi çevrimiçi</span>
        </div>

        {/* Başlık */}
        <h1 className="relative font-extrabold leading-[1.1] mb-5 max-w-lg">
          <span className="text-[26px] sm:text-[40px]">Basılı davetiyeye binlerce lira verme,</span>
          <span className="block text-[36px] sm:text-[48px] text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400 mt-1">
            dijitalde oluştur.
          </span>
        </h1>

        {/* Alt yazı */}
        <p className="relative text-[15px] sm:text-lg text-zinc-400 mb-6 max-w-md leading-relaxed">
          Fotoğraflarınız, mekan bilgisi ve müzik tek bir davetiyede.
          <br />
          <span className="text-white font-medium">WhatsApp&apos;tan gönder, anında ulaşsın.</span>
        </p>

        {/* CTA */}
        <Link href="/register" onClick={handleCTA} className="relative group btn-primary text-lg px-10 py-4 hidden md:flex items-center gap-2" aria-label="Ücretsiz kayıt ol ve davetiye oluştur">
          Davetiye Oluştur
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </Link>

        <button onClick={() => templateRef.current?.scrollIntoView({ behavior: "smooth" })} className="absolute bottom-6 animate-bounce">
          <ChevronDown className="h-7 w-7 text-zinc-700" />
        </button>
      </section>

      {/* ===== ŞABLONLAR ===== */}
      <section ref={templateRef} className="border-t border-white/10 pt-24 pb-8">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Davetiye Şablonları</h2>
              <p className="text-zinc-400 text-lg">Birini seç, bilgilerini gir, gönder.</p>
            </div>

            {loadingTemplates ? (
              <TemplateGridSkeleton count={6} />
            ) : templates.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isPurchased={false}
                    isSaved={false}
                    showSaveButton={false}
                    showPrice={true}
                    onClick={() => router.push(`/editor/${template.id}`)}
                    tags={(template.template_tags || []).map((tt: any) => tt.tags).filter(Boolean)}
                  />
                ))}
              </div>
            ) : null}

            {!loadingTemplates && templates.length > 0 && (
              <div className="text-center mt-10">
                <Link href="/templates" className="btn-secondary px-8 py-3">
                  Tüm Şablonları Gör
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== NASIL ÇALIŞIR ===== */}
      <section className="py-16 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-10">3 adımda davetiye hazır</h2>
          <div className="space-y-0">
            {[
              { n: "1", t: "Şablon seç", d: "Düğün, nişan, kına, söz — etkinliğine uygun şablonu seç." },
              { n: "2", t: "Bilgileri gir", d: "Tarih, saat, mekan, fotoğraf ve müzik ekle." },
              { n: "3", t: "WhatsApp'tan gönder", d: "Linki kopyala, tüm davetlilere anında gönder." },
            ].map((s, i) => (
              <div key={i} className="flex gap-4 items-stretch">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-pink-500 flex items-center justify-center text-black font-bold text-sm shrink-0">{s.n}</div>
                  {i < 2 && <div className="w-px flex-1 bg-pink-500/20" />}
                </div>
                <div className="pb-7 pt-0.5">
                  <h3 className="text-sm font-bold mb-0.5">{s.t}</h3>
                  <p className="text-sm text-zinc-500">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== YORUMLAR ===== */}
      <section className="py-16 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-1 mb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            ))}
          </div>
          <p className="text-center text-xs text-zinc-500 mb-8">Kullanıcı yorumları</p>

          <div className="space-y-3">
            {reviews.map((r, i) => (
              <div key={i} className="bg-zinc-900/80 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center text-[10px] font-bold text-pink-400 shrink-0">
                    {r.name[0]}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold">{r.name}</span>
                    <span className="text-[10px] text-zinc-600 ml-1.5">{r.city} · {r.when}</span>
                  </div>
                </div>
                <p className="text-[13px] text-zinc-300 leading-relaxed">&ldquo;{r.text}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SSS ===== */}
      <section className="border-t border-white/10 py-24">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Sıkça Sorulan Sorular</h2>
            </div>

            <div className="space-y-3">
              {[
                { q: "Basılı davetiye yerine kullanılabilir mi?", a: "Evet! Birçok çift artık dijital davetiye tercih ediyor. Hem pratik hem çok daha uygun fiyatlı." },
                { q: "Kaç kişiye gönderebilirim?", a: "Sınırsız. Linki istediğin kadar kişiye gönderebilirsin. WhatsApp, Instagram, SMS — hepsi çalışır." },
                { q: "Müzik ekleyebilir miyim?", a: "Evet. Davetiye açıldığında arka planda müzik çalar." },
                { q: "Ne kadar sürede hazır olur?", a: "Ortalama 10 dakika. Şablon seç, bilgileri gir, paylaş." },
                { q: "İade var mı?", a: "Evet. 14 gün içinde iade edebilirsin." },
              ].map((faq, i) => (
                <div key={i} className="border border-white/5 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer"
                  >
                    <span className="font-medium">{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-zinc-500 shrink-0 ml-4 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-200"
                    style={{ maxHeight: openFaq === i ? "200px" : "0px", opacity: openFaq === i ? 1 : 0 }}
                  >
                    <p className="px-6 pb-4 text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <Heart className="h-12 w-12 text-pink-500 fill-pink-500 mx-auto mb-5 animate-pulse" />
          <h2 className="text-2xl font-bold mb-3">Bugün davetiyeni oluştur</h2>
          <p className="text-sm text-zinc-400 mb-8">Binlerce kişi Forilove ile dijital davetiye oluşturdu. Sıra sende.</p>
          <Link href="/register" onClick={handleCTA} className="btn-primary text-base px-8 py-3.5 inline-flex items-center gap-2">
            Ücretsiz Kayıt Ol <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
