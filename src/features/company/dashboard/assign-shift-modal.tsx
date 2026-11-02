import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CompanySettings } from "./company-settings";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rpc, unwrap } from "@/lib/rpc";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

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
      const data = await unwrap(
        rpc.ai["parse-shift"].$post({
          json: {
            prompt: trimmed,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            employeeId: employee.id,
          },
        }),
        "Could not understand that",
      );

      setTitle(data.proposal.title);
      setDate(toLocalDateInput(data.proposal.start_time));
      setStartTime(toLocalTimeInput(data.proposal.start_time));
      setEndTime(toLocalTimeInput(data.proposal.end_time));
      toast.success(
        data.proposal.interpretation || "Filled from OhShifts AI — review and assign",
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not fill from OhShifts AI",
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
      await unwrap(
        rpc.shifts.$post({
          json: {
            employeeId: employee.id,
            title,
            startTime: start,
            endTime: end,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
        "Failed to assign shift",
      );

      toast.success("Shift saved as draft — publish the week when ready");
      setIsOpen(false);
      await onAssigned?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign shift");
    } finally {
      setIsLoading(false);
    }
  }

  const busy = isLoading || isAiLoading;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`Assign a shift to ${employee.full_name}`}
        className="h-7 px-2 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Assign
      </button>

      <Dialog
        open={isOpen}
        onOpenChange={(next) => {
          if (!next && !busy) setIsOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign shift</DialogTitle>
            <DialogDescription>
              Create a draft shift for {employee.full_name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand" />
                OhShifts AI
              </span>
              <span className="text-xs text-muted-foreground">
                {aiOpen ? "Hide" : "Describe in plain language"}
              </span>
            </button>
            {aiOpen && (
              <div className="px-3 pb-3 space-y-2 border-t border-border">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={`e.g. Next Tuesday evening for ${employee.full_name.split(" ")[0]}`}
                  className={cn(fieldClass, "mt-2 py-2 resize-none")}
                  disabled={isAiLoading || isLoading}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={fillWithAi}
                    disabled={isAiLoading || isLoading || !aiPrompt.trim()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium btn-brand h-8 px-3 rounded-md disabled:opacity-50"
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
            <label htmlFor="title" className="text-[13px] font-medium text-muted-foreground">
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cook, Server, Manager"
              className={cn(fieldClass, "h-9")}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="date"
              className="text-[13px] font-medium text-muted-foreground"
            >
              Date
            </label>
            <DatePicker
              id="date"
              name="date"
              required
              value={date}
              onChange={setDate}
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
                  htmlFor="startTime"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  Start
                </label>
                <TimePicker
                  id="startTime"
                  name="startTime"
                  required
                  value={startTime}
                  onChange={setStartTime}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="endTime"
                  className="text-[13px] font-medium text-muted-foreground"
                >
                  End
                </label>
                <TimePicker
                  id="endTime"
                  name="endTime"
                  required
                  value={endTime}
                  onChange={setEndTime}
                />
              </div>
            </div>
          </div>
            </DialogBody>
            <DialogFooter>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 dark:bg-transparent"
              disabled={isLoading || isAiLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isAiLoading}
              className="btn-brand inline-flex h-8 items-center justify-center gap-1.5 px-3 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </span>
              ) : (
                "Assign shift"
              )}
            </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
