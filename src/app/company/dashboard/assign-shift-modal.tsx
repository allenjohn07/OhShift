"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Loader2 } from "lucide-react";
import type { CompanySettings } from "./manage-settings-modal";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation?: string;
}

export function AssignShiftModal({ employee, company }: { employee: Employee, company: CompanySettings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const title = formData.get("title") as string;
    const date = formData.get("date") as string;
    const startTimeStr = formData.get("startTime") as string;
    const endTimeStr = formData.get("endTime") as string;

    // Combine date and time
    const startTime = new Date(`${date}T${startTimeStr}`).toISOString();
    const endTime = new Date(`${date}T${endTimeStr}`).toISOString();

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: employee.id,
          title,
          startTime,
          endTime,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign shift");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
      >
        Assign Shift
      </button>
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
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Shift Title / Role
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              defaultValue={employee.designation || ""}
              placeholder="e.g. Cook, Server, Manager"
              className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="date" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" /> Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              required
              className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Shift Time</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => { setStartTime(company.morning_start); setEndTime(company.morning_end); }}
                  className="px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 rounded-lg transition-colors"
                >
                  Morning
                </button>
                <button
                  type="button"
                  onClick={() => { setStartTime(company.evening_start); setEndTime(company.evening_end); }}
                  className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                >
                  Evening
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="startTime" className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
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
                <label htmlFor="endTime" className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
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
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary h-10 px-6 rounded-xl text-sm font-medium"
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
