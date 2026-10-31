import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/login/page";

export const Route = createFileRoute("/login")({ component: Page });
