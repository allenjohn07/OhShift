import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckSquare, ChevronDown, ChevronRight, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import type { CompanySettings } from "./company-settings";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fieldClass } from "@/components/ui/input";

import { ScrollFade } from "@/components/scroll-fade";
import { cn } from "@/lib/utils";
import { SimpleSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { queries } from "@/lib/queries";
import { rpc, unwrap } from "@/lib/rpc";

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
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayLocalDate);
  const [startTime, setStartTime] = useState(company.morning_start || "08:00");
  const [endTime, setEndTime] = useState(company.morning_end || "12:00");
  const [designation, setDesignation] = useState("");
  const [sharedTitle, setSharedTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, PersonOverride>>(
    () => new Map(),
  );

  // Eligibility for the chosen window — debounced so picking times doesn't
  // fire a request per change. Serialized so the debounce compares by value.
  const eligibleParams = useDebouncedValue(
    date && startTime && endTime
      ? JSON.stringify({
          start: toIso(date, startTime),
          end: toIso(date, endTime),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...(designation ? { designation } : {}),
        })
      : "",
    200,
  );
  const eligibleQuery = useQuery({
    ...queries.eligible(eligibleParams ? JSON.parse(eligibleParams) : {}),
    enabled: isOpen && Boolean(eligibleParams),
    placeholderData: keepPreviousData,
  });
  const people: EligiblePerson[] = eligibleQuery.data?.people ?? [];
  const designations = eligibleQuery.data?.designations ?? [];
  const isFetching = eligibleQuery.isFetching;
  const shownError =
    error ?? (eligibleQuery.isError ? eligibleQuery.error.message : null);

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
      const data = await unwrap(
        rpc.shifts.bulk.$post({ json: { timezone, shifts } }),
        "Failed to create shifts",
      );

      const { created, failed } = data;
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
        const firstErr = data.results.flatMap((r) => ("error" in r ? [r.error] : []))[0];
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

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1.5 text-sm font-medium btn-brand h-8 px-3 rounded-md shrink-0"
      >
        <Users className="w-4 h-4" />
        <span>Assign shifts</span>
      </button>

      <Dialog
        open={isOpen}
        onOpenChange={(next) => {
          if (!next && !isLoading) close();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign shifts</DialogTitle>
            <DialogDescription>
              Pick a time window, filter by designation, then create drafts.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {shownError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {shownError}
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When</h3>
              <div className="space-y-2">
                <label
                  htmlFor="bulk-date"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  Date
                </label>
                <DatePicker
                  id="bulk-date"
                  value={date}
                  onChange={setDate}
                  required
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-muted-foreground">Shift time</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-1">
                      Presets:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStartTime(company.morning_start);
                        setEndTime(company.morning_end);
                      }}
                      className="h-6 px-2 text-xs font-medium rounded-md border border-input transition-colors hover:bg-accent"
                    >
                      Morning
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartTime(company.evening_start);
                        setEndTime(company.evening_end);
                      }}
                      className="h-6 px-2 text-xs font-medium rounded-md border border-input transition-colors hover:bg-accent"
                    >
                      Evening
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="bulk-start"
                      className="text-[13px] font-medium text-muted-foreground"
                    >
                      Start
                    </label>
                    <TimePicker
                      id="bulk-start"
                      value={startTime}
                      onChange={setStartTime}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="bulk-end"
                      className="text-[13px] font-medium text-muted-foreground"
                    >
                      End
                    </label>
                    <TimePicker
                      id="bulk-end"
                      value={endTime}
                      onChange={setEndTime}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who</h3>
              <div className="space-y-2">
                <label htmlFor="bulk-designation" className="text-[13px] font-medium text-muted-foreground">
                  Designation
                </label>
                <SimpleSelect
                  id="bulk-designation"
                  value={designation}
                  onValueChange={setDesignation}
                  emptyLabel="All designations"
                  options={designations.map((d) => ({ value: d, label: d }))}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="bulk-title" className="text-[13px] font-medium text-muted-foreground">
                  Default title
                </label>
                <input
                  type="text"
                  id="bulk-title"
                  value={sharedTitle}
                  onChange={(e) => setSharedTitle(e.target.value)}
                  placeholder={designation || "Shift"}
                  className={cn(fieldClass, "h-9")}
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Eligible
                  {isFetching && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </h3>
                <button
                  type="button"
                  onClick={selectAllEligible}
                  disabled={eligiblePeople.length === 0}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Select all eligible
                </button>
              </div>

              {people.length === 0 && !isFetching ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No team members to show for this window.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <ScrollFade
                    contentKey={`${people.length}:${designation}:${date}:${startTime}:${endTime}`}
                    maxHeightClass="max-h-64"
                    className="divide-y divide-border"
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
                                className={cn(fieldClass, "h-8")}
                              />
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                <DatePicker
                                  size="sm"
                                  className="col-span-2 sm:col-span-1"
                                  value={o.date || date}
                                  onChange={(v) =>
                                    patchOverride(person.id, { date: v })
                                  }
                                  aria-label={`${person.full_name} date`}
                                />
                                <TimePicker
                                  size="sm"
                                  value={o.startTime || startTime}
                                  onChange={(v) =>
                                    patchOverride(person.id, { startTime: v })
                                  }
                                  aria-label={`${person.full_name} start`}
                                />
                                <TimePicker
                                  size="sm"
                                  value={o.endTime || endTime}
                                  onChange={(v) =>
                                    patchOverride(person.id, { endTime: v })
                                  }
                                  aria-label={`${person.full_name} end`}
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
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 dark:bg-transparent"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={isLoading || selectedCount === 0}
              className="btn-brand inline-flex h-8 items-center justify-center gap-1.5 px-3 rounded-md text-sm font-medium disabled:opacity-50"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
