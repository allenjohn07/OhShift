"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6 flex-1">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
          {description}
        </p>
      </div>

      <div className="space-y-6">{children}</div>
    </main>
  );
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
      <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card">
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <ul className="divide-y divide-border/40">{children}</ul>
    </section>
  );
}

export function SettingsToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <li className="px-4 sm:px-6 py-4 flex items-start sm:items-center gap-3 sm:gap-4 justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer",
          checked ? "bg-brand" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </li>
  );
}

export function SettingsSelectRow({
  icon: Icon,
  title,
  description,
  value,
  options,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <li className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full sm:w-48 shrink-0 rounded-xl border border-border/60 bg-card/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </li>
  );
}

export function SettingsLinkRow({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="px-4 sm:px-6 py-4 flex items-start sm:items-center gap-3 sm:gap-4 justify-between hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-2.5 sm:mt-0" />
      </Link>
    </li>
  );
}
