"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/cn";

type Align = "start" | "end";

export type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: Align;
  /** Gap between the anchor's bottom edge and the panel, in px. */
  sideOffset?: number;
  className?: string;
  children: ReactNode;
};

type Position = { top: number; left?: number; right?: number };

/**
 * Generic floating panel primitive: viewport-aware positioning relative to an anchor,
 * outside-click + Escape to close, portal to <body> so it never gets clipped by
 * `overflow-hidden` ancestors. Shared across apps (App Switcher today, Content Studio menus later).
 */
export function Popover({
  open,
  onOpenChange,
  anchorRef,
  align = "end",
  sideOffset = 10,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const recalc = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    if (align === "end") {
      setPosition({
        top: rect.bottom + sideOffset,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    } else {
      setPosition({
        top: rect.bottom + sideOffset,
        left: Math.max(8, rect.left),
      });
    }
  }, [anchorRef, align, sideOffset]);

  useLayoutEffect(() => {
    if (!open) return;
    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open, recalc]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange, anchorRef]);

  if (!mounted || !open || !position) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        right: position.right,
      }}
      className={cn(
        "cs-popover-in border-foreground/10 bg-background/95 z-50 max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-2xl shadow-black/20 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
