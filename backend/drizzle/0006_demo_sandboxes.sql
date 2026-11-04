-- Demo sandboxes: a non-null expiry marks a company as a throwaway demo.
ALTER TABLE companies ADD demo_expires_at integer;
--> statement-breakpoint
CREATE INDEX companies_demo_expires_idx ON companies(demo_expires_at);
