import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelFooter, PanelHeader } from "@/components/panel";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";
import { apiError, rpc, unwrap } from "@/lib/rpc";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    rpc.availability
      .$get()
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || "error" in data) {
          if (res.status !== 401) {
            toast.error(apiError(data, "Failed to load availability"));
          }
          return;
        }
        const loaded = normalizeDays(data.days);
        setDays(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load availability");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateDay = (index: number, patch: Partial<DayAvailability>) => {
    setDays((prev) =>
      prev.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
  };

  const handleSave = async () => {
    for (const day of days) {
      if (!day.is_available) continue;
      if (toMinutes(day.end_time) <= toMinutes(day.start_time)) {
        toast.error(
          `${DAY_LABELS[day.day_of_week]}: end time must be after start time`,
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
      const saved = normalizeDays(data.days);
      setDays(saved);
      setSavedSnapshot(JSON.stringify(saved));
      toast.success("Availability saved");
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
      sum + Math.max(0, toMinutes(d.end_time) - toMinutes(d.start_time)) / 60,
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
                      className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                      aria-label={`${DAY_LABELS[index]} start`}
                    />
                    <span className="text-sm text-muted-foreground">–</span>
                    <TimePicker
                      value={day.end_time}
                      onChange={(v) => updateDay(index, { end_time: v })}
                      className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                      aria-label={`${DAY_LABELS[index]} end`}
                    />
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
              const start = toMinutes(day.start_time);
              const end = toMinutes(day.end_time);
              const valid = day.is_available && end > start;
              return (
                <div key={day.day_of_week} className="flex items-center gap-3">
                  <span className="w-8 text-xs text-muted-foreground">
                    {DAY_LABELS[index].slice(0, 3)}
                  </span>
                  <div className="relative h-5 flex-1 rounded-sm bg-foreground/[0.05] dark:bg-foreground/[0.07]">
                    {valid && (
                      <div
                        className="absolute inset-y-0 rounded-sm bg-brand/25 dark:bg-brand/35"
                        style={{
                          left: `${(start / DAY_MINUTES) * 100}%`,
                          width: `${((end - start) / DAY_MINUTES) * 100}%`,
                        }}
                      />
                    )}
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
