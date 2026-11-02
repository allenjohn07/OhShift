import { Link } from "@tanstack/react-router";
import type { RoutePath } from "@/lib/nav";
import { scrollToSection } from "@/lib/scroll-to-section";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

const COLUMNS: Array<{
  title: string;
  links: Array<
    | { label: string; to: RoutePath }
    | { label: string; href: string; external?: boolean; section?: string }
  >;
}> = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features", section: "features" },
      { label: "How it works", href: "/#how-it-works", section: "how-it-works" },
      { label: "For teams", href: "/#roles", section: "roles" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Register your company", to: "/company/register" },
      { label: "Company login", to: "/company/login" },
      { label: "Employee login", to: "/login" },
    ],
  },
  {
    title: "Resources",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/allenjohn07/OhShift",
        external: true,
      },
    ],
  },
];

const linkClass =
  "text-sm text-muted-foreground transition-colors hover:text-foreground";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3 flex items-center gap-2">
              <BrandMark size={22} />
              <span className="text-[15px] font-semibold tracking-tight">
                OhShifts
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Shift scheduling your team will actually enjoy. Stop juggling
              spreadsheets, start shifting.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-sm font-medium">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"to" in link ? (
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    ) : link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.href}
                        onClick={(e) =>
                          link.section && scrollToSection(e, link.section)
                        }
                        className={linkClass}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-6 border-t border-border py-6">
          <p className="text-[13px] text-muted-foreground">
            © {new Date().getFullYear()} OhShifts
          </p>
          <p className="text-[13px] text-muted-foreground">Now in public beta</p>
        </div>
      </div>
    </footer>
  );
}
