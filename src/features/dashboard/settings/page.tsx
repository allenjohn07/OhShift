import { Shield, User } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import {
  DisplayPrefsSection,
  SettingsLinkRow,
  SettingsPageShell,
  SettingsSection,
} from "@/components/settings-ui";

export default function EmployeeSettingsPage() {
  const { user } = useAuth();
  return (
    <AppShell role="employee">
      <AuthGuard allowedRoles={["employee"]}>
        <SettingsPageShell
          eyebrow={user?.profile.companies?.name}
          title="Settings"
          description="How dates and times appear for you, plus account shortcuts."
        >
          <DisplayPrefsSection />

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
