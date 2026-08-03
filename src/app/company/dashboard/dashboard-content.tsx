"use client";

import { useState } from "react";
import { Users, Calendar, Settings } from "lucide-react";

import { IconTooltip } from "@/components/icon-tooltip";
import { TeamMembersList } from "./team-members-list";
import { InviteEmployeeForm } from "./invite-form";
import { TeamScheduleGrid } from "@/app/company/dashboard/team-schedule-grid";
import { TodayCompanySchedule } from "@/app/dashboard/today-company-schedule";
import { ManageTeamModal } from "@/app/company/dashboard/manage-team-modal";
import { ManageSettingsModal, type CompanySettings } from "./manage-settings-modal";
import { ShiftSummary } from "@/app/dashboard/shift-summary";
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6 sm:space-y-8 overflow-x-clip w-full">
        <div>
          <p className="text-sm font-medium text-brand mb-1">
            {company.name} Workspace
          </p>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {userName}
          </h1>
        </div>

        {/* Manager's own shift summary — only for managers, not owners */}
        {currentUser.role === "manager" && (
          <ShiftSummary initialShifts={myShifts} employeeId={currentUser.id} />
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <IconTooltip label="Manage team" side="bottom" className="w-full">
            <div 
              onClick={() => setIsManageTeamOpen(true)}
              className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4 cursor-pointer hover:bg-card/60 hover:border-brand/40 transition-all group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsManageTeamOpen(true);
                }
              }}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-soft text-brand group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Total Team</p>
                <p className="text-2xl font-bold mt-1">{employees?.length || 0}</p>
              </div>
            </div>
          </IconTooltip>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Shifts Scheduled (All Time)</p>
              <p className="text-2xl font-bold mt-1">{shifts?.length || 0}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-soft text-brand">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Manage Setup</p>
              <IconTooltip label="View settings" side="top">
                <p onClick={() => setIsManageSettingsOpen(true)} className="text-sm font-medium mt-1 text-foreground underline underline-offset-4 cursor-pointer hover:text-brand transition-colors">View Settings</p>
              </IconTooltip>
            </div>
          </div>
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
