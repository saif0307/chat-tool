"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const configError = searchParams.get("error") === "config";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-background text-foreground relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <ThemeToggle />
      </div>
      <div className="border-foreground/10 bg-background w-full max-w-sm rounded-2xl border p-8 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
        <p className="text-foreground/60 mt-1 text-sm">
          Enter the site password to use the chat.
        </p>

        {configError && (
          <p className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 mt-4 rounded-lg border px-3 py-2 text-sm">
            Server is missing valid auth configuration (check AUTH_SECRET on the host).
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-foreground/70 text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-foreground/15 bg-background text-foreground focus:ring-foreground/20 mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
              required
              disabled={pending}
            />
          </label>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !password}
            className="bg-foreground text-background hover:opacity-90 w-full rounded-lg py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="text-foreground/50 flex min-h-dvh items-center justify-center text-sm">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
