CREATE TABLE email_jobs (
  id text PRIMARY KEY NOT NULL,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at integer NOT NULL,
  lease_token text,
  lease_until integer,
  sent_at integer,
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX email_jobs_delivery_idx ON email_jobs(status, available_at);
