"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

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

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function AvailabilityEditor() {
  const api = useApi();
  const [days, setDays] = useState<DayAvailability[]>(defaultDays);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api("/availability")
      .then(async (res) => {
        const data = await parseApiJson<{ days?: DayAvailability[]; error?: string }>(res);
        if (cancelled) return;
        if (!res.ok || !data.days) {
          if (res.status !== 401) {
            toast.error(data.error || "Failed to load availability");
          }
          return;
        }
        const byDay = new Map(data.days.map((d) => [d.day_of_week, d]));
        setDays(
          DAY_LABELS.map((_, i) =>
            byDay.get(i) ?? {
              day_of_week: i,
              is_available: true,
              start_time: "09:00",
              end_time: "17:00",
            },
          ),
        );
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
  }, [api]);

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
      const res = await api("/availability", {
        method: "PUT",
        body: JSON.stringify({ days }),
      });
      const data = await parseApiJson<{ days?: DayAvailability[]; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to save availability");
      }
      if (data.days) {
        const byDay = new Map(data.days.map((d) => [d.day_of_week, d]));
        setDays(
          DAY_LABELS.map((_, i) =>
            byDay.get(i) ?? {
              day_of_week: i,
              is_available: true,
              start_time: "09:00",
              end_time: "17:00",
            },
          ),
        );
      }
      toast.success("Availability saved");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save availability",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6 flex-1">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
          Availability
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
          Tell your manager when you can work. This schedule repeats every
          week.
        </p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
        <ul className="divide-y divide-border/40">
          {days.map((day, index) => (
            <li
              key={day.day_of_week}
              className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
            >
              <div className="sm:w-28 shrink-0">
                <p className="text-sm font-semibold">{DAY_LABELS[index]}</p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-background/50 border border-border/50 self-start">
                <button
                  type="button"
                  onClick={() => updateDay(index, { is_available: true })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                    day.is_available
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Available
                </button>
                <button
                  type="button"
                  onClick={() => updateDay(index, { is_available: false })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                    !day.is_available
                      ? "bg-muted text-muted-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Unavailable
                </button>
              </div>

              {day.is_available ? (
                <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                  <Input
                    type="time"
                    value={day.start_time}
                    onChange={(e) =>
                      updateDay(index, { start_time: e.target.value })
                    }
                    className="h-10 w-[8.5rem] rounded-xl bg-card/50 border-border/60"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input
                    type="time"
                    value={day.end_time}
                    onChange={(e) =>
                      updateDay(index, { end_time: e.target.value })
                    }
                    className="h-10 w-[8.5rem] rounded-xl bg-card/50 border-border/60"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground sm:ml-auto">Off</p>
              )}
            </li>
          ))}
        </ul>

        <div className="border-t border-border/40 px-4 sm:px-6 py-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="btn-brand rounded-xl h-11 px-6 w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save availability"
            )}
          </Button>
        </div>
      </div>
    </main>
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
      <AuthGuard allowedRoles={["employee", "manager", "owner"]}>
        <AvailabilityEditor />
      </AuthGuard>
    </AppShell>
  );
}
