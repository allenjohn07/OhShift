import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
  backHref,
  backLabel = "Back to dashboard",
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-12 flex-1">
      <div className="rounded-2xl border border-border/50 bg-card/40 px-6 py-16 sm:py-20 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-md mx-auto text-sm sm:text-base text-muted-foreground">
          {description}
        </p>
        <Link href={backHref} className="inline-block mt-8">
          <Button variant="outline" className="rounded-xl">
            {backLabel}
          </Button>
        </Link>
      </div>
    </main>
  );
}
