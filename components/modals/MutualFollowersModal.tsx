"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { UserListSkeleton } from "@/components/Skeletons";
import UserListItem from "@/components/UserListItem";

interface MutualUser {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  is_verified?: boolean;
  premium_plan?: string | null;
}

interface MutualFollowersModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

export default function MutualFollowersModal({ open, onClose, username }: MutualFollowersModalProps) {
  const [users, setUsers] = useState<MutualUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) loadMutuals();
  }, [open]);

  const loadMutuals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${username}/mutual-followers`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Ortak Takipçiler" size="md" infoText="Her ikinizin de takip ettiği kişiler burada listelenir." centerOnDesktop>
      <div className="px-4 py-3">
        {loading ? (
          <UserListSkeleton count={5} />
        ) : users.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">Ortak takipçi yok</p>
        ) : (
          <div className="space-y-1">
            {users.map(u => (
              <UserListItem
                key={u.user_id}
                user={u}
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
