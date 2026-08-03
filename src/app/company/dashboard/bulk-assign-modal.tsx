"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { CompanySettings } from "./manage-settings-modal";
import { useApi } from "@/hooks/use-api";
import { IconTooltip } from "@/components/icon-tooltip";
import { ScrollFade } from "@/components/scroll-fade";
import { cn } from "@/lib/utils";

type EligibilityReason =
  | "unavailable"
  | "conflict"
  | "time_off"
  | "outside_window"
  | "designation_mismatch"
  | null;

type EligiblePerson = {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
  role: string;
  eligible: boolean;
  reason: EligibilityReason;
};

type PersonOverride = {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  expanded?: boolean;
};

function reasonLabel(reason: EligibilityReason): string {
  switch (reason) {
    case "unavailable":
      return "Unavailable";
    case "conflict":
      return "Conflict";
    case "time_off":
      return "On time off";
    case "outside_window":
      return "Outside availability";
    case "designation_mismatch":
      return "Different designation";
    default:
      return "Ineligible";
  }
}

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export function BulkAssignModal({
  company,
  onAssigned,
}: {
  company: CompanySettings;
  onAssigned?: () => void | Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayLocalDate);
  const [startTime, setStartTime] = useState(company.morning_start || "08:00");
  const [endTime, setEndTime] = useState(company.morning_end || "12:00");
  const [designation, setDesignation] = useState("");
  const [sharedTitle, setSharedTitle] = useState("");
  const [designations, setDesignations] = useState<string[]>([]);
  const [people, setPeople] = useState<EligiblePerson[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, PersonOverride>>(
    () => new Map(),
  );

  const api = useApi();
  const fetchGen = useRef(0);

  const eligiblePeople = people.filter((p) => p.eligible);
  const selectedCount = [...selected].filter((id) =>
    eligiblePeople.some((p) => p.id === id),
  ).length;

  useEffect(() => {
    if (!isOpen) return;
    if (designation) {
      setSharedTitle((prev) => (prev.trim() ? prev : designation));
    }
  }, [designation, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const gen = ++fetchGen.current;
    const timer = window.setTimeout(async () => {
      if (!date || !startTime || !endTime) return;

      setIsFetching(true);
      try {
        const start = toIso(date, startTime);
        const end = toIso(date, endTime);
        const params = new URLSearchParams({
          start,
          end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (designation) params.set("designation", designation);

        const res = await api(`/shifts/eligible?${params}`);
        const data = await res.json();
        if (gen !== fetchGen.current) return;

        if (!res.ok) {
          setError(data.error || "Failed to load eligible team members");
          setPeople([]);
          return;
        }

        setError(null);
        setPeople(data.people ?? []);
        setDesignations(data.designations ?? []);
        setSelected((prev) => {
          const next = new Set<string>();
          for (const id of prev) {
            const person = (data.people as EligiblePerson[] | undefined)?.find(
              (p) => p.id === id,
            );
            if (person?.eligible) next.add(id);
          }
          return next;
        });
      } catch {
        if (gen !== fetchGen.current) return;
        setError("Failed to load eligible team members");
        setPeople([]);
      } finally {
        if (gen === fetchGen.current) setIsFetching(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [isOpen, date, startTime, endTime, designation, api]);

  function open() {
    setIsOpen(true);
    setError(null);
    setDate(todayLocalDate());
    setStartTime(company.morning_start || "08:00");
    setEndTime(company.morning_end || "12:00");
    setDesignation("");
    setSharedTitle("");
    setSelected(new Set());
    setOverrides(new Map());
    setPeople([]);
  }

  function close() {
    if (isLoading) return;
    setIsOpen(false);
  }

  function togglePerson(id: string, eligible: boolean) {
    if (!eligible) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllEligible() {
    const allSelected =
      eligiblePeople.length > 0 &&
      eligiblePeople.every((p) => selected.has(p.id));
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(eligiblePeople.map((p) => p.id)));
  }

  function getOverride(id: string): PersonOverride {
    return overrides.get(id) ?? {};
  }

  function patchOverride(id: string, patch: Partial<PersonOverride>) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, { ...next.get(id), ...patch });
      return next;
    });
  }

  function resolvedFields(person: EligiblePerson) {
    const o = getOverride(person.id);
    return {
      title:
        o.title?.trim() ||
        sharedTitle.trim() ||
        person.designation?.trim() ||
        "Shift",
      date: o.date || date,
      startTime: o.startTime || startTime,
      endTime: o.endTime || endTime,
    };
  }

  async function onCreate() {
    if (selectedCount === 0) {
      setError("Select at least one eligible team member");
      return;
    }

    setIsLoading(true);
    setError(null);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const shifts = people
      .filter((p) => p.eligible && selected.has(p.id))
      .map((p) => {
        const f = resolvedFields(p);
        return {
          employeeId: p.id,
          title: f.title,
          startTime: toIso(f.date, f.startTime),
          endTime: toIso(f.date, f.endTime),
        };
      });

    try {
      const res = await api("/shifts/bulk", {
        method: "POST",
        body: JSON.stringify({ timezone, shifts }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create shifts");
      }

      const created = data.created ?? 0;
      const failed = data.failed ?? 0;
      if (created > 0 && failed === 0) {
        toast.success(
          `${created} draft shift${created === 1 ? "" : "s"} created — publish when ready`,
        );
      } else if (created > 0 && failed > 0) {
        toast.warning(
          `${created} created, ${failed} failed — check availability and conflicts`,
        );
      } else {
        toast.error("No shifts were created");
        const firstErr = (data.results as Array<{ error?: string }> | undefined)?.find(
          (r) => r.error,
        )?.error;
        if (firstErr) setError(firstErr);
        return;
      }

      setIsOpen(false);
      await onAssigned?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create shifts");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <IconTooltip label="Assign shifts to multiple people" side="bottom">
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-2 text-sm font-medium btn-brand h-9 px-3 rounded-xl shrink-0"
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Assign shifts</span>
        </button>
      </IconTooltip>
    );
  }

  const allEligibleSelected =
    eligiblePeople.length > 0 &&
    eligiblePeople.every((p) => selected.has(p.id));

  return (
    <>
      <IconTooltip label="Assign shifts to multiple people" side="bottom">
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-2 text-sm font-medium btn-brand h-9 px-3 rounded-xl shrink-0"
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Assign shifts</span>
        </button>
      </IconTooltip>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] border border-border/50 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
          <div className="p-6 border-b border-border/50 flex items-start justify-between gap-3 shrink-0">
            <div>
              <h2 className="text-xl font-semibold">Assign shifts</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick a time window, filter by designation, then create drafts.
              </p>
            </div>
            <IconTooltip label="Close" side="bottom">
              <button
                type="button"
                onClick={close}
                disabled={isLoading}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </IconTooltip>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
                {error}
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">When</h3>
              <div className="space-y-2">
                <label
                  htmlFor="bulk-date"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-muted-foreground" /> Date
                </label>
                <input
                  type="date"
                  id="bulk-date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Shift time</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-1">
                      Presets:
                    </span>
                    <IconTooltip label="Apply morning hours" side="top">
                      <button
                        type="button"
                        onClick={() => {
                          setStartTime(company.morning_start);
                          setEndTime(company.morning_end);
                        }}
                        className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors"
                      >
                        Morning
                      </button>
                    </IconTooltip>
                    <IconTooltip label="Apply evening hours" side="top">
                      <button
                        type="button"
                        onClick={() => {
                          setStartTime(company.evening_start);
                          setEndTime(company.evening_end);
                        }}
                        className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                      >
                        Evening
                      </button>
                    </IconTooltip>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="bulk-start"
                      className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider"
                    >
                      <Clock className="w-3.5 h-3.5" /> Start
                    </label>
                    <input
                      type="time"
                      id="bulk-start"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="bulk-end"
                      className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider"
                    >
                      <Clock className="w-3.5 h-3.5" /> End
                    </label>
                    <input
                      type="time"
                      id="bulk-end"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Who</h3>
              <div className="space-y-2">
                <label htmlFor="bulk-designation" className="text-sm font-medium">
                  Designation
                </label>
                <select
                  id="bulk-designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All designations</option>
                  {designations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="bulk-title" className="text-sm font-medium">
                  Default title
                </label>
                <input
                  type="text"
                  id="bulk-title"
                  value={sharedTitle}
                  onChange={(e) => setSharedTitle(e.target.value)}
                  placeholder={designation || "Shift"}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Eligible
                  {isFetching && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </h3>
                <IconTooltip
                  label={
                    allEligibleSelected
                      ? "Clear selection"
                      : "Select all eligible"
                  }
                  side="top"
                >
                  <button
                    type="button"
                    onClick={selectAllEligible}
                    disabled={eligiblePeople.length === 0}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Select all eligible
                  </button>
                </IconTooltip>
              </div>

              {people.length === 0 && !isFetching ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No team members to show for this window.
                </p>
              ) : (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <ScrollFade
                    contentKey={`${people.length}:${designation}:${date}:${startTime}:${endTime}`}
                    maxHeightClass="max-h-64"
                    className="divide-y divide-border/40"
                  >
                    {people.map((person) => {
                      const isSelected = selected.has(person.id);
                      const o = getOverride(person.id);
                      const expanded = Boolean(o.expanded && isSelected);
                      return (
                        <div
                          key={person.id}
                          className={cn(
                            "px-3 py-2.5 transition-colors",
                            !person.eligible && "opacity-50",
                            isSelected && person.eligible && "bg-brand-soft/40",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected && person.eligible}
                              disabled={!person.eligible}
                              onChange={() =>
                                togglePerson(person.id, person.eligible)
                              }
                              className="mt-1 h-4 w-4 rounded border-input accent-[var(--brand-from)]"
                              aria-label={`Select ${person.full_name}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium truncate">
                                  {person.full_name}
                                </p>
                                {person.designation && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    {person.designation}
                                  </span>
                                )}
                              </div>
                              {!person.eligible && person.reason && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {reasonLabel(person.reason)}
                                </p>
                              )}
                              {person.eligible && isSelected && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchOverride(person.id, {
                                      expanded: !o.expanded,
                                    })
                                  }
                                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  {expanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                  Edit details
                                </button>
                              )}
                            </div>
                          </div>
                          {expanded && (
                            <div className="mt-3 ml-7 space-y-2">
                              <input
                                type="text"
                                value={
                                  o.title !== undefined
                                    ? o.title
                                    : sharedTitle ||
                                      person.designation ||
                                      ""
                                }
                                onChange={(e) =>
                                  patchOverride(person.id, {
                                    title: e.target.value,
                                  })
                                }
                                placeholder="Title"
                                className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm"
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  type="date"
                                  value={o.date || date}
                                  onChange={(e) =>
                                    patchOverride(person.id, {
                                      date: e.target.value,
                                    })
                                  }
                                  className="h-9 px-2 rounded-lg border border-input bg-transparent text-xs"
                                />
                                <input
                                  type="time"
                                  value={o.startTime || startTime}
                                  onChange={(e) =>
                                    patchOverride(person.id, {
                                      startTime: e.target.value,
                                    })
                                  }
                                  className="h-9 px-2 rounded-lg border border-input bg-transparent text-xs"
                                />
                                <input
                                  type="time"
                                  value={o.endTime || endTime}
                                  onChange={(e) =>
                                    patchOverride(person.id, {
                                      endTime: e.target.value,
                                    })
                                  }
                                  className="h-9 px-2 rounded-lg border border-input bg-transparent text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </ScrollFade>
                </div>
              )}
            </section>

            <p className="text-sm text-muted-foreground">
              {selectedCount} draft shift{selectedCount === 1 ? "" : "s"} will
              be created
            </p>
          </div>

          <div className="p-6 pt-4 flex items-center justify-end gap-3 border-t border-border/50 shrink-0">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={isLoading || selectedCount === 0}
              className="btn-brand h-10 px-6 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create drafts"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
