"use client";

import { useState, useEffect, useRef } from "react";
import { Heart, Trash2, MoreHorizontal } from "lucide-react";
import { useUser } from "@/components/UserContext";
import { useAuthModal } from "@/components/AuthModal";
import { feedimAlert } from "@/components/FeedimAlert";
import { formatRelativeDate, cn, formatCount } from "@/lib/utils";
import Modal from "./Modal";
import VerifiedBadge, { getBadgeVariant } from "@/components/VerifiedBadge";
import LoadMoreTrigger from "@/components/LoadMoreTrigger";
import { isBlockedContent } from "@/lib/blockedWords";
import { NoteListSkeleton } from "@/components/Skeletons";

interface Reply {
  id: number;
  note_id: number;
  author_id: string;
  content: string;
  like_count: number;
  created_at: string;
  profiles?: {
    user_id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
    is_verified?: boolean;
    premium_plan?: string | null;
  };
}

interface NoteRepliesModalProps {
  open: boolean;
  onClose: () => void;
  noteId: number;
  replyCount: number;
  onReplyAdded?: () => void;
}

export default function NoteRepliesModal({ open, onClose, noteId, replyCount, onReplyAdded }: NoteRepliesModalProps) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(replyCount);
  const [newReply, setNewReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [likedReplies, setLikedReplies] = useState<Set<number>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const { requireAuth } = useAuthModal();
  const { user: ctxUser } = useUser();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = 500;

  useEffect(() => {
    if (open) {
      setPage(1);
      setTotalCount(replyCount);
      loadReplies(1);
    }
  }, [open]);

  const loadReplies = async (pageNum: number) => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/replies?page=${pageNum}`);
      const data = await res.json();
      if (res.ok) {
        if (pageNum === 1) {
          setReplies(data.replies || []);
        } else {
          setReplies(prev => [...prev, ...(data.replies || [])]);
        }
        setHasMore(data.hasMore);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim() || submitting) return;

    const user = await requireAuth();
    if (!user) return;

    const content = newReply.trim();
    const tempId = -Date.now();

    // Optimistic: add reply immediately
    const optimisticReply: Reply = {
      id: tempId,
      note_id: noteId,
      author_id: ctxUser?.id || "",
      content,
      like_count: 0,
      created_at: new Date().toISOString(),
      profiles: ctxUser ? {
        user_id: ctxUser.id,
        username: ctxUser.username || "",
        full_name: ctxUser.fullName || undefined,
        avatar_url: ctxUser.avatarUrl || undefined,
        is_verified: ctxUser.isVerified,
        premium_plan: ctxUser.premiumPlan,
      } : undefined,
    };

    setReplies(prev => [...prev, optimisticReply]);
    setTotalCount(c => c + 1);
    setNewReply("");
    onReplyAdded?.();

    // Background API call
    try {
      const res = await fetch(`/api/notes/${noteId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Rollback
        setReplies(prev => prev.filter(r => r.id !== tempId));
        setTotalCount(c => c - 1);
        feedimAlert("error", data.error || "Yanit gonderilemedi");
        return;
      }

      // Replace temp with real reply
      setReplies(prev => prev.map(r => r.id === tempId ? data.reply : r));
    } catch {
      setReplies(prev => prev.filter(r => r.id !== tempId));
      setTotalCount(c => c - 1);
      feedimAlert("error", "Yanit gonderilemedi");
    }
  };

  const handleDelete = (replyId: number) => {
    feedimAlert("question", "Bu yaniti silmek istedigine emin misin?", {
      showYesNo: true,
      onYes: async () => {
        try {
          const res = await fetch(`/api/notes/${noteId}/replies/${replyId}`, { method: "DELETE" });
          if (res.ok) {
            setReplies(prev => prev.filter(r => r.id !== replyId));
            setTotalCount(c => c - 1);
          }
        } catch { /* silent */ }
      },
    });
  };

  const handleLike = async (replyId: number) => {
    // Note replies don't have a dedicated like endpoint yet — placeholder for future
    // For now just toggle UI
    const isLiked = likedReplies.has(replyId);
    setLikedReplies(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(replyId); else next.add(replyId);
      return next;
    });
    setReplies(prev => prev.map(r =>
      r.id === replyId ? { ...r, like_count: r.like_count + (isLiked ? -1 : 1) } : r
    ));
  };

  const replyFormFooter = (
    <div className="z-[99998] px-3 py-[2px] pb-[env(safe-area-inset-bottom,8px)]">
      <form onSubmit={handleSubmit} className="flex flex-col my-[10px]">
        <div className="flex flex-1 items-end rounded-[24px] bg-bg-tertiary">
          <textarea
            ref={inputRef}
            value={newReply}
            onChange={e => setNewReply(e.target.value)}
            maxLength={maxLength}
            placeholder="Yanitini yaz..."
            rows={1}
            className="flex-1 py-[13px] pl-[18px] pr-[4px] bg-transparent outline-none border-none shadow-none resize-none text-[0.9rem] text-text-readable min-h-[35px] max-h-[120px] align-middle placeholder:text-text-muted"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            style={{ fontFamily: "inherit" }}
          />
          {newReply.trim() && (
            <div className="flex items-center shrink-0 my-[9px] mr-[7px]">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center h-[35px] w-auto min-w-[53px] rounded-[2rem] bg-bg-inverse text-bg-primary disabled:opacity-50 transition shrink-0"
              >
                {submitting ? (
                  <span className="loader" style={{ width: 16, height: 16, borderTopColor: "var(--bg-primary)" }} />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 6V18M12 6L7 11M12 6L17 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
        {newReply.length > 0 && (
          <div className="flex justify-end mt-1 px-3">
            <span className={cn(
              "text-[0.66rem] tabular-nums",
              newReply.length >= maxLength - 20 ? "text-error" : "text-text-muted/60"
            )}>
              {newReply.length}/{maxLength}
            </span>
          </div>
        )}
      </form>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Yanitlar (${totalCount})`}
      size="md"
      footer={replyFormFooter}
      fullHeight
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide overscroll-contain modal-scroll-content relative" onScroll={() => openMenuId && setOpenMenuId(null)}>
          {loading && replies.length === 0 ? (
            <NoteListSkeleton count={3} />
          ) : replies.length === 0 ? (
            <div className="flex absolute inset-0 items-center justify-center">
              <div className="flex flex-col items-center mb-[20%] opacity-60 text-center">
                <h6 className="font-semibold text-base mb-2">Henuz yanit yok</h6>
                <p className="text-[0.9rem] text-text-muted mt-[3px]">Ilk yaniti sen ver</p>
              </div>
            </div>
          ) : (
            <ol className="list-none m-0">
              {replies.filter(r => r.author_id === ctxUser?.id || !isBlockedContent(r.content)).map(reply => (
                <li key={reply.id}>
                  <div className="flex flex-row w-full py-[9px] px-[11px]">
                    <div className="shrink-0 mt-0.5">
                      <a href={`/u/${reply.profiles?.username || ""}`}>
                        {reply.profiles?.avatar_url ? (
                          <img src={reply.profiles.avatar_url} alt="" className="h-[34px] w-[34px] rounded-full object-cover" />
                        ) : (
                          <img className="default-avatar-auto h-[34px] w-[34px] rounded-full object-cover" alt="" />
                        )}
                      </a>
                    </div>
                    <div className="flex flex-col items-start flex-1 min-w-0 ml-[7px]">
                      <div className="flex w-full justify-between mt-[5px]">
                        <div className="flex flex-col items-start">
                          <a href={`/u/${reply.profiles?.username || ""}`} className="flex items-center gap-1 text-[0.8rem] font-bold leading-tight text-text-primary hover:underline">
                            <span className="line-clamp-1">@{reply.profiles?.username || "Anonim"}</span>
                            {reply.profiles?.is_verified && <VerifiedBadge variant={getBadgeVariant(reply.profiles?.premium_plan)} />}
                          </a>
                          <span className="text-[0.7rem] text-text-muted mt-0.5">
                            {formatRelativeDate(reply.created_at)}
                          </span>
                        </div>
                        {ctxUser?.id === reply.author_id && (
                          <button
                            onClick={() => setOpenMenuId(openMenuId === reply.id ? null : reply.id)}
                            className="flex items-center justify-center h-[30px] w-[30px] rounded-full text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition shrink-0"
                          >
                            <MoreHorizontal className="h-[18px] w-[18px]" />
                          </button>
                        )}
                      </div>

                      {/* Menu */}
                      {openMenuId === reply.id && ctxUser?.id === reply.author_id && (
                        <>
                          <div className="fixed inset-0 z-[99990] bg-black/40" onClick={() => setOpenMenuId(null)} />
                          <div className="fixed inset-x-0 bottom-0 z-[99991] bg-bg-elevated rounded-t-2xl shadow-xl py-2 px-2 pb-[env(safe-area-inset-bottom,8px)] animate-[slideInBottom_0.22s_ease-out]">
                            <div className="w-10 h-1 rounded-full bg-text-muted/20 mx-auto mb-2" />
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(reply.id); }}
                              className="flex items-center gap-3 px-4 py-3.5 text-[0.88rem] text-error hover:bg-error/10 transition w-full text-left rounded-[12px]"
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                              Yaniti sil
                            </button>
                          </div>
                        </>
                      )}

                      <p className="w-full max-w-full text-[0.82rem] leading-[1.5] text-text-readable mt-1 break-words pr-[26px] whitespace-pre-wrap">
                        {reply.content}
                      </p>

                      <div className="flex items-center gap-3 mt-[5px]">
                        <button
                          onClick={() => handleLike(reply.id)}
                          className={cn(
                            "flex items-center gap-1 text-xs transition",
                            likedReplies.has(reply.id) ? "text-red-500" : "text-text-muted hover:text-red-500"
                          )}
                        >
                          <Heart className={cn("h-[14px] w-[14px]", likedReplies.has(reply.id) && "fill-current")} />
                          {reply.like_count > 0 && <span>{formatCount(reply.like_count)}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              <li>
                <LoadMoreTrigger onLoadMore={() => { const next = page + 1; setPage(next); loadReplies(next); }} loading={loadingMore} hasMore={hasMore} />
              </li>
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
