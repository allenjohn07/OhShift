import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/company/dashboard/page";

export const Route = createFileRoute("/company/dashboard/")({ component: Page });
