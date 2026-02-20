"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Tag, Plus, X, Pencil, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

interface TagRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}

export default function AdminTagsPage() {
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
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

      if (profile?.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      const { data } = await supabase
        .from("tags")
        .select("*")
        .order("name");
      setTags(data || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Etiket adı en az 2 karakter olmalı");
      return;
    }

    const slug = toSlug(trimmed);
    if (slug.length < 2) {
      toast.error("Geçerli bir slug oluşturulamadı");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("tags")
        .insert({
          name: trimmed,
          slug,
          description: description.trim(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Bu etiket zaten mevcut");
        } else {
          toast.error("Etiket oluşturulamadı: " + error.message);
        }
        return;
      }

      setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "tr")));
      setName("");
      setDescription("");
      toast.success("Etiket oluşturuldu");
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (tagId: string) => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .delete()
        .eq("id", tagId)
        .select("id");

      if (error) {
        toast.error("Etiket silinemedi: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        toast.error("Etiket silinemedi. Yetkiniz olmayabilir.");
        return;
      }

      setTags((prev) => prev.filter((t) => t.id !== tagId));
      toast.success("Etiket silindi");
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const startEdit = (tag: TagRow) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditDescription(tag.description || "");
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Etiket adı en az 2 karakter olmalı");
      return;
    }

    const slug = toSlug(trimmed);
    try {
      const { error } = await supabase
        .from("tags")
        .update({
          name: trimmed,
          slug,
          description: editDescription.trim(),
        })
        .eq("id", editingId);

      if (error) {
        if (error.code === "23505") {
          toast.error("Bu isim veya slug zaten kullanılıyor");
        } else {
          toast.error("Güncellenemedi: " + error.message);
        }
        return;
      }

      setTags((prev) =>
        prev
          .map((t) =>
            t.id === editingId
              ? { ...t, name: trimmed, slug, description: editDescription.trim() }
              : t
          )
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      );
      setEditingId(null);
      toast.success("Etiket güncellendi");
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
          <h1 className="text-lg font-semibold">Etiket Yönetimi</h1>
          <div className="w-16" />
        </nav>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-16 max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-2xl p-6 animate-pulse h-60" />
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="h-5 w-5 text-pink-500" />
              <h3 className="font-semibold">Etiket Yönetimi</h3>
            </div>

            {/* Create Tag Form */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Etiket Adı
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn: Yıldönümü"
                  maxLength={40}
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
                  maxLength={100}
                  className="input-modern w-full text-sm"
                />
              </div>
              {name.trim() && (
                <p className="text-xs text-zinc-500">
                  Slug: <span className="text-zinc-400">{toSlug(name.trim())}</span>
                </p>
              )}
              <button
                onClick={handleCreate}
                disabled={creating || name.trim().length < 2}
                className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Oluşturuluyor..." : "Etiket Oluştur"}
              </button>
            </div>

            {/* Tags List */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                  Mevcut Etiketler ({tags.length})
                </p>
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                  >
                    {editingId === tag.id ? (
                      <div className="flex-1 space-y-2 mr-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input-modern w-full text-sm"
                          maxLength={40}
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="input-modern w-full text-sm"
                          placeholder="Açıklama"
                          maxLength={100}
                        />
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {tag.name}
                          </span>
                          <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">
                            {tag.slug}
                          </span>
                        </div>
                        {tag.description && (
                          <p className="text-xs text-zinc-500 mt-1 truncate">
                            {tag.description}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {editingId === tag.id ? (
                        <>
                          <button
                            onClick={handleUpdate}
                            className="p-2 text-green-400 hover:text-green-300 transition"
                            title="Kaydet"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 text-zinc-500 hover:text-zinc-300 transition"
                            title="İptal"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(tag)}
                            className="p-2 text-zinc-500 hover:text-yellow-400 transition"
                            title="Düzenle"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tag.id)}
                            className="p-2 text-zinc-500 hover:text-red-400 transition"
                            title="Sil"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
