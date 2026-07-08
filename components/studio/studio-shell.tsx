"use client";

import { useState, type ReactNode } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { StudioNav } from "@/components/studio/studio-nav";
import { AppSwitcherMobileTrigger } from "@/components/app-switcher/app-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";

/**
 * Content Studio's own shell: sidebar navigation + mobile header. Deliberately independent from
 * `ChatSidebar` / `ChatApp` — only shared design tokens and primitives are reused.
 */
export function StudioShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="bg-background text-foreground relative flex h-full min-h-0 flex-1">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/45 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "border-foreground/10 bg-background flex min-h-0 w-[min(85vw,272px)] flex-col overflow-hidden border-r transition-transform duration-200 ease-out",
          "fixed inset-y-0 left-0 z-40 md:static md:z-auto md:w-64 md:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-foreground/10 safe-area-pt flex shrink-0 items-center gap-2 border-b px-4 py-4">
          <span className="bg-cs-accent/15 text-cs-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-foreground truncate text-sm font-semibold tracking-tight">
            Content Studio
          </span>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="text-foreground/60 hover:bg-foreground/10 ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors md:hidden"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <StudioNav onNavigate={() => setMobileNavOpen(false)} />

        <div className="border-foreground/10 safe-area-pb flex shrink-0 items-center justify-between border-t px-3 py-3">
          <span className="text-foreground/40 px-1 text-[11px]">Content Studio</span>
          <ThemeToggle variant="icon" />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-foreground/10 bg-zinc-50/95 dark:bg-background/95 safe-area-pt flex shrink-0 items-center gap-2 border-b px-3 py-2 backdrop-blur-sm md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            className="text-foreground/70 hover:bg-foreground/10 hover:text-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">
            Content Studio
          </span>
          <AppSwitcherMobileTrigger />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
