import { Link } from "@/lib/navigation";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelEmpty } from "@/components/panel";

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
    <PageMain>
      <PageHeader title={title} description={description} />
      <Panel className="min-h-[20rem]">
        <PanelEmpty icon={<Icon />} title="Coming soon">
          We&apos;re still building this page.
        </PanelEmpty>
        <div className="flex justify-center pb-10">
          <Link href={backHref}>
            <Button variant="outline">{backLabel}</Button>
          </Link>
        </div>
      </Panel>
    </PageMain>
  );
}
