"use client";

import UserListModal from "./UserListModal";

interface FollowersModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

export default function FollowersModal({ open, onClose, username }: FollowersModalProps) {
  return (
    <UserListModal
      open={open}
      onClose={onClose}
      title="Takipciler"
      infoText="Bu kullaniciyi takip eden kisiler burada listelenir."
      fetchUrl={`/api/users/${username}/followers`}
      emptyText="Henuz takipci yok"
      filterTabs={[
        { key: "verified", label: "Dogrulanmis" },
        { key: "all", label: "Tumu" },
        { key: "following", label: "Takip Edilenler" },
      ]}
    />
  );
}
