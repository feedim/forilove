"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Plus,
  X,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  LayoutTemplate,
  Package,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Code,
  Undo2,
  Redo2,
  Image,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

function toSlug(title: string) {
  return title
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

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  content: string;
  read_time: string;
  cover_image_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/* ─── WYSIWYG Editor ─── */
function RichEditor({
  value,
  onChange,
  onInsertEmbed,
  editorRef: externalEditorRef,
}: {
  value: string;
  onChange: (html: string) => void;
  onInsertEmbed: (type: "template" | "bundle") => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const editorRef = externalEditorRef;
  const isInternalUpdate = useRef(false);
  const savedRange = useRef<Range | null>(null);

  // Sync external value → editor only on first mount or when value is reset to empty / totally different doc
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save cursor position whenever selection changes inside editor
  const saveCursor = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    flush();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isInternalUpdate.current = true;
    onChange(el.innerHTML);
  }, [onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLink = useCallback(() => {
    const url = prompt("Link URL:");
    if (url) exec("createLink", url);
  }, [exec]);

  const handleImage = useCallback(() => {
    const url = prompt("Görsel URL:");
    if (url) exec("insertImage", url);
  }, [exec]);

  const btn =
    "p-1.5 rounded hover:bg-white/10 transition text-zinc-400 hover:text-white";
  const sep = "w-px h-5 bg-white/10 mx-0.5";

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-zinc-900 border-b border-white/10">
        <button type="button" onClick={() => exec("undo")} className={btn} title="Geri al">
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec("redo")} className={btn} title="İleri al">
          <Redo2 className="h-4 w-4" />
        </button>

        <div className={sep} />

        <button type="button" onClick={() => exec("bold")} className={btn} title="Kalın">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec("italic")} className={btn} title="İtalik">
          <Italic className="h-4 w-4" />
        </button>

        <div className={sep} />

        <button
          type="button"
          onClick={() => exec("formatBlock", "h2")}
          className={btn}
          title="Başlık 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "h3")}
          className={btn}
          title="Başlık 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "p")}
          className={`${btn} text-xs font-mono`}
          title="Paragraf"
        >
          P
        </button>

        <div className={sep} />

        <button type="button" onClick={() => exec("insertUnorderedList")} className={btn} title="Madde listesi">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btn} title="Numaralı liste">
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "blockquote")}
          className={btn}
          title="Alıntı"
        >
          <Quote className="h-4 w-4" />
        </button>

        <div className={sep} />

        <button type="button" onClick={handleLink} className={btn} title="Link ekle">
          <LinkIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={handleImage} className={btn} title="Görsel ekle">
          <Image className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("formatBlock", "pre")}
          className={btn}
          title="Kod bloğu"
        >
          <Code className="h-4 w-4" />
        </button>

        <div className={sep} />

        <button
          type="button"
          onClick={() => onInsertEmbed("template")}
          className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 transition px-2 py-1 rounded bg-pink-500/10"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Şablon
        </button>
        <button
          type="button"
          onClick={() => onInsertEmbed("bundle")}
          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition px-2 py-1 rounded bg-purple-500/10"
        >
          <Package className="h-3.5 w-3.5" />
          Paket
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={flush}
        onKeyUp={saveCursor}
        onMouseUp={saveCursor}
        onBlur={saveCursor}
        className="min-h-[400px] max-h-[70vh] overflow-y-auto px-4 py-3 prose-blog focus:outline-none text-white"
      />
    </div>
  );
}

/* ─── Main Page ─── */
export default function AdminPostsPage() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [readTime, setReadTime] = useState("1 dk");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [viewMode, setViewMode] = useState<"visual" | "html">("visual");

  // Embed modal state
  const [embedModal, setEmbedModal] = useState<"template" | "bundle" | null>(
    null
  );
  const [embedItems, setEmbedItems] = useState<any[]>([]);
  const [embedLoading, setEmbedLoading] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const wysiwygRef = useRef<HTMLDivElement>(null);

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      const res = await fetch("/api/admin/blog-posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setSlugManual(false);
    setDescription("");
    setKeywords("");
    setReadTime("1 dk");
    setContent("");
    setIsPublished(false);
    setEditingPost(null);
    setViewMode("visual");
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingPost(post);
    setTitle(post.title);
    setSlug(post.slug);
    setSlugManual(true);
    setDescription(post.description);
    setKeywords(post.keywords.join(", "));
    setReadTime(post.read_time);
    setContent(post.content);
    setIsPublished(post.is_published);
    setViewMode("visual");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Başlık gerekli");
      return;
    }

    setSaving(true);
    try {
      const body: any = {
        title: title.trim(),
        slug: slug.trim() || toSlug(title.trim()),
        description: description.trim(),
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        read_time: readTime.trim() || "1 dk",
        content,
        is_published: isPublished,
      };

      let res: Response;
      if (editingPost) {
        body.postId = editingPost.id;
        res = await fetch("/api/admin/blog-posts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/admin/blog-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Bir hata oluştu");
        return;
      }

      toast.success(editingPost ? "Yazı güncellendi" : "Yazı oluşturuldu");
      setShowForm(false);
      resetForm();
      loadData();
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Bu yazıyı silmek istediğinize emin misiniz?")) return;

    try {
      const res = await fetch("/api/admin/blog-posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Silinemedi");
        return;
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Yazı silindi");
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const openEmbedModal = async (type: "template" | "bundle") => {
    setEmbedModal(type);
    setEmbedLoading(true);
    setEmbedItems([]);

    try {
      if (type === "template") {
        const { data } = await supabase
          .from("templates")
          .select("id, name, coin_price")
          .order("name");
        setEmbedItems(data || []);
      } else {
        const { data } = await supabase
          .from("bundles")
          .select("id, name, slug")
          .eq("is_active", true)
          .order("name");
        setEmbedItems(data || []);
      }
    } catch {
      /* silent */
    } finally {
      setEmbedLoading(false);
    }
  };

  // data-embed stores "template:UUID" or "bundle:SLUG" (no HTML comment — avoids &lt; encoding)
  const EMBED_PLACEHOLDER_STYLE =
    "background:rgba(236,72,153,0.1);border:1px dashed rgba(236,72,153,0.3);border-radius:12px;padding:12px 16px;margin:12px 0;font-size:13px;color:rgb(236,72,153);cursor:default;user-select:none";

  const insertEmbed = (item: any) => {
    // embedKey: "template:UUID" or "bundle:SLUG"
    const embedKey =
      embedModal === "template"
        ? `template:${item.id}`
        : `bundle:${item.slug}`;
    const comment = `<!-- embed:${embedKey} -->`;

    if (viewMode === "html") {
      const textarea = htmlRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent =
          content.slice(0, start) + "\n" + comment + "\n" + content.slice(end);
        setContent(newContent);
      } else {
        setContent((prev) => prev + "\n" + comment + "\n");
      }
    } else {
      // Visual mode — insert at cursor position in contentEditable
      const label =
        embedModal === "template" ? "Sablon Embed" : "Paket Embed";
      const el = wysiwygRef.current;
      if (el) {
        el.focus();
        const placeholder = document.createElement("div");
        placeholder.setAttribute("data-embed", embedKey);
        placeholder.setAttribute("contenteditable", "false");
        placeholder.style.cssText = EMBED_PLACEHOLDER_STYLE;
        placeholder.textContent = `${label}: ${item.name}`;

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (el.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            range.insertNode(placeholder);
            range.setStartAfter(placeholder);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            el.appendChild(placeholder);
          }
        } else {
          el.appendChild(placeholder);
        }
        setContent(el.innerHTML);
      }
    }

    setEmbedModal(null);
    toast.success("Embed eklendi");
  };

  // Convert visual placeholders → HTML comments
  const placeholdersToComments = (html: string) =>
    html.replace(
      /<div[^>]*data-embed="([^"]+)"[^>]*>[\s\S]*?<\/div>/gi,
      (_match, key) => `<!-- embed:${key} -->`
    );

  // Convert HTML comments → visual placeholders
  const commentsToPlaceholders = (html: string) =>
    html.replace(
      /<!--\s*embed:(template|bundle):([^\s]+)\s*-->/g,
      (_full, type, id) => {
        const label = type === "template" ? "Sablon Embed" : "Paket Embed";
        return `<div data-embed="${type}:${id}" contenteditable="false" style="${EMBED_PLACEHOLDER_STYLE}">${label}: ${id}</div>`;
      }
    );

  const switchToHtml = () => {
    setContent(placeholdersToComments(content));
    setViewMode("html");
  };

  const switchToVisual = () => {
    setContent(commentsToPlaceholders(content));
    setViewMode("visual");
  };

  // Before save, always convert placeholders to comments
  const getCleanContent = () => placeholdersToComments(content);

  const handleSaveWrapped = async () => {
    const originalContent = content;
    // Clean before save
    const cleaned = getCleanContent();
    setContent(cleaned);
    // Defer save so state updates
    setTimeout(async () => {
      // Override content in body directly
      const body: any = {
        title: title.trim(),
        slug: slug.trim() || toSlug(title.trim()),
        description: description.trim(),
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        read_time: readTime.trim() || "1 dk",
        content: cleaned,
        is_published: isPublished,
      };

      setSaving(true);
      try {
        let res: Response;
        if (editingPost) {
          body.postId = editingPost.id;
          res = await fetch("/api/admin/blog-posts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } else {
          res = await fetch("/api/admin/blog-posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Bir hata oluştu");
          setContent(originalContent);
          return;
        }

        toast.success(editingPost ? "Yazı güncellendi" : "Yazı oluşturuldu");
        setShowForm(false);
        resetForm();
        loadData();
      } catch {
        toast.error("Bir hata oluştu");
        setContent(originalContent);
      } finally {
        setSaving(false);
      }
    }, 0);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl min-h-[73px]">
        <nav className="container mx-auto px-6 flex items-center justify-between min-h-[73px]">
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                router.back();
              }
            }}
            className="flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Geri</span>
          </button>
          <h1 className="text-lg font-semibold">
            {showForm
              ? editingPost
                ? "Yazı Düzenle"
                : "Yeni Yazı"
              : "Blog Yazıları"}
          </h1>
          <div className="w-16" />
        </nav>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-16 max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-2xl p-6 animate-pulse h-60" />
          </div>
        ) : showForm ? (
          <div className="bg-zinc-900 rounded-2xl p-6">
            <div className="space-y-4">
              {/* Başlık */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Başlık
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugManual) setSlug(toSlug(e.target.value));
                  }}
                  placeholder="Yazı başlığı"
                  maxLength={200}
                  className="input-modern w-full"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManual(true);
                  }}
                  placeholder="yazi-slug"
                  className="input-modern w-full text-sm"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Açıklama (SEO)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kısa açıklama..."
                  maxLength={500}
                  rows={3}
                  className="input-modern w-full resize-none"
                />
              </div>

              {/* Anahtar Kelimeler */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Anahtar Kelimeler (virgülle ayır)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="hediye, sevgililer günü, dijital"
                  className="input-modern w-full text-sm"
                />
              </div>

              {/* Okuma Süresi */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Okuma Süresi
                </label>
                <input
                  type="text"
                  value={readTime}
                  onChange={(e) => setReadTime(e.target.value)}
                  placeholder="5 dk"
                  className="input-modern w-full text-sm"
                />
              </div>

              {/* İçerik — mode toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-zinc-400">İçerik</label>
                  <div className="flex bg-zinc-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        viewMode === "html" ? switchToVisual() : null
                      }
                      className={`px-3 py-1 text-xs rounded-md transition ${
                        viewMode === "visual"
                          ? "bg-white/10 text-white"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      Görsel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        viewMode === "visual" ? switchToHtml() : null
                      }
                      className={`px-3 py-1 text-xs rounded-md transition ${
                        viewMode === "html"
                          ? "bg-white/10 text-white"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                </div>

                {viewMode === "visual" ? (
                  <RichEditor
                    value={content}
                    onChange={setContent}
                    onInsertEmbed={openEmbedModal}
                    editorRef={wysiwygRef}
                  />
                ) : (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => openEmbedModal("template")}
                        className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 transition px-2 py-1 rounded bg-pink-500/10"
                      >
                        <LayoutTemplate className="h-3.5 w-3.5" />
                        Şablon Ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => openEmbedModal("bundle")}
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition px-2 py-1 rounded bg-purple-500/10"
                      >
                        <Package className="h-3.5 w-3.5" />
                        Paket Ekle
                      </button>
                    </div>
                    <textarea
                      ref={htmlRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={20}
                      className="input-modern w-full resize-y font-mono text-sm"
                      placeholder="<h2>Başlık</h2>\n<p>Paragraf...</p>"
                    />
                  </div>
                )}
              </div>

              {/* Yayın Durumu */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <span className="text-sm font-medium">
                  {isPublished ? "Yayında" : "Taslak"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsPublished(!isPublished)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPublished ? "bg-pink-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublished ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Kaydet */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1 btn-secondary py-3"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveWrapped}
                  disabled={saving || !title.trim()}
                  className="flex-1 btn-primary py-3"
                >
                  {saving
                    ? "Kaydediliyor..."
                    : editingPost
                    ? "Güncelle"
                    : "Oluştur"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Yeni Yazı Butonu */}
            <button
              onClick={openNew}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Yeni Yazı Oluştur
            </button>

            {/* Yazı Listesi */}
            {posts.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-8 text-center">
                <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">Henüz yazı yok</p>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-zinc-900 rounded-xl p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">
                          {post.title}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            post.is_published
                              ? "bg-green-500/20 text-green-400"
                              : "bg-zinc-700 text-zinc-400"
                          }`}
                        >
                          {post.is_published ? "Yayında" : "Taslak"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {new Date(post.created_at).toLocaleDateString("tr-TR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                        {" · "}
                        {post.read_time}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(post)}
                        className="p-2 text-zinc-500 hover:text-yellow-400 transition"
                        title="Düzenle"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          window.open(`/blog/${post.slug}`, "_blank")
                        }
                        className="p-2 text-zinc-500 hover:text-blue-400 transition"
                        title="Görüntüle"
                      >
                        {post.is_published ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 transition"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Embed Modal */}
      {embedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-semibold">
                {embedModal === "template" ? "Şablon Seç" : "Paket Seç"}
              </h3>
              <button
                onClick={() => setEmbedModal(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {embedLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-xl bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : embedItems.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">
                  Hiç öğe bulunamadı
                </p>
              ) : (
                <div className="space-y-2">
                  {embedItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => insertEmbed(item)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
                    >
                      <p className="font-medium text-sm">{item.name}</p>
                      {embedModal === "template" && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {item.coin_price} FL
                        </p>
                      )}
                      {embedModal === "bundle" && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          /{item.slug}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
