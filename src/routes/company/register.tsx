import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/company/register/page";

export const Route = createFileRoute("/company/register")({ component: Page });
