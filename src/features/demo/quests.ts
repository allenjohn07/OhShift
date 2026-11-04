import type { AppRole, RoutePath } from "@/lib/nav";

/**
 * The guided demo tour: a short checklist of real actions. Each quest ticks
 * when the visitor actually does it (see `completeDemoStep` call sites), so
 * the tour doubles as a tour of every feature.
 */
export type Quest = {
  id: string;
  chapter: string;
  title: string;
  description: string;
  /** Roles that can do it; "Take me there" switches to the first one if needed. */
  roles: readonly AppRole[];
  href: RoutePath;
  /** `data-tour` value of the element to highlight on arrival. */
  target?: string;
};

export const QUESTS = [
  {
    id: "assign",
    chapter: "Build the schedule",
    title: "Assign a shift",
    description: "Pick anyone in Team and click Assign. Try double-booking someone who's already working: OhShifts blocks the overlap.",
    roles: ["owner", "manager"],
    href: "/company/dashboard",
    target: "team",
  },
  {
    id: "publish",
    chapter: "Build the schedule",
    title: "Publish next week",
    description: "New shifts start as drafts that only managers see. Go to next week in Schedule and click Publish to show them to the team.",
    roles: ["owner", "manager"],
    href: "/company/dashboard",
    target: "publish",
  },
  {
    id: "invite",
    chapter: "Grow the team",
    title: "Add a teammate",
    description: "Click Invite and add someone. In the demo no email is sent; they join the team right away.",
    roles: ["owner", "manager"],
    href: "/company/dashboard",
    target: "invite",
  },
  {
    id: "promote",
    chapter: "Grow the team",
    title: "Promote someone to manager",
    description: "Open Team → Manage and change someone's role. Only the owner can do this.",
    roles: ["owner"],
    href: "/company/dashboard",
    target: "team",
  },
  {
    id: "employee-view",
    chapter: "Work a shift",
    title: "See the employee side",
    description: "Switch to Sam, a barista, to see the schedule you just published.",
    roles: ["employee"],
    href: "/dashboard",
  },
  {
    id: "clock-in",
    chapter: "Work a shift",
    title: "Clock in",
    description: "Sam is on shift right now. Clock in from Hours (or the Today card).",
    roles: ["employee"],
    href: "/dashboard/hours",
    target: "clock",
  },
  {
    id: "availability",
    chapter: "Work a shift",
    title: "Set your availability",
    description: "Tell managers when you can work. They see it when they assign shifts.",
    roles: ["employee"],
    href: "/dashboard/availability",
  },
  {
    id: "request-time-off",
    chapter: "Work a shift",
    title: "Request time off",
    description: "Ask for a day off. Your manager gets it in Requests straight away.",
    roles: ["employee"],
    href: "/dashboard/time-off",
  },
  {
    id: "message",
    chapter: "Work a shift",
    title: "Reply to Priya",
    description: "Priya, the shift lead, sent you a message. Open it in Inbox and reply.",
    roles: ["employee"],
    href: "/dashboard/inbox",
  },
  {
    id: "review-time-off",
    chapter: "Run the day",
    title: "Review a time-off request",
    description: "Back as a manager: approve or deny a request, including the one Sam just sent.",
    roles: ["manager", "owner"],
    href: "/company/dashboard/requests",
  },
  {
    id: "timesheet",
    chapter: "Run the day",
    title: "Approve a timesheet",
    description: "Check the hours people clocked and approve them for payroll.",
    roles: ["manager", "owner"],
    href: "/company/dashboard/timesheets",
  },
  {
    id: "announce",
    chapter: "Run the day",
    title: "Post an announcement",
    description: "Share news with everyone in Inbox. Employees see an unread badge.",
    roles: ["owner", "manager"],
    href: "/dashboard/inbox",
  },
  {
    id: "ask",
    chapter: "Run the day",
    title: "Ask OhShifts",
    description: "Ask the assistant something like \"Who is working tomorrow?\". The demo includes 5 questions.",
    roles: ["owner", "manager"],
    href: "/company/dashboard",
    target: "ask",
  },
] as const satisfies readonly Quest[];

export type DemoQuest = (typeof QUESTS)[number];
export type QuestId = DemoQuest["id"];

export function isQuestId(value: string): value is QuestId {
  return QUESTS.some((quest) => quest.id === value);
}

/** The first quest not yet done, in tour order (null when everything is done). */
export function nextQuest(done: ReadonlySet<string>): DemoQuest | null {
  return QUESTS.find((quest) => !done.has(quest.id)) ?? null;
}

export function tourProgress(done: ReadonlySet<string>) {
  const completed = QUESTS.filter((quest) => done.has(quest.id)).length;
  return { completed, total: QUESTS.length, finished: completed === QUESTS.length };
}

/** The role to view as for `quest`: stay as you are when you can already do it. */
export function roleForQuest(quest: Quest, current: AppRole): AppRole {
  return quest.roles.includes(current) ? current : quest.roles[0]!;
}
