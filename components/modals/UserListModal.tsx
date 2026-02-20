"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "./Modal";
import { UserListSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";
import LoadMoreTrigger from "@/components/LoadMoreTrigger";
import FollowButton from "@/components/FollowButton";
import UserListItem from "@/components/UserListItem";

interface User {
  user_id: string;
  username: string;
  full_name?: string;
  name?: string;
  avatar_url?: string;
  is_verified?: boolean;
  premium_plan?: string | null;
  is_following?: boolean;
  is_own?: boolean;
}

export interface FilterTab {
  key: string;
  label: string;
}

const DEFAULT_FILTER_TABS: FilterTab[] = [
  { key: "verified", label: "Dogrulanmis" },
  { key: "all", label: "Tumu" },
  { key: "following", label: "Takip Edilenler" },
];

export interface UserListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  infoText: string;
  fetchUrl: string;
  emptyText: string;
  filterTabs?: FilterTab[];
}

export default function UserListModal({
  open,
  onClose,
  title,
  infoText,
  fetchUrl,
  emptyText,
  filterTabs = DEFAULT_FILTER_TABS,
}: UserListModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState(filterTabs[0]?.key || "all");

  useEffect(() => {
    if (open) {
      setPage(1);
      setFilter(filterTabs[0]?.key || "all");
      loadUsers(1);
    }
  }, [open]);

  const loadUsers = async (pageNum: number) => {
    setLoading(true);
    try {
      const separator = fetchUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${fetchUrl}${separator}page=${pageNum}`);
      const data = await res.json();
      if (pageNum === 1) {
        setUsers(data.users || []);
      } else {
        setUsers(prev => [...prev, ...(data.users || [])]);
      }
      setHasMore(data.hasMore || false);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (filter === "verified") return users.filter(u => u.is_verified);
    if (filter === "following") return users.filter(u => u.is_following);
    return users;
  }, [users, filter]);

  const handleFollow = async (targetUsername: string, userId: string) => {
    setToggling(prev => new Set(prev).add(userId));
    const user = users.find(u => u.user_id === userId);
    const wasFollowing = user?.is_following;

    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_following: !wasFollowing } : u));

    const res = await fetch(`/api/users/${targetUsername}/follow`, { method: "POST" });
    if (!res.ok) {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_following: wasFollowing } : u));
    }
    setToggling(prev => { const s = new Set(prev); s.delete(userId); return s; });
  };

  const filterEmptyText = (key: string) => {
    if (key === "verified") return "Dogrulanmis hesap yok";
    if (key === "following") return "Takip ettiginiz kimse yok";
    return "Sonuc yok";
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="md" infoText={infoText} centerOnDesktop>
      {/* Filter tabs */}
      <div className="flex gap-0 px-4 border-b border-border-primary overflow-x-auto scrollbar-hide">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-4 py-2.5 text-[0.8rem] font-semibold whitespace-nowrap border-b-2 transition-colors",
              filter === tab.key
                ? "border-accent-main text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-3 min-h-[300px]">
        {loading && users.length === 0 ? (
          <UserListSkeleton count={5} />
        ) : users.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">{emptyText}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">
            {filterEmptyText(filter)}
          </p>
        ) : (
          <div className="space-y-1">
            {filteredUsers.map(u => (
              <UserListItem
                key={u.user_id}
                user={u}
                onNavigate={onClose}
                action={!u.is_own ? (
                  <FollowButton following={!!u.is_following} onClick={() => handleFollow(u.username, u.user_id)} disabled={toggling.has(u.user_id)} />
                ) : undefined}
              />
            ))}
            <LoadMoreTrigger onLoadMore={() => { setPage(p => p + 1); loadUsers(page + 1); }} loading={loading} hasMore={hasMore} />
          </div>
        )}
      </div>
    </Modal>
  );
}
