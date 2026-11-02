// OhShift API — Cloudflare D1 (SQLite) via Drizzle
// Timestamps are stored as epoch milliseconds and read back as Date.
// Date-only columns (time off) are stored as UTC midnight of the calendar day.

import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

const createdAt = () =>
  timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date());

export const USER_ROLES = ["owner", "manager", "employee"] as const;
export const SHIFT_STATUSES = ["draft", "published"] as const;
export const SHIFT_LOG_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "published",
] as const;
export const TIME_OFF_TYPES = ["vacation", "sick", "personal", "other"] as const;
export const TIME_OFF_STATUSES = [
  "pending",
  "approved",
  "denied",
  "cancelled",
] as const;
export const TIME_ENTRY_STATUSES = [
  "open",
  "pending",
  "approved",
  "denied",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];
export type ShiftLogAction = (typeof SHIFT_LOG_ACTIONS)[number];
export type TimeOffType = (typeof TIME_OFF_TYPES)[number];
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];
export type TimeEntryStatus = (typeof TIME_ENTRY_STATUSES)[number];

export const companies = sqliteTable("companies", {
  id: id(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references((): AnySQLiteColumn => users.id, { onDelete: "cascade" }),
  morningStart: text("morning_start").notNull().default("08:00"),
  morningEnd: text("morning_end").notNull().default("16:00"),
  eveningStart: text("evening_start").notNull().default("16:00"),
  eveningEnd: text("evening_end").notNull().default("00:00"),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    role: text("role", { enum: USER_ROLES }).notNull(),
    companyId: text("company_id").references(
      (): AnySQLiteColumn => companies.id,
      { onDelete: "set null" },
    ),
    designation: text("designation"),
    avatarUrl: text("avatar_url"),
    createdAt: createdAt(),
  },
  (t) => [index("users_company_id_idx").on(t.companyId)],
);

export const shifts = sqliteTable(
  "shifts",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    status: text("status", { enum: SHIFT_STATUSES })
      .notNull()
      .default("published"),
    publishedAt: timestamp("published_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("shifts_company_start_idx").on(t.companyId, t.startTime),
    index("shifts_employee_start_idx").on(t.employeeId, t.startTime),
  ],
);

export const shiftLogs = sqliteTable(
  "shift_logs",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    shiftId: text("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action", { enum: SHIFT_LOG_ACTIONS }).notNull(),
    detail: text("detail").notNull(),
    weekStart: text("week_start"),
    createdAt: createdAt(),
  },
  (t) => [index("shift_logs_company_created_idx").on(t.companyId, t.createdAt)],
);

/** dayOfWeek: 0 = Monday … 6 = Sunday. One window per day per employee (v1). */
export const availabilityWindows = sqliteTable(
  "availability_windows",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    startTime: text("start_time").notNull().default("09:00"),
    endTime: text("end_time").notNull().default("17:00"),
  },
  (t) => [uniqueIndex("availability_user_day_uq").on(t.userId, t.dayOfWeek)],
);

export const timeOffRequests = sqliteTable(
  "time_off_requests",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: TIME_OFF_TYPES }).notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    note: text("note"),
    status: text("status", { enum: TIME_OFF_STATUSES })
      .notNull()
      .default("pending"),
    reviewedById: text("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("time_off_company_status_idx").on(t.companyId, t.status),
    index("time_off_employee_idx").on(t.employeeId),
  ],
);

export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shiftId: text("shift_id")
      .notNull()
      .unique()
      .references(() => shifts.id, { onDelete: "cascade" }),
    punchedInAt: timestamp("punched_in_at").notNull(),
    punchedOutAt: timestamp("punched_out_at"),
    clockInAt: timestamp("clock_in_at").notNull(),
    clockOutAt: timestamp("clock_out_at"),
    status: text("status", { enum: TIME_ENTRY_STATUSES })
      .notNull()
      .default("open"),
    reviewNote: text("review_note"),
    reviewedById: text("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("time_entries_company_status_idx").on(t.companyId, t.status),
    index("time_entries_employee_status_idx").on(t.employeeId, t.status),
    index("time_entries_employee_clock_in_idx").on(t.employeeId, t.clockInAt),
  ],
);

export const announcements = sqliteTable(
  "announcements",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [index("announcements_company_created_idx").on(t.companyId, t.createdAt)],
);

export const announcementReads = sqliteTable(
  "announcement_reads",
  {
    id: id(),
    announcementId: text("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("announcement_reads_announcement_user_uq").on(
      t.announcementId,
      t.userId,
    ),
    index("announcement_reads_user_idx").on(t.userId),
  ],
);

/**
 * Search index for the assistant: one embedding per announcement. Derived data
 * (rebuilt from `announcements`), so it can be dropped and regenerated. The
 * vector is a base64-encoded little-endian Float32Array.
 */
export const announcementEmbeddings = sqliteTable(
  "announcement_embeddings",
  {
    announcementId: text("announcement_id")
      .primaryKey()
      .references(() => announcements.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    vector: text("vector").notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("announcement_embeddings_company_idx").on(t.companyId)],
);

/** pairKey = sorted "userIdA:userIdB" for unique 1:1 DMs within a company */
export const conversations = sqliteTable(
  "conversations",
  {
    id: id(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    pairKey: text("pair_key").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("conversations_company_pair_uq").on(t.companyId, t.pairKey),
    index("conversations_company_updated_idx").on(t.companyId, t.updatedAt),
  ],
);

export const conversationParticipants = sqliteTable(
  "conversation_participants",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
  },
  (t) => [
    uniqueIndex("conversation_participants_conversation_user_uq").on(
      t.conversationId,
      t.userId,
    ),
    index("conversation_participants_user_idx").on(t.userId),
  ],
);

export const directMessages = sqliteTable(
  "direct_messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("direct_messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  ],
);

// ── Relations (for db.query.* with `with`) ──────────────────────────────

export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  employee: one(users, {
    fields: [shifts.employeeId],
    references: [users.id],
  }),
}));

export const shiftLogsRelations = relations(shiftLogs, ({ one }) => ({
  actor: one(users, {
    fields: [shiftLogs.actorId],
    references: [users.id],
  }),
}));

export const timeOffRequestsRelations = relations(
  timeOffRequests,
  ({ one }) => ({
    employee: one(users, {
      fields: [timeOffRequests.employeeId],
      references: [users.id],
    }),
    reviewedBy: one(users, {
      fields: [timeOffRequests.reviewedById],
      references: [users.id],
    }),
  }),
);

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  employee: one(users, {
    fields: [timeEntries.employeeId],
    references: [users.id],
  }),
  reviewedBy: one(users, {
    fields: [timeEntries.reviewedById],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [timeEntries.shiftId],
    references: [shifts.id],
  }),
}));

export const announcementsRelations = relations(
  announcements,
  ({ one, many }) => ({
    author: one(users, {
      fields: [announcements.authorId],
      references: [users.id],
    }),
    reads: many(announcementReads),
  }),
);

export const announcementReadsRelations = relations(
  announcementReads,
  ({ one }) => ({
    announcement: one(announcements, {
      fields: [announcementReads.announcementId],
      references: [announcements.id],
    }),
  }),
);

export const conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(directMessages),
}));

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [directMessages.conversationId],
    references: [conversations.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
