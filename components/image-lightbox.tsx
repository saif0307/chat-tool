"use client";

import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";

type ImageLightboxProps = {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-[201] rounded-full p-2 text-2xl leading-none text-zinc-200/90 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Close preview"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- preview is arbitrary URL */}
      <img
        src={src}
        alt={alt}
        className="max-h-[min(92vh,1200px)] max-w-full object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

type PreviewableImageProps = ComponentPropsWithoutRef<"img">;

/**
 * Image that opens a full-screen preview on click (Escape or backdrop closes).
 */
export function PreviewableImage({ src, alt, className, ...rest }: PreviewableImageProps) {
  const [open, setOpen] = useState(false);
  if (typeof src !== "string" || !src) return null;

  const label = alt?.trim() ? `View larger: ${alt}` : "View larger";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-block max-w-full cursor-zoom-in border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950"
        aria-label={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ""} className={className} {...rest} />
      </button>
      <ImageLightbox
        src={src}
        alt={alt ?? ""}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
