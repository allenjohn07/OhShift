import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Loader2, X, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { IconTooltip } from "@/components/icon-tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiError, rpc } from "@/lib/rpc";
import { completeDemoStep } from "@/features/demo/tour-store";

interface Invitee {
  fullName: string;
  email: string;
  designation: string;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Invite form body — rendered inside the Invite dialog on the Overview. */
export function InviteEmployeeForm() {
  const queryClient = useQueryClient();
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
      const res = await rpc.employees.invite.$post({ json: { invites: list } });
      const data = await res.json();

      if ("error" in data) {
        const detail =
          "details" in data && Array.isArray(data.details) && data.details.length > 0
            ? data.details.join(" · ")
            : apiError(data, "An unknown error occurred.");
        toast.error("Failed to invite employee", {
          description: detail,
          duration: 12_000,
        });
        return;
      }

      const created = data.invites;

      if ("demo" in data) {
        toast.success(data.message);
        completeDemoStep("invite");
      } else if (created.length > 0) {
        toast.success(created.length === 1 ? "Invitation sent" : "Invitations sent", {
          description: "Each employee will receive a link to set their password.",
        });
      } else {
        toast.success(data.message || "Invitations created");
      }

      if ("errors" in data && data.errors?.length) {
        toast.warning("Some invites had issues", {
          description: data.errors[0],
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
    <div className="flex flex-col">
      <div className="flex flex-col">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Full name
            </Label>
            <Input
              id="fullName"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email
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
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">
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
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void handleInviteNow()}
              disabled={isLoading || !canSubmitForm}
              className="btn-hover h-10 flex-1 rounded-md font-medium"
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
              className="h-9 flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to list
            </Button>
          </div>
        </div>

        {invitees.length > 0 && (
          <div className="mt-6 space-y-4 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <Label>Pending invitations</Label>
              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-sm font-medium">
                {invitees.length} added
              </span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {invitees.map((invitee, idx) => (
                <div
                  key={`${invitee.email}-${idx}`}
                  className="flex flex-col p-3 bg-card border border-border rounded-lg"
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
                        <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-border bg-background">
                          {invitee.designation}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <IconTooltip label="Edit invitee" side="top">
                        <button
                          type="button"
                          onClick={() => handleEditInvitee(idx)}
                          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                          aria-label="Edit invitee"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </IconTooltip>
                      <IconTooltip label="Remove invitee" side="top">
                        <button
                          type="button"
                          onClick={() => handleRemoveInvitee(idx)}
                          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          aria-label="Remove invitee"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </IconTooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={() => void handleSendPending()}
              disabled={isLoading}
              className="btn-hover w-full h-10 rounded-md font-medium"
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
              <Label htmlFor="editFullName">
                Full Name
              </Label>
              <Input
                id="editFullName"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">
                Email Address
              </Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDesignation">
                Designation
              </Label>
              <Input
                id="editDesignation"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingIndex(null)}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="h-9"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
