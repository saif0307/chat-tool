"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { StudioTopbar } from "@/components/studio/studio-topbar";
import { getRecentProjects } from "@/lib/content-studio/services/project-service";
import { inferWorkflowStage } from "@/lib/content-studio/workflow";
import { WORKFLOW_STAGES, type ContentProject } from "@/lib/content-studio/types";

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function stageLabel(stage: string): string {
  return WORKFLOW_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function DashboardView() {
  const [recent, setRecent] = useState<ContentProject[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setRecent(getRecentProjects(6));
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StudioTopbar
        title="Dashboard"
        description="Give me a topic — I'll research it, find an angle, write it, and hand you a polished final draft."
        actions={
          <Link
            href="/studio/workspace"
            className="bg-foreground text-background hover:opacity-90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New project
          </Link>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold">Recent work</h2>
            {recent.length > 0 ? (
              <Link
                href="/studio/recent"
                className="text-foreground/55 hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>

          {!mounted ? null : recent.length === 0 ? (
            <div className="border-foreground/10 bg-cs-surface flex flex-col items-center gap-3 rounded-2xl border p-10 text-center">
              <p className="text-foreground text-sm font-medium">No projects yet</p>
              <p className="text-foreground/55 max-w-sm text-sm leading-relaxed">
                Start a new project and tell me what you want to write about — I&apos;ll take it
                from there.
              </p>
              <Link
                href="/studio/workspace"
                className="bg-foreground text-background hover:opacity-90 mt-1 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity"
              >
                <Plus className="h-4 w-4" aria-hidden />
                New project
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recent.map((p) => (
                <Link
                  key={p.id}
                  href={`/studio/workspace/${p.id}`}
                  className="border-foreground/10 bg-cs-surface hover:border-foreground/20 flex flex-col gap-2 rounded-xl border p-4 transition-colors"
                >
                  <p className="text-foreground truncate text-sm font-medium">{p.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-cs-accent/15 text-cs-accent rounded-full px-2 py-0.5 text-[11px] font-medium">
                      {stageLabel(inferWorkflowStage(p.messages))}
                    </span>
                    <span className="text-foreground/45 text-xs">
                      {formatRelativeTime(p.updatedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
