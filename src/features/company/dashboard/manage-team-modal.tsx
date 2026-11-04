import { useState } from "react";
import { X, Loader2, Save, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Input, fieldClass } from "@/components/ui/input";
import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SimpleSelect } from "@/components/ui/select";
import { rpc, unwrap } from "@/lib/rpc";
import { completeDemoStep } from "@/features/demo/tour-store";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation?: string | null;
  role?: "employee" | "manager";
}

export function ManageTeamModal({
  isOpen,
  onChanged,
  onClose,
  employees,
  currentUserRole,
}: {
  isOpen: boolean;
  /** Refetch team data after a role/title change or removal (same tab). */
  onChanged?: () => void | Promise<void>;
  onClose: () => void;
  employees: Employee[] | null;
  currentUserRole: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);

  const isOwner = currentUserRole === "owner";

  const handleSaveDesignation = async (employeeId: string) => {
    setIsSaving(employeeId);
    try {
      await unwrap(
        rpc.employees.$put({ json: { employeeId, designation: editValue.trim() } }),
        "Could not update designation",
      );

      toast.success("Designation updated!");
      setEditingId(null);
      await onChanged?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Could not update designation",
      );
    } finally {
      setIsSaving(null);
    }
  };

  const handleRoleChange = async (
    employeeId: string,
    role: "employee" | "manager",
    name: string,
  ) => {
    setRoleSavingId(employeeId);
    try {
      await unwrap(
        rpc.employees.$put({ json: { employeeId, role } }),
        "Failed to update role",
      );

      toast.success(
        role === "manager"
          ? `${name} is now a manager`
          : `${name} is now an employee`,
      );
      if (role === "manager") completeDemoStep("promote");
      await onChanged?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Could not update role",
      );
    } finally {
      setRoleSavingId(null);
    }
  };

  const handleRemoveEmployee = async (employeeId: string, name: string) => {
    if (
      !confirm(
        `Deactivate ${name}? They will lose access. Historical shifts and timesheets will be preserved.`,
      )
    )
      return;

    setIsDeleting(employeeId);
    try {
      await unwrap(
        rpc.employees.$delete({ query: { id: employeeId } }),
        "Failed to remove employee",
      );

      toast.success(`${name} was deactivated`);
      await onChanged?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove employee",
      );
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage team</DialogTitle>
          <DialogDescription>
            Update titles, roles, or deactivate team members.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {!employees || employees.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No employees found. Invite some to get started!
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{emp.full_name}</p>
                      {emp.role === "manager" && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">
                          <Shield className="w-3 h-3" />
                          Manager
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {emp.email}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                    {isOwner && (
                      <SimpleSelect
                        size="sm"
                        value={emp.role ?? "employee"}
                        disabled={roleSavingId === emp.id}
                        onValueChange={(v) =>
                          handleRoleChange(
                            emp.id,
                            v as "employee" | "manager",
                            emp.full_name,
                          )
                        }
                        options={[
                          { value: "employee", label: "Employee" },
                          { value: "manager", label: "Manager" },
                        ]}
                        className="w-32"
                        aria-label={`Role for ${emp.full_name}`}
                      />
                    )}

                    {editingId === emp.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="e.g. Server"
                          className="h-8 w-32"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleSaveDesignation(emp.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <IconTooltip label="Save title" side="top">
                          <button
                            onClick={() => handleSaveDesignation(emp.id)}
                            disabled={isSaving === emp.id}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-brand transition-colors hover:bg-accent"
                            aria-label="Save title"
                          >
                            {isSaving === emp.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                        </IconTooltip>
                        <IconTooltip label="Cancel" side="top">
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
                            aria-label="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </IconTooltip>
                      </div>
                    ) : (
                      <div
                        className={cn(fieldClass, "flex h-8 w-32 cursor-pointer items-center truncate hover:bg-accent")}
                        onClick={() => {
                          setEditingId(emp.id);
                          setEditValue(emp.designation || "");
                        }}
                      >
                        {emp.designation ? (
                          <span className="truncate">
                            {emp.designation}
                          </span>
                        ) : (
                          <span className="truncate text-muted-foreground/70">
                            Add title…
                          </span>
                        )}
                      </div>
                    )}

                    
                    <IconTooltip label="Remove employee" side="top">
                      <button
                        onClick={() =>
                          handleRemoveEmployee(emp.id, emp.full_name)
                        }
                        disabled={isDeleting === emp.id}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove employee"
                      >
                        {isDeleting === emp.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </IconTooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
