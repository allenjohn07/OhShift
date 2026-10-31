import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/company/dashboard/timesheets/page";

export const Route = createFileRoute("/company/dashboard/timesheets")({ component: Page });
