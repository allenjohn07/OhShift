import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Moon } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { IconTooltip } from "@/components/icon-tooltip";
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelFooter, PanelHeader } from "@/components/panel";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";
import { queries } from "@/lib/queries";
import { rpc, unwrap } from "@/lib/rpc";
import { completeDemoStep } from "@/features/demo/tour-store";

type DayAvailability = {
  day_of_week: number;
  is_available: boolean;
  start_time: string;
  end_time: string;
};

const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function defaultDays(): DayAvailability[] {
  return DAY_LABELS.map((_, i) => ({
    day_of_week: i,
    is_available: true,
    start_time: "09:00",
    end_time: "17:00",
  }));
}

const DAY_MINUTES = 24 * 60;

/** Window length in minutes; an end at/before the start runs overnight. */
function windowMinutes(day: DayAvailability) {
  const start = toMinutes(day.start_time);
  const end = toMinutes(day.end_time);
  return end > start ? end - start : end + DAY_MINUTES - start;
}

const isOvernight = (day: DayAvailability) =>
  toMinutes(day.end_time) <= toMinutes(day.start_time);

/** Always Mon–Sun in order, filling any missing day with the default window. */
function normalizeDays(rows: DayAvailability[]): DayAvailability[] {
  const byDay = new Map(rows.map((d) => [d.day_of_week, d]));
  return DAY_LABELS.map(
    (_, i) =>
      byDay.get(i) ?? {
        day_of_week: i,
        is_available: true,
        start_time: "09:00",
        end_time: "17:00",
      },
  );
}

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function AvailabilityEditor() {
  const [days, setDays] = useState<DayAvailability[]>(defaultDays);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const { data, isPending: loading } = useQuery(queries.availability());

  // Seed the editor from the server once; later refetches never clobber edits.
  const [seeded, setSeeded] = useState(false);
  if (data && !seeded) {
    const loaded = normalizeDays(data.days);
    setSeeded(true);
    setDays(loaded);
    setSavedSnapshot(JSON.stringify(loaded));
  }

  const updateDay = (index: number, patch: Partial<DayAvailability>) => {
    setDays((prev) =>
      prev.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
  };

  const handleSave = async () => {
    for (const day of days) {
      if (!day.is_available) continue;
      // End before start is fine (overnight, e.g. 20:00–04:00); equal isn't.
      if (day.end_time === day.start_time) {
        toast.error(
          `${DAY_LABELS[day.day_of_week]}: start and end can't be the same time`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const data = await unwrap(
        rpc.availability.$put({ json: { days } }),
        "Failed to save availability",
      );
      queryClient.setQueryData(queries.availability().queryKey, data);
      const saved = normalizeDays(data.days);
      setDays(saved);
      setSavedSnapshot(JSON.stringify(saved));
      toast.success("Availability saved");
      completeDemoStep("availability");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save availability",
      );
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(days) !== savedSnapshot;
  const availableDays = days.filter((d) => d.is_available);
  const totalHours = availableDays.reduce(
    (sum, d) =>
      sum + windowMinutes(d) / 60,
    0,
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageMain>
      <PageHeader
        eyebrow={user?.profile.companies?.name}
        title="Availability"
        description="Tell your manager when you can work. This schedule repeats every week."
        actions={
          <>
            {dirty && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save availability"
              )}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Weekly editor */}
        <Panel className="lg:col-span-3">
          <PanelHeader title="Weekly hours" meta="Local time" />
          <ul className="divide-y divide-border">
            {days.map((day, index) => (
              <li
                key={day.day_of_week}
                className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-5"
              >
                <div className="flex w-36 items-center gap-3">
                  <Switch
                    size="sm"
                    checked={day.is_available}
                    onCheckedChange={(next) => updateDay(index, { is_available: next })}
                    label={`Available on ${DAY_LABELS[index]}`}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      !day.is_available && "text-muted-foreground",
                    )}
                  >
                    {DAY_LABELS[index]}
                  </span>
                </div>

                {day.is_available ? (
                  <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                    <TimePicker
                      value={day.start_time}
                      onChange={(v) => updateDay(index, { start_time: v })}
                      className="min-w-0 flex-1 sm:w-36 sm:flex-none"
                      aria-label={`${DAY_LABELS[index]} start`}
                    />
                    <span className="text-sm text-muted-foreground">–</span>
                    <TimePicker
                      value={day.end_time}
                      onChange={(v) => updateDay(index, { end_time: v })}
                      className="min-w-0 flex-1 sm:w-36 sm:flex-none"
                      aria-label={`${DAY_LABELS[index]} end`}
                    />
                    {/* Fixed slot so rows stay aligned whether or not they're overnight. */}
                    <span className="flex w-4 shrink-0 justify-center">
                      {isOvernight(day) && day.end_time !== day.start_time && (
                        <IconTooltip label="Ends the next morning (overnight)" side="top">
                          <Moon
                            className="h-4 w-4 text-muted-foreground"
                            aria-label="Overnight"
                          />
                        </IconTooltip>
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="ml-auto text-sm text-muted-foreground">
                    Unavailable
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        {/* Week at a glance */}
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Your week"
            meta={`${availableDays.length} day${availableDays.length === 1 ? "" : "s"} · ${Math.round(totalHours * 10) / 10}h`}
          />
          <div className="flex flex-1 flex-col justify-center gap-2.5 px-4 py-4 sm:px-5">
            {days.map((day, index) => {
              // This day's window (until midnight), plus the morning part of
              // the previous day's overnight window.
              const segments: Array<[number, number]> = [];
              if (day.is_available && day.end_time !== day.start_time) {
                const start = toMinutes(day.start_time);
                segments.push([start, isOvernight(day) ? DAY_MINUTES : toMinutes(day.end_time)]);
              }
              const prev = days[(index + 6) % 7];
              if (prev.is_available && isOvernight(prev) && prev.end_time !== prev.start_time) {
                segments.push([0, toMinutes(prev.end_time)]);
              }
              return (
                <div key={day.day_of_week} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-muted-foreground">
                    {DAY_LABELS[index].slice(0, 3)}
                  </span>
                  <div className="relative h-5 flex-1 rounded-sm bg-foreground/[0.05] dark:bg-foreground/[0.07]">
                    {segments.map(([from, to]) => (
                      <div
                        key={from}
                        className="absolute inset-y-0 rounded-sm bg-brand/25 dark:bg-brand/35"
                        style={{
                          left: `${(from / DAY_MINUTES) * 100}%`,
                          width: `${((to - from) / DAY_MINUTES) * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex pl-11 text-[10px] text-muted-foreground tabular-nums">
              {["12a", "6a", "12p", "6p", "12a"].map((t, i) => (
                <span key={i} className={cn("flex-1", i === 4 && "flex-none")}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <PanelFooter>
            Managers can only assign shifts inside these hours. Approved time
            off is blocked separately.
          </PanelFooter>
        </Panel>
      </div>
    </PageMain>
  );
}

export default function AvailabilityPage() {
  const { user } = useAuth();
  const role: AppRole =
    user?.profile.role === "owner"
      ? "owner"
      : user?.profile.role === "manager"
        ? "manager"
        : "employee";

  return (
    <AppShell role={role}>
      {/* Owners run the workspace and don't work shifts — the guard sends them to Overview. */}
      <AuthGuard allowedRoles={["employee", "manager"]}>
        <AvailabilityEditor />
      </AuthGuard>
    </AppShell>
  );
}
