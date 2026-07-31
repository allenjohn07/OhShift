import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Clock,
  LayoutDashboard,
  Inbox,
  Settings,
  Palmtree,
} from "lucide-react";

export type AppRole = "employee" | "manager" | "owner";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AppRole[];
  /** Show in the mobile bottom tab bar */
  mobileTab?: boolean;
  /** Feature not built yet — page shows a coming-soon state */
  comingSoon?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  // Employee
  {
    id: "emp-schedule",
    label: "Schedule",
    href: "/dashboard",
    icon: Calendar,
    roles: ["employee"],
    mobileTab: true,
  },
  {
    id: "emp-availability",
    label: "Availability",
    href: "/dashboard/availability",
    icon: Clock,
    roles: ["employee"],
    mobileTab: true,
  },
  {
    id: "emp-time-off",
    label: "Time off",
    href: "/dashboard/time-off",
    icon: Palmtree,
    roles: ["employee"],
    mobileTab: true,
  },
  {
    id: "emp-settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["employee"],
  },

  // Manager / Owner (also use Availability + Time off as employees)
  {
    id: "mgr-overview",
    label: "Overview",
    href: "/company/dashboard",
    icon: LayoutDashboard,
    roles: ["manager", "owner"],
    mobileTab: true,
  },
  {
    id: "mgr-requests",
    label: "Requests",
    href: "/company/dashboard/requests",
    icon: Inbox,
    roles: ["manager", "owner"],
    mobileTab: true,
  },
  {
    id: "mgr-availability",
    label: "Availability",
    href: "/dashboard/availability",
    icon: Clock,
    roles: ["manager", "owner"],
  },
  {
    id: "mgr-time-off",
    label: "Time off",
    href: "/dashboard/time-off",
    icon: Palmtree,
    roles: ["manager", "owner"],
  },
  {
    id: "mgr-settings",
    label: "Settings",
    href: "/company/dashboard/settings",
    icon: Settings,
    roles: ["manager", "owner"],
  },
];

export function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

export function isNavActive(pathname: string, href: string) {
  return normalizePath(pathname) === normalizePath(href);
}

export function navItemsForRole(role: AppRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function mobileTabsForRole(role: AppRole) {
  return navItemsForRole(role).filter((item) => item.mobileTab);
}

export function homeHrefForRole(role: AppRole) {
  return role === "employee" ? "/dashboard" : "/company/dashboard";
}
