"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ActiveChatControls = {
  busy: boolean;
  stop: () => void;
  clearChat: () => void;
  retryLast: () => void;
  canClear: boolean;
  canRetry: boolean;
  openSettings: () => void;
  settingsSummaryLine: string;
};

type Ctx = {
  controls: ActiveChatControls | null;
  setControls: (next: ActiveChatControls | null) => void;
};

const ActiveChatControlsContext = createContext<Ctx | null>(null);

export function ActiveChatControlsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [controls, setControls] = useState<ActiveChatControls | null>(null);
  const value = useMemo(
    () => ({ controls, setControls }),
    [controls],
  );
  return (
    <ActiveChatControlsContext.Provider value={value}>
      {children}
    </ActiveChatControlsContext.Provider>
  );
}

export function useActiveChatControlsSetter() {
  const ctx = useContext(ActiveChatControlsContext);
  if (!ctx) {
    throw new Error(
      "useActiveChatControlsSetter must be used within ActiveChatControlsProvider",
    );
  }
  return ctx.setControls;
}

export function useActiveChatControls(): ActiveChatControls | null {
  const ctx = useContext(ActiveChatControlsContext);
  return ctx?.controls ?? null;
}
