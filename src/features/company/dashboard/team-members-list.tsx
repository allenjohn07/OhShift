import { useState } from "react";
import { Search, Shield } from "lucide-react";
import { AssignShiftModal } from "./assign-shift-modal";
import type { CompanySettings } from "./company-settings";
import { ScrollFade } from "@/components/scroll-fade";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation?: string | null;
  role?: "employee" | "manager";
}

/** Show the search box only once the list is long enough to need it. */
const SEARCH_THRESHOLD = 8;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TeamMembersList({
  employees,
  company,
  onShiftAssigned,
  onManage,
  className,
}: {
  employees: Employee[] | null;
  company: CompanySettings;
  onShiftAssigned?: () => void | Promise<void>;
  onManage?: () => void;
  className?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const all = employees ?? [];
  const query = searchQuery.toLowerCase();
  const filtered = all.filter(
    (emp) =>
      emp.full_name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query),
  );

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="font-semibold">Team</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {all.length}
        </span>
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="ml-auto h-7 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Manage
          </button>
        )}
      </div>

      {all.length > SEARCH_THRESHOLD && (
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-5" />
          <input
            type="text"
            placeholder="Search team…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground/70 sm:pl-11"
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <ScrollFade
          contentKey={`${filtered.length}:${searchQuery}`}
          maxHeightClass="max-h-[340px]"
          className="divide-y divide-border"
        >
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60 sm:px-5"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  getEmployeeColor(emp.full_name),
                )}
              >
                {initials(emp.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {emp.full_name}
                  {emp.role === "manager" && (
                    <Shield
                      className="h-3 w-3 shrink-0 text-brand"
                      aria-label="Manager"
                    />
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {emp.designation || emp.email}
                </p>
              </div>
              <AssignShiftModal
                employee={emp}
                company={company}
                onAssigned={onShiftAssigned}
              />
            </div>
          ))}
        </ScrollFade>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          {all.length === 0
            ? `No one here yet — invite your team to ${company.name}.`
            : `No team members match "${searchQuery}".`}
        </p>
      )}
    </section>
  );
}
