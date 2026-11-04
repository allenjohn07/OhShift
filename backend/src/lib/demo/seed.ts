import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "../../db";
import {
  announcements,
  availabilityWindows,
  companies,
  conversationParticipants,
  conversations,
  directMessages,
  shiftLogs,
  shifts,
  timeEntries,
  timeOffRequests,
  users,
  type UserRole,
} from "../../db/schema";
import { DEMO_PERSONAS, DEMO_TTL_MS, demoEmail } from ".";

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** D1 allows at most 100 bound parameters per statement. */
const MAX_PARAMS = 100;

type Person = { slug: string; name: string; role: UserRole; designation: string };

const PEOPLE: Person[] = [
  { slug: DEMO_PERSONAS.owner, name: "Alex Morgan", role: "owner", designation: "Owner" },
  { slug: DEMO_PERSONAS.manager, name: "Priya Patel", role: "manager", designation: "Shift Lead" },
  { slug: "marcus.chen", name: "Marcus Chen", role: "manager", designation: "Kitchen Manager" },
  { slug: DEMO_PERSONAS.employee, name: "Sam Rivera", role: "employee", designation: "Barista" },
  { slug: "jordan.lee", name: "Jordan Lee", role: "employee", designation: "Barista" },
  { slug: "maya.okafor", name: "Maya Okafor", role: "employee", designation: "Cashier" },
  { slug: "leo.martins", name: "Leo Martins", role: "employee", designation: "Line Cook" },
  { slug: "nina.kowalski", name: "Nina Kowalski", role: "employee", designation: "Line Cook" },
  { slug: "omar.haddad", name: "Omar Haddad", role: "employee", designation: "Host" },
  { slug: "grace.kim", name: "Grace Kim", role: "employee", designation: "Server" },
];

// ── Wall-clock time in the visitor's time zone ─────────────────────────────

function zoned(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

function offsetAt(ms: number, timeZone: string) {
  const p = zoned(ms, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** `dayKey` is the local calendar day as UTC midnight; returns that local time as an instant. */
function localTime(dayKey: number, hhmm: string, timeZone: string) {
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = dayKey + h! * HOUR + mi! * 60_000;
  const first = guess - offsetAt(guess, timeZone);
  return new Date(guess - offsetAt(first, timeZone));
}

const ymd = (dayKey: number) => new Date(dayKey).toISOString().slice(0, 10);

/** Multi-row inserts, split so each statement stays under D1's parameter cap. */
function chunked<T extends object>(rows: T[], insert: (rows: T[]) => BatchItem<"sqlite">) {
  if (!rows.length) return [];
  const size = Math.max(1, Math.floor(MAX_PARAMS / Object.keys(rows[0]!).length));
  const out: BatchItem<"sqlite">[] = [];
  for (let i = 0; i < rows.length; i += size) out.push(insert(rows.slice(i, i + size)));
  return out;
}

/**
 * Builds a realistic café team for one visitor, relative to `now` in their time
 * zone, and writes it in a single D1 batch:
 * - last and this week published, next week draft (so there is something to publish)
 * - the employee persona has a shift on right now (so they can clock in)
 * - pending time-off requests and timesheets for the manager to review
 * - announcements and an unread direct message
 */
export async function seedDemoCompany({ now = new Date(), timeZone = "UTC" } = {}) {
  const companyId = crypto.randomUUID();
  const ids = Object.fromEntries(PEOPLE.map(p => [p.slug, crypto.randomUUID()])) as Record<string, string>;
  const idOf = (slug: string) => ids[slug]!;
  const ownerId = idOf(DEMO_PERSONAS.owner);
  const priya = idOf(DEMO_PERSONAS.manager);
  const sam = idOf(DEMO_PERSONAS.employee);
  const created = new Date(now.getTime() - 30 * DAY);

  const today = zoned(now.getTime(), timeZone);
  const todayKey = Date.UTC(today.y, today.m - 1, today.d);
  const weekStartKey = todayKey - ((new Date(todayKey).getUTCDay() + 6) % 7) * DAY;

  // Shifts: every worker has 4 days on per week, alternating morning/evening.
  const workers = PEOPLE.filter(p => p.role !== "owner");
  type ShiftRow = typeof shifts.$inferInsert & { id: string; startTime: Date; endTime: Date };
  const publishedAtFor = (week: number) => new Date(weekStartKey + (week * 7 - 2) * DAY);
  const regular: ShiftRow[] = [];
  for (const week of [-1, 0, 1]) {
    for (let d = 0; d < 7; d++) {
      const dayKey = weekStartKey + (week * 7 + d) * DAY;
      workers.forEach((worker, i) => {
        if ((d + i) % 7 < 3) return;
        const morning = (d + i) % 2 === 0;
        const published = week < 1;
        regular.push({
          id: crypto.randomUUID(), companyId, employeeId: idOf(worker.slug), title: morning ? "Morning" : "Evening",
          startTime: localTime(dayKey, morning ? "07:00" : "15:00", timeZone),
          endTime: localTime(dayKey, morning ? "15:00" : "23:00", timeZone),
          status: published ? "published" : "draft", publishedAt: published ? publishedAtFor(week) : null, createdAt: created,
        });
      });
    }
  }
  // Sam is on shift right now, so "clock in" works whenever the tour is played.
  // Any regular shift of Sam's that would overlap it is dropped (the DB rejects overlaps).
  const samStart = new Date(Math.floor(now.getTime() / HOUR) * HOUR - HOUR);
  const samNow: ShiftRow = { id: crypto.randomUUID(), companyId, employeeId: sam, title: "Barista", startTime: samStart, endTime: new Date(samStart.getTime() + 7 * HOUR), status: "published", publishedAt: created, createdAt: created };
  const shiftRows = [
    ...regular.filter(s => s.employeeId !== sam || s.endTime <= samNow.startTime || s.startTime >= samNow.endTime),
    samNow,
  ];

  // Timesheets waiting for review: each worker's most recent finished shift.
  const lastFinished = (employeeId: string) => shiftRows
    .filter(s => s.employeeId === employeeId && s.status === "published" && s.endTime.getTime() < now.getTime())
    .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())[0];
  const entryRows = ["jordan.lee", "maya.okafor", "leo.martins", "nina.kowalski", DEMO_PERSONAS.employee].flatMap((slug) => {
    const shift = lastFinished(idOf(slug));
    if (!shift) return [];
    const clockInAt = new Date(shift.startTime.getTime() + 4 * 60_000);
    const clockOutAt = new Date(shift.endTime.getTime() + 6 * 60_000);
    const approved = slug === DEMO_PERSONAS.employee;
    return [{
      id: crypto.randomUUID(), companyId, employeeId: shift.employeeId, shiftId: shift.id,
      punchedInAt: clockInAt, punchedOutAt: clockOutAt, clockInAt, clockOutAt,
      status: approved ? "approved" as const : "pending" as const,
      reviewedById: approved ? priya : null, reviewedAt: approved ? clockOutAt : null, createdAt: clockInAt,
    }];
  });

  // Availability: most employees have filled it in (Sam hasn't: that's a tour step).
  const availabilityRows = workers.flatMap((worker, i) => {
    if (worker.role !== "employee" || worker.slug === DEMO_PERSONAS.employee) return [];
    return Array.from({ length: 7 }, (_, day) => ({
      id: crypto.randomUUID(), userId: idOf(worker.slug), dayOfWeek: day,
      isAvailable: (day + i) % 7 !== 0, startTime: "07:00", endTime: "23:00",
    }));
  });

  const dateOnly = (days: number) => new Date(`${ymd(todayKey + days * DAY)}T00:00:00.000Z`);
  const timeOffRows = [
    { employee: "jordan.lee", type: "vacation" as const, from: 9, to: 11, status: "pending" as const, note: "Family visit" },
    { employee: "grace.kim", type: "personal" as const, from: 13, to: 13, status: "pending" as const, note: "Moving apartments" },
    { employee: "leo.martins", type: "sick" as const, from: -6, to: -6, status: "approved" as const, note: null },
  ].map(r => ({
    id: crypto.randomUUID(), companyId, employeeId: idOf(r.employee), type: r.type, startDate: dateOnly(r.from), endDate: dateOnly(r.to),
    note: r.note, status: r.status, reviewedById: r.status === "approved" ? priya : null, reviewedAt: r.status === "approved" ? dateOnly(r.from - 1) : null,
    createdAt: new Date(now.getTime() - 2 * DAY),
  }));

  const announcementRows = [
    { authorId: ownerId, title: "Welcome to Brew & Bloom!", body: "This is our team's home for schedules, time off and updates. Check your shifts here every week and keep your availability current.", daysAgo: 6 },
    { authorId: priya, title: "New seasonal menu training", body: "Training for the autumn menu is on Thursday at 2pm in the back room. Baristas and cashiers please attend; it counts as paid time.", daysAgo: 2 },
    { authorId: idOf("marcus.chen"), title: "Kitchen deep clean on Sunday", body: "We close the kitchen an hour early on Sunday for the monthly deep clean. Evening line cooks: please plan to stay until it is finished.", daysAgo: 1 },
  ].map(({ daysAgo, ...a }) => {
    const at = new Date(now.getTime() - daysAgo * DAY);
    return { id: crypto.randomUUID(), companyId, ...a, createdAt: at, updatedAt: at };
  });

  const conversationId = crypto.randomUUID();
  const messageTime = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR);

  const statements: BatchItem<"sqlite">[] = [
    // users ↔ companies reference each other: owner first, then company, then link.
    db.insert(users).values({ id: ownerId, fullName: PEOPLE[0]!.name, email: demoEmail(DEMO_PERSONAS.owner, companyId), passwordHash: null, role: "owner", designation: "Owner", createdAt: created }),
    db.insert(companies).values({ id: companyId, name: "Brew & Bloom Café", ownerId, morningStart: "07:00", morningEnd: "15:00", eveningStart: "15:00", eveningEnd: "23:00", demoExpiresAt: new Date(now.getTime() + DEMO_TTL_MS), createdAt: created }),
    db.update(users).set({ companyId }).where(eq(users.id, ownerId)),
    ...chunked(PEOPLE.slice(1).map(p => ({ id: idOf(p.slug), fullName: p.name, email: demoEmail(p.slug, companyId), passwordHash: null, role: p.role, companyId, designation: p.designation, createdAt: created })), rows => db.insert(users).values(rows)),
    ...chunked(shiftRows, rows => db.insert(shifts).values(rows)),
    ...chunked(entryRows, rows => db.insert(timeEntries).values(rows)),
    ...chunked(availabilityRows, rows => db.insert(availabilityWindows).values(rows)),
    ...chunked(timeOffRows, rows => db.insert(timeOffRequests).values(rows)),
    ...chunked(announcementRows, rows => db.insert(announcements).values(rows)),
    db.insert(shiftLogs).values([-1, 0].map((week) => {
      const weekStart = ymd(weekStartKey + week * 7 * DAY);
      const count = regular.filter(s => s.publishedAt?.getTime() === publishedAtFor(week).getTime()).length;
      return { id: crypto.randomUUID(), companyId, actorId: priya, action: "published" as const, weekStart, detail: `Published ${count} shift(s) for the week of ${weekStart}`, createdAt: publishedAtFor(week) };
    })),
    db.insert(conversations).values({ id: conversationId, companyId, pairKey: [priya, sam].sort().join(":"), createdAt: messageTime(3), updatedAt: messageTime(1) }),
    db.insert(conversationParticipants).values([
      { id: crypto.randomUUID(), conversationId, userId: priya, lastReadAt: messageTime(1) },
      { id: crypto.randomUUID(), conversationId, userId: sam, lastReadAt: null },
    ]),
    db.insert(directMessages).values([
      { id: crypto.randomUUID(), conversationId, senderId: priya, body: "Hey Sam! Could you cover the opening shift next Saturday?", createdAt: messageTime(3) },
      { id: crypto.randomUUID(), conversationId, senderId: priya, body: "No pressure, just let me know by Friday 🙂", createdAt: messageTime(1) },
    ]),
  ];
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  return { companyId, ownerId };
}
