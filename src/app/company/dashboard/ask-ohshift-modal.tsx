"use client";

import { useState } from "react";
import { Sparkles, Loader2, X, Calendar, Clock, User } from "lucide-react";
import { IconTooltip } from "@/components/icon-tooltip";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import type { CompanySettings } from "./manage-settings-modal";
import { ScrollFade } from "@/components/scroll-fade";

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
      <IconTooltip label="Ask about the schedule or create a shift" side="bottom">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium btn-brand px-3 py-1.5 rounded-lg"
        >
          <Sparkles className="w-4 h-4" />
          Ask OhShift
        </button>
      </IconTooltip>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] border border-border/50 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/50 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand" />
                  Ask OhShift
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isEditing
                    ? "Adjust the shift details, then create."
                    : showingQuery
                      ? "Here’s what we found."
                      : showingCreate
                        ? "Review before creating a draft."
                        : "Ask about the schedule or describe a shift to create."}
                </p>
              </div>
              <IconTooltip label="Close" side="bottom">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isParsing || isCreating}
                  className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </IconTooltip>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
                  {error}
                </div>
              )}

              {!showingCreate && !showingQuery ? (
                <form onSubmit={handleAsk} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="ask-prompt" className="text-sm font-medium">
                      Ask or schedule
                    </label>
                    <textarea
                      id="ask-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="e.g. Who is the manager? Who is working Tuesday? Or: Add me to next Friday evening"
                      className="w-full px-3 py-2.5 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring resize-none"
                      disabled={isParsing}
                      autoFocus
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/50">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
                      disabled={isParsing}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isParsing || !prompt.trim()}
                      className="btn-brand h-10 px-6 rounded-xl text-sm font-medium disabled:opacity-50"
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
                  </div>
                </form>
              ) : showingQuery ? (
                <div className="space-y-4">
                  {(queryWindow || queryPerson) && (
                    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 space-y-1">
                      {queryPerson && (
                        <p className="text-sm font-medium flex items-center gap-2">
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

                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                        className="divide-y divide-border/40"
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

                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => {
                        setQueryAnswer(null);
                        setQueryShifts([]);
                        setQueryWindow(null);
                        setQueryPerson(null);
                        setError(null);
                      }}
                      className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
                    >
                      Ask again
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn-brand h-10 px-6 rounded-xl text-sm font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : isEditing && proposal ? (
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-2 text-sm rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                    <User className="w-4 h-4 text-brand shrink-0" />
                    <span className="font-medium">{proposal.employee_name}</span>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="ask-title" className="text-sm font-medium">
                      Shift Title / Role
                    </label>
                    <input
                      id="ask-title"
                      type="text"
                      value={fields.title}
                      onChange={(e) =>
                        setFields((f) => ({ ...f, title: e.target.value }))
                      }
                      required
                      className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="ask-date"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4 text-muted-foreground" /> Date
                    </label>
                    <input
                      id="ask-date"
                      type="date"
                      value={fields.date}
                      onChange={(e) =>
                        setFields((f) => ({ ...f, date: e.target.value }))
                      }
                      required
                      className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="text-sm font-medium">Shift Time</label>
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
                            className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors"
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
                            className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
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
                          className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider"
                        >
                          <Clock className="w-3.5 h-3.5" /> Start
                        </label>
                        <input
                          id="ask-start"
                          type="time"
                          value={fields.startTime}
                          onChange={(e) =>
                            setFields((f) => ({
                              ...f,
                              startTime: e.target.value,
                            }))
                          }
                          required
                          className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="ask-end"
                          className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider"
                        >
                          <Clock className="w-3.5 h-3.5" /> End
                        </label>
                        <input
                          id="ask-end"
                          type="time"
                          value={fields.endTime}
                          onChange={(e) =>
                            setFields((f) => ({
                              ...f,
                              endTime: e.target.value,
                            }))
                          }
                          required
                          className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setError(null);
                        setFields(proposalToFields(proposal));
                      }}
                      className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
                      disabled={isCreating}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isCreating}
                      className="btn-brand h-10 px-6 rounded-xl text-sm font-medium disabled:opacity-50"
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
                </div>
              ) : proposal ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {proposal.interpretation}
                  </p>

                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
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

                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => {
                        setProposal(null);
                        setIsEditing(false);
                        setError(null);
                      }}
                      className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
                      disabled={isCreating}
                    >
                      Back
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          setError(null);
                        }}
                        className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
                        disabled={isCreating}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isCreating}
                        className="btn-brand h-10 px-6 rounded-xl text-sm font-medium disabled:opacity-50"
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
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
