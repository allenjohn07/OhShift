import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard content box. Panels in the same grid row stretch to equal height
 * (the grid must not use `items-start`); the body grows to fill the space.
 */
export function Panel({
  children,
  className,
  as: Tag = "section",
  tour,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  /** `data-tour` anchor for the demo tour's "Take me there". */
  tour?: string;
}) {
  return (
    <Tag
      data-tour={tour}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * One-line header with a fixed height on every panel:
 * title · muted meta (counts, dates) · actions on the right.
 */
export function PanelHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2 sm:px-5",
        className,
      )}
    >
      <h2 className="font-semibold">{title}</h2>
      {meta != null && meta !== false && (
        <span className="text-sm text-muted-foreground tabular-nums">{meta}</span>
      )}
      {actions && (
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      )}
    </div>
  );
}

/** Centered empty state that fills the remaining panel height. */
export function PanelEmpty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-foreground/[0.06] [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      {title && <p className="text-sm font-medium">{title}</p>}
      {children && (
        <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  );
}

/** Muted footnote pinned to the bottom of a panel. */
export function PanelFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-auto shrink-0 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
