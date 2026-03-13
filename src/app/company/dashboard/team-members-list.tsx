"use client";

import { useState } from "react";
import { AssignShiftModal } from "./assign-shift-modal";
import { Search } from "lucide-react";
import type { CompanySettings } from "./manage-settings-modal";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation?: string;
}

export function TeamMembersList({ employees, company }: { employees: Employee[] | null, company: CompanySettings }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = employees?.filter(emp => 
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden lg:col-span-7 flex flex-col h-full">
      <div className="border-b border-border/40 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between bg-card gap-4">
        <h2 className="font-semibold text-lg">Team Members</h2>
        
        <div className="relative max-w-xs w-full">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-input bg-background/50 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>
      
      {filteredEmployees && filteredEmployees.length > 0 ? (
        <div className="divide-y divide-border/40 overflow-y-auto">
          {filteredEmployees.map((emp) => (
            <div key={emp.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-card/60 transition-colors">
              <div>
                <p className="font-medium text-foreground">{emp.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-muted-foreground">{emp.email}</p>
                  {emp.designation && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {emp.designation}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <AssignShiftModal employee={emp} company={company} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-muted-foreground border-border/50 border-dashed border-2 m-6 rounded-xl bg-background/50 flex flex-col items-center justify-center">
          <p>
            {employees && employees.length === 0 
              ? `You haven't added any employees yet.`
              : `No team members found matching "${searchQuery}".`
            }
          </p>
          {employees && employees.length === 0 && (
            <p className="text-sm mt-1">Start by inviting your employees to join {company.name}.</p>
          )}
        </div>
      )}
    </div>
  );
}
