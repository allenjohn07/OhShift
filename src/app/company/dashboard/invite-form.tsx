"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, UserPlus, Loader2, X, Plus } from "lucide-react";
import { toast } from "sonner";

interface Invitee {
  fullName: string;
  email: string;
  designation: string;
}

export function InviteEmployeeForm() {
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToList = () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Full Name and Email are required.");
      return;
    }

    const cleanEmail = email.trim();
    const isValidEvent = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    
    if (!isValidEvent) {
      toast.error("Invalid email format.");
      return;
    }

    if (invitees.some(i => i.email === cleanEmail)) {
      toast.error("Email is already in the list.");
      return;
    }

    setInvitees([
      ...invitees,
      {
        fullName: fullName.trim(),
        email: cleanEmail,
        designation: designation.trim()
      }
    ]);

    // Reset inputs
    setFullName("");
    setEmail("");
    setDesignation("");
  };

  const handleRemoveInvitee = (indexToRemove: number) => {
    setInvitees(invitees.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // If there's something left in the inputs and list is empty, try to add it first
    let currentInvitees = [...invitees];
    if (currentInvitees.length === 0 && fullName.trim() && email.trim()) {
      const cleanEmail = email.trim();
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
      if (isValid) {
        currentInvitees.push({
          fullName: fullName.trim(),
          email: cleanEmail,
          designation: designation.trim()
        });
      }
    }

    if (currentInvitees.length === 0) {
      toast.error("Please add at least one valid employee to the list.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/employees/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invites: currentInvitees }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Failed to invite employee", {
          description: data.error || "An unknown error occurred.",
        });
        return;
      }

      if (data.details && data.details.length > 0) {
        toast.warning(data.message || "Some invitations failed", {
          description: `Failed for some: ${data.details[0]}${data.details.length > 1 ? ` + ${data.details.length - 1} more` : ''}`,
        });
      } else {
        toast.success("Invitations sent!", {
          description: "All employees have been invited.",
        });
      }

      // Clear form on success
      setInvitees([]);
      setFullName("");
      setEmail("");
      setDesignation("");
    } catch (err) {
      toast.error("Network error", {
        description: "Could not reach the server to send the invite.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden h-full flex flex-col">
      <div className="border-b border-border/40 px-6 py-4 bg-card flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-emerald-500" />
        <h2 className="font-semibold text-lg">Invite Employee</h2>
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground mb-6">
          Add team members to your invite list. We will auto-generate an invitation code and send it to their email.
        </p>

        {/* Add to List Form */}
        <div className="space-y-4 mb-6 pb-6 border-b border-border/40">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
            <Input
              id="fullName"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all focus-visible:ring-1 focus-visible:ring-foreground/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddToList();
                }
              }}
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all focus-visible:ring-1 focus-visible:ring-foreground/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation" className="text-sm font-medium">
              Designation <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="designation"
              placeholder="e.g. Cook, Steward, Manager"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddToList();
                }
              }}
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all focus-visible:ring-1 focus-visible:ring-foreground/30"
            />
          </div>

          <Button 
            type="button" 
            variant="secondary"
            onClick={handleAddToList}
            className="w-full h-9 rounded-xl font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add to List
          </Button>
        </div>

        {/* Submit Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Pending Invitations</Label>
              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                {invitees.length} added
              </span>
            </div>

            {invitees.length === 0 ? (
              <div className="h-24 rounded-xl border border-dashed border-border/60 flex items-center justify-center text-sm text-muted-foreground">
                No employees added yet
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {invitees.map((invitee, idx) => (
                  <div key={idx} className="flex flex-col p-3 bg-card/50 border border-border/60 rounded-xl group relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{invitee.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{invitee.email}</p>
                        {invitee.designation && (
                          <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-border/50 bg-background/50">
                            {invitee.designation}
                          </span>
                        )}
                      </div>
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
                ))}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="btn-hover w-full h-10 rounded-xl font-medium"
            disabled={isLoading || (invitees.length === 0 && !fullName.trim())}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Invites...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send Invitations
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
