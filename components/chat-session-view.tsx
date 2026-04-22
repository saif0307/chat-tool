"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultModel,
  modelsForProvider,
  resolveEffectiveModel,
  type ProviderId,
} from "@/lib/models";
import { defaultTitleFromMessages, type ChatSession } from "@/lib/chat-storage";
import { messageToPlainText } from "@/lib/message-text";
import { MarkdownMessage } from "@/components/markdown-message";
import { ThemeToggle } from "@/components/theme-toggle";
import { StreamActivityBar } from "@/components/stream-activity-bar";
import { ToolInvocationCard, type LooseToolPart } from "@/components/tool-invocation";

const MAX_ATTACH_BYTES = 12 * 1024 * 1024;
const MAX_ATTACH_FILES = 8;

type Props = {
  session: ChatSession;
  onPersist: (id: string, patch: Partial<ChatSession>) => void;
  onFork: (
    messages: UIMessage[],
    titleHint: string,
    opts: {
      provider: ProviderId;
      model: string;
      maxMode: boolean;
      enableWebSearch?: boolean;
    },
  ) => void;
};

export function ChatSessionView({ session, onPersist, onFork }: Props) {
  const [provider, setProvider] = useState(session.provider);
  const [model, setModel] = useState(session.model);
  const [maxMode, setMaxMode] = useState(session.maxMode);
  const [enableWebSearch, setEnableWebSearch] = useState(session.enableWebSearch ?? true);
  const [input, setInput] = useState("");
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProvider(session.provider);
    setModel(session.model);
    setMaxMode(session.maxMode);
    setEnableWebSearch(session.enableWebSearch ?? true);
  }, [session.id, session.provider, session.model, session.maxMode, session.enableWebSearch]);

  const effectiveModel = useMemo(
    () => resolveEffectiveModel(provider, model, maxMode),
    [provider, model, maxMode],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          provider,
          model: effectiveModel,
          maxMode,
          enableWebSearch,
        },
      }),
    [provider, effectiveModel, maxMode, enableWebSearch],
  );

  const { messages, sendMessage, status, stop, setMessages, error, clearError, regenerate } =
    useChat({
      id: session.id,
      messages: session.messages,
      transport,
    });

  const busy = status === "streaming" || status === "submitted";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const title = defaultTitleFromMessages(messages);
      onPersist(session.id, {
        messages,
        provider,
        model,
        maxMode,
        enableWebSearch,
        title,
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [messages, provider, model, maxMode, enableWebSearch, session.id, onPersist]);

  useEffect(() => {
    if (provider === "openai" && !modelsForProvider("openai").some((x) => x.id === model)) {
      setModel(defaultModel("openai"));
    }
    if (provider === "anthropic" && !modelsForProvider("anthropic").some((x) => x.id === model)) {
      setModel(defaultModel("anthropic"));
    }
  }, [provider, model]);

  const validateFileList = useCallback((list: FileList | null): FileList | undefined => {
    setAttachError(null);
    if (!list?.length) return undefined;
    const arr = Array.from(list);
    if (arr.length > MAX_ATTACH_FILES) {
      setAttachError(`At most ${MAX_ATTACH_FILES} files.`);
      return undefined;
    }
    const big = arr.find((f) => f.size > MAX_ATTACH_BYTES);
    if (big) {
      setAttachError(
        `"${big.name}" is too large (max ${Math.round(MAX_ATTACH_BYTES / 1024 / 1024)} MB per file).`,
      );
      return undefined;
    }
    const dt = new DataTransfer();
    arr.forEach((f) => dt.items.add(f));
    return dt.files;
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      const rawList = fileInputRef.current?.files ?? null;
      const files = validateFileList(rawList);
      if (rawList?.length && !files) return;
      if ((!text && !files?.length) || busy) return;
      setInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAttachmentCount(0);
      clearError();
      await sendMessage({
        text: text || "(attached files)",
        ...(files?.length ? { files } : {}),
      });
    },
    [input, busy, sendMessage, clearError, validateFileList],
  );

  const modelOptions = modelsForProvider(provider);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyResponse = useCallback(async (m: UIMessage) => {
    const t = messageToPlainText(m);
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 2000);
    } catch {
      // ignore
    }
  }, []);

  const forkHere = useCallback(
    (messageIndex: number) => {
      const slice = messages.slice(0, messageIndex + 1);
      const hint =
        messages[messageIndex]?.role === "user"
          ? `Fork · ${messageToPlainText(messages[messageIndex]).slice(0, 40) || "message"}`
          : `Fork · ${defaultTitleFromMessages(slice)}`;
      onFork(structuredClone(slice), hint, {
        provider,
        model,
        maxMode,
        enableWebSearch,
      });
    },
    [messages, onFork, provider, model, maxMode, enableWebSearch],
  );

  return (
    <div className="bg-zinc-50 dark:bg-background flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-foreground/10 flex flex-shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
        <h1 className="text-foreground min-w-0 shrink truncate text-lg font-semibold tracking-tight">
          {defaultTitleFromMessages(messages)}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-foreground/70 flex items-center gap-1.5 text-sm">
            <span className="whitespace-nowrap">Provider</span>
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as ProviderId;
                setProvider(p);
                setModel(defaultModel(p));
              }}
              className="border-foreground/15 bg-background text-foreground focus:ring-foreground/20 rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <label className="text-foreground/65 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={maxMode}
              onChange={(e) => setMaxMode(e.target.checked)}
              className="accent-foreground h-4 w-4 rounded border"
            />
            <span title="Uses the strongest model for this provider and allows longer outputs">
              Max mode
            </span>
          </label>
          <label className="text-foreground/65 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enableWebSearch}
              onChange={(e) => setEnableWebSearch(e.target.checked)}
              className="accent-foreground h-4 w-4 rounded border"
            />
            <span title="Default: OpenAI/Anthropic hosted web search (billed by them). Or set WEB_SEARCH_BACKEND=firecrawl + FIRECRAWL_API_KEY">
              Live web search
            </span>
          </label>
          {!maxMode && (
            <label className="text-foreground/70 flex items-center gap-1.5 text-sm">
              <span className="whitespace-nowrap">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border-foreground/15 bg-background text-foreground focus:ring-foreground/20 max-w-[min(100vw-10rem,320px)] rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {maxMode && (
            <span className="text-foreground/55 text-xs">
              Max model: <span className="font-mono">{effectiveModel}</span>
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void stop()}
            disabled={!busy}
            className="border-foreground/15 bg-background text-foreground hover:bg-foreground/5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={() => {
              clearError();
              setMessages([]);
            }}
            disabled={messages.length === 0}
            className="border-foreground/15 bg-background text-foreground hover:bg-foreground/5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={busy || messages.length === 0}
            className="border-foreground/15 bg-background text-foreground hover:bg-foreground/5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Retry last
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-xl border border-transparent pr-1">
          {messages.length === 0 && (
            <p className="text-foreground/50 px-1 text-center text-sm">
              Add{" "}
              <code className="bg-foreground/10 rounded px-1 py-0.5 font-mono text-xs">
                OPENAI_API_KEY
              </code>{" "}
              /{" "}
              <code className="bg-foreground/10 rounded px-1 py-0.5 font-mono text-xs">
                ANTHROPIC_API_KEY
              </code>{" "}
              to your env. Add{" "}
              optional{" "}
              <code className="bg-foreground/10 rounded px-1 py-0.5 font-mono text-xs">
                FIRECRAWL_API_KEY
              </code>{" "}
              if using Firecrawl mode. Attach files below. Chats stay in this browser.
            </p>
          )}
          {messages.map((m, idx) => (
            <article
              key={m.id}
              className={`border-foreground/8 flex flex-col gap-2 rounded-xl border px-4 py-3 ${
                m.role === "user"
                  ? "bg-foreground/6 ml-auto max-w-[min(100%,42rem)]"
                  : "dark:bg-zinc-700/85 bg-background border-foreground/8 mr-auto max-w-[min(100%,52rem)] border shadow-sm"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-foreground/45 text-xs font-medium uppercase tracking-wide">
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="New chat from here"
                    onClick={() => forkHere(idx)}
                    className="border-foreground/15 bg-background text-foreground/80 hover:bg-foreground/5 rounded-md border px-2 py-1 text-xs font-medium"
                  >
                    Fork here
                  </button>
                  {m.role === "assistant" && (
                    <button
                      type="button"
                      title="Copy response"
                      onClick={() => void copyResponse(m)}
                      className="border-foreground/15 bg-background text-foreground/80 hover:bg-foreground/5 rounded-md border px-2 py-1 text-xs font-medium"
                    >
                      {copiedId === m.id ? "Copied" : "Copy"}
                    </button>
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
                    const isImg = part.mediaType.startsWith("image/");
                    return (
                      <div key={`${m.id}-file-${i}`} className="my-2">
                        {isImg ? (
                          <img
                            src={part.url}
                            alt={part.filename ?? "attachment"}
                            className="max-h-64 max-w-full rounded-lg object-contain"
                          />
                        ) : (
                          <a
                            href={part.url}
                            download={part.filename}
                            className="text-sky-600 text-sm underline dark:text-sky-400"
                          >
                            {part.filename ?? "Attached file"}
                          </a>
                        )}
                      </div>
                    );
                  }
                  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                    return (
                      <ToolInvocationCard key={`${m.id}-tool-${i}`} part={part as LooseToolPart} />
                    );
                  }
                  if (part.type === "text") {
                    const text = part.text;
                    if (!text) return null;
                    return (
                      <div key={`${m.id}-text-${i}`}>
                        {m.role === "user" ? (
                          <p className="text-foreground whitespace-pre-wrap">{text}</p>
                        ) : (
                          <MarkdownMessage content={text} />
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </article>
          ))}
          <div ref={endRef} className="h-px w-full flex-shrink-0" aria-hidden />
        </div>

        <StreamActivityBar messages={messages} status={status} />

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

        <form onSubmit={onSubmit} className="flex-shrink-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => setAttachmentCount(e.target.files?.length ?? 0)}
              className="text-foreground/80 max-w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-zinc-800"
              disabled={busy}
            />
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit(e);
                }
              }}
              placeholder="Message… (Enter to send, Shift+Enter for newline)"
              rows={3}
              disabled={busy}
              className="border-foreground/15 bg-background text-foreground placeholder:text-foreground/35 focus:ring-foreground/20 max-h-48 min-h-[5.5rem] flex-1 resize-y rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || (!input.trim() && attachmentCount === 0)}
              className="bg-foreground text-background hover:opacity-90 self-end rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
