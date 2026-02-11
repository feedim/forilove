"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, Menu, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import DOMPurify from "isomorphic-dompurify";
import toast from "react-hot-toast";

export default function NewŞablonPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coinPrice, setCoinPrice] = useState(100);
  const [htmlContent, setHtmlContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAITopic] = useState('');
  const [aiDetails, setAIDetails] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Set panel closed on mobile by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && leftPanelOpen) {
        setLeftPanelOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    // Auto-update preview
    setPreviewHtml(htmlContent);
  }, [htmlContent]);

  useEffect(() => {
    if (name) {
      const autoSlug = name
        .toLowerCase()
        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g')
        .replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
        .replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 40);
      setSlug(autoSlug);
    }
  }, [name]);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!profile || (profile.role !== "creator" && profile.role !== "admin")) {
        toast.error("Bu sayfaya erişim yetkiniz yok");
        router.push("/dashboard");
        return;
      }

      setUserRole(profile.role);
    } catch (error) {
      console.error(error);
      router.push("/dashboard");
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    const trimmedDesc = description.trim();

    // Client-side validation
    if (!trimmedName || trimmedName.length < 2) {
      toast.error("Sablon adi en az 2 karakter olmali");
      return;
    }
    if (trimmedName.length > 60) {
      toast.error("Sablon adi en fazla 60 karakter olabilir");
      return;
    }
    if (trimmedSlug.length < 5) {
      toast.error("Slug en az 5 karakter olmali");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      toast.error("Slug sadece kucuk harf, rakam ve tire icermelidir");
      return;
    }
    if (trimmedDesc.length > 50) {
      toast.error("Aciklama en fazla 50 karakter olabilir");
      return;
    }
    if (coinPrice < 0 || coinPrice > 9999) {
      toast.error("Fiyat 0-9999 arasinda olmali");
      return;
    }
    if (!htmlContent || htmlContent.trim() === "") {
      toast.error("HTML icerigi bos olamaz");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const safeName = trimmedName.substring(0, 60);
      const safeSlug = trimmedSlug.replace(/[^a-z0-9-]/g, '').substring(0, 40);
      const safeDescription = trimmedDesc.substring(0, 50);

      const { error } = await supabase.from("templates").insert({
        name: safeName,
        slug: safeSlug,
        description: safeDescription,
        coin_price: Math.max(0, Math.min(9999, coinPrice)),
        html_content: htmlContent,
        created_by: user.id,
        is_public: true,
      });

      if (error) throw error;

      toast.success("Şablon oluşturuldu!");
      router.push("/creator");
    } catch (error: any) {
      toast.error("Kaydetme hatası: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAITemplate = async () => {
    if (!aiTopic.trim() || aiLoading) return;
    setAILoading(true);
    try {
      const res = await fetch('/api/ai/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          details: aiDetails.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI hatası');

      setHtmlContent(data.html);
      if (!name.trim()) setName(aiTopic.trim().slice(0, 60));
      toast.success('Şablon oluşturuldu!');
      setShowAIModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Şablon oluşturma hatası');
    } finally {
      setAILoading(false);
    }
  };

  const handlePreview = () => {
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      const sanitized = DOMPurify.sanitize(htmlContent, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style", "link", "meta", "title"], ADD_ATTR: ["target", "data-editable", "data-type", "data-hook"] });
      previewWindow.document.write(sanitized);
      previewWindow.document.close();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px] border-b border-white/10">
        <nav className="w-full px-6 flex items-center justify-between min-h-[73px]">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="flex items-center gap-2 transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Geri</span>
            </button>
            <div className="h-6 w-px bg-white/10"></div>
            <button
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-white/10 transition-all"
              aria-label={leftPanelOpen ? "Paneli Kapat" : "Paneli Aç"}
            >
              <Menu className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </button>
          </div>
          <h1 className="text-lg font-semibold flex-1 ml-3">Yeni Şablon Oluştur</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" style={{ color: 'lab(49.5493% 79.8381 2.31768)' }} />
              AI ile Oluştur
            </button>
            <button
              onClick={handlePreview}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Önizle
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-4 py-2 text-sm"
            >
              {saving ? "Oluşturuluyor..." : "Oluştur"}
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Settings & Editor */}
        <div
          className={`border-r border-white/10 flex flex-col transition-all duration-300 ${
            leftPanelOpen ? 'w-[400px]' : 'w-0 overflow-hidden'
          }`}
        >
          {/* Settings */}
          <div className="p-6 border-b border-white/10 space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Sablon Adi</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-modern w-full"
                placeholder="Orn: Romantik Yildonumu"
                maxLength={60}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Slug (URL)</label>
              <div className="flex items-center gap-0 bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                <span className="text-xs text-gray-500 pl-3 shrink-0">forilove.com/p/</span>
                <input
                  type="text"
                  value={slug}
                  readOnly
                  placeholder="otomatik-olusturulur"
                  className="flex-1 bg-transparent text-sm text-white/50 outline-none py-3 pr-3 cursor-not-allowed"
                  tabIndex={-1}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Sablon adindan otomatik olusturulur</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Aciklama</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 50))}
                className="input-modern w-full"
                placeholder="Kisaca sablonu tanitin"
                maxLength={50}
              />
              <p className="text-[11px] text-gray-500 mt-1 text-right">{description.length}/50</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Fiyat (FL Coin)</label>
              <input
                type="number"
                value={coinPrice}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCoinPrice(Math.min(9999, Math.max(0, val)));
                }}
                className="input-modern w-full"
                min="0"
                max="9999"
              />
            </div>
          </div>

          {/* HTML Editor */}
          <div className="flex-1 flex flex-col p-6 min-h-0">
            <label className="block text-sm text-gray-400 mb-2">HTML Kodu</label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="flex-1 min-h-[600px] bg-zinc-900 border border-white/10 rounded-lg p-4 font-mono text-sm text-white resize-none focus:outline-none focus:border-pink-500/50"
              spellCheck={false}
              placeholder="HTML kodunuzu buraya yazın..."
            />
          </div>

          {/* AI Prompt removed — integrated into AI modal */}
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 bg-white transition-all duration-300">
          <div className="h-full overflow-y-auto">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border-0"
              title="Live Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>

      {/* AI Template Modal */}
      {showAIModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => { if (!aiLoading) setShowAIModal(false); }}
        >
          <div
            className="bg-zinc-900 w-full sm:w-[550px] rounded-t-3xl sm:rounded-4xl p-5 space-y-4 animate-slide-up sm:animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Heart className="h-10 w-10 text-pink-500 fill-pink-500 animate-pulse" />
                <p className="text-white text-sm font-medium">Şablon oluşturuluyor...</p>
                <p className="text-gray-500 text-xs">Bu işlem 10-20 saniye sürebilir</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5" style={{ color: 'lab(49.5493% 79.8381 2.31768)' }} />
                      AI ile Şablon Oluştur
                    </h3>
                    <p className="text-xs text-gray-400">Şablon detaylarını girin, AI tasarlasın</p>
                  </div>
                  <button
                    onClick={() => setShowAIModal(false)}
                    aria-label="Kapat"
                    className="rounded-full p-2 bg-white/10 text-gray-400 hover:text-white hover:bg-white/15 transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Ne oluşturmak istiyorsun? *</label>
                    <textarea
                      value={aiTopic}
                      onChange={(e) => setAITopic(e.target.value.slice(0, 300))}
                      className="input-modern w-full min-h-[80px] resize-y text-base"
                      placeholder={"Örn:\n• Sevgililer günü için romantik bir sayfa\n• My anniversary page, dark elegant style\n• Anneme doğum günü sayfası, pastel renkler"}
                      maxLength={300}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Detaylar <span className="text-gray-500 font-normal">(opsiyonel)</span>
                    </label>
                    <input
                      type="text"
                      value={aiDetails}
                      onChange={(e) => setAIDetails(e.target.value.slice(0, 200))}
                      className="input-modern w-full text-sm"
                      placeholder="Stil, renk, atmosfer... Örn: dark theme, neon, minimal"
                      maxLength={200}
                    />
                  </div>
                </div>

                {htmlContent.trim() && (
                  <p className="text-xs text-yellow-400/80">
                    Mevcut HTML kodunuzun üzerine yazılacak
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="flex-1 btn-secondary py-3"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleAITemplate}
                    disabled={!aiTopic.trim()}
                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-4 w-4" />
                    Oluştur
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
