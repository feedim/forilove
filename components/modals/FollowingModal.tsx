"use client";

import UserListModal from "./UserListModal";

interface FollowingModalProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

export default function FollowingModal({ open, onClose, username }: FollowingModalProps) {
  return (
    <UserListModal
      open={open}
      onClose={onClose}
      title="Takip Edilenler"
      infoText="Bu kullanicinin takip ettigi kisiler burada listelenir."
      fetchUrl={`/api/users/${username}/following`}
      emptyText="Henuz takip edilen yok"
      filterTabs={[
        { key: "verified", label: "Dogrulanmis" },
        { key: "all", label: "Tumu" },
      ]}
    />
  );
}
