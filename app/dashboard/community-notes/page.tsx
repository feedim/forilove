"use client";

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { PenLine, Users } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import NoteListSection from "@/components/NoteListSection";
import { NoteListSkeleton } from "@/components/Skeletons";
import { useUser } from "@/components/UserContext";
import { useAuthModal } from "@/components/AuthModal";
import { cn } from "@/lib/utils";
import type { NoteData } from "@/components/NoteCard";

const NoteComposeModal = lazy(() => import("@/components/modals/NoteComposeModal"));

type NoteTab = "for-you" | "following";

export default function CommunityNotesPage() {
  const { user: ctxUser, isLoggedIn } = useUser();
  const { requireAuth } = useAuthModal();
  const [activeTab, setActiveTab] = useState<NoteTab>("for-you");
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const loadNotes = useCallback(async (tab: NoteTab, pageNum: number) => {
    try {
      const res = await fetch(`/api/notes?tab=${tab}&page=${pageNum}`);
      const data = await res.json();
      if (pageNum === 1) {
        setNotes(data.notes || []);
      } else {
        setNotes(prev => [...prev, ...(data.notes || [])]);
      }
      setHasMore(data.hasMore || false);
      setPage(pageNum);
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadNotes("for-you", 1).then(() => setLoading(false));
  }, []);

  const handleTabChange = async (tab: NoteTab) => {
    setActiveTab(tab);
    setNotes([]);
    setPage(1);
    setLoading(true);
    await loadNotes(tab, 1);
    setLoading(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    await loadNotes(activeTab, page + 1);
    setLoadingMore(false);
  };

  const handleCompose = async () => {
    const user = await requireAuth();
    if (!user) return;
    setComposeOpen(true);
  };

  const handleNoteCreated = (note: any) => {
    if (note && note.status === "published") {
      // Reload feed to show the new note
      setLoading(true);
      setPage(1);
      loadNotes(activeTab, 1).then(() => setLoading(false));
    }
  };

  const handleLikeToggle = (noteId: number, liked: boolean, newCount: number) => {
    setNotes(prev =>
      prev.map(n => n.id === noteId ? { ...n, is_liked: liked, like_count: newCount } : n)
    );
  };

  const handleSaveToggle = (noteId: number, saved: boolean) => {
    setNotes(prev =>
      prev.map(n => n.id === noteId ? { ...n, is_saved: saved } : n)
    );
  };

  const handleDelete = (noteId: number) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const tabs: { key: NoteTab; label: string }[] = [
    { key: "for-you", label: "Senin İçin" },
    { key: "following", label: "Takip" },
  ];

  return (
    <AppLayout scrollableHeader>
      {/* Compose box */}
      <div className="px-2.5 sm:px-3 mt-4 mb-3">
        <button
          onClick={handleCompose}
          className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition hover:opacity-80 bg-bg-secondary/60 rounded-[18px]"
        >
          {ctxUser?.avatarUrl ? (
            <img src={ctxUser.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-accent-main/10 text-accent-main flex items-center justify-center shrink-0">
              <PenLine className="h-4 w-4" />
            </div>
          )}
          <span className="flex-1 text-left text-[0.95rem] text-text-muted">Ne düşünüyorsun?</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-bg-primary border-b border-border-primary px-3 sm:px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-0 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "px-4 py-3 text-[0.97rem] font-bold whitespace-nowrap border-b-[2.5px] transition-colors",
                activeTab === tab.key
                  ? "border-accent-main text-text-primary"
                  : "border-transparent text-text-muted opacity-60 hover:opacity-100 hover:text-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <NoteListSkeleton count={6} />
      ) : (
        <NoteListSection
          notes={notes}
          loading={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          emptyTitle="Henüz not yok"
          emptyDescription={
            activeTab === "for-you"
              ? "İlk notunuzu paylaşarak başlayın!"
              : "Takip ettiğiniz kullanıcıların notları burada görünecek."
          }
          emptyIcon={<Users className="h-12 w-12" />}
          onLikeToggle={handleLikeToggle}
          onSaveToggle={handleSaveToggle}
          onDelete={handleDelete}
        />
      )}

      {/* Compose Modal */}
      <Suspense fallback={null}>
        <NoteComposeModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          onSuccess={handleNoteCreated}
        />
      </Suspense>
    </AppLayout>
  );
}
