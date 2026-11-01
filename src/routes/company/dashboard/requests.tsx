import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/company/dashboard/requests/page";

export const Route = createFileRoute("/company/dashboard/requests")({ component: Page });
