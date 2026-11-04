import { createFileRoute } from "@tanstack/react-router";
import Page from "@/features/demo/start-page";

export const Route = createFileRoute("/demo")({ component: Page });
