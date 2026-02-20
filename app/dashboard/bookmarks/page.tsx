"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/AppLayout";
import PostListSection from "@/components/PostListSection";
import NoteListSection from "@/components/NoteListSection";
import type { NoteData } from "@/components/NoteCard";
import { FEED_PAGE_SIZE, NOTES_PAGE_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type BookmarkTab = "posts" | "notes";

export default function BookmarksPage() {
  const [activeTab, setActiveTab] = useState<BookmarkTab>("posts");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesPage, setNotesPage] = useState(1);
  const [notesHasMore, setNotesHasMore] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const supabase = createClient();

  const loadBookmarks = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const from = (pageNum - 1) * FEED_PAGE_SIZE;
      const to = from + FEED_PAGE_SIZE - 1;

      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("post_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (!bookmarks || bookmarks.length === 0) {
        if (pageNum === 1) setPosts([]);
        setHasMore(false);
        return;
      }

      setHasMore(bookmarks.length >= FEED_PAGE_SIZE);

      const postIds = bookmarks.map(b => b.post_id);
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id, title, slug, excerpt, featured_image, reading_time,
          like_count, comment_count, save_count, published_at,
          profiles!posts_author_id_fkey(user_id, name, surname, full_name, username, avatar_url, is_verified, premium_plan)
        `)
        .in("id", postIds)
        .eq("status", "published");

      // Preserve bookmark order
      const postMap = new Map((postsData || []).map(p => [p.id, p]));
      const ordered = postIds.map(id => postMap.get(id)).filter(Boolean);

      // Normalize profiles
      const normalized = ordered.map((p: any) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
      }));

      if (pageNum === 1) {
        setPosts(normalized);
      } else {
        setPosts(prev => [...prev, ...normalized]);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadNoteBookmarks = useCallback(async (pageNum: number) => {
    setNotesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const from = (pageNum - 1) * NOTES_PAGE_SIZE;
      const to = from + NOTES_PAGE_SIZE - 1;

      const { data: bookmarks } = await supabase
        .from("note_bookmarks")
        .select("note_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (!bookmarks || bookmarks.length === 0) {
        if (pageNum === 1) setNotes([]);
        setNotesHasMore(false);
        setNotesLoaded(true);
        return;
      }

      setNotesHasMore(bookmarks.length >= NOTES_PAGE_SIZE);

      const noteIds = bookmarks.map(b => b.note_id);
      const { data: notesData } = await supabase
        .from("community_notes")
        .select(`
          id, author_id, content, images, like_count, reply_count, save_count, view_count, created_at,
          profiles!community_notes_author_id_fkey(user_id, username, full_name, avatar_url, is_verified, premium_plan),
          note_tags(tag_id, tags(id, name, slug))
        `)
        .in("id", noteIds)
        .eq("status", "published");

      // Preserve order
      const noteMap = new Map((notesData || []).map(n => [n.id, n]));
      const ordered = noteIds.map(id => noteMap.get(id)).filter(Boolean);

      const normalized: NoteData[] = ordered.map((n: any) => {
        const profile = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles;
        const tags = (n.note_tags || []).map((nt: any) => {
          const tag = Array.isArray(nt.tags) ? nt.tags[0] : nt.tags;
          return tag;
        }).filter(Boolean);
        return {
          id: n.id,
          author_id: n.author_id,
          content: n.content,
          like_count: n.like_count,
          reply_count: n.reply_count,
          save_count: n.save_count,
          created_at: n.created_at,
          profiles: profile,
          tags,
          is_saved: true,
        };
      });

      if (pageNum === 1) {
        setNotes(normalized);
      } else {
        setNotes(prev => [...prev, ...normalized]);
      }
      setNotesLoaded(true);
    } catch {
      // Silent
    } finally {
      setNotesLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadBookmarks(1);
  }, []);

  useEffect(() => {
    if (activeTab === "notes" && !notesLoaded) {
      loadNoteBookmarks(1);
    }
  }, [activeTab]);

  const tabs: { key: BookmarkTab; label: string }[] = [
    { key: "posts", label: "Gönderiler" },
    { key: "notes", label: "Notlar" },
  ];

  return (
    <AppLayout headerTitle="Kaydedilenler" hideRightSidebar>
      {/* Tabs */}
      <div className="sticky top-[53px] z-20 bg-bg-primary border-b border-border-primary px-3 sm:px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-0 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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

      <div className="px-2.5 sm:px-3">
        {activeTab === "posts" && (
          <PostListSection
            posts={posts}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={() => { const next = page + 1; setPage(next); loadBookmarks(next); }}
            emptyTitle="Henüz gönderi yok"
            emptyDescription="Beğendiğiniz gönderileri kaydedin, burada görüntülensin."
            emptyIcon={<Bookmark className="h-12 w-12" />}
            skeletonCount={4}
          />
        )}

        {activeTab === "notes" && (
          <NoteListSection
            notes={notes}
            loading={notesLoading}
            hasMore={notesHasMore}
            onLoadMore={() => { const next = notesPage + 1; setNotesPage(next); loadNoteBookmarks(next); }}
            emptyTitle="Henüz kaydedilen not yok"
            emptyDescription="Beğendiğiniz notları kaydedin, burada görüntülensin."
            emptyIcon={<Users className="h-12 w-12" />}
            skeletonCount={4}
          />
        )}
      </div>
    </AppLayout>
  );
}
