"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Plus,
  X,
  Pencil,
  Check,
  Coins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateBundlePrice } from "@/lib/bundle-price";
import toast from "react-hot-toast";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface TemplateOption {
  id: string;
  name: string;
  coin_price: number;
  discount_price?: number | null;
  discount_expires_at?: string | null;
}

interface BundleRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  created_at: string;
  bundle_templates: {
    template_id: string;
    templates: TemplateOption;
  }[];
}

export default function AdminBundlesPage() {
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSelectedIds, setEditSelectedIds] = useState<Set<string>>(
    new Set()
  );
  const [role, setRole] = useState<"admin" | "creator" | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }
      const user = session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const userRole = profile?.role;
      if (userRole !== "admin" && userRole !== "creator") {
        router.push("/dashboard");
        return;
      }
      setRole(userRole as "admin" | "creator");

      // Şablonları yükle
      let tplQuery = supabase
        .from("templates")
        .select(
          "id, name, coin_price, discount_price, discount_expires_at"
        )
        .eq("is_active", true)
        .order("name");

      if (userRole === "creator") {
        tplQuery = tplQuery.eq("created_by", user.id);
      }

      const { data: tplData } = await tplQuery;
      setTemplates(tplData || []);

      // Paketleri API'den yükle
      const res = await fetch("/api/admin/bundles");
      if (res.ok) {
        const json = await res.json();
        setBundles(json.bundles || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEditTemplate = (id: string) => {
    setEditSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTemplates = templates.filter((t) => selectedIds.has(t.id));
  const editSelectedTemplates = templates.filter((t) =>
    editSelectedIds.has(t.id)
  );

  const priceInfo =
    selectedTemplates.length >= 2
      ? calculateBundlePrice(selectedTemplates)
      : null;

  const editPriceInfo =
    editSelectedTemplates.length >= 2
      ? calculateBundlePrice(editSelectedTemplates)
      : null;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Paket adı en az 2 karakter olmalı");
      return;
    }
    if (selectedIds.size < 2) {
      toast.error("En az 2 şablon seçmelisiniz");
      return;
    }
    if (selectedIds.size > 20) {
      toast.error("Bir pakette en fazla 20 şablon olabilir");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim(),
          templateIds: Array.from(selectedIds),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Paket oluşturulamadı");
        return;
      }

      setName("");
      setDescription("");
      setSelectedIds(new Set());
      toast.success("Paket oluşturuldu");
      // Yeniden yükle
      const listRes = await fetch("/api/admin/bundles");
      if (listRes.ok) {
        const listJson = await listRes.json();
        setBundles(listJson.bundles || []);
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (bundleId: string) => {
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Paket silinemedi");
        return;
      }

      setBundles((prev) => prev.filter((b) => b.id !== bundleId));
      toast.success("Paket silindi");
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const startEdit = (bundle: BundleRow) => {
    setEditingId(bundle.id);
    setEditName(bundle.name);
    setEditDescription(bundle.description || "");
    setEditSelectedIds(
      new Set(bundle.bundle_templates.map((bt) => bt.template_id))
    );
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Paket adı en az 2 karakter olmalı");
      return;
    }
    if (editSelectedIds.size < 2) {
      toast.error("En az 2 şablon seçmelisiniz");
      return;
    }
    if (editSelectedIds.size > 20) {
      toast.error("Bir pakette en fazla 20 şablon olabilir");
      return;
    }

    try {
      const res = await fetch("/api/admin/bundles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: editingId,
          name: trimmed,
          description: editDescription.trim(),
          templateIds: Array.from(editSelectedIds),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Güncellenemedi");
        return;
      }

      setEditingId(null);
      toast.success("Paket güncellendi");
      // Yeniden yükle
      const listRes = await fetch("/api/admin/bundles");
      if (listRes.ok) {
        const listJson = await listRes.json();
        setBundles(listJson.bundles || []);
      }
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const handleToggleActive = async (bundle: BundleRow) => {
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: bundle.id,
          is_active: !bundle.is_active,
        }),
      });

      if (!res.ok) {
        toast.error("Durum değiştirilemedi");
        return;
      }

      setBundles((prev) =>
        prev.map((b) =>
          b.id === bundle.id ? { ...b, is_active: !b.is_active } : b
        )
      );
      toast.success(bundle.is_active ? "Paket pasife alındı" : "Paket aktif edildi");
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px]">
        <nav className="container mx-auto px-6 flex items-center justify-between min-h-[73px]">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Geri</span>
          </button>
          <h1 className="text-lg font-semibold">Paket Yönetimi</h1>
          <div className="w-16" />
        </nav>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-16 max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-2xl p-6 animate-pulse h-60" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Create Bundle Form */}
            <div className="bg-zinc-900 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-pink-500" />
                <h3 className="font-semibold">Yeni Paket Oluştur</h3>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Paket Adı
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Romantik Paket"
                    maxLength={60}
                    className="input-modern w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Açıklama (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Kısa açıklama"
                    maxLength={200}
                    className="input-modern w-full text-sm"
                  />
                </div>
                {name.trim() && (
                  <p className="text-xs text-zinc-500">
                    Slug:{" "}
                    <span className="text-zinc-400">
                      {toSlug(name.trim())}
                    </span>
                  </p>
                )}

                {/* Template Selection */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">
                    Şablonlar (en az 2 seçin)
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-white/10 rounded-xl p-2">
                    {templates.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleTemplate(t.id)}
                          className="accent-pink-500"
                        />
                        <span className="text-sm flex-1 truncate">
                          {t.name}
                        </span>
                        <span className="text-xs text-yellow-500 flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          {t.coin_price}
                        </span>
                      </label>
                    ))}
                    {templates.length === 0 && (
                      <p className="text-xs text-zinc-500 p-2">
                        Henüz şablon yok
                      </p>
                    )}
                  </div>
                </div>

                {/* Price Preview */}
                {priceInfo && (
                  <div className="bg-white/5 rounded-xl p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">
                        Toplam ({selectedIds.size} şablon)
                      </span>
                      <span className="text-zinc-400 line-through">
                        {priceInfo.totalOriginal} FL
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-pink-400">%20 İndirimli Fiyat</span>
                      <span className="text-yellow-500">
                        {priceInfo.bundlePrice} FL
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-pink-400">Tasarruf</span>
                      <span className="text-pink-400">
                        {priceInfo.savings} FL
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={
                    creating ||
                    name.trim().length < 2 ||
                    selectedIds.size < 2 ||
                    selectedIds.size > 20
                  }
                  className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {creating ? "Oluşturuluyor..." : "Paket Oluştur"}
                </button>
              </div>
            </div>

            {/* Bundles List */}
            {bundles.length > 0 && (
              <div className="bg-zinc-900 rounded-2xl p-6">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">
                  Mevcut Paketler ({bundles.length})
                </p>
                <div className="space-y-3">
                  {bundles.map((bundle) => (
                    <div
                      key={bundle.id}
                      className="p-4 rounded-xl bg-white/5"
                    >
                      {editingId === bundle.id ? (
                        /* Edit Mode */
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="input-modern w-full text-sm"
                            maxLength={60}
                          />
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) =>
                              setEditDescription(e.target.value)
                            }
                            className="input-modern w-full text-sm"
                            placeholder="Açıklama"
                            maxLength={200}
                          />
                          <div className="max-h-40 overflow-y-auto space-y-1 border border-white/10 rounded-xl p-2">
                            {templates.map((t) => (
                              <label
                                key={t.id}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={editSelectedIds.has(t.id)}
                                  onChange={() => toggleEditTemplate(t.id)}
                                  className="accent-pink-500"
                                />
                                <span className="text-sm flex-1 truncate">
                                  {t.name}
                                </span>
                                <span className="text-xs text-yellow-500 flex items-center gap-1">
                                  <Coins className="h-3 w-3" />
                                  {t.coin_price}
                                </span>
                              </label>
                            ))}
                          </div>
                          {editPriceInfo && (
                            <div className="bg-white/5 rounded-xl p-3 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-400">
                                  Toplam ({editSelectedIds.size} şablon)
                                </span>
                                <span className="text-zinc-400 line-through">
                                  {editPriceInfo.totalOriginal} FL
                                </span>
                              </div>
                              <div className="flex justify-between text-sm font-semibold">
                                <span className="text-pink-400">
                                  %20 İndirimli Fiyat
                                </span>
                                <span className="text-yellow-500">
                                  {editPriceInfo.bundlePrice} FL
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdate}
                              className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1"
                            >
                              <Check className="h-4 w-4" />
                              Kaydet
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-1"
                            >
                              <X className="h-4 w-4" />
                              İptal
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                  {bundle.name}
                                </span>
                                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">
                                  {bundle.slug}
                                </span>
                                {!bundle.is_active && (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                    Pasif
                                  </span>
                                )}
                              </div>
                              {bundle.description && (
                                <p className="text-xs text-zinc-500 mt-1">
                                  {bundle.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => startEdit(bundle)}
                                className="p-2 text-zinc-500 hover:text-yellow-400 transition"
                                title="Düzenle"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleToggleActive(bundle)}
                                className={`p-2 transition text-xs ${
                                  bundle.is_active
                                    ? "text-zinc-500 hover:text-orange-400"
                                    : "text-zinc-500 hover:text-pink-400"
                                }`}
                                title={
                                  bundle.is_active
                                    ? "Pasife al"
                                    : "Aktif et"
                                }
                              >
                                {bundle.is_active ? "Pasif" : "Aktif"}
                              </button>
                              <button
                                onClick={() => handleDelete(bundle.id)}
                                className="p-2 text-zinc-500 hover:text-red-400 transition"
                                title="Sil"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {bundle.bundle_templates.map((bt) => (
                              <span
                                key={bt.template_id}
                                className="text-xs bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full"
                              >
                                {bt.templates?.name || "?"}
                              </span>
                            ))}
                          </div>
                          {(() => {
                            const tpls = bundle.bundle_templates
                              .map((bt) => bt.templates)
                              .filter(Boolean);
                            if (tpls.length < 2) return null;
                            const info = calculateBundlePrice(tpls);
                            return (
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-zinc-500 line-through">
                                  {info.totalOriginal} FL
                                </span>
                                <span className="text-yellow-500 font-semibold">
                                  {info.bundlePrice} FL
                                </span>
                                <span className="text-pink-400">
                                  {info.savings} FL tasarruf
                                </span>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
