import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/dashboard/hours/page";

export const Route = createFileRoute("/dashboard/hours")({ component: Page });
