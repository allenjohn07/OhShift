import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/dashboard/page";

export const Route = createFileRoute("/dashboard/")({ component: Page });
