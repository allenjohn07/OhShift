"use client";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const emailNotifications = [
  {
    id: "new-shift",
    title: "New Shift Assigned",
    description: "Get notified when you're assigned a new shift",
    defaultChecked: true,
  },
  {
    id: "shift-updated",
    title: "Shift Updated",
    description: "Get notified when a shift's time, location, or notes change",
    defaultChecked: true,
  },
  {
    id: "shift-cancelled",
    title: "Shift Cancelled",
    description: "Get notified when a shift is cancelled",
    defaultChecked: true,
  },
  {
    id: "reminder",
    title: "24-Hour Reminder",
    description: "Receive a reminder 24 hours before each upcoming shift",
    defaultChecked: true,
  },
  {
    id: "weekly-summary",
    title: "Weekly Schedule Summary",
    description: "Receive a weekly digest every Sunday evening",
    defaultChecked: false,
  },
];

const inAppNotifications = [
  {
    id: "in-app-shifts",
    title: "Shift Notifications",
    description: "Show shift updates in the notification bell",
    defaultChecked: true,
  },
  {
    id: "in-app-team",
    title: "Team Updates",
    description: "Show team activity notifications",
    defaultChecked: true,
  },
];

export default function NotificationSettingsPage() {
  const handleSave = () => {
    toast.success("Notification preferences saved");
  };

  return (
    <div>
      <Header title="Notification Settings" />

      <div className="p-6 max-w-2xl space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to settings
        </Link>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Notification Preferences
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose what notifications you receive
          </p>
        </div>

        {/* Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Notifications</CardTitle>
            <CardDescription>
              Sent to your registered email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailNotifications.map((notif, i) => (
              <div key={notif.id}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={notif.id} className="text-sm font-medium cursor-pointer">
                      {notif.title}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {notif.description}
                    </p>
                  </div>
                  <Switch id={notif.id} defaultChecked={notif.defaultChecked} />
                </div>
                {i < emailNotifications.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* In-app */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In-App Notifications</CardTitle>
            <CardDescription>
              Shown in the notification bell in the header
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inAppNotifications.map((notif, i) => (
              <div key={notif.id}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={notif.id} className="text-sm font-medium cursor-pointer">
                      {notif.title}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {notif.description}
                    </p>
                  </div>
                  <Switch id={notif.id} defaultChecked={notif.defaultChecked} />
                </div>
                {i < inAppNotifications.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
