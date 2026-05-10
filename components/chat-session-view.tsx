"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { resolveEffectiveModel } from "@/lib/models";
import { defaultTitleFromMessages, type ChatSession } from "@/lib/chat-storage";
import { messageToPlainText } from "@/lib/message-text";
import { AssistantMessageBody } from "@/components/assistant-message-body";
import { useActiveChatControlsSetter } from "@/components/active-chat-controls-context";
import {
  ToolInvocationCard,
  type LooseToolPart,
} from "@/components/tool-invocation";
import {
  ComposerAttachmentPreview,
  MessageAttachmentPart,
} from "@/components/attachment-display";
import {
  ATTACHMENT_ACCEPT,
  isAllowedAttachment,
} from "@/lib/attachment-allowlist";
import { prepareAttachmentsForModel } from "@/lib/prepare-attachments";
import type { UserMessageMetadata } from "@/lib/expand-user-message-metadata";
import {
  UserInlinedAttachments,
  visibleUserMessageText,
} from "@/components/user-inlined-attachments";
import {
  ChatSettingsModal,
  type SettingsDraft,
} from "@/components/chat-settings-modal";
import {
  defaultAppChatSettings,
  normalizeAppChatSettings,
  type AppChatSettings,
} from "@/lib/user-settings";
import { Tooltip } from "@/components/tooltip";

const MAX_ATTACH_BYTES = 12 * 1024 * 1024;
const MAX_ATTACH_FILES = 8;

/** Extra scrollable space below the last message so content clears the overlaid composer. */
const COMPOSER_SCROLL_GAP_PX = 28;

/** Same max width as assistant message column — composer stays aligned and does not span full screen. */
const CHAT_COLUMN_MAX = "max-w-[min(100%,52rem)]";

/** Fork / copy — icon-only, no box border (minimal UI). */
const MESSAGE_ICON_BTN =
  "text-foreground/45 hover:bg-foreground/10 hover:text-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors";

/**
 * How close to the bottom (px) we must be to auto-snap on new tokens. Keep small so scrolling up
 * isn’t fought by streaming layout updates.
 */
const SNAP_TO_BOTTOM_THRESHOLD_PX = 18;

/** User is “back at the tail” — resume auto-follow after they’ve scrolled away (wheel / trackpad). */
const RESUME_AUTO_FOLLOW_THRESHOLD_PX = 12;

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

/** True when the assistant bubble has something visible (text, reasoning, tools, files). */
function assistantHasRenderableContent(m: UIMessage): boolean {
  if (m.role !== "assistant") return true;
  for (const part of m.parts) {
    if (part.type === "reasoning" && (part as { text?: string }).text?.trim())
      return true;
    if (part.type === "text" && (part as { text?: string }).text?.trim())
      return true;
    if (part.type === "file") return true;
    if (part.type === "dynamic-tool") return true;
    if (typeof part.type === "string" && part.type.startsWith("tool-"))
      return true;
  }
  return false;
}

function fileListFromFiles(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const fromItems: File[] = [];
  for (const item of data.items) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) fromItems.push(f);
    }
  }
  if (fromItems.length > 0) return fromItems;
  return Array.from(data.files);
}

const USER_MESSAGE_COLLAPSE_CHARS = 380;
const USER_MESSAGE_COLLAPSE_NEWLINES = 7;

function userMessageNeedsCollapse(text: string): boolean {
  if (text.length > USER_MESSAGE_COLLAPSE_CHARS) return true;
  return text.split(/\r?\n/).length > USER_MESSAGE_COLLAPSE_NEWLINES;
}

function CollapsibleUserMessageText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = userMessageNeedsCollapse(text);

  const bodyClass =
    "text-foreground max-w-full min-w-0 overflow-x-hidden whitespace-pre-wrap wrap-break-word wrap-anywhere";

  if (!needsCollapse) {
    return <p className={bodyClass}>{text}</p>;
  }

  return (
    <div className="min-w-0">
      <p className={`${bodyClass} ${expanded ? "" : "line-clamp-6"}`}>{text}</p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-foreground/65 hover:text-foreground mt-2 inline-flex items-center gap-1 text-sm font-medium transition-colors"
      >
        {expanded ? "Show less" : "Show more"}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

type Props = {
  session: ChatSession;
  appSettings: AppChatSettings;
  onAppSettingsChange: (next: AppChatSettings) => void;
  onPersist: (id: string, patch: Partial<ChatSession>) => void;
  onFork: (messages: UIMessage[], titleHint: string) => void;
};

export function ChatSessionView({
  session,
  appSettings,
  onAppSettingsChange,
  onPersist,
  onFork,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const d0 = defaultAppChatSettings();
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => ({
    provider: d0.provider,
    model: d0.model,
    maxMode: d0.maxMode,
    enableWebSearch: d0.enableWebSearch,
    customInstructions: d0.customInstructions,
  }));
  const [input, setInput] = useState("");
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  /** False while user reads older messages — use live `messages` (no defer) for stable scroll. */
  const [followingStream, setFollowingStream] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  /** When true, assistant streaming / layout growth keeps the viewport snapped to the newest content. */
  const stickToBottomRef = useRef(true);
  const scrollPinRafRef = useRef<number | null>(null);
  /** While streaming: set true when user scrolls up — blocks programmatic snap until they return to the tail. */
  const autoFollowPausedRef = useRef(false);
  const prevScrollTopRef = useRef<number | null>(null);

  /** Match `max-h-[min(70vh,28rem)]` — do not use getComputedStyle(maxHeight); `min()` often breaks parseFloat. */
  const getComposerTextareaMaxPx = useCallback(() => {
    if (typeof window === "undefined") return 28 * 16;
    return Math.min(window.innerHeight * 0.7, 28 * 16);
  }, []);

  const adjustComposerTextareaHeight = useCallback(() => {
    const ta = composerTextareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const cap = getComposerTextareaMaxPx();
    const scrollH = ta.scrollHeight;
    const next = Math.min(scrollH, cap);
    ta.style.height = `${next}px`;
    ta.style.overflowY = scrollH > cap ? "auto" : "hidden";
  }, [getComposerTextareaMaxPx]);

  useLayoutEffect(() => {
    adjustComposerTextareaHeight();
  }, [input, attachments.length, adjustComposerTextareaHeight]);

  useEffect(() => {
    window.addEventListener("resize", adjustComposerTextareaHeight);
    return () =>
      window.removeEventListener("resize", adjustComposerTextareaHeight);
  }, [adjustComposerTextareaHeight]);

  const applyComposerBottomInset = useCallback(() => {
    const scrollEl = messagesScrollRef.current;
    const dockEl = composerDockRef.current;
    if (!scrollEl || !dockEl) return;
    const h =
      Math.ceil(dockEl.getBoundingClientRect().height) + COMPOSER_SCROLL_GAP_PX;
    const next = `${h}px`;
    if (scrollEl.style.paddingBottom !== next) {
      scrollEl.style.paddingBottom = next;
    }
  }, []);

  useLayoutEffect(() => {
    applyComposerBottomInset();
    const dockEl = composerDockRef.current;
    if (!dockEl) return;
    const ro = new ResizeObserver(() => {
      applyComposerBottomInset();
      const scrollEl = messagesScrollRef.current;
      if (!scrollEl || autoFollowPausedRef.current) return;
      if (distanceFromBottom(scrollEl) > SNAP_TO_BOTTOM_THRESHOLD_PX) return;
      scrollEl.scrollTop = scrollEl.scrollHeight - scrollEl.clientHeight;
    });
    ro.observe(dockEl);
    return () => ro.disconnect();
  }, [applyComposerBottomInset]);

  const effectiveModel = useMemo(
    () =>
      resolveEffectiveModel(
        appSettings.provider,
        appSettings.model,
        appSettings.maxMode,
      ),
    [appSettings.provider, appSettings.model, appSettings.maxMode],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          provider: appSettings.provider,
          model: effectiveModel,
          maxMode: appSettings.maxMode,
          enableWebSearch: appSettings.enableWebSearch,
          ...(appSettings.customInstructions.trim()
            ? { customInstructions: appSettings.customInstructions.trim() }
            : {}),
        },
      }),
    [appSettings, effectiveModel],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
    clearError,
    regenerate,
  } = useChat({
    id: session.id,
    messages: session.messages,
    transport,
  });

  const busy = status === "streaming" || status === "submitted";

  /** Defer paint only while following the tail — avoids jank fighting scroll when reading history. */
  const deferredMessages = useDeferredValue(messages);
  const renderMessages =
    busy && followingStream ? deferredMessages : messages;
  const lastMessageId = messages.at(-1)?.id;

  const generationStartedAtRef = useRef<number | null>(null);
  const [thoughtSecondsByMessageId, setThoughtSecondsByMessageId] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (status === "submitted") {
      generationStartedAtRef.current = Date.now();
    }
  }, [status]);

  useEffect(() => {
    if (status !== "ready") return;
    const start = generationStartedAtRef.current;
    if (start == null) return;
    generationStartedAtRef.current = null;
    const ms = Date.now() - start;
    const lastAssist = [...messages]
      .reverse()
      .find((x) => x.role === "assistant");
    if (!lastAssist) return;
    const sec = Math.round((ms / 1000) * 10) / 10;
    setThoughtSecondsByMessageId((prev) => ({ ...prev, [lastAssist.id]: sec }));
  }, [status, messages]);

  useEffect(() => {
    const scrollEl = messagesScrollRef.current;
    if (!scrollEl) return;

    const flushPin = () => {
      scrollPinRafRef.current = null;
      const st = scrollEl.scrollTop;
      const prev = prevScrollTopRef.current;
      let scrolledUp = false;
      if (prev !== null && busy && st < prev - 0.5) {
        autoFollowPausedRef.current = true;
        scrolledUp = true;
        setFollowingStream(false);
      }
      prevScrollTopRef.current = st;

      const dist = distanceFromBottom(scrollEl);
      const pin = dist <= SNAP_TO_BOTTOM_THRESHOLD_PX;
      stickToBottomRef.current = pin;
      if (!scrolledUp && dist <= RESUME_AUTO_FOLLOW_THRESHOLD_PX) {
        autoFollowPausedRef.current = false;
      }
      setFollowingStream(busy ? !autoFollowPausedRef.current : true);
    };

    const onScroll = () => {
      if (scrollPinRafRef.current != null) return;
      scrollPinRafRef.current = requestAnimationFrame(flushPin);
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    flushPin();
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (scrollPinRafRef.current != null) {
        cancelAnimationFrame(scrollPinRafRef.current);
        scrollPinRafRef.current = null;
      }
    };
  }, [busy, messages.length]);

  useLayoutEffect(() => {
    const scrollEl = messagesScrollRef.current;
    if (!scrollEl || autoFollowPausedRef.current) return;

    const pinned =
      distanceFromBottom(scrollEl) <= SNAP_TO_BOTTOM_THRESHOLD_PX;
    stickToBottomRef.current = pinned;
    if (!pinned) return;

    requestAnimationFrame(() => {
      const el = messagesScrollRef.current;
      if (!el || autoFollowPausedRef.current) return;
      el.scrollTop = el.scrollHeight - el.clientHeight;
    });
  }, [messages, status]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const autoTitle = defaultTitleFromMessages(messages);
      const patch: Partial<ChatSession> = { messages };
      if (session.titleMode !== "manual") {
        patch.title = autoTitle;
      }
      onPersist(session.id, patch);
    }, 450);
    return () => window.clearTimeout(t);
  }, [messages, session.id, session.titleMode, onPersist]);

  const validateFiles = useCallback((arr: File[]): File[] | undefined => {
    setAttachError(null);
    if (!arr.length) return [];

    const allowed = arr.filter(isAllowedAttachment);
    const rejected = arr.filter((f) => !isAllowedAttachment(f));
    if (rejected.length > 0) {
      setAttachError(
        rejected.length === 1
          ? `"${rejected[0].name}" is not allowed. Attach images, text files, PDFs, or spreadsheets (e.g. .xlsx, .csv).`
          : `${rejected.length} file(s) skipped — only images, text, PDF, and spreadsheet formats are allowed.`,
      );
    }

    if (!allowed.length) return undefined;

    if (allowed.length > MAX_ATTACH_FILES) {
      setAttachError(`At most ${MAX_ATTACH_FILES} files.`);
      return undefined;
    }
    const big = allowed.find((f) => f.size > MAX_ATTACH_BYTES);
    if (big) {
      setAttachError(
        `"${big.name}" is too large (max ${Math.round(MAX_ATTACH_BYTES / 1024 / 1024)} MB per file).`,
      );
      return undefined;
    }
    return allowed;
  }, []);

  const syncFileInput = useCallback((files: File[]) => {
    const el = fileInputRef.current;
    if (!el) return;
    if (files.length === 0) {
      el.value = "";
      return;
    }
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    el.files = dt.files;
  }, []);

  const mergeIntoFileInput = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;
      const merged = [...attachments, ...incoming];
      const validated = validateFiles(merged);
      if (merged.length && !validated) return;
      if (validated) {
        setAttachments(validated);
        syncFileInput(validated);
      }
    },
    [attachments, validateFiles, syncFileInput],
  );

  const removeAttachment = useCallback(
    (index: number) => {
      const next = attachments.filter((_, i) => i !== index);
      setAttachments(next);
      syncFileInput(next);
      setAttachError(null);
    },
    [attachments, syncFileInput],
  );

  const onPasteFiles = useCallback(
    (e: React.ClipboardEvent) => {
      if (busy) return;
      const pasted = filesFromClipboard(e.clipboardData);
      if (!pasted.length) return;
      e.preventDefault();
      mergeIntoFileInput(pasted);
    },
    [busy, mergeIntoFileInput],
  );

  const hasFilePayload = (dt: DataTransfer | null) =>
    dt != null && [...dt.types].includes("Files");

  const onDragEnterChat = useCallback(
    (e: React.DragEvent) => {
      if (busy || !hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
    },
    [busy],
  );

  const onDragOverChat = useCallback(
    (e: React.DragEvent) => {
      if (busy || !hasFilePayload(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [busy],
  );

  const onDropFiles = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (busy) return;
      const list = e.dataTransfer.files;
      if (!list?.length) return;
      mergeIntoFileInput(Array.from(list));
    },
    [busy, mergeIntoFileInput],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if ((!text && !attachments.length) || busy) return;

      stickToBottomRef.current = true;
      autoFollowPausedRef.current = false;
      setFollowingStream(true);

      const prepared = await prepareAttachmentsForModel(attachments, text);
      if (prepared.error) {
        setAttachError(prepared.error);
        return;
      }
      setAttachError(null);

      setInput("");
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      clearError();
      await sendMessage({
        text: prepared.displayText,
        ...(prepared.files.length
          ? { files: fileListFromFiles(prepared.files) }
          : {}),
        ...(prepared.inlinedForModel.length > 0
          ? {
              metadata: {
                inlinedForModel: prepared.inlinedForModel,
              },
            }
          : {}),
      });
    },
    [input, busy, attachments, sendMessage, clearError],
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyResponse = useCallback(async (m: UIMessage) => {
    const t = messageToPlainText(m);
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopiedId(m.id);
      window.setTimeout(
        () => setCopiedId((id) => (id === m.id ? null : id)),
        2000,
      );
    } catch {
      // ignore
    }
  }, []);

  const copyUserMessage = useCallback(async (m: UIMessage) => {
    if (m.role !== "user") return;
    const inlinedMeta = (m.metadata as UserMessageMetadata | undefined)
      ?.inlinedForModel;
    const fileNames = m.parts.flatMap((p) =>
      p.type === "file" && p.filename ? [p.filename] : [],
    );
    const raw = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text?: string }).text ?? "")
      .join("\n\n");
    const visible = visibleUserMessageText(raw, inlinedMeta, fileNames);
    const text = (visible ?? raw).trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(m.id);
      window.setTimeout(
        () => setCopiedId((id) => (id === m.id ? null : id)),
        2000,
      );
    } catch {
      // ignore
    }
  }, []);

  const handleSaveSettings = useCallback(() => {
    onAppSettingsChange(
      normalizeAppChatSettings({
        provider: settingsDraft.provider,
        model: settingsDraft.model,
        maxMode: settingsDraft.maxMode,
        enableWebSearch: settingsDraft.enableWebSearch,
        customInstructions: settingsDraft.customInstructions.trim(),
      }),
    );
    setSettingsOpen(false);
  }, [settingsDraft, onAppSettingsChange]);

  const openSettings = useCallback(() => {
    setSettingsDraft({
      provider: appSettings.provider,
      model: appSettings.model,
      maxMode: appSettings.maxMode,
      enableWebSearch: appSettings.enableWebSearch,
      customInstructions: appSettings.customInstructions,
    });
    setSettingsOpen(true);
  }, [appSettings]);

  const settingsSummaryLine = useMemo(() => {
    const parts = [
      appSettings.provider === "openai" ? "OpenAI" : "Anthropic",
      appSettings.maxMode ? "Max" : effectiveModel,
      appSettings.enableWebSearch === false ? "Web off" : null,
    ].filter(Boolean) as string[];
    return parts.join(" · ");
  }, [
    appSettings.provider,
    appSettings.maxMode,
    appSettings.enableWebSearch,
    effectiveModel,
  ]);

  const setActiveToolbar = useActiveChatControlsSetter();

  useEffect(() => {
    const clearChat = () => {
      clearError();
      setMessages([]);
    };
    setActiveToolbar({
      busy,
      stop: () => void stop(),
      clearChat,
      retryLast: () => void regenerate(),
      canClear: messages.length > 0,
      canRetry: messages.length > 0 && !busy,
      openSettings,
      settingsSummaryLine,
    });
    return () => setActiveToolbar(null);
  }, [
    busy,
    clearError,
    messages.length,
    openSettings,
    regenerate,
    setActiveToolbar,
    setMessages,
    settingsSummaryLine,
    stop,
  ]);

  const forkHere = useCallback(
    (messageIndex: number) => {
      const slice = messages.slice(0, messageIndex + 1);
      const hint =
        messages[messageIndex]?.role === "user"
          ? `Fork · ${messageToPlainText(messages[messageIndex]).slice(0, 40) || "message"}`
          : `Fork · ${defaultTitleFromMessages(slice)}`;
      onFork(structuredClone(slice), hint);
    },
    [messages, onFork],
  );

  const isLanding = messages.length === 0;

  const composerDock = (
    <div
      ref={composerDockRef}
      className={
        isLanding
          ? "flex w-full justify-center"
          : "absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-4 pt-2"
      }
    >
      <div className={`mx-auto flex w-full flex-col gap-3 ${CHAT_COLUMN_MAX}`}>
      {error && (
        <div
          role="alert"
          className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 rounded-xl border px-4 py-3 text-sm"
        >
          {error.message}
        </div>
      )}

      {attachError && (
        <div
          role="status"
          className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-xl border px-4 py-2 text-sm"
        >
          {attachError}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        onPaste={onPasteFiles}
        className="flex-shrink-0 space-y-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          tabIndex={-1}
          onChange={(e) => {
            const raw = e.target.files ? Array.from(e.target.files) : [];
            const v = validateFiles(raw);
            if (raw.length && v === undefined) {
              e.target.value = "";
              return;
            }
            setAttachments(v ?? []);
            syncFileInput(v ?? []);
          }}
          className="hidden"
          disabled={busy}
        />
        <div className="border-foreground/15 bg-white dark:bg-zinc-700 flex flex-col gap-2 rounded-[28px] border px-3 py-2 shadow-sm">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 pt-0.5 pb-1">
              {attachments.map((file, idx) => (
                <ComposerAttachmentPreview
                  key={`${file.name}-${file.size}-${idx}`}
                  file={file}
                  disabled={busy}
                  onRemove={() => removeAttachment(idx)}
                />
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <Tooltip
              content="Attach images, text, PDF, or spreadsheet files"
              disabled={busy}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach images, text files, PDFs, or spreadsheets"
                className="text-foreground/70 hover:bg-foreground/10 hover:text-foreground mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </Tooltip>
            <textarea
              ref={composerTextareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit(e);
                }
              }}
              placeholder="Ask anything"
              rows={1}
              disabled={busy}
              className="text-foreground placeholder:text-foreground/40 focus:placeholder:text-foreground/25 max-h-[min(70vh,28rem)] min-h-0 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-normal outline-none ring-0 focus:ring-0 disabled:opacity-60 box-border"
            />
            <Tooltip
              content="Send message"
              disabled={busy || (!input.trim() && attachments.length === 0)}
            >
              <button
                type="submit"
                disabled={busy || (!input.trim() && attachments.length === 0)}
                aria-label="Send message"
                className="bg-foreground text-background hover:opacity-92 mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M12 19V12" />
                  <path d="m7 12 5-5 5 5" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
      </form>
      </div>
    </div>
  );

  return (
    <div
      className="bg-zinc-50 dark:bg-background flex min-h-0 min-w-0 flex-1 flex-col"
      onDragEnter={onDragEnterChat}
      onDragOver={onDragOverChat}
      onDrop={onDropFiles}
    >
      {isLanding ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-10 px-4 pb-12 pt-8">
            <h2 className="text-foreground max-w-[min(100%,48rem)] text-center text-3xl font-semibold tracking-tight md:text-4xl">
              What would you like to do today?
            </h2>
            {composerDock}
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={messagesScrollRef}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain rounded-xl border border-transparent px-4 pt-4 pr-1 [scrollbar-gutter:stable] [overflow-anchor:none]"
          >
          {renderMessages.map((m, idx) => {
            const inlinedMeta =
              m.role === "user"
                ? (m.metadata as UserMessageMetadata | undefined)
                    ?.inlinedForModel
                : undefined;
            const fileAttachmentNames =
              m.role === "user"
                ? m.parts.flatMap((p) =>
                    p.type === "file" && p.filename ? [p.filename] : [],
                  )
                : [];
            const isStreamingAssistant =
              busy && lastMessageId === m.id && m.role === "assistant";

            return (
              <div key={m.id} className="flex w-full justify-center">
                <div
                  className={
                    m.role === "user"
                      ? "flex w-full max-w-[min(100%,52rem)] justify-end"
                      : "w-full max-w-[min(100%,52rem)]"
                  }
                >
                  <article
                    className={`flex min-w-0 flex-col gap-2 rounded-3xl border px-5 py-4 ${
                      m.role === "user"
                        ? "border-foreground/10 bg-white dark:bg-[#2f2f2f] max-w-[min(100%,28rem)]"
                        : "border-foreground/10 w-full border bg-white shadow-sm dark:bg-[#2f2f2f]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-foreground/45 text-xs font-medium uppercase tracking-wide">
                        {m.role === "user" ? "You" : "Assistant"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Tooltip content="Fork here · new chat from this message">
                          <button
                            type="button"
                            aria-label="Fork here · new chat from this message"
                            onClick={() => forkHere(idx)}
                            className={MESSAGE_ICON_BTN}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                              aria-hidden
                            >
                              <circle cx="12" cy="18" r="3" />
                              <circle cx="6" cy="6" r="3" />
                              <circle cx="18" cy="6" r="3" />
                              <path d="M18 9v1a3 3 0 0 1-3 3h-6a3 3 0 0 0-3 3v1" />
                              <path d="M12 13v5" />
                            </svg>
                          </button>
                        </Tooltip>
                        {m.role === "user" && (
                          <Tooltip
                            content={
                              copiedId === m.id ? "Copied" : "Copy message"
                            }
                          >
                            <button
                              type="button"
                              aria-label={
                                copiedId === m.id
                                  ? "Copied to clipboard"
                                  : "Copy message"
                              }
                              onClick={() => void copyUserMessage(m)}
                              className={MESSAGE_ICON_BTN}
                            >
                            {copiedId === m.id ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                                aria-hidden
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                                aria-hidden
                              >
                                <rect
                                  width="8"
                                  height="4"
                                  x="8"
                                  y="2"
                                  rx="1"
                                  ry="1"
                                />
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                              </svg>
                            )}
                            </button>
                          </Tooltip>
                        )}
                        {m.role === "assistant" && (
                          <Tooltip
                            content={
                              copiedId === m.id ? "Copied" : "Copy response"
                            }
                          >
                            <button
                              type="button"
                              aria-label={
                                copiedId === m.id
                                  ? "Copied to clipboard"
                                  : "Copy response"
                              }
                              onClick={() => void copyResponse(m)}
                              className={MESSAGE_ICON_BTN}
                            >
                            {copiedId === m.id ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                                aria-hidden
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                                aria-hidden
                              >
                                <rect
                                  width="8"
                                  height="4"
                                  x="8"
                                  y="2"
                                  rx="1"
                                  ry="1"
                                />
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                              </svg>
                            )}
                          </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      {m.parts.map((part, i) => {
                        if (part.type === "reasoning") {
                          const reasoningText = part.text;
                          if (!reasoningText) return null;
                          return (
                            <details
                              key={`${m.id}-reasoning-${i}`}
                              className="text-foreground/65 bg-foreground/5 mb-2 rounded-lg border border-dashed px-3 py-2 text-sm"
                            >
                              <summary className="cursor-pointer select-none text-xs font-medium">
                                Reasoning
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
                                {reasoningText}
                              </pre>
                            </details>
                          );
                        }
                        if (part.type === "file") {
                          return (
                            <MessageAttachmentPart
                              key={`${m.id}-file-${i}`}
                              url={part.url}
                              filename={part.filename}
                              mediaType={part.mediaType}
                            />
                          );
                        }
                        if (
                          typeof part.type === "string" &&
                          part.type.startsWith("tool-")
                        ) {
                          return (
                            <ToolInvocationCard
                              key={`${m.id}-tool-${i}`}
                              part={part as LooseToolPart}
                            />
                          );
                        }
                        if (part.type === "text") {
                          const text = part.text;
                          if (m.role === "user") {
                            const visible = visibleUserMessageText(
                              text,
                              inlinedMeta,
                              fileAttachmentNames,
                            );
                            if (!visible) return null;
                            return (
                              <div key={`${m.id}-text-${i}`}>
                                <CollapsibleUserMessageText text={visible} />
                              </div>
                            );
                          }
                          if (!text?.trim()) return null;
                          return (
                            <div key={`${m.id}-text-${i}`}>
                              <AssistantMessageBody
                                text={text}
                                isStreaming={isStreamingAssistant}
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                      {inlinedMeta && inlinedMeta.length > 0 ? (
                        <UserInlinedAttachments items={inlinedMeta} />
                      ) : null}
                  {m.role === "assistant" &&
                    busy &&
                    lastMessageId === m.id &&
                    !assistantHasRenderableContent(m) && (
                          <div
                            className="text-foreground/60 mt-1 flex items-center gap-3 py-2"
                            aria-live="polite"
                            aria-busy="true"
                          >
                            <span
                              className="border-foreground/35 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-sky-500"
                              aria-hidden
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <div className="bg-foreground/12 h-2.5 w-full max-w-[14rem] animate-pulse rounded" />
                              <div className="bg-foreground/10 h-2.5 w-full max-w-[10rem] animate-pulse rounded" />
                            </div>
                          </div>
                        )}
                      {m.role === "assistant" &&
                        thoughtSecondsByMessageId[m.id] != null && (
                          <p className="text-foreground/45 mt-2 border-t border-foreground/10 pt-2 text-xs tabular-nums">
                            Thought for {thoughtSecondsByMessageId[m.id]} s
                          </p>
                        )}
                    </div>
                  </article>
                </div>
              </div>
            );
          })}
          <div ref={endRef} className="h-3 w-full shrink-0" aria-hidden />
        </div>
        {composerDock}
      </div>
      )}

      <ChatSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        draft={settingsDraft}
        onChangeDraft={(patch) =>
          setSettingsDraft((prev) => ({ ...prev, ...patch }))
        }
        onSave={handleSaveSettings}
      />
    </div>
  );
}
