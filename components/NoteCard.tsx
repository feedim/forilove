"use client";

import { memo, useState, lazy, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Eye } from "lucide-react";
import ShareIcon from "@/components/ShareIcon";
import { encodeId } from "@/lib/hashId";
import { formatRelativeDate, formatCount } from "@/lib/utils";
import VerifiedBadge, { getBadgeVariant } from "@/components/VerifiedBadge";
import { useAuthModal } from "@/components/AuthModal";
import { feedimAlert } from "@/components/FeedimAlert";
import { useUser } from "@/components/UserContext";
import { slugify } from "@/lib/utils";

const NoteRepliesModal = lazy(() => import("@/components/modals/NoteRepliesModal"));
const ImageViewer = lazy(() => import("@/components/ImageViewer"));

// Render note content with inline clickable hashtags
function renderNoteContent(text: string, tags?: { id: number; name: string; slug: string }[]) {
  // Build a map from lowercase tag name to slug for known tags
  const tagSlugMap = new Map<string, string>();
  if (tags) {
    for (const t of tags) {
      tagSlugMap.set(t.name.toLowerCase(), t.slug);
    }
  }

  // Split text by hashtag pattern, keeping the delimiter
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

export interface NoteData {
  id: number;
  author_id: string;
  content: string;
  images?: string[];
  like_count: number;
  reply_count: number;
  save_count: number;
  view_count?: number;
  created_at: string;
  is_liked?: boolean;
  is_saved?: boolean;
  profiles?: {
    user_id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
    is_verified?: boolean;
    premium_plan?: string | null;
  };
  tags?: { id: number; name: string; slug: string }[];
}

interface NoteCardProps {
  note: NoteData;
  onLikeToggle?: (noteId: number, liked: boolean, newCount: number) => void;
  onSaveToggle?: (noteId: number, saved: boolean) => void;
  onDelete?: (noteId: number) => void;
}

export default memo(function NoteCard({ note, onLikeToggle, onSaveToggle, onDelete }: NoteCardProps) {
  const author = note.profiles;
  const router = useRouter();
  const { requireAuth } = useAuthModal();
  const { user: currentUser } = useUser();
  const [liked, setLiked] = useState(note.is_liked || false);
  const [likeCount, setLikeCount] = useState(note.like_count || 0);
  const [replyCount, setReplyCount] = useState(note.reply_count || 0);
  const [saved, setSaved] = useState(note.is_saved || false);
  const [saveCount, setSaveCount] = useState(note.save_count || 0);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const isOwn = currentUser?.id === note.author_id;
  const images = note.images || [];

  const handleLike = async () => {
    const user = await requireAuth();
    if (!user) return;

    const newLiked = !liked;
    const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    setLiked(newLiked);
    setLikeCount(newCount);
    if (newLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 400);
    }

    try {
      const res = await fetch(`/api/notes/${note.id}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.like_count);
        onLikeToggle?.(note.id, data.liked, data.like_count);
      } else {
        setLiked(!newLiked);
        setLikeCount(note.like_count);
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          feedimAlert("error", data.error || "Gunluk begeni limitine ulastin.");
        }
      }
    } catch {
      setLiked(!newLiked);
      setLikeCount(note.like_count);
    }
  };

  const handleSave = async () => {
    const user = await requireAuth();
    if (!user) return;

    const newSaved = !saved;
    setSaved(newSaved);
    setSaveCount(c => c + (newSaved ? 1 : -1));

    try {
      const res = await fetch(`/api/notes/${note.id}/save`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
        setSaveCount(data.save_count ?? saveCount + (data.saved ? 1 : -1));
        onSaveToggle?.(note.id, data.saved);
      } else {
        setSaved(!newSaved);
        setSaveCount(note.save_count || 0);
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          feedimAlert("error", data.error || "Gunluk kaydetme limitine ulastin.");
        }
      }
    } catch {
      setSaved(!newSaved);
      setSaveCount(note.save_count || 0);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: note.content, url: `${window.location.origin}/note/${encodeId(note.id)}` });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${window.location.origin}/note/${encodeId(note.id)}`);
      feedimAlert("success", "Link kopyalandi!");
    }
  };

  const handleDelete = () => {
    feedimAlert("question", "Bu notu silmek istedigine emin misin?", {
      showYesNo: true,
      onYes: async () => {
        try {
          const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
          if (res.ok) {
            onDelete?.(note.id);
          }
        } catch { /* silent */ }
      },
    });
  };

  const handleReplyAdded = () => {
    setReplyCount(prev => prev + 1);
  };

  const openImage = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
    <article className="my-[3px] mx-1 sm:mx-3 py-3.5 px-3 sm:px-4 rounded-[14px] hover:bg-bg-secondary/60 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/u/${author?.username || ""}`} className="shrink-0">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={author.username} className="h-8 w-8 rounded-full object-cover" loading="lazy" />
          ) : (
            <img className="default-avatar-auto h-8 w-8 rounded-full object-cover" alt="" loading="lazy" />
          )}
        </Link>
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Link href={`/u/${author?.username || ""}`} className="text-[0.82rem] font-semibold truncate hover:underline">
            @{author?.username || "Anonim"}
          </Link>
          {author?.is_verified && <VerifiedBadge variant={getBadgeVariant(author?.premium_plan)} />}
          <span className="text-[0.68rem] text-text-muted shrink-0">· {formatRelativeDate(note.created_at)}</span>
        </div>
        {isOwn && (
          <button onClick={handleDelete} className="i-btn !w-7 !h-7 text-text-muted hover:text-text-primary shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Clickable content area — navigates to /note/[hash] */}
      <Link href={`/note/${encodeId(note.id)}`} className="block">
        {/* Content — hashtags rendered as inline links */}
        <p className="text-[0.9rem] leading-relaxed text-text-primary whitespace-pre-wrap break-words mb-1.5">
          {renderNoteContent(note.content, note.tags)}
        </p>

        {/* Image grid — Twitter style */}
        {images.length > 0 && (
          <div
            className={`mt-2 mb-2 rounded-xl overflow-hidden ${
              images.length === 1 ? "grid grid-cols-1" :
              "grid grid-cols-2 gap-0.5"
            }`}
            style={{ maxHeight: images.length === 1 ? 320 : 260 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openImage(0); }}
          >
            {images.length === 1 && (
              <div className="w-full h-full">
                <img
                  src={images[0]}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ maxHeight: 320 }}
                  loading="lazy"
                />
              </div>
            )}

            {images.length === 2 && images.map((url, i) => (
              <div key={i} className="w-full h-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openImage(i); }}>
                <img src={url} alt="" className="w-full h-full object-cover" style={{ maxHeight: 260 }} loading="lazy" />
              </div>
            ))}

            {images.length >= 3 && (
              <>
                <div className="w-full h-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openImage(0); }}>
                  <img src={images[0]} alt="" className="w-full h-full object-cover" style={{ maxHeight: 260 }} loading="lazy" />
                </div>
                <div className="w-full h-full relative" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openImage(1); }}>
                  <img src={images[1]} alt="" className="w-full h-full object-cover" style={{ maxHeight: 260 }} loading="lazy" />
                  {images.length > 2 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                      <span className="text-white text-xl font-bold">+{images.length - 2}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-5 mt-1 -ml-1">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 text-[0.72rem] transition group ${
            liked ? "text-error" : "text-text-muted hover:text-error"
          }`}
        >
          <Heart
            className={`h-[17px] w-[17px] transition-transform ${likeAnimating ? "scale-125" : ""}`}
            fill={liked ? "currentColor" : "none"}
          />
          {likeCount > 0 && <span>{formatCount(likeCount)}</span>}
        </button>

        <button
          onClick={() => setRepliesOpen(true)}
          className="flex items-center gap-1 text-[0.72rem] text-text-muted hover:text-accent-main transition"
        >
          <MessageCircle className="h-[17px] w-[17px]" />
          {replyCount > 0 && <span>{formatCount(replyCount)}</span>}
        </button>

        <button
          onClick={handleSave}
          className={`flex items-center gap-1 text-[0.72rem] transition ${
            saved ? "text-accent-main" : "text-text-muted hover:text-accent-main"
          }`}
        >
          <Bookmark className="h-[17px] w-[17px]" fill={saved ? "currentColor" : "none"} />
          {saveCount > 0 && <span>{formatCount(saveCount)}</span>}
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-[0.72rem] text-text-muted hover:text-text-primary transition"
        >
          <ShareIcon className="h-[17px] w-[17px]" />
        </button>

        {(note.view_count ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[0.72rem] text-text-muted ml-auto">
            <Eye className="h-[15px] w-[15px]" />
            {formatCount(note.view_count!)}
          </span>
        )}
      </div>
    </article>

    {/* Replies modal */}
    <Suspense fallback={null}>
      <NoteRepliesModal
        open={repliesOpen}
        onClose={() => setRepliesOpen(false)}
        noteId={note.id}
        replyCount={replyCount}
        onReplyAdded={handleReplyAdded}
      />
    </Suspense>

    {/* Image viewer */}
    {viewerOpen && (
      <Suspense fallback={null}>
        <ImageViewer
          images={images.map(url => ({ src: url, alt: "" }))}
          initialIndex={viewerIndex}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      </Suspense>
    )}
    </>
  );
});
