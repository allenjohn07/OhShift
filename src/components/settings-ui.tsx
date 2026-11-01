import { Link } from "@/lib/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { IconTooltip } from "@/components/icon-tooltip";
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelHeader } from "@/components/panel";
import { fieldClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SettingsPageShell({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageMain>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {/* Two columns of equal-height panels; use `wide` for full-width sections */}
      <div className="grid gap-6 lg:grid-cols-2">{children}</div>
    </PageMain>
  );
}

export function SettingsSection({
  title,
  description,
  wide,
  children,
}: {
  title: string;
  description?: string;
  /** Span both columns */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Panel className={wide ? "lg:col-span-2" : undefined}>
      <PanelHeader title={title} />
      {description && (
        <p className="px-4 pt-3 text-xs text-muted-foreground sm:px-5">{description}</p>
      )}
      <ul className="divide-y divide-border">{children}</ul>
    </Panel>
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
    <li className="px-4 sm:px-5 py-3 flex items-start sm:items-center gap-3 sm:gap-4 justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-foreground/[0.06]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <IconTooltip
        label={checked ? `Turn off ${title}` : `Turn on ${title}`}
        side="top"
      >
        <span>
          <Switch checked={checked} onCheckedChange={onCheckedChange} label={title} />
        </span>
      </IconTooltip>
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
    <li className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-foreground/[0.06]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldClass, "h-8 w-full shrink-0 cursor-pointer sm:w-48")}
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
        className="px-4 sm:px-5 py-3 flex items-start sm:items-center gap-3 sm:gap-4 justify-between hover:bg-accent/60 transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-foreground/[0.06]">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-2.5 sm:mt-0" />
      </Link>
    </li>
  );
}
