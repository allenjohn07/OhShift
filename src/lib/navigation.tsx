/**
 * Small Next.js-style navigation API on top of TanStack Router, so pages keep
 * using `<Link href>`, `useRouter().push/replace` and `usePathname()`.
 */
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useRouter as useTanstackRouter,
} from "@tanstack/react-router";
import { useMemo, type ComponentProps } from "react";

type LinkProps = Omit<ComponentProps<"a">, "href"> & { href: string };

export function Link({ href, ...props }: LinkProps) {
  return <RouterLink to={href as never} {...props} />;
}

export function useRouter() {
  const navigate = useNavigate();
  const router = useTanstackRouter();
  return useMemo(
    () => ({
      push: (href: string) => navigate({ to: href as never }),
      replace: (href: string) => navigate({ to: href as never, replace: true }),
      refresh: () => router.invalidate(),
    }),
    [navigate, router],
  );
}

export function usePathname() {
  return useLocation({ select: (location) => location.pathname });
}
