"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const HIDDEN_SCROLLBAR =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function maskFor(top: boolean, bottom: boolean): string | undefined {
  if (top && bottom) {
    return "linear-gradient(to bottom, transparent, black 1.75rem, black calc(100% - 1.75rem), transparent)";
  }
  if (top) {
    return "linear-gradient(to bottom, transparent, black 1.75rem, black 100%)";
  }
  if (bottom) {
    return "linear-gradient(to bottom, black 0%, black calc(100% - 1.75rem), transparent)";
  }
  return undefined;
}

function readEdges(el: HTMLDivElement): { top: boolean; bottom: boolean } {
  const overflow = el.scrollHeight - el.clientHeight;
  if (overflow <= 2) return { top: false, bottom: false };
  return {
    top: el.scrollTop > 4,
    bottom: el.scrollTop < overflow - 4,
  };
}

type ScrollFadeProps = {
  children: ReactNode;
  className?: string;
  /** Tailwind max-height utility — default matches dashboard list panels */
  maxHeightClass?: string;
  /** Bump when list data changes so the region remounts and fades recompute */
  contentKey?: string | number;
};

/**
 * Vertically scrollable region with soft edge fades via CSS mask
 * (no dark overlay band). Hide native scrollbar.
 */
export function ScrollFade({ contentKey, ...props }: ScrollFadeProps) {
  // Remount on content change so edges are measured fresh (avoids setState-in-effect).
  return <ScrollFadeInner key={contentKey ?? "scroll-fade"} {...props} />;
}

function ScrollFadeInner({
  children,
  className,
  maxHeightClass = "max-h-[400px]",
}: Omit<ScrollFadeProps, "contentKey">) {
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const roRef = useRef<ResizeObserver | null>(null);

  const applyEdges = useCallback((el: HTMLDivElement) => {
    const next = readEdges(el);
    setEdges((prev) =>
      prev.top === next.top && prev.bottom === next.bottom ? prev : next,
    );
  }, []);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (!el) return;

      applyEdges(el);

      if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => applyEdges(el));
        ro.observe(el);
        roRef.current = ro;
      }
    },
    [applyEdges],
  );

  useEffect(() => {
    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
    };
  }, []);

  const mask = maskFor(edges.top, edges.bottom);
  const style: CSSProperties | undefined = mask
    ? { maskImage: mask, WebkitMaskImage: mask }
    : undefined;

  return (
    <div
      ref={setRef}
      onScroll={(e) => applyEdges(e.currentTarget)}
      style={style}
      className={cn("overflow-y-auto", maxHeightClass, HIDDEN_SCROLLBAR, className)}
    >
      {children}
    </div>
  );
}
