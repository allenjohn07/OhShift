import { useState } from "react";
import { Sparkles, Loader2, Calendar, Clock, User } from "lucide-react";

import { toast } from "sonner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import type { CompanySettings } from "./company-settings";
import { ScrollFade } from "@/components/scroll-fade";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

type ShiftProposal = {
  employee_id: string;
  employee_name: string;
  title: string;
  start_time: string;
  end_time: string;
  interpretation: string;
};

type QueryShift = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  users?: { full_name: string };
};

type EditFields = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function proposalToFields(proposal: ShiftProposal): EditFields {
  return {
    title: proposal.title,
    date: toLocalDateInput(proposal.start_time),
    startTime: toLocalTimeInput(proposal.start_time),
    endTime: toLocalTimeInput(proposal.end_time),
  };
}

function fieldsToIso(fields: EditFields): { start: string; end: string } | null {
  if (!fields.date || !fields.startTime || !fields.endTime) return null;
  const start = new Date(`${fields.date}T${fields.startTime}`);
  let end = new Date(`${fields.date}T${fields.endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export function AskOhShiftModal({
  onCreated,
  company,
}: {
  onCreated?: () => void | Promise<void>;
  company?: CompanySettings | null;
}) {
  const api = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<ShiftProposal | null>(null);
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
  const [queryShifts, setQueryShifts] = useState<QueryShift[]>([]);
  const [queryWindow, setQueryWindow] = useState<string | null>(null);
  const [queryPerson, setQueryPerson] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fields, setFields] = useState<EditFields>({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function reset() {
    setPrompt("");
    setProposal(null);
    setQueryAnswer(null);
    setQueryShifts([]);
    setQueryWindow(null);
    setQueryPerson(null);
    setIsEditing(false);
    setFields({ title: "", date: "", startTime: "", endTime: "" });
    setError(null);
    setIsParsing(false);
    setIsCreating(false);
  }

  function handleClose() {
    if (isParsing || isCreating) return;
    setIsOpen(false);
    reset();
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setIsParsing(true);
    setError(null);
    setProposal(null);
    setQueryAnswer(null);
    setQueryShifts([]);
    setQueryWindow(null);
    setQueryPerson(null);
    setIsEditing(false);

    try {
      const res = await api("/ai/ask", {
        method: "POST",
        body: JSON.stringify({ prompt: trimmed, timezone }),
      });
      const data = await parseApiJson<{
        error?: string;
        kind?: "create" | "query";
        proposal?: ShiftProposal;
        answer?: string;
        window_label?: string;
        person?: string | null;
        shifts?: QueryShift[];
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Could not process that request");
      }

      if (data.kind === "query") {
        setQueryAnswer(data.answer || "No answer returned.");
        setQueryShifts(data.shifts ?? []);
        setQueryWindow(data.window_label ?? null);
        setQueryPerson(data.person ?? null);
        return;
      }

      if (data.kind === "create" && data.proposal) {
        setProposal(data.proposal);
        setFields(proposalToFields(data.proposal));
        return;
      }

      throw new Error(data.error || "Could not process that request");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not process that request",
      );
    } finally {
      setIsParsing(false);
    }
  }

  async function handleConfirm() {
    if (!proposal) return;

    const times = fieldsToIso(fields);
    if (!times) {
      setError("Enter a valid date and start/end time");
      return;
    }
    if (!fields.title.trim()) {
      setError("Shift title is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await api("/shifts", {
        method: "POST",
        body: JSON.stringify({
          employeeId: proposal.employee_id,
          title: fields.title.trim(),
          startTime: times.start,
          endTime: times.end,
          timezone,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Failed to create shift");
      }

      toast.success("Shift saved as draft — publish the week when ready");
      setIsOpen(false);
      reset();
      await onCreated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create shift");
    } finally {
      setIsCreating(false);
    }
  }

  const previewStartEnd = fieldsToIso(fields);
  const showingQuery = queryAnswer !== null;
  const showingCreate = proposal !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent dark:bg-transparent [&_svg]:text-brand"
      >
        <Sparkles className="w-4 h-4" />
        Ask OhShift
      </button>

      <Dialog
          open={isOpen}
          onOpenChange={(next) => {
            if (!next && !isParsing && !isCreating) handleClose();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  Ask OhShift
                </DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Adjust the shift details, then create."
                    : showingQuery
                      ? "Here’s what we found."
                      : showingCreate
                        ? "Review before creating a draft."
                        : "Ask about the schedule or describe a shift to create."}
                </DialogDescription>
              </DialogHeader>

            <DialogBody>
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {!showingCreate && !showingQuery ? (
                <form onSubmit={handleAsk} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="ask-prompt" className="text-[13px] font-medium text-muted-foreground">
                      Ask or schedule
                    </label>
                    <textarea
                      id="ask-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="e.g. Who is the manager? Who is working Tuesday? Or: Add me to next Friday evening"
                      className={cn(fieldClass, "py-2 resize-none")}
                      disabled={isParsing}
                      autoFocus
                    />
                  </div>

                  <DialogFooter className="sticky -bottom-5 -mx-6 -mb-5 mt-5 bg-popover">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 dark:bg-transparent"
                      disabled={isParsing}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isParsing || !prompt.trim()}
                      className="btn-brand inline-flex h-8 items-center justify-center gap-1.5 px-3 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      {isParsing ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Thinking...
                        </span>
                      ) : (
                        "Ask"
                      )}
                    </button>
                  </DialogFooter>
                </form>
              ) : showingQuery ? (
                <div className="space-y-4">
                  {(queryWindow || queryPerson) && (
                    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 space-y-1">
                      {queryPerson && (
                        <p className="text-[13px] font-medium text-muted-foreground">
                          <User className="w-4 h-4 text-brand shrink-0" />
                          {queryPerson}
                        </p>
                      )}
                      {queryWindow && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          {queryWindow}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-sm leading-relaxed text-foreground">
                    {queryAnswer}
                  </p>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-2 border-b border-border bg-muted/30">
                      <p className="text-[13px] font-medium text-muted-foreground">
                        From schedule
                        {queryShifts.length > 0
                          ? ` (${queryShifts.length})`
                          : ""}
                      </p>
                    </div>
                    {queryShifts.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No shifts in this window.
                      </p>
                    ) : (
                      <ScrollFade
                        contentKey={queryShifts.map((s) => s.id).join(",")}
                        maxHeightClass="max-h-56"
                        className="divide-y divide-border"
                      >
                        {queryShifts.map((shift) => (
                          <div key={shift.id} className="px-3 py-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">
                                {shift.users?.full_name || "Team member"}
                              </p>
                              <span
                                className={
                                  shift.status === "published"
                                    ? "text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                }
                              >
                                {shift.status}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {shift.title}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              {formatRange(shift.start_time, shift.end_time)}
                            </p>
                          </div>
                        ))}
                      </ScrollFade>
                    )}
                  </div>

                  <DialogFooter className="sticky -bottom-5 -mx-6 -mb-5 mt-5 bg-popover sm:justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setQueryAnswer(null);
                        setQueryShifts([]);
                        setQueryWindow(null);
                        setQueryPerson(null);
                        setError(null);
                      }}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 dark:bg-transparent"
                    >
                      Ask again
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn-brand inline-flex h-8 items-center justify-center gap-1.5 px-3 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      Done
                    </button>
                  </DialogFooter>
                </div>
              ) : isEditing && proposal ? (
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-2 text-sm rounded-md border border-border bg-muted/30 px-3 py-2.5">
                    <User className="w-4 h-4 text-brand shrink-0" />
                    <span className="font-medium">{proposal.employee_name}</span>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="ask-title" className="text-[13px] font-medium text-muted-foreground">
              Title
            </label>
                    <input
                      id="ask-title"
                      type="text"
                      value={fields.title}
                      onChange={(e) =>
                        setFields((f) => ({ ...f, title: e.target.value }))
                      }
                      required
                      className={cn(fieldClass, "h-9")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="ask-date"
                      className="text-[13px] font-medium text-muted-foreground"
                    >
                      Date
                    </label>
                    <DatePicker
                      id="ask-date"
                      value={fields.date}
                      onChange={(date) => setFields((f) => ({ ...f, date }))}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="text-[13px] font-medium text-muted-foreground">Shift time</label>
                      {company && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground mr-1">
                            Presets:
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFields((f) => ({
                                ...f,
                                startTime: company.morning_start,
                                endTime: company.morning_end,
                              }))
                            }
                            className="h-6 px-2 text-xs font-medium rounded-md border border-input transition-colors hover:bg-accent"
                          >
                            Morning
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFields((f) => ({
                                ...f,
                                startTime: company.evening_start,
                                endTime: company.evening_end,
                              }))
                            }
                            className="h-6 px-2 text-xs font-medium rounded-md border border-input transition-colors hover:bg-accent"
                          >
                            Evening
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label
                          htmlFor="ask-start"
                          className="text-[13px] font-medium text-muted-foreground"
                        >
                          Start
                        </label>
                        <TimePicker
                          id="ask-start"
                          value={fields.startTime}
                          onChange={(startTime) =>
                            setFields((f) => ({ ...f, startTime }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="ask-end"
                          className="text-[13px] font-medium text-muted-foreground"
                        >
                          End
                        </label>
                        <TimePicker
                          id="ask-end"
                          value={fields.endTime}
                          onChange={(endTime) =>
                            setFields((f) => ({ ...f, endTime }))
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="sticky -bottom-5 -mx-6 -mb-5 mt-5 bg-popover">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setError(null);
                        setFields(proposalToFields(proposal));
                      }}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 dark:bg-transparent"
                      disabled={isCreating}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isCreating}
                      className="btn-brand inline-flex h-8 items-center justify-center gap-1.5 px-3 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      {isCreating ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </span>
                      ) : (
                        "Create shift"
                      )}
                    </button>
                  </DialogFooter>
                </div>
              ) : proposal ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {proposal.interpretation}
                  </p>

                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-brand shrink-0" />
                      <span className="font-medium">
                        {proposal.employee_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>
                        {previewStartEnd
                          ? formatRange(previewStartEnd.start, previewStartEnd.end)
                          : formatRange(proposal.start_time, proposal.end_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{fields.title || proposal.title}</span>
                    </div>
                  </div>

                  <DialogFooter className="sticky -bottom-5 -mx-6 -mb-5 mt-5 bg-popover sm:justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setProposal(null);
                        setIsEditing(false);
                        setError(null);
                      }}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 dark:bg-transparent"
                      disabled={isCreating}
                    >
                      Back
                    </button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          setError(null);
                        }}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 dark:bg-transparent"
                        disabled={isCreating}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isCreating}
                        className="btn-brand inline-flex h-8 items-center justify-center gap-1.5 px-3 rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        {isCreating ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </span>
                        ) : (
                          "Create shift"
                        )}
                      </button>
                    </div>
                  </DialogFooter>
                </div>
              ) : null}
            </DialogBody>
          </DialogContent>
        </Dialog>
    </>
  );
}
