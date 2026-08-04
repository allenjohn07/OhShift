"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** True only for mouse/trackpad desktops — not phones/tablets (tap would open tips). */
function useDesktopHoverTooltips() {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setOk(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return ok;
}

/**
 * Hover/focus tooltip (same pattern as the collapsed sidebar).
 * Disabled on touch / coarse-pointer devices so taps don't sticky-open tips.
 * `side`: where the tip sits relative to the trigger — sidebar uses "right".
 */
export function IconTooltip({
  label,
  children,
  enabled = true,
  className,
  side = "right",
}: {
  label: string;
  children: React.ReactNode;
  enabled?: boolean;
  className?: string;
  side?: "right" | "bottom" | "top";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const desktopHover = useDesktopHoverTooltips();
  const active = enabled && desktopHover;
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    transform: string;
  } | null>(null);

  const show = () => {
    if (!active) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    if (side === "bottom") {
      setPos({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
        transform: "translateX(-50%)",
      });
      return;
    }
    if (side === "top") {
      setPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      });
      return;
    }
    setPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
      transform: "translateY(-50%)",
    });
  };

  const hide = () => setPos(null);

  return (
    <div
      ref={ref}
      className={cn("relative inline-flex max-w-full", className)}
      onMouseEnter={active ? show : undefined}
      onMouseLeave={active ? hide : undefined}
      onFocus={active ? show : undefined}
      onBlur={active ? hide : undefined}
    >
      {children}
      {pos &&
        active &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[100] whitespace-nowrap rounded-md border border-border/50 bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.transform,
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </div>
  );
}
