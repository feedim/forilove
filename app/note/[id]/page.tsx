"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Eye } from "lucide-react";
import ShareIcon from "@/components/ShareIcon";
import AppLayout from "@/components/AppLayout";
import VerifiedBadge, { getBadgeVariant } from "@/components/VerifiedBadge";
import { useAuthModal } from "@/components/AuthModal";
import { useUser } from "@/components/UserContext";
import { feedimAlert } from "@/components/FeedimAlert";
import { formatRelativeDate, formatCount, cn, slugify } from "@/lib/utils";
import { decodeId, encodeId } from "@/lib/hashId";
import ImageViewer from "@/components/ImageViewer";
import type { NoteData } from "@/components/NoteCard";

function renderNoteContent(text: string, tags?: { id: number; name: string; slug: string }[]) {
  const tagSlugMap = new Map<string, string>();
  if (tags) {
    for (const t of tags) tagSlugMap.set(t.name.toLowerCase(), t.slug);
  }
  const parts = text.split(/(#[\p{L}\p{N}_]{2,50})/gu);
  return parts.map((part, i) => {
    if (part.startsWith("#") && part.length > 2) {
      const name = part.slice(1);
      const slug = tagSlugMap.get(name.toLowerCase()) || slugify(name);
      return (
        <Link key={i} href={`/dashboard/explore/tag/${slug}`} className="text-accent-main hover:underline font-medium">
          {part}
        </Link>
      );
    }
    return part;
  });
}

const NoteRepliesModal = lazy(() => import("@/components/modals/NoteRepliesModal"));

export default function NoteDetailPage() {
  const { id: hashParam } = useParams<{ id: string }>();
  const router = useRouter();
  const { requireAuth } = useAuthModal();
  const { user: currentUser } = useUser();

  // Decode the hashed ID from the URL
  const noteId = hashParam ? decodeId(hashParam) : null;

  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [replyCount, setReplyCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!noteId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/notes/${noteId}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const n = data.note;
        setNote(n);
        setLiked(n.is_liked || false);
        setLikeCount(n.like_count || 0);
        setSaveCount(n.save_count || 0);
        setSaved(n.is_saved || false);
        setReplyCount(n.reply_count || 0);
        setViewCount(n.view_count || 0);
        // Record view in background
        fetch(`/api/notes/${noteId}/view`, { method: "POST" }).catch(() => {});
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [noteId]);

  const handleLike = async () => {
    const user = await requireAuth();
    if (!user || !note) return;
    const newLiked = !liked;
    const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    setLiked(newLiked);
    setLikeCount(newCount);
    if (newLiked) { setLikeAnimating(true); setTimeout(() => setLikeAnimating(false), 400); }
    try {
      const res = await fetch(`/api/notes/${note.id}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.like_count);
      } else {
        setLiked(!newLiked);
        setLikeCount(note.like_count);
      }
    } catch { setLiked(!newLiked); setLikeCount(note.like_count); }
  };

  const handleSave = async () => {
    const user = await requireAuth();
    if (!user || !note) return;
    const newSaved = !saved;
    setSaved(newSaved);
    setSaveCount(c => c + (newSaved ? 1 : -1));
    try {
      const res = await fetch(`/api/notes/${note.id}/save`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
      } else {
        setSaved(!newSaved);
        setSaveCount(c => c + (newSaved ? -1 : 1));
      }
    } catch {
      setSaved(!newSaved);
      setSaveCount(c => c + (newSaved ? -1 : 1));
    }
  };

  const handleShare = async () => {
    if (!note) return;
    const url = `${window.location.origin}/note/${encodeId(note.id)}`;
    if (navigator.share) {
      try { await navigator.share({ text: note.content, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      feedimAlert("success", "Link kopyalandi!");
    }
  };

  const handleDelete = () => {
    if (!note) return;
    feedimAlert("question", "Bu notu silmek istedigine emin misin?", {
      showYesNo: true,
      onYes: async () => {
        try {
          const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
          if (res.ok) {
            router.push("/dashboard/community-notes");
          }
        } catch {}
      },
    });
  };

  const author = note?.profiles;
  const images = note?.images || [];
  const tags = note?.tags || [];
  const isOwn = currentUser?.id === note?.author_id;

  const openImage = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  if (loading) {
    return (
      <AppLayout headerTitle="Not">
        <div className="flex items-center justify-center py-20">
          <span className="loader" style={{ width: 24, height: 24 }} />
        </div>
      </AppLayout>
    );
  }

  if (!note) {
    return (
      <AppLayout headerTitle="Not">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-muted text-sm">Not bulunamadi veya kaldirilmis.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Not" hideRightSidebar>
      <article className="px-4 sm:px-5 py-4">
        {/* Author */}
        <div className="flex items-center gap-2.5 mb-4">
          <Link href={`/u/${author?.username || ""}`}>
            {author?.avatar_url ? (
              <img src={author.avatar_url} alt={author.username} className="h-11 w-11 rounded-full object-cover" loading="lazy" />
            ) : (
              <img className="default-avatar-auto h-11 w-11 rounded-full object-cover" alt="" loading="lazy" />
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Link href={`/u/${author?.username || ""}`} className="font-semibold text-[0.88rem] hover:underline truncate">
                @{author?.username || "Anonim"}
              </Link>
              {author?.is_verified && <VerifiedBadge variant={getBadgeVariant(author?.premium_plan)} />}
            </div>
            <span className="text-[0.72rem] text-text-muted">{formatRelativeDate(note.created_at)}</span>
          </div>
          {isOwn && (
            <button onClick={handleDelete} className="i-btn !w-8 !h-8 text-text-muted hover:text-text-primary shrink-0">
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>

        {/* Content */}
        <p className="text-[1.05rem] leading-[1.7] text-text-primary whitespace-pre-wrap break-words mb-3">
          {renderNoteContent(note.content, tags)}
        </p>

        {/* Images */}
        {images.length > 0 && (
          <div className={`mt-2 mb-4 rounded-xl overflow-hidden ${
            images.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-0.5"
          }`} style={{ maxHeight: images.length === 1 ? 400 : 300 }}>
            {images.length === 1 && (
              <button onClick={() => openImage(0)} className="w-full h-full">
                <img src={images[0]} alt="" className="w-full h-full object-cover" style={{ maxHeight: 400 }} loading="lazy" />
              </button>
            )}
            {images.length === 2 && images.map((url, i) => (
              <button key={i} onClick={() => openImage(i)} className="w-full h-full">
                <img src={url} alt="" className="w-full h-full object-cover" style={{ maxHeight: 300 }} loading="lazy" />
              </button>
            ))}
            {images.length >= 3 && (
              <>
                <button onClick={() => openImage(0)} className="w-full h-full">
                  <img src={images[0]} alt="" className="w-full h-full object-cover" style={{ maxHeight: 300 }} loading="lazy" />
                </button>
                <button onClick={() => openImage(1)} className="w-full h-full relative">
                  <img src={images[1]} alt="" className="w-full h-full object-cover" style={{ maxHeight: 300 }} loading="lazy" />
                  {images.length > 2 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xl font-bold">+{images.length - 2}</span>
                    </div>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* View count */}
        {viewCount > 0 && (
          <div className="flex items-center gap-1.5 text-[0.78rem] text-text-muted mt-2 mb-1">
            <Eye className="h-[15px] w-[15px]" />
            <span>{formatCount(viewCount)} goruntuleme</span>
          </div>
        )}

        {/* Interaction bar — /post/ style with all counts */}
        <div className="sticky bottom-0 z-40 bg-bg-primary mt-3 mb-4">
          <div className="flex items-center gap-2 py-3">
            {/* Like */}
            <button
              onClick={handleLike}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[0.82rem] font-semibold transition",
                liked ? "bg-red-500/10 text-red-500" : "bg-bg-secondary text-text-primary hover:text-red-500"
              )}
            >
              <Heart className={cn("h-[18px] w-[18px] transition-transform", liked && "fill-current", likeAnimating && "scale-125")} />
              <span>{formatCount(likeCount)}</span>
            </button>

            {/* Comments */}
            <button
              onClick={() => setRepliesOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[0.82rem] font-semibold bg-bg-secondary text-text-primary hover:text-accent-main transition"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
              <span>{formatCount(replyCount)}</span>
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[0.82rem] font-semibold transition",
                saved ? "bg-accent-main/10 text-accent-main" : "bg-bg-secondary text-text-primary hover:text-accent-main"
              )}
            >
              <Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-current")} />
              <span>{formatCount(saveCount)}</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[0.82rem] font-semibold bg-bg-secondary text-text-primary hover:text-accent-main transition"
            >
              <ShareIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </article>

      {/* Replies modal */}
      <Suspense fallback={null}>
        <NoteRepliesModal
          open={repliesOpen}
          onClose={() => setRepliesOpen(false)}
          noteId={note.id}
          replyCount={replyCount}
          onReplyAdded={() => setReplyCount(c => c + 1)}
        />
      </Suspense>

      {/* Image viewer */}
      {viewerOpen && (
        <ImageViewer
          images={images.map(url => ({ src: url, alt: "" }))}
          initialIndex={viewerIndex}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </AppLayout>
  );
}
