"use client";

import { useState } from "react";
import {
  Bell,
  CalendarClock,
  Clock,
  Mail,
  Palmtree,
  Shield,
  User,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import {
  SettingsLinkRow,
  SettingsPageShell,
  SettingsSection,
  SettingsSelectRow,
  SettingsToggleRow,
} from "@/components/settings-ui";

export default function EmployeeSettingsPage() {
  const [schedulePublished, setSchedulePublished] = useState(true);
  const [shiftReminders, setShiftReminders] = useState(true);
  const [timeOffUpdates, setTimeOffUpdates] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [timeFormat, setTimeFormat] = useState("12h");
  const [weekStartsOn, setWeekStartsOn] = useState("monday");

  return (
    <AppShell role="employee">
      <AuthGuard allowedRoles={["employee"]}>
        <SettingsPageShell
          title="Settings"
          description="Notifications, display preferences, and account shortcuts."
        >
          <SettingsSection
            title="Notifications"
            description="Choose what you hear about from your schedule."
          >
            <SettingsToggleRow
              icon={Bell}
              title="Schedule published"
              description="When your manager publishes a new week."
              checked={schedulePublished}
              onCheckedChange={setSchedulePublished}
            />
            <SettingsToggleRow
              icon={CalendarClock}
              title="Shift reminders"
              description="A heads-up before your upcoming shifts."
              checked={shiftReminders}
              onCheckedChange={setShiftReminders}
            />
            <SettingsToggleRow
              icon={Palmtree}
              title="Time-off decisions"
              description="When a request is approved or denied."
              checked={timeOffUpdates}
              onCheckedChange={setTimeOffUpdates}
            />
            <SettingsToggleRow
              icon={Mail}
              title="Email alerts"
              description="Send the same updates to your inbox (after email is enabled)."
              checked={emailAlerts}
              onCheckedChange={setEmailAlerts}
            />
          </SettingsSection>

          <SettingsSection
            title="Preferences"
            description="How dates and times appear for you."
          >
            <SettingsSelectRow
              icon={Clock}
              title="Time format"
              description="Use 12-hour or 24-hour clocks."
              value={timeFormat}
              onChange={setTimeFormat}
              options={[
                { value: "12h", label: "12-hour (1:00 PM)" },
                { value: "24h", label: "24-hour (13:00)" },
              ]}
            />
            <SettingsSelectRow
              icon={CalendarClock}
              title="Week starts on"
              description="First day shown on your schedule views."
              value={weekStartsOn}
              onChange={setWeekStartsOn}
              options={[
                { value: "monday", label: "Monday" },
                { value: "sunday", label: "Sunday" },
              ]}
            />
          </SettingsSection>

          <SettingsSection title="Account">
            <SettingsLinkRow
              icon={User}
              title="Profile"
              description="Name, photo, and password."
              href="/profile"
            />
            <SettingsLinkRow
              icon={Shield}
              title="Security"
              description="Password and sign-in options."
              href="/profile"
            />
          </SettingsSection>
        </SettingsPageShell>
      </AuthGuard>
    </AppShell>
  );
}
