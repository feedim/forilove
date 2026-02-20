"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoggedIn } = useUser();

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    if (user?.username) {
      router.replace(`/u/${user.username}`);
    } else {
      router.replace("/dashboard");
    }
  }, [isLoggedIn, user, router]);

  return null;
}
