"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  CalendarClock,
  Clock,
  Inbox,
  Mail,
  MapPin,
  Users,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import {
  SettingsPageShell,
  SettingsSection,
  SettingsSelectRow,
  SettingsToggleRow,
} from "@/components/settings-ui";
import type { AppRole } from "@/lib/nav";

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const role: AppRole = user?.profile.role === "owner" ? "owner" : "manager";

  const [timeOffAlerts, setTimeOffAlerts] = useState(true);
  const [publishReminders, setPublishReminders] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [weekStartsOn, setWeekStartsOn] = useState("monday");
  const [timezone, setTimezone] = useState("local");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [morningPreset, setMorningPreset] = useState("08:00–16:00");
  const [eveningPreset, setEveningPreset] = useState("16:00–00:00");
  const [requireSwapApproval, setRequireSwapApproval] = useState(true);
  const [showCompanyName, setShowCompanyName] = useState(true);

  return (
    <AppShell role={role}>
      <AuthGuard loginPath="/company/login" allowedRoles={["owner", "manager"]}>
        <SettingsPageShell
          title="Settings"
          description="Workspace schedule defaults, notifications, and team preferences."
        >
          <SettingsSection
            title="Schedule"
            description="Defaults used when assigning shifts. Editable here soon — presets still work from Overview for now."
          >
            <SettingsSelectRow
              icon={Clock}
              title="Morning preset"
              description="Default morning shift window."
              value={morningPreset}
              onChange={setMorningPreset}
              options={[
                { value: "08:00–16:00", label: "8:00 AM – 4:00 PM" },
                { value: "07:00–15:00", label: "7:00 AM – 3:00 PM" },
                { value: "09:00–17:00", label: "9:00 AM – 5:00 PM" },
              ]}
            />
            <SettingsSelectRow
              icon={Clock}
              title="Evening preset"
              description="Default evening shift window."
              value={eveningPreset}
              onChange={setEveningPreset}
              options={[
                { value: "16:00–00:00", label: "4:00 PM – 12:00 AM" },
                { value: "15:00–23:00", label: "3:00 PM – 11:00 PM" },
                { value: "14:00–22:00", label: "2:00 PM – 10:00 PM" },
              ]}
            />
            <SettingsSelectRow
              icon={CalendarClock}
              title="Week starts on"
              description="First day of the scheduling week."
              value={weekStartsOn}
              onChange={setWeekStartsOn}
              options={[
                { value: "monday", label: "Monday" },
                { value: "sunday", label: "Sunday" },
              ]}
            />
            <SettingsSelectRow
              icon={MapPin}
              title="Timezone"
              description="Used for shift times and publish windows."
              value={timezone}
              onChange={setTimezone}
              options={[
                { value: "local", label: "Device local time" },
                { value: "America/New_York", label: "Eastern (US)" },
                { value: "America/Chicago", label: "Central (US)" },
                { value: "America/Denver", label: "Mountain (US)" },
                { value: "America/Los_Angeles", label: "Pacific (US)" },
              ]}
            />
            <SettingsSelectRow
              icon={Clock}
              title="Time format"
              description="How times appear across the company dashboard."
              value={timeFormat}
              onChange={setTimeFormat}
              options={[
                { value: "12h", label: "12-hour (1:00 PM)" },
                { value: "24h", label: "24-hour (13:00)" },
              ]}
            />
          </SettingsSection>

          <SettingsSection
            title="Notifications"
            description="Stay on top of team requests and schedule changes."
          >
            <SettingsToggleRow
              icon={Inbox}
              title="Time-off requests"
              description="When someone submits a new time-off request."
              checked={timeOffAlerts}
              onCheckedChange={setTimeOffAlerts}
            />
            <SettingsToggleRow
              icon={Bell}
              title="Publish reminders"
              description="Nudge when a draft week still needs publishing."
              checked={publishReminders}
              onCheckedChange={setPublishReminders}
            />
            <SettingsToggleRow
              icon={Mail}
              title="Email digest"
              description="Daily summary for managers (after email is enabled)."
              checked={emailDigest}
              onCheckedChange={setEmailDigest}
            />
          </SettingsSection>

          <SettingsSection
            title="Team & workspace"
            description="How invites and company details behave."
          >
            <SettingsToggleRow
              icon={Users}
              title="Require manager approval for swaps"
              description="Employees can propose swaps; you confirm before they stick."
              checked={requireSwapApproval}
              onCheckedChange={setRequireSwapApproval}
            />
            <SettingsToggleRow
              icon={Building2}
              title="Show company name on employee schedule"
              description="Display your workspace name on shared views."
              checked={showCompanyName}
              onCheckedChange={setShowCompanyName}
            />
          </SettingsSection>
        </SettingsPageShell>
      </AuthGuard>
    </AppShell>
  );
}
