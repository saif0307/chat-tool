"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span className="border-foreground/15 inline-flex h-9 w-[5.5rem] shrink-0 rounded-lg border bg-transparent" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="border-foreground/15 bg-background text-foreground/85 hover:bg-foreground/5 inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span aria-hidden className="text-base leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
