"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, UserPlus, Loader2, X, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Invitee {
  fullName: string;
  email: string;
  designation: string;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function InviteEmployeeForm() {
  const api = useApi();
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDesignation, setEditDesignation] = useState("");

  const clearForm = () => {
    setFullName("");
    setEmail("");
    setDesignation("");
  };

  const parseFormInvitee = (): Invitee | null => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Full Name and Email are required.");
      return null;
    }

    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      toast.error("Invalid email format.");
      return null;
    }

    return {
      fullName: fullName.trim(),
      email: cleanEmail,
      designation: designation.trim(),
    };
  };

  const sendInvites = async (list: Invitee[], clearList: boolean) => {
    setIsLoading(true);
    try {
      const res = await api("/employees/invite", {
        method: "POST",
        body: JSON.stringify({ invites: list }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail =
          Array.isArray(data.details) && data.details.length > 0
            ? data.details.join(" · ")
            : data.error || "An unknown error occurred.";
        toast.error("Failed to invite employee", {
          description: detail,
          duration: 12_000,
        });
        return;
      }

      const created = (data.invites ?? []) as Array<{
        email: string;
        fullName: string;
        inviteCode: string;
      }>;

      if (created.length > 0) {
        const summary = created
          .map((i) => `${i.email}: ${i.inviteCode}`)
          .join(" · ");
        toast.success(
          created.length === 1 ? "Employee invited" : "Employees invited",
          {
            description: `Share these invite codes (not emailed yet): ${summary}`,
            duration: 30_000,
          },
        );
      } else if (data.details?.length) {
        toast.warning(data.message || "Some invitations failed", {
          description: data.details[0],
        });
      } else {
        toast.success(data.message || "Invitations created");
      }

      if (data.errors?.length) {
        toast.warning("Some invites had issues", {
          description: data.errors[0],
        });
      }

      clearForm();
      if (clearList) setInvitees([]);
    } catch {
      toast.error("Network error", {
        description: "Could not reach the server to create the invite.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteNow = async () => {
    const invitee = parseFormInvitee();
    if (!invitee) return;
    await sendInvites([invitee], false);
  };

  const handleAddToList = () => {
    const invitee = parseFormInvitee();
    if (!invitee) return;

    if (invitees.some((i) => i.email === invitee.email)) {
      toast.error("Email is already in the list.");
      return;
    }

    setInvitees([...invitees, invitee]);
    clearForm();
  };

  const handleSendPending = async () => {
    if (invitees.length === 0) {
      toast.error("Add at least one employee to the list first.");
      return;
    }
    await sendInvites(invitees, true);
  };

  const handleRemoveInvitee = (indexToRemove: number) => {
    setInvitees(invitees.filter((_, idx) => idx !== indexToRemove));
  };

  const handleEditInvitee = (index: number) => {
    const invitee = invitees[index];
    setEditFullName(invitee.fullName);
    setEditEmail(invitee.email);
    setEditDesignation(invitee.designation);
    setEditingIndex(index);
  };

  const handleSaveEdit = () => {
    if (!editFullName.trim() || !editEmail.trim()) {
      toast.error("Full Name and Email are required.");
      return;
    }

    const cleanEmail = editEmail.trim();
    if (!isValidEmail(cleanEmail)) {
      toast.error("Invalid email format.");
      return;
    }

    if (
      invitees.some(
        (i, idx) => i.email === cleanEmail && idx !== editingIndex,
      )
    ) {
      toast.error("Email is already in the list.");
      return;
    }

    if (editingIndex !== null) {
      const updatedInvitees = [...invitees];
      updatedInvitees[editingIndex] = {
        fullName: editFullName.trim(),
        email: cleanEmail,
        designation: editDesignation.trim(),
      };
      setInvitees(updatedInvitees);
      setEditingIndex(null);
      toast.success("Invitee details updated.");
    }
  };

  const canSubmitForm = Boolean(fullName.trim() && email.trim());

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden h-full flex flex-col">
      <div className="border-b border-border/40 px-4 sm:px-6 py-4 bg-card flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-emerald-500" />
        <h2 className="font-semibold text-lg">Invite Employee</h2>
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
          Invite someone now, or add several to a list and send them together.
          We generate an invite code for each person — share it so they can log
          in (email delivery comes later).
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="fullName"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all focus-visible:ring-1 focus-visible:ring-foreground/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleInviteNow();
                }
              }}
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all focus-visible:ring-1 focus-visible:ring-foreground/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation" className="text-sm font-medium">
              Designation{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </Label>
            <Input
              id="designation"
              placeholder="e.g. Cook, Steward, Manager"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleInviteNow();
                }
              }}
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all focus-visible:ring-1 focus-visible:ring-foreground/30"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void handleInviteNow()}
              disabled={isLoading || !canSubmitForm}
              className="btn-hover h-10 flex-1 rounded-xl font-medium"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Inviting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Invite
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddToList}
              disabled={isLoading || !canSubmitForm}
              className="h-10 flex-1 rounded-xl font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to List
            </Button>
          </div>
        </div>

        {invitees.length > 0 && (
          <div className="mt-6 space-y-4 border-t border-border/40 pt-6">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Pending Invitations</Label>
              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                {invitees.length} added
              </span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {invitees.map((invitee, idx) => (
                <div
                  key={`${invitee.email}-${idx}`}
                  className="flex flex-col p-3 bg-card/50 border border-border/60 rounded-xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {invitee.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {invitee.email}
                      </p>
                      {invitee.designation && (
                        <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-border/50 bg-background/50">
                          {invitee.designation}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditInvitee(idx)}
                        className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveInvitee(idx)}
                        className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={() => void handleSendPending()}
              disabled={isLoading}
              className="btn-hover w-full h-10 rounded-xl font-medium"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send {invitees.length} Invitation
                  {invitees.length === 1 ? "" : "s"}
                </span>
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={editingIndex !== null}
        onOpenChange={(open) => !open && setEditingIndex(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editFullName" className="text-sm font-medium">
                Full Name
              </Label>
              <Input
                id="editFullName"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="h-10 rounded-xl bg-card/50 border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="h-10 rounded-xl bg-card/50 border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDesignation" className="text-sm font-medium">
                Designation
              </Label>
              <Input
                id="editDesignation"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                className="h-10 rounded-xl bg-card/50 border-border/60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingIndex(null)}
              className="h-10 rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="h-10 rounded-xl">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
