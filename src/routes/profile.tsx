import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/profile/page";

export const Route = createFileRoute("/profile")({ component: Page });
