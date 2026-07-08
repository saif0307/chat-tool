"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { StudioTopbar } from "@/components/studio/studio-topbar";
import { EmptyState } from "@/components/studio/empty-state";
import { listProjects } from "@/lib/content-studio/services/project-service";
import { inferWorkflowStage } from "@/lib/content-studio/workflow";
import { WORKFLOW_STAGES, type ContentProject } from "@/lib/content-studio/types";

function stageLabel(stage: string): string {
  return WORKFLOW_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function RecentWorkView() {
  const [projects, setProjects] = useState<ContentProject[] | null>(null);

  useEffect(() => {
    queueMicrotask(() => setProjects(listProjects()));
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StudioTopbar
        title="Recent Work"
        description="Every project you've started, most recent first."
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {projects === null ? null : projects.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title="Nothing here yet"
            description="Projects you start in the workspace will show up here automatically."
            actionLabel="Start a project"
            actionHref="/studio/workspace"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/studio/workspace/${p.id}`}
                className="border-foreground/10 bg-cs-surface hover:border-foreground/20 flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">{p.title}</p>
                  <p className="text-foreground/45 mt-0.5 text-xs">
                    {new Date(p.updatedAt).toLocaleString()}
                  </p>
                </div>
                <span className="bg-cs-accent/15 text-cs-accent shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium">
                  {stageLabel(inferWorkflowStage(p.messages))}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
