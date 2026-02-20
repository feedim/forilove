import { ReactNode } from "react";
import NoteCard, { type NoteData } from "@/components/NoteCard";
import { NoteListSkeleton } from "@/components/Skeletons";
import EmptyState from "@/components/EmptyState";
import LoadMoreTrigger from "@/components/LoadMoreTrigger";

interface NoteListSectionProps {
  notes: NoteData[];
  loading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode | { label: string; href?: string; onClick?: () => void };
  skeletonCount?: number;
  onLikeToggle?: (noteId: number, liked: boolean, newCount: number) => void;
  onSaveToggle?: (noteId: number, saved: boolean) => void;
  onDelete?: (noteId: number) => void;
}

export default function NoteListSection({
  notes,
  loading,
  hasMore = false,
  onLoadMore,
  emptyTitle = "Henüz not yok",
  emptyDescription = "",
  emptyIcon,
  emptyAction,
  skeletonCount = 6,
  onLikeToggle,
  onSaveToggle,
  onDelete,
}: NoteListSectionProps) {
  if (loading && notes.length === 0) {
    return <NoteListSkeleton count={skeletonCount} />;
  }

  if (notes.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onLikeToggle={onLikeToggle}
          onSaveToggle={onSaveToggle}
          onDelete={onDelete}
        />
      ))}
      {onLoadMore && <LoadMoreTrigger onLoadMore={onLoadMore} loading={loading} hasMore={hasMore} />}
    </>
  );
}
