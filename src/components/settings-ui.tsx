import { Link } from "@tanstack/react-router";
import type { RoutePath } from "@/lib/nav";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, ChevronRight, Clock } from "lucide-react";
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelHeader } from "@/components/panel";
import { SimpleSelect } from "@/components/ui/select";
import {
  setDisplayPrefs,
  useDisplayPrefs,
  type TimeFormat,
  type WeekStart,
} from "@/lib/display-prefs";

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
  footer,
  children,
}: {
  title: string;
  description?: string;
  /** Span both columns */
  wide?: boolean;
  /** Rendered below the rows (e.g. a Save button in a PanelFooter) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel className={wide ? "lg:col-span-2" : undefined}>
      <PanelHeader title={title} />
      {description && (
        <p className="px-4 pt-3 text-xs text-muted-foreground sm:px-5">{description}</p>
      )}
      <ul className="divide-y divide-border">{children}</ul>
      {footer}
    </Panel>
  );
}

/** Icon + title/description on the left, any control on the right. */
export function SettingsRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
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
      {children}
    </li>
  );
}

export function SettingsSelectRow({
  icon,
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
    <SettingsRow icon={icon} title={title} description={description}>
      <SimpleSelect
        size="sm"
        value={value}
        onValueChange={onChange}
        options={options}
        className="w-full shrink-0 sm:w-48"
        aria-label={title}
      />
    </SettingsRow>
  );
}

/** Time format + week start, saved on this device and applied app-wide. */
export function DisplayPrefsSection() {
  const prefs = useDisplayPrefs();
  return (
    <SettingsSection
      title="Display"
      description="Saved on this device and applied right away."
    >
      <SettingsSelectRow
        icon={Clock}
        title="Time format"
        description="Use 12-hour or 24-hour clocks."
        value={prefs.timeFormat}
        onChange={(v) => setDisplayPrefs({ timeFormat: v as TimeFormat })}
        options={[
          { value: "12h", label: "12-hour (1:00 PM)" },
          { value: "24h", label: "24-hour (13:00)" },
        ]}
      />
      <SettingsSelectRow
        icon={CalendarClock}
        title="Week starts on"
        description="First day on schedules and calendars."
        value={prefs.weekStartsOn}
        onChange={(v) => setDisplayPrefs({ weekStartsOn: v as WeekStart })}
        options={[
          { value: "monday", label: "Monday" },
          { value: "sunday", label: "Sunday" },
        ]}
      />
    </SettingsSection>
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
  href: RoutePath;
}) {
  return (
    <li>
      <Link
        to={href}
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
