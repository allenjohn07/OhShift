CREATE TABLE `account_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`session_version` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_tokens_token_hash_unique` ON `account_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `account_tokens_user_idx` ON `account_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_rate_buckets` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_rate_buckets_expires_idx` ON `auth_rate_buckets` (`expires_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 1 NOT NULL;