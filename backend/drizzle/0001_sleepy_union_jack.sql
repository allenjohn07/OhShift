CREATE TABLE `announcement_embeddings` (
	`announcement_id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`model` text NOT NULL,
	`vector` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `announcement_embeddings_company_idx` ON `announcement_embeddings` (`company_id`);