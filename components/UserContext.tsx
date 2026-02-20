"use client";

import { createContext, useContext } from "react";

export interface InitialUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  accountType: string;
  isPremium: boolean;
  premiumPlan: string | null;
  isVerified: boolean;
  role: string;
}

interface UserContextValue {
  user: InitialUser | null;
  isLoggedIn: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoggedIn: false,
});

export function UserProvider({
  initialUser,
  children,
}: {
  initialUser: InitialUser | null;
  children: React.ReactNode;
}) {
  return (
    <UserContext.Provider value={{ user: initialUser, isLoggedIn: !!initialUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
