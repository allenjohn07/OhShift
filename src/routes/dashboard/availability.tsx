import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/dashboard/availability/page";

export const Route = createFileRoute("/dashboard/availability")({ component: Page });
