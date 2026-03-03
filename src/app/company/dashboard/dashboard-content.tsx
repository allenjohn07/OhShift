"use client";

import { useState } from "react";
import { Users, Calendar, Settings } from "lucide-react";
import { LogoutButton } from "@/app/company/dashboard/logout-button";
import { TeamMembersList } from "./team-members-list";
import { InviteEmployeeForm } from "./invite-form";
import { TeamScheduleGrid } from "@/app/company/dashboard/team-schedule-grid";
import { ManageTeamModal } from "@/app/company/dashboard/manage-team-modal";
import { ManageSettingsModal, type CompanySettings } from "./manage-settings-modal";

export function DashboardContent({ 
  userName, 
  company, 
  employees, 
  shifts 
}: { 
  userName: string, 
  company: CompanySettings, 
  employees: any, 
  shifts: any 
}) {
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [isManageSettingsOpen, setIsManageSettingsOpen] = useState(false);

  return (
    <>
      {/* Header Area */}
      <header className="border-b border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-500 mb-1">
                {company.name} Workspace
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Welcome back, {userName}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8 overflow-x-clip w-full">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            onClick={() => setIsManageTeamOpen(true)}
            className="rounded-2xl border border-border/50 bg-card/40 p-6 flex items-start gap-4 cursor-pointer hover:bg-card/60 hover:border-emerald-500/50 transition-all group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Total Team</p>
              <p className="text-2xl font-bold mt-1">{employees?.length || 0}</p>
            </div>
          </div>
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
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Manage Setup</p>
              <p onClick={() => setIsManageSettingsOpen(true)} className="text-sm font-medium mt-1 text-foreground underline underline-offset-4 cursor-pointer hover:text-violet-500 transition-colors">View Settings</p>
            </div>
          </div>
        </div>

        {/* Dashboard Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Team Members Area (takes 2/3 width on large screens) */}
          <TeamMembersList employees={employees} company={company} />
          
          {/* Employee Invitation Form (takes 1/3 width on large screens) */}
          <div className="lg:col-span-1">
            <InviteEmployeeForm />
          </div>
        </div>

        {/* Weekly Schedule Preview */}
        <TeamScheduleGrid shifts={shifts} />
      </main>

      <ManageTeamModal 
        isOpen={isManageTeamOpen} 
        onClose={() => setIsManageTeamOpen(false)} 
        employees={employees} 
      />

      <ManageSettingsModal
        isOpen={isManageSettingsOpen}
        onClose={() => setIsManageSettingsOpen(false)}
        company={company}
      />
    </>
  );
}
