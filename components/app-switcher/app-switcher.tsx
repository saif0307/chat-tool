"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Check, LayoutGrid } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { APPS, activeAppIdForPath, type AppId } from "@/lib/apps/app-registry";
import { cn } from "@/lib/cn";

function AppSwitcherList({
  activeId,
  onNavigate,
}: {
  activeId: AppId;
  onNavigate: () => void;
}) {
  return (
    <div className="p-2">
      <p className="text-foreground/45 px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide">
        Switch app
      </p>
      <div className="flex flex-col gap-0.5">
        {APPS.map((app) => {
          const isActive = app.id === activeId;
          const Icon = app.icon;
          return (
            <Link
              key={app.id}
              href={app.href}
              role="menuitem"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                isActive ? "bg-foreground/10" : "hover:bg-foreground/6",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground/70",
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-medium">
                  {app.name}
                </span>
                <span className="text-foreground/50 block truncate text-xs">
                  {app.description}
                </span>
              </span>
              {isActive ? (
                <Check className="text-foreground/60 h-4 w-4 shrink-0" aria-hidden />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

type TriggerVariant = "floating" | "inline";

function AppSwitcherTrigger({
  variant,
  className,
}: {
  variant: TriggerVariant;
  className?: string;
}) {
  const pathname = usePathname();
  const activeId = activeAppIdForPath(pathname ?? "/");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /** Nothing to switch to before authenticating. */
  if (pathname === "/login") return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch app"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          variant === "floating"
            ? "border-foreground/10 bg-background/80 text-foreground/70 hover:bg-foreground/10 hover:text-foreground fixed right-3 top-3 z-50 hidden h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors md:flex"
            : "text-foreground/70 hover:bg-foreground/10 hover:text-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors md:hidden",
          className,
        )}
      >
        <LayoutGrid className={variant === "floating" ? "h-[18px] w-[18px]" : "h-5 w-5"} aria-hidden />
      </button>

      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        align="end"
        sideOffset={10}
        className="w-[min(88vw,300px)]"
      >
        <AppSwitcherList activeId={activeId} onNavigate={() => setOpen(false)} />
      </Popover>
    </>
  );
}

/** Fixed top-right trigger, visible on tablet/desktop where neither app renders its own header chrome. */
export function AppSwitcher() {
  return <AppSwitcherTrigger variant="floating" />;
}

/** Inline trigger meant to be placed inside an app's own mobile header row. */
export function AppSwitcherMobileTrigger({ className }: { className?: string }) {
  return <AppSwitcherTrigger variant="inline" className={className} />;
}
