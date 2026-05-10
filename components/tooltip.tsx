"use client";

import Tippy, { type TippyProps } from "@tippyjs/react";
import type { ReactElement, ReactNode } from "react";

import "tippy.js/dist/tippy.css";

export type TooltipProps = {
  content: ReactNode;
  children: ReactElement;
  disabled?: boolean;
} & Omit<TippyProps, "content" | "children">;

export function Tooltip({ content, children, disabled, ...rest }: TooltipProps) {
  if (
    disabled ||
    content === null ||
    content === undefined ||
    content === ""
  ) {
    return children;
  }

  return (
    <Tippy
      content={content}
      delay={[250, 0]}
      animation="fade"
      duration={[150, 100]}
      theme="chat-dark"
      arrow={false}
      {...rest}
    >
      {children}
    </Tippy>
  );
}
