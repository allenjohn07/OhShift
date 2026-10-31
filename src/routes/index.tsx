import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/landing/page";

export const Route = createFileRoute("/")({ component: Page });
