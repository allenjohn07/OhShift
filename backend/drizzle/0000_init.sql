CREATE TABLE `announcement_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer NOT NULL,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `announcement_reads_announcement_user_uq` ON `announcement_reads` (`announcement_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `announcement_reads_user_idx` ON `announcement_reads` (`user_id`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `announcements_company_created_idx` ON `announcements` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `availability_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`start_time` text DEFAULT '09:00' NOT NULL,
	`end_time` text DEFAULT '17:00' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_user_day_uq` ON `availability_windows` (`user_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`morning_start` text DEFAULT '08:00' NOT NULL,
	`morning_end` text DEFAULT '16:00' NOT NULL,
	`evening_start` text DEFAULT '16:00' NOT NULL,
	`evening_end` text DEFAULT '00:00' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `conversation_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_participants_conversation_user_uq` ON `conversation_participants` (`conversation_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `conversation_participants_user_idx` ON `conversation_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`pair_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_company_pair_uq` ON `conversations` (`company_id`,`pair_key`);--> statement-breakpoint
CREATE INDEX `conversations_company_updated_idx` ON `conversations` (`company_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `direct_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `direct_messages_conversation_created_idx` ON `direct_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `shift_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`shift_id` text,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`week_start` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shift_logs_company_created_idx` ON `shift_logs` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`title` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shifts_company_start_idx` ON `shifts` (`company_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `shifts_employee_start_idx` ON `shifts` (`employee_id`,`start_time`);--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`punched_in_at` integer NOT NULL,
	`punched_out_at` integer,
	`clock_in_at` integer NOT NULL,
	`clock_out_at` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`review_note` text,
	`reviewed_by_id` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `time_entries_shift_id_unique` ON `time_entries` (`shift_id`);--> statement-breakpoint
CREATE INDEX `time_entries_company_status_idx` ON `time_entries` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `time_entries_employee_status_idx` ON `time_entries` (`employee_id`,`status`);--> statement-breakpoint
CREATE INDEX `time_entries_employee_clock_in_idx` ON `time_entries` (`employee_id`,`clock_in_at`);--> statement-breakpoint
CREATE TABLE `time_off_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`type` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_id` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `time_off_company_status_idx` ON `time_off_requests` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `time_off_employee_idx` ON `time_off_requests` (`employee_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`role` text NOT NULL,
	`company_id` text,
	`designation` text,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_company_id_idx` ON `users` (`company_id`);