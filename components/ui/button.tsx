import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-foreground text-background hover:opacity-90",
  secondary: "bg-foreground/10 text-foreground hover:bg-foreground/15",
  ghost: "text-foreground/70 hover:bg-foreground/10 hover:text-foreground",
  icon: "text-foreground/70 hover:bg-foreground/10 hover:text-foreground rounded-full",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

/** Shared primitive — used by both AI Chat and Content Studio. Not chat- or studio-specific. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        BASE,
        VARIANT_CLASSES[variant],
        variant === "icon" ? "h-9 w-9" : SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
