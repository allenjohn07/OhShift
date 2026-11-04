import { createFileRoute, redirect } from "@tanstack/react-router";
import Page from "@/features/landing/page";
import { isDemoHost } from "@/lib/demo";

export const Route = createFileRoute("/")({
  // demo.ohshifts.com has no landing page: its root starts (or resumes) the demo.
  beforeLoad: () => {
    if (isDemoHost()) throw redirect({ to: "/demo", replace: true });
  },
  component: Page,
});
