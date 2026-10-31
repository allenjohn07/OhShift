import { useState } from "react";
import { AssignShiftModal } from "./assign-shift-modal";
import { BulkAssignModal } from "./bulk-assign-modal";
import { Search, Shield } from "lucide-react";
import type { CompanySettings } from "./manage-settings-modal";
import { ScrollFade } from "@/components/scroll-fade";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation?: string | null;
  role?: "employee" | "manager";
}

export function TeamMembersList({
  employees,
  company,
  onShiftAssigned,
}: {
  employees: Employee[] | null;
  company: CompanySettings;
  onShiftAssigned?: () => void | Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = employees?.filter(
    (emp) =>
      emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden lg:col-span-7 flex flex-col">
      <div className="border-b border-border px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between bg-card gap-4 shrink-0">
        <h2 className="font-semibold">Team members</h2>

        <div className="flex items-center gap-2 w-full sm:w-auto sm:max-w-md">
          <BulkAssignModal company={company} onAssigned={onShiftAssigned} />
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-muted-foreground">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.03]"
            />
          </div>
        </div>
      </div>

      {filteredEmployees && filteredEmployees.length > 0 ? (
        <ScrollFade
          contentKey={`${filteredEmployees.length}:${searchQuery}`}
          className="divide-y divide-border"
        >
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/60 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{emp.full_name}</p>
                  {emp.role === "manager" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-brand-soft text-brand">
                      <Shield className="w-3 h-3" />
                      Manager
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-sm text-muted-foreground">{emp.email}</p>
                  {emp.designation && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {emp.designation}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <AssignShiftModal
                  employee={emp}
                  company={company}
                  onAssigned={onShiftAssigned}
                />
              </div>
            </div>
          ))}
        </ScrollFade>
      ) : (
        <div className="p-12 text-center text-muted-foreground border-border border-dashed border-2 m-6 rounded-lg bg-background flex flex-col items-center justify-center">
          <p>
            {employees && employees.length === 0
              ? `You haven't added any employees yet.`
              : `No team members found matching "${searchQuery}".`}
          </p>
          {employees && employees.length === 0 && (
            <p className="text-sm mt-1">
              Start by inviting your employees to join {company.name}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
