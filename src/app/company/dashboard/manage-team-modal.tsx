"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Users, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation?: string | null;
}

export function ManageTeamModal({ 
  isOpen, 
  onClose, 
  employees 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  employees: Employee[] | null;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveDesignation = async (employeeId: string) => {
    setIsSaving(employeeId);
    try {
      const res = await fetch("/api/employees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, designation: editValue.trim() }),
      });

      if (!res.ok) throw new Error("Failed to update designation");

      toast.success("Designation updated!");
      setEditingId(null);
      router.refresh();
    } catch (error) {
      toast.error("Could not update designation");
    } finally {
      setIsSaving(null);
    }
  };

  const handleRemoveEmployee = async (employeeId: string, name: string) => {
    if (!confirm(`Are you sure you want to completely remove ${name} from your team? This action cannot be undone.`)) return;
    
    setIsDeleting(employeeId);
    try {
      const res = await fetch(`/api/employees?id=${employeeId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove employee");
      }

      toast.success(`${name} was removed from the team`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-border/50 animate-in fade-in zoom-in-95 duration-200 my-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Manage Team</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Update employee titles or remove them from your company.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[500px]">
          {(!employees || employees.length === 0) ? (
             <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
               No employees found. Invite some to get started!
             </div>
          ) : (
             <div className="space-y-4">
               {employees.map(emp => (
                 <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/40 rounded-xl border border-border/50 gap-4">
                    <div className="flex-1 min-w-0">
                       <p className="font-medium truncate">{emp.full_name}</p>
                       <p className="text-sm text-muted-foreground truncate">{emp.email}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {editingId === emp.id ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="e.g. Server"
                            className="h-8 w-32 text-sm bg-background"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveDesignation(emp.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button
                            onClick={() => handleSaveDesignation(emp.id)}
                            disabled={isSaving === emp.id}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                          >
                            {isSaving === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="px-3 py-1.5 bg-background border border-border/50 rounded-lg text-sm cursor-pointer hover:border-emerald-500/50 transition-colors w-32 truncate text-center"
                          onClick={() => {
                            setEditingId(emp.id);
                            setEditValue(emp.designation || "");
                          }}
                          title="Click to edit designation"
                        >
                          {emp.designation ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{emp.designation}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Add title...</span>
                          )}
                        </div>
                      )}

                      <div className="w-px h-8 bg-border/50 mx-1 hidden sm:block"></div>

                      <button
                        onClick={() => handleRemoveEmployee(emp.id, emp.full_name)}
                        disabled={isDeleting === emp.id}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Remove Employee"
                      >
                         {isDeleting === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
