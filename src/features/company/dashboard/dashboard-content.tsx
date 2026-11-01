import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Link } from "@/lib/navigation";
import { PageHeader, PageMain } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePendingTimeOffSnapshot } from "@/hooks/use-pending-time-off";
import { greeting, todayLabel } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { TeamMembersList } from "./team-members-list";
import { InviteEmployeeForm } from "./invite-form";
import { BulkAssignModal } from "./bulk-assign-modal";
import { TeamScheduleGrid } from "@/features/company/dashboard/team-schedule-grid";
import { DayAgenda } from "@/features/dashboard/day-agenda";
import { ManageTeamModal } from "@/features/company/dashboard/manage-team-modal";
import type { CompanySettings } from "./company-settings";
import { ShiftSummary } from "@/features/dashboard/shift-summary";
import { ActivityFeed } from "./activity-feed";

type DashboardEmployee = {
  id: string;
  full_name: string;
  email: string;
  designation?: string | null;
  role?: "employee" | "manager";
};

type DashboardShift = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  employee_id: string;
  status?: "draft" | "published";
  users?: { full_name: string };
};

type MyShift = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
};

/** Local Monday 00:00 of the current week. */
function startOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function weekStats(shifts: DashboardShift[]) {
  const monday = startOfThisWeek();
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const today = new Date().toDateString();

  let weekCount = 0;
  let weekHours = 0;
  let drafts = 0;
  const workingToday = new Set<string>();
  for (const s of shifts) {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    if (start >= monday && start < nextMonday) {
      weekCount += 1;
      weekHours += (end.getTime() - start.getTime()) / 3_600_000;
    }
    if (s.status === "draft" && end >= monday) drafts += 1;
    if (start.toDateString() === today) workingToday.add(s.employee_id);
  }
  return {
    weekCount,
    weekHours: Math.round(weekHours),
    drafts,
    workingToday: workingToday.size,
  };
}

function Stat({
  label,
  value,
  hint,
  tone,
  href,
  className,
}: {
  className?: string;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "warn";
  href?: string;
}) {
  const body = (
    <>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "mt-0.5 block text-2xl font-semibold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </>
  );
  const cls = cn("block bg-card px-4 py-3", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-accent/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function DashboardContent({
  userName,
  company,
  employees,
  shifts,
  myShifts,
  currentUser,
  onScheduleChanged,
}: {
  userName: string;
  company: CompanySettings;
  employees: DashboardEmployee[] | null;
  shifts: DashboardShift[] | null;
  myShifts: MyShift[];
  currentUser: { id: string; role: string };
  onScheduleChanged?: () => void | Promise<void>;
}) {
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const { pendingCount } = usePendingTimeOffSnapshot();

  const handleScheduleChanged = async () => {
    await onScheduleChanged?.();
    setActivityRefreshKey((k) => k + 1);
  };

  const stats = weekStats(shifts ?? []);

  return (
    <>
      <PageMain>
        <PageHeader
          eyebrow={`${company.name} · ${todayLabel()}`}
          title={greeting(userName)}
          actions={
            <>
              <Button variant="outline" onClick={() => setIsInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
              <BulkAssignModal company={company} onAssigned={handleScheduleChanged} />
            </>
          }
        />

        {/* Manager's own shifts — only for managers, not owners */}
        {currentUser.role === "manager" && (
          <ShiftSummary initialShifts={myShifts} employeeId={currentUser.id} />
        )}

        {/* At a glance */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-5">
          <Stat label="Team" value={employees?.length ?? 0} hint="members" />
          <Stat
            label="Working today"
            value={stats.workingToday}
            hint={stats.workingToday === 1 ? "person" : "people"}
          />
          <Stat
            label="This week"
            value={stats.weekCount}
            hint={`shifts · ${stats.weekHours}h`}
          />
          <Stat
            label="Drafts"
            value={stats.drafts}
            hint={stats.drafts > 0 ? "not published yet" : "all published"}
            tone={stats.drafts > 0 ? "warn" : undefined}
          />
          <Stat
            label="Requests"
            value={pendingCount}
            hint={pendingCount > 0 ? "pending review →" : "all caught up"}
            tone={pendingCount > 0 ? "warn" : undefined}
            href="/company/dashboard/requests"
            className="col-span-2 lg:col-span-1"
          />
        </div>

        <TeamScheduleGrid
          shifts={shifts}
          company={company}
          onScheduleChanged={handleScheduleChanged}
        />

        {/* One section per row — each sizes to its own content */}
        <DayAgenda shifts={shifts} currentUserId={currentUser.id} />
        <TeamMembersList
          employees={employees}
          company={company}
          onShiftAssigned={handleScheduleChanged}
          onManage={() => setIsManageTeamOpen(true)}
        />
        <ActivityFeed refreshKey={activityRefreshKey} />
      </PageMain>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to {company.name}</DialogTitle>
            <DialogDescription>
              Invite one person or add several to a list. Each gets an invite code to share (email delivery comes later).
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <InviteEmployeeForm bare />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ManageTeamModal
        isOpen={isManageTeamOpen}
        onClose={() => setIsManageTeamOpen(false)}
        employees={employees}
        currentUserRole={currentUser.role}
      />
    </>
  );
}
