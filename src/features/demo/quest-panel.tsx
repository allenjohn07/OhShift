import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, PartyPopper, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { highlightTourTarget } from "./highlight";
import { nextQuest, QUESTS, roleForQuest, tourProgress, type Quest } from "./quests";
import { completeDemoStep, resetTour, setTourPanelOpen, useTour } from "./tour-store";
import type { useDemoRoleSwitch } from "./use-demo-role-switch";

/** Floating checklist: the current quest, "Take me there", and every step with its tick. */
export function QuestPanel({
  role,
  switchRole,
  switching,
  onSignUp,
}: {
  role: AppRole;
  switchRole: ReturnType<typeof useDemoRoleSwitch>["switchRole"];
  switching: boolean;
  onSignUp: () => void;
}) {
  const navigate = useNavigate();
  const { done } = useTour();
  const [showAll, setShowAll] = useState(false);
  const current = nextQuest(done);
  const { completed, total, finished } = tourProgress(done);

  const go = async (quest: Quest) => {
    const target = roleForQuest(quest, role);
    // A role switch navigates (and highlights) once the new role has rendered.
    if (target !== role) {
      await switchRole(target, { to: quest.href, target: quest.target });
      return;
    }
    await navigate({ to: quest.href });
    if (quest.target) highlightTourTarget(quest.target);
  };

  return (
    <aside
      aria-label="Product tour"
      className="fixed right-4 bottom-24 z-60 flex max-h-[min(32rem,calc(100dvh-8rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-popover md:bottom-4"
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="font-semibold">Product tour</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{completed}/{total}</span>
        {/* The wrapper takes ml-auto: Button renders inside a tooltip wrapper. */}
        <div className="ml-auto -mr-2 flex">
          <Button size="icon-sm" variant="ghost" aria-label="Hide the tour" tooltip="Hide the tour" onClick={() => setTourPanelOpen(false)}>
            <X />
          </Button>
        </div>
      </div>
      <div className="h-1 w-full bg-muted" aria-hidden>
        <div className="h-full bg-brand transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(completed / total) * 100}%` }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {current ? (
          <div className="space-y-2 px-4 py-4" data-testid="current-quest">
            <p className="text-xs font-medium text-muted-foreground">{current.chapter}</p>
            <h3 className="font-semibold">{current.title}</h3>
            <p className="text-sm text-muted-foreground">{current.description}</p>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" disabled={switching} onClick={() => void go(current)}>
                Take me there
              </Button>
              <Button size="sm" variant="ghost" onClick={() => completeDemoStep(current.id)}>
                Skip
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-4 py-4">
            <PartyPopper className="h-5 w-5 text-brand" />
            <h3 className="font-semibold">You've seen all of OhShifts</h3>
            <p className="text-sm text-muted-foreground">
              Scheduling, publishing, requests, timesheets, messages and the assistant, from every side. Ready for your own team?
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={onSignUp}>Create your company</Button>
              <Button size="sm" variant="ghost" onClick={resetTour}>
                <RotateCcw />
                Restart tour
              </Button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAll((open) => !open)}
          aria-expanded={showAll}
          className="flex w-full cursor-pointer items-center justify-between border-t border-border px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/60"
        >
          {finished ? "All steps" : "All steps · jump to any"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} />
        </button>
        {showAll && (
          <ol className="divide-y divide-border border-t border-border">
            {QUESTS.map((quest) => {
              const isDone = done.has(quest.id);
              return (
                <li key={quest.id}>
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => void go(quest)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-accent/60",
                      quest.id === current?.id && "font-medium",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        isDone ? "border-emerald-500 bg-emerald-500 text-white" : "border-border",
                      )}
                      aria-label={isDone ? "Done" : "Not done"}
                    >
                      {isDone && <Check className="h-3 w-3" />}
                    </span>
                    <span className={cn("truncate", isDone && "text-muted-foreground line-through")}>{quest.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
