import { WORKFLOW_STAGES, type WorkflowStage } from "@/lib/content-studio/types";
import { cn } from "@/lib/cn";

/** Visualizes the eight-stage workflow and highlights the project's current stage. */
export function WorkflowStepper({ stage }: { stage: WorkflowStage }) {
  const activeIndex = WORKFLOW_STAGES.findIndex((s) => s.id === stage);

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {WORKFLOW_STAGES.map((s, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            <span
              title={s.description}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-cs-accent/15 text-cs-accent"
                  : isDone
                    ? "text-foreground/50 bg-foreground/5"
                    : "text-foreground/35 bg-foreground/[0.03]",
              )}
            >
              {s.label}
            </span>
            {i < WORKFLOW_STAGES.length - 1 ? (
              <span className="text-foreground/20" aria-hidden>
                {"\u2192"}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
