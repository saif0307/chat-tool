"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  getProject,
  updateProject,
} from "@/lib/content-studio/services/project-service";
import { defaultTitleFromMessages } from "@/lib/content-studio/storage";
import { loadContentStudioSettings } from "@/lib/content-studio/settings";
import { inferWorkflowStage } from "@/lib/content-studio/workflow";
import type { ContentProject } from "@/lib/content-studio/types";
import { WorkflowStepper } from "@/components/studio/workflow-stepper";
import { StudioMessageList } from "@/components/studio/workspace/studio-message-list";
import { StudioComposer } from "@/components/studio/workspace/studio-composer";

const PERSIST_DEBOUNCE_MS = 450;

/**
 * Loads the project before anything else mounts. `useChat` only reads its `messages` option
 * once, at construction — if it mounted before the project finished loading, it would lock in
 * an empty history forever. Splitting the loader out from `StudioWorkspaceChat` guarantees
 * `useChat` is only ever constructed with the real, already-loaded messages.
 */
export function StudioWorkspaceView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ContentProject | null | undefined>(undefined);

  useEffect(() => {
    queueMicrotask(() => {
      const p = getProject(projectId);
      if (!p) {
        router.replace("/studio/workspace");
        return;
      }
      setProject(p);
    });
  }, [projectId, router]);

  if (project === undefined) {
    return (
      <div className="text-foreground/50 flex flex-1 items-center justify-center p-8 text-sm">
        Loading…
      </div>
    );
  }
  if (!project) return null;

  return <StudioWorkspaceChat key={projectId} projectId={projectId} initialProject={project} />;
}

/** The conversational canvas for a single Content Studio project — real streaming, own route. */
function StudioWorkspaceChat({
  projectId,
  initialProject,
}: {
  projectId: string;
  initialProject: ContentProject;
}) {
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Read once at mount — this component remounts (fresh `key`) whenever the project changes. */
  const titleModeRef = useRef(initialProject.titleMode);
  const settings = useMemo(() => loadContentStudioSettings(), []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/content-studio/chat",
        body: { provider: settings.provider, model: settings.model },
      }),
    [settings],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: projectId,
    messages: initialProject.messages,
    transport,
  });

  const stage = useMemo(() => inferWorkflowStage(messages), [messages]);

  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const patch: Partial<ContentProject> = { messages };
      if (titleModeRef.current !== "manual") {
        const title = defaultTitleFromMessages(messages);
        if (title !== "Untitled project") patch.title = title;
      }
      updateProject(projectId, patch);
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [messages, projectId]);

  const handleSend = useCallback(
    (text: string) => {
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const isStreaming = status === "streaming" || status === "submitted";
  const isLanding = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-foreground/10 shrink-0 border-b px-4 py-3 sm:px-6">
        <WorkflowStepper stage={stage} />
      </div>

      {isLanding ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <h2 className="text-foreground max-w-lg text-2xl font-semibold tracking-tight">
            What are we creating today?
          </h2>
          <p className="text-foreground/55 max-w-md text-sm leading-relaxed">
            Give me a topic and I&apos;ll research it, find a strong angle, and write the piece.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <StudioMessageList
            messages={messages}
            isStreaming={isStreaming}
            onSelectAngle={handleSend}
          />
        </div>
      )}

      <StudioComposer onSend={handleSend} onStop={stop} isStreaming={isStreaming} />
    </div>
  );
}
