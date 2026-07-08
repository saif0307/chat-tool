import type { ReactNode } from "react";

export function StudioTopbar({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-foreground/10 hidden shrink-0 items-center justify-between gap-4 border-b px-8 py-6 md:flex">
      <div className="min-w-0">
        <h1 className="text-foreground truncate text-lg font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-foreground/55 mt-0.5 max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
