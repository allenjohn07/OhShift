import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard authenticated page frame — every AppShell page uses the same
 * width and gutters as the Overview so content lines up across pages.
 */
export function PageMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-6xl flex-1 space-y-6 overflow-x-clip px-4 pt-8 pb-10 sm:px-8 sm:pt-12 sm:pb-16 lg:px-12",
        className,
      )}
    >
      {children}
    </main>
  );
}

/** Eyebrow · big title · description, with optional actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-sm text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="text-[1.75rem] font-bold leading-[1.15] tracking-tight sm:text-[2.5rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
