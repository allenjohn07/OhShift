import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/dashboard/time-off/page";

export const Route = createFileRoute("/dashboard/time-off")({ component: Page });
