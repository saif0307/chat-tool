"use client";

import { useTheme } from "next-themes";
import { forwardRef, useEffect, useState } from "react";
import { Tooltip } from "@/components/tooltip";

type Props = {
  variant?: "full" | "icon";
};

export const ThemeToggle = forwardRef<HTMLButtonElement, Props>(
  function ThemeToggle({ variant = "full" }, ref) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
      return (
        <span
          className={
            variant === "icon"
              ? "inline-flex h-9 w-9 shrink-0 rounded-lg bg-transparent"
              : "inline-flex h-9 w-[5.5rem] shrink-0 rounded-lg bg-transparent"
          }
          aria-hidden
        />
      );
    }

    const isDark = resolvedTheme === "dark";
    const tip = isDark ? "Switch to light mode" : "Switch to dark mode";

    const btn = (
      <button
        ref={ref}
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={
          variant === "icon"
            ? "text-foreground/70 hover:bg-foreground/10 hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base leading-none transition-colors"
            : "text-foreground/75 hover:bg-foreground/10 hover:text-foreground inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors"
        }
      >
        <span aria-hidden className="text-base leading-none">
          {isDark ? "☀️" : "🌙"}
        </span>
        {variant === "full" ? (
          <span>{isDark ? "Light" : "Dark"}</span>
        ) : null}
      </button>
    );

    return <Tooltip content={tip}>{btn}</Tooltip>;
  },
);
