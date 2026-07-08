"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, LayoutDashboard, Plus, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Kept intentionally small — every entry here must lead to a fully working page. */
const NAV_ITEMS: NavItem[] = [
  { href: "/studio", label: "Dashboard", icon: LayoutDashboard },
  { href: "/studio/recent", label: "Recent Work", icon: Clock3 },
  { href: "/studio/settings", label: "Settings", icon: Settings },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/studio") return pathname === "/studio";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StudioNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/studio";

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-4">
      <Link
        href="/studio/workspace"
        onClick={onNavigate}
        className="bg-foreground text-background hover:opacity-90 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-opacity"
      >
        <Plus className="h-4 w-4" aria-hidden />
        New project
      </Link>

      <div className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/60 hover:bg-foreground/6 hover:text-foreground",
              )}
            >
              <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
