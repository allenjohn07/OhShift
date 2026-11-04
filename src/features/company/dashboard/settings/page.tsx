import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PanelFooter } from "@/components/panel";
import {
  DisplayPrefsSection,
  SettingsPageShell,
  SettingsRow,
  SettingsSection,
} from "@/components/settings-ui";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { queries } from "@/lib/queries";
import { rpc, unwrap } from "@/lib/rpc";
import type { AppRole } from "@/lib/nav";
import type { CompanySettings } from "../company-settings";
import { Spinner } from "@/components/ui/spinner";

type Presets = Pick<
  CompanySettings,
  "morning_start" | "morning_end" | "evening_start" | "evening_end"
>;

const PRESET_KEYS = [
  "morning_start",
  "morning_end",
  "evening_start",
  "evening_end",
] as const;

function pickPresets(company: Presets): Presets {
  return Object.fromEntries(PRESET_KEYS.map((k) => [k, company[k]])) as Presets;
}

function PresetRange({
  label,
  start,
  end,
  onStart,
  onEnd,
  disabled,
}: {
  label: string;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <TimePicker
        size="sm"
        value={start}
        onChange={onStart}
        disabled={disabled}
        aria-label={`${label} start`}
        className="min-w-0 flex-1 sm:w-28 sm:flex-none"
      />
      <span className="text-sm text-muted-foreground">–</span>
      <TimePicker
        size="sm"
        value={end}
        onChange={onEnd}
        disabled={disabled}
        aria-label={`${label} end`}
        className="min-w-0 flex-1 sm:w-28 sm:flex-none"
      />
    </div>
  );
}

function ShiftPresetsSection() {
  const [saved, setSaved] = useState<Presets | null>(null);
  const [draft, setDraft] = useState<Presets | null>(null);
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();
  const { data } = useQuery(queries.profile());
  const company = data?.profile.companies;

  // Seed from the server once; refetches never clobber unsaved edits.
  if (company && saved === null) {
    const presets = pickPresets(company);
    setSaved(presets);
    setDraft(presets);
  }

  const dirty =
    !!draft && !!saved && PRESET_KEYS.some((k) => draft[k] !== saved[k]);

  const patch = (key: keyof Presets) => (value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  async function save() {
    if (!draft) return;
    for (const [name, s, e] of [
      ["Morning", draft.morning_start, draft.morning_end],
      ["Evening", draft.evening_start, draft.evening_end],
    ] as const) {
      if (s === e) {
        toast.error(`${name}: start and end can't be the same time`);
        return;
      }
    }
    setSaving(true);
    try {
      const data = await unwrap(
        rpc.company.$put({ json: draft }),
        "Could not save shift presets",
      );
      const presets = pickPresets(data.company);
      setSaved(presets);
      setDraft(presets);
      // Assign dialogs read presets from the dashboard/profile queries.
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Shift presets saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save shift presets");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      title="Shift presets"
      description="The Morning and Evening buttons when assigning shifts. Shared by everyone in the workspace."
      footer={
        <PanelFooter className="flex items-center justify-end gap-2">
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft(saved)}
              disabled={saving}
            >
              Discard
            </Button>
          )}
          <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
            {saving && <Spinner className="mr-1.5 h-3.5 w-3.5" />}
            Save presets
          </Button>
        </PanelFooter>
      }
    >
      <SettingsRow icon={Sun} title="Morning" description="Default morning shift window.">
        <PresetRange
          label="Morning"
          start={draft?.morning_start ?? ""}
          end={draft?.morning_end ?? ""}
          onStart={patch("morning_start")}
          onEnd={patch("morning_end")}
          disabled={!draft || saving}
        />
      </SettingsRow>
      <SettingsRow icon={Moon} title="Evening" description="Default evening shift window.">
        <PresetRange
          label="Evening"
          start={draft?.evening_start ?? ""}
          end={draft?.evening_end ?? ""}
          onStart={patch("evening_start")}
          onEnd={patch("evening_end")}
          disabled={!draft || saving}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const role: AppRole = user?.profile.role === "owner" ? "owner" : "manager";

  return (
    <AppShell role={role}>
      <AuthGuard loginPath="/company/login" allowedRoles={["owner", "manager"]}>
        <SettingsPageShell
          eyebrow={user?.profile.companies?.name}
          title="Settings"
          description="Workspace shift presets and how dates and times appear for you."
        >
          <ShiftPresetsSection />
          <DisplayPrefsSection />
        </SettingsPageShell>
      </AuthGuard>
    </AppShell>
  );
}
