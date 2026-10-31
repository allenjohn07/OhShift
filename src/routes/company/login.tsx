import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/company/login/page";

export const Route = createFileRoute("/company/login")({ component: Page });
