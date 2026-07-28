import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "relative border-t border-border/40 bg-card/20 backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12rem] sm:text-[16rem] md:text-[24rem] font-black tracking-tighter text-foreground/2 pointer-events-none select-none z-0 hidden sm:block">
        OHSHIFT
      </div>

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

        <div className="border-t border-border/40 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-sm font-medium text-muted-foreground">
            © {new Date().getFullYear()} OhShift. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/allenjohn07/OhShift"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/40 hover:bg-muted/80 hover:text-foreground transition-all duration-300"
            >
              Proudly open-source
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:scale-110"
                aria-label="GitHub"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
