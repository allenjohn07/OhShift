import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Providers } from "@/components/providers";

export const Route = createRootRoute({
  component: () => (
    <Providers>
      <Outlet />
    </Providers>
  ),
});
