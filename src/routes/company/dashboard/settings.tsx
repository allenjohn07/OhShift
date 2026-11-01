import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/company/dashboard/settings/page";

export const Route = createFileRoute("/company/dashboard/settings")({ component: Page });
