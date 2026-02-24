"use client";

import { Header } from "@/components/layout/header";
import { mockCompany } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);
  const inviteCode = "BREW-2025-XK9";

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite code copied to clipboard");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Settings saved");
  };

  return (
    <div>
      <Header title="Settings" />

      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Company Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your company profile and preferences
          </p>
        </div>

        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Profile</CardTitle>
            <CardDescription>Basic information about your company</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  defaultValue={mockCompany.name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">ohshift.com/</span>
                  <Input
                    id="slug"
                    defaultValue={mockCompany.slug}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select defaultValue={mockCompany.timezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Invite Code */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite Code</CardTitle>
            <CardDescription>
              Share this code with employees to let them join your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-2.5 bg-muted rounded-lg font-mono text-sm tracking-widest">
                {inviteCode}
              </div>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification preferences link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>
              Manage your email and in-app notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/notifications">
              <Button variant="outline">
                Manage Notification Preferences
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
