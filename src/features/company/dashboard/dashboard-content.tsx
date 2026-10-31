import { useState } from "react";
import { Users, Calendar, Settings } from "lucide-react";
import { TeamMembersList } from "./team-members-list";
import { InviteEmployeeForm } from "./invite-form";
import { TeamScheduleGrid } from "@/features/company/dashboard/team-schedule-grid";
import { TodayCompanySchedule } from "@/features/dashboard/today-company-schedule";
import { ManageTeamModal } from "@/features/company/dashboard/manage-team-modal";
import { ManageSettingsModal, type CompanySettings } from "./manage-settings-modal";
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

export function DashboardContent({ 
  userName, 
  company, 
  employees, 
  shifts,
  myShifts,
  currentUser,
  onScheduleChanged,
}: { 
  userName: string, 
  company: CompanySettings, 
  employees: DashboardEmployee[] | null, 
  shifts: DashboardShift[] | null,
  myShifts: MyShift[],
  currentUser: { id: string; role: string },
  onScheduleChanged?: () => void | Promise<void>,
}) {
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [isManageSettingsOpen, setIsManageSettingsOpen] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  const handleScheduleChanged = async () => {
    await onScheduleChanged?.();
    setActivityRefreshKey((k) => k + 1);
  };

  return (
    <>
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-10 sm:pb-16 space-y-8 sm:space-y-10 overflow-x-clip w-full">
        <div>
          <p className="text-sm text-muted-foreground mb-1.5">
            {company.name}
          </p>
          <h1 className="text-[1.75rem] sm:text-[2.5rem] leading-[1.15] font-bold tracking-tight">
            Welcome back, {userName}
          </h1>
        </div>

        {/* Manager's own shift summary — only for managers, not owners */}
        {currentUser.role === "manager" && (
          <ShiftSummary initialShifts={myShifts} employeeId={currentUser.id} />
        )}

        {/* Quick stats — Notion-style property tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setIsManageTeamOpen(true)}
            className="group w-full rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/60 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Team
            </span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums">
              {employees?.length || 0}
            </span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              Manage team →
            </span>
          </button>
          <div className="w-full rounded-lg border border-border bg-card px-4 py-3.5">
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Shifts scheduled
            </span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums">
              {shifts?.length || 0}
            </span>
            <span className="text-xs text-muted-foreground">All time</span>
          </div>
          <button
            type="button"
            onClick={() => setIsManageSettingsOpen(true)}
            className="group w-full rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/60 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
              Shift presets
            </span>
            <span className="mt-1 block text-sm font-medium tabular-nums">
              {company.morning_start}–{company.morning_end} ·{" "}
              {company.evening_start}–{company.evening_end}
            </span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              Edit settings →
            </span>
          </button>
        </div>

        {/* Dashboard Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Team Members Area (takes 7/12 width on large screens) */}
          <TeamMembersList
            employees={employees}
            company={company}
            onShiftAssigned={handleScheduleChanged}
          />
          
          {/* Employee Invitation Form (takes 5/12 width on large screens) */}
          <div className="lg:col-span-5">
            <InviteEmployeeForm />
          </div>
        </div>

        {/* Weekly Schedule Preview */}
        <TeamScheduleGrid
          shifts={shifts}
          company={company}
          onScheduleChanged={handleScheduleChanged}
        />

        {/* Upcoming Team Schedule List */}
        <TodayCompanySchedule 
          initialShifts={shifts}
          currentUserId={currentUser.id}
        />

        {/* Recent schedule changes */}
        <ActivityFeed refreshKey={activityRefreshKey} />
      </main>

      <ManageTeamModal 
        isOpen={isManageTeamOpen} 
        onClose={() => setIsManageTeamOpen(false)} 
        employees={employees}
        currentUserRole={currentUser.role}
      />

      <ManageSettingsModal
        isOpen={isManageSettingsOpen}
        onClose={() => setIsManageSettingsOpen(false)}
        company={company}
      />
    </>
  );
}
