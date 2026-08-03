"use client";

import { useState } from "react";
import { Sparkles, Loader2, X, Calendar, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import type { CompanySettings } from "./manage-settings-modal";

type ShiftProposal = {
  employee_id: string;
  employee_name: string;
  title: string;
  start_time: string;
  end_time: string;
  interpretation: string;
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
  // Overnight: end clock is earlier than start → next calendar day
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

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setIsParsing(true);
    setError(null);
    setProposal(null);
    setIsEditing(false);

    try {
      const res = await api("/ai/parse-shift", {
        method: "POST",
        body: JSON.stringify({ prompt: trimmed, timezone }),
      });
      const data = await parseApiJson<{
        error?: string;
        proposal?: ShiftProposal;
      }>(res);

      if (!res.ok || !data.proposal) {
        throw new Error(data.error || "Could not parse that request");
      }

      setProposal(data.proposal);
      setFields(proposalToFields(data.proposal));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not parse that request",
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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-medium btn-brand px-3 py-1.5 rounded-lg"
      >
        <Sparkles className="w-4 h-4" />
        Ask OhShift
      </button>

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
                    : "Describe a shift in plain language — review before it is created."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isParsing || isCreating}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
                  {error}
                </div>
              )}

              {!proposal ? (
                <form onSubmit={handleParse} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="ask-prompt" className="text-sm font-medium">
                      What should we schedule?
                    </label>
                    <textarea
                      id="ask-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="e.g. Add me to next Tuesday evening"
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
                          Parsing...
                        </span>
                      ) : (
                        "Preview"
                      )}
                    </button>
                  </div>
                </form>
              ) : isEditing ? (
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
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
