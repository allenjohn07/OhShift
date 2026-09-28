import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "relative border-t border-border/40 bg-card/20 backdrop-blur-sm",
        className,
      )}
    >
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 py-16 md:py-24">
          <div className="max-w-sm">
            <div className="flex items-center gap-1.5 mb-6">
              <BrandMark size={24} />
              <span className="text-2xl font-bold tracking-tight">OhShift</span>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed font-medium">
              Modern shift scheduling that your team will actually enjoy. Stop
              juggling spreadsheets, start shifting.
            </p>
          </div>
        </div>

        <div className="border-t border-border/40 py-8 flex flex-row items-center justify-between gap-6">
          <p className="text-sm font-medium text-muted-foreground">
            © {new Date().getFullYear()} OhShift. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/allenjohn07/OhShift"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on GitHub"
              className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
