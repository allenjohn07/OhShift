import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/dashboard/inbox/page";

export const Route = createFileRoute("/dashboard/inbox")({ component: Page });
