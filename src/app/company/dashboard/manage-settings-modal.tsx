"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface CompanySettings {
  id: string;
  name: string;
  morning_start: string;
  morning_end: string;
  evening_start: string;
  evening_end: string;
}

export function ManageSettingsModal({ 
  isOpen, 
  onClose, 
  company 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  company: CompanySettings;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // Local state for the 4 time presets
  const [morningStart, setMorningStart] = useState(company.morning_start || "08:00");
  const [morningEnd, setMorningEnd] = useState(company.morning_end || "16:00");
  const [eveningStart, setEveningStart] = useState(company.evening_start || "16:00");
  const [eveningEnd, setEveningEnd] = useState(company.evening_end || "00:00");

  if (!isOpen) return null;

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          morning_start: morningStart,
          morning_end: morningEnd,
          evening_start: eveningStart,
          evening_end: eveningEnd,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to save settings");
        return;
      }

      toast.success("Settings saved successfully!");
      router.refresh(); // Refresh to ensure changes propagate
      onClose();
    } catch (err) {
      toast.error("Network error saving settings");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border/50 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-violet-500" /> 
              Company Settings
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure global schedule preferences
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/90 border-b border-border/40 pb-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              Morning Shift Presets
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Time</label>
                <Input
                  type="time"
                  required
                  value={morningStart}
                  onChange={(e) => setMorningStart(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Time</label>
                <Input
                  type="time"
                  required
                  value={morningEnd}
                  onChange={(e) => setMorningEnd(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/90 border-b border-border/40 pb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Evening Shift Presets
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Time</label>
                <Input
                  type="time"
                  required
                  value={eveningStart}
                  onChange={(e) => setEveningStart(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Time</label>
                <Input
                  type="time"
                  required
                  value={eveningEnd}
                  onChange={(e) => setEveningEnd(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-10 px-4 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-10 px-6 rounded-xl btn-hover"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
