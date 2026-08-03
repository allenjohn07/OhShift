"use client";

import { useState } from "react";
import { Calendar, Clock, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CompanySettings } from "./manage-settings-modal";
import { useApi } from "@/hooks/use-api";
import { parseApiJson } from "@/lib/api";
import { IconTooltip } from "@/components/icon-tooltip";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation?: string | null;
}

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

export function AssignShiftModal({
  employee,
  company,
  onAssigned,
}: {
  employee: Employee;
  company: CompanySettings;
  onAssigned?: () => void | Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(employee.designation || "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const api = useApi();

  function open() {
    setIsOpen(true);
    setError(null);
    setTitle(employee.designation || "");
    setDate("");
    setStartTime("");
    setEndTime("");
    setAiPrompt("");
    setAiOpen(false);
  }

  async function fillWithAi() {
    const trimmed = aiPrompt.trim();
    if (!trimmed) return;

    setIsAiLoading(true);
    setError(null);

    try {
      const res = await api("/ai/parse-shift", {
        method: "POST",
        body: JSON.stringify({
          prompt: trimmed,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          employeeId: employee.id,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        proposal?: {
          title: string;
          start_time: string;
          end_time: string;
          interpretation?: string;
        };
      }>(res);

      if (!res.ok || !data.proposal) {
        throw new Error(data.error || "Could not understand that");
      }

      setTitle(data.proposal.title);
      setDate(toLocalDateInput(data.proposal.start_time));
      setStartTime(toLocalTimeInput(data.proposal.start_time));
      setEndTime(toLocalTimeInput(data.proposal.end_time));
      toast.success(
        data.proposal.interpretation || "Filled from OhShift AI — review and assign",
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not fill from OhShift AI",
      );
    } finally {
      setIsAiLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const start = new Date(`${date}T${startTime}`).toISOString();
    const end = new Date(`${date}T${endTime}`).toISOString();

    try {
      const res = await api("/shifts", {
        method: "POST",
        body: JSON.stringify({
          employeeId: employee.id,
          title,
          startTime: start,
          endTime: end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign shift");
      }

      toast.success("Shift saved as draft — publish the week when ready");
      setIsOpen(false);
      await onAssigned?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign shift");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <IconTooltip label="Assign a shift to this person" side="bottom">
        <button
          onClick={open}
          className="text-sm font-medium btn-brand px-3 py-1.5 rounded-lg"
        >
          Assign Shift
        </button>
      </IconTooltip>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] border border-border/50 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-xl font-semibold">Assign Shift</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Setting schedule for {employee.full_name}
          </p>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 text-left">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand" />
                OhShift AI
              </span>
              <span className="text-xs text-muted-foreground">
                {aiOpen ? "Hide" : "Describe in plain language"}
              </span>
            </button>
            {aiOpen && (
              <div className="px-3 pb-3 space-y-2 border-t border-border/40">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={`e.g. Next Tuesday evening for ${employee.full_name.split(" ")[0]}`}
                  className="mt-2 w-full px-3 py-2 rounded-xl border border-input bg-transparent text-sm shadow-xs resize-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={isAiLoading || isLoading}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={fillWithAi}
                    disabled={isAiLoading || isLoading || !aiPrompt.trim()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium btn-brand h-8 px-3 rounded-lg disabled:opacity-50"
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Filling...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Fill form
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Shift Title / Role
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cook, Server, Manager"
              className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="date"
              className="text-sm font-medium flex items-center gap-2"
            >
              <Calendar className="w-4 h-4 text-muted-foreground" /> Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Shift Time</label>
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
                  htmlFor="startTime"
                  className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider"
                >
                  <Clock className="w-3.5 h-3.5" /> Start
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="endTime"
                  className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider"
                >
                  <Clock className="w-3.5 h-3.5" /> End
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-border/50 mt-6">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-xl transition-colors"
              disabled={isLoading || isAiLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isAiLoading}
              className="btn-brand h-10 px-6 rounded-xl text-sm font-medium"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </span>
              ) : (
                "Assign Shift"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
