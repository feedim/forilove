"use client";

import UserListModal from "./UserListModal";

interface LikesModalProps {
  open: boolean;
  onClose: () => void;
  postId: number;
}

export default function LikesModal({ open, onClose, postId }: LikesModalProps) {
  return (
    <UserListModal
      open={open}
      onClose={onClose}
      title="Begeniler"
      infoText="Gonderiyi begenen kisiler burada listelenir."
      fetchUrl={`/api/posts/${postId}/likes`}
      emptyText="Henuz begeni yok"
      filterTabs={[
        { key: "verified", label: "Dogrulanmis" },
        { key: "all", label: "Tumu" },
        { key: "following", label: "Takip Edilenler" },
      ]}
    />
  );
}
