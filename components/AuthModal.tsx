"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

/* ─── Types ─── */

interface AuthModalContextValue {
  requireAuth: (returnPath?: string) => Promise<User | null>;
}

/* ─── Context ─── */

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

/* ─── Provider ─── */

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [returnPath, setReturnPath] = useState<string | undefined>();
  const resolveRef = useRef<((user: User | null) => void) | null>(null);
  const supabase = createClient();

  const requireAuth = useCallback(async (rp?: string): Promise<User | null> => {
    // Already logged in? Return user immediately
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user;

    // Open modal and wait
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setReturnPath(rp);
      setOpen(true);
    });
  }, [supabase]);

  const handleClose = useCallback(() => {
    resolveRef.current?.(null);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const handleSuccess = useCallback((user: User) => {
    resolveRef.current?.(user);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  return (
    <AuthModalContext.Provider value={{ requireAuth }}>
      {children}
      {open && (
        <AuthModalSheet
          onClose={handleClose}
          onSuccess={handleSuccess}
          returnPath={returnPath}
        />
      )}
    </AuthModalContext.Provider>
  );
}

/* ─── Bottom Sheet Modal ─── */

interface SheetProps {
  onClose: () => void;
  onSuccess: (user: User) => void;
  returnPath?: string;
}

function AuthModalSheet({ onClose, onSuccess, returnPath }: SheetProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Reset form when switching tabs
  useEffect(() => {
    setError(null);
    setPassword("");
  }, [tab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message === "Invalid login credentials") {
          setError("E-posta veya sifre yanlis.");
        } else if (authError.message.includes("Email not confirmed")) {
          setError("E-posta adresinizi onaylamaniz gerekiyor.");
        } else {
          setError("Giris yapilamadi. Lutfen tekrar deneyin.");
        }
        return;
      }

      if (data.user) {
        onSuccess(data.user);
      }
    } catch {
      setError("Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            surname,
            full_name: `${name} ${surname}`,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        if (authError.message.includes("User already registered")) {
          setError("Bu e-posta adresi zaten kullaniliyor.");
        } else if (authError.message.includes("Password")) {
          setError("Sifre en az 6 karakter olmalidir.");
        } else {
          setError("Kayit olusturulamadi.");
        }
        return;
      }

      // Wait for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update profile with name and surname
      if (data.user) {
        await supabase
          .from("profiles")
          .update({ name, surname })
          .eq("user_id", data.user.id);
      }

      if (data.session && data.user) {
        onSuccess(data.user);
      } else {
        // Email confirmation required
        setError("Kayit basarili! Lutfen e-postanizi kontrol edin ve dogrulayin, ardindan giris yapin.");
        setTab("login");
      }
    } catch {
      setError("Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async () => {
    // Save returnPath for OAuth callback
    const redirectPath = returnPath || window.location.pathname;
    const returnTo = redirectPath.startsWith("/editor/") ? redirectPath : undefined;

    const redirectUrl = returnTo
      ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`
      : `${window.location.origin}/auth/callback`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (oauthError) {
      setError("Google ile giris yapilamadi.");
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999999] flex items-end justify-center bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] bg-zinc-900 rounded-t-[32px] p-6 flex flex-col gap-4 animate-[slideUp_0.25s_ease-out] max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">
              {tab === "login" ? "Giris Yap" : "Hesap Olustur"}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Devam etmek icin giris yapin veya kayit olun
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Kapat"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === "login"
                ? "bg-pink-500 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Giris Yap
          </button>
          <button
            onClick={() => setTab("register")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === "register"
                ? "bg-pink-500 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Kayit Ol
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-[13px] text-red-500 text-center bg-red-500/10 rounded-lg py-2 px-3">{error}</p>
        )}

        {/* Login Form */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              autoComplete="email"
              className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                maxLength={128}
                autoComplete="current-password"
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                "Giris Yap"
              )}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Ad"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                autoComplete="given-name"
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition"
              />
              <input
                type="text"
                placeholder="Soyad"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                required
                maxLength={50}
                autoComplete="family-name"
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition"
              />
            </div>
            <input
              type="email"
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              autoComplete="email"
              className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sifre (en az 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/50 transition pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 cursor-pointer"
              />
              <span className="text-xs text-zinc-400 leading-snug">
                <Link href="/terms" target="_blank" className="text-pink-500 hover:text-pink-400 underline">
                  Kullanim Kosullari
                </Link>
                &apos;ni ve{" "}
                <Link href="/privacy" target="_blank" className="text-pink-500 hover:text-pink-400 underline">
                  Gizlilik Politikasi
                </Link>
                &apos;ni kabul ediyorum.
              </span>
            </label>
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                "Kayit Ol"
              )}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-zinc-900 text-zinc-500">veya</span>
          </div>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleOAuth}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-black rounded-xl hover:bg-gray-100 transition font-semibold text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google ile devam et
        </button>
      </div>
    </div>,
    document.body
  );
}
