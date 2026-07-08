import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="bg-foreground/6 text-foreground/40 flex h-12 w-12 items-center justify-center rounded-2xl">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      <p className="text-foreground/55 max-w-sm text-sm leading-relaxed">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="bg-foreground text-background hover:opacity-90 mt-2 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
