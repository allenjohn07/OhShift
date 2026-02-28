"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function InviteEmployeeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/employees/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Failed to invite employee", {
          description: data.error || "An unknown error occurred.",
        });
        return;
      }

      toast.success("Invitation sent!", {
        description: `${name} has been invited with an auto-generated code.`,
      });

      // Clear form on success
      setName("");
      setEmail("");
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
      
      <div className="p-6 flex-1 flex flex-col justify-center">
        <p className="text-sm text-muted-foreground mb-6">
          Invite a new employee to your team. We will auto-generate an invitation code password and send it to their email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee-name" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="employee-name"
              type="text"
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="employee-email"
              type="email"
              placeholder="jane.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 rounded-xl bg-card/50 border-border/60 transition-all duration-300 focus:border-foreground/30"
            />
          </div>

          <Button
            type="submit"
            className="btn-hover w-full h-10 rounded-xl font-medium mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Invite...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send Invitation
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
