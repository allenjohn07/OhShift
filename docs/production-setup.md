# Production setup

## Resend and account links

1. Add your sending domain (or a dedicated subdomain) in Resend and add the DNS records Resend supplies. Wait for verification. Keep click/open tracking off for account links.
2. Create a sending-only Resend API key scoped to that domain.
3. Public production settings are committed in `backend/wrangler.toml`:

   ```toml
   EMAIL_FROM = "OhShift <notification@ohshifts.com>"
   APP_URL = "https://ohshifts.com"
   ```

   `APP_URL` supplies the canonical account-link and CORS origin. `FRONTEND_URL` is a legacy fallback; optional `FRONTEND_URLS` explicitly permits extra origins. If `APP_URL` or `EMAIL_FROM` was previously stored as a Worker secret, remove that duplicate binding in Cloudflare before deploying these public vars.

   Set only the Resend key using an interactive prompt from `backend/`:

   ```sh
   bunx wrangler secret put RESEND_API_KEY
   ```

   Keep the existing `AUTH_SECRET` configured as a strong Worker secret. Never commit either key. Frontend Pages/GitHub variable `VITE_API_URL` must point to the Worker, and `VITE_APP_URL` should be `https://ohshifts.com`. Only public configuration belongs in `VITE_*` variables.
4. For local development, copy variable names from `backend/.env.example` to your own `backend/.dev.vars` and configure values yourself. Agents must not open or edit that file. Tests mock Resend and never send mail.
5. Apply migrations before deploying the Worker: `bun run db:migrate:remote`. Migration 0002 invalidates older sessions; users must sign in again.
6. Deploy the Worker before the frontend when introducing new endpoints. Test recovery and invitations with mailboxes you control. Recovery must return the same generic message for unknown and known addresses, leave the old password working until the link is redeemed, reject reused/expired links, and revoke old sessions after completion.

Recovery links expire after 30 minutes; invitations after 48 hours. Only SHA-256 token digests are stored. Raw tokens are carried in URL fragments and removed from browser history when the password page opens. Tokens cannot be recovered from the database. Resend delivery retries use a stable idempotency key; provider response bodies and credentials are never logged. A failed invitation can be retried by inviting the same pending address from the same company. Recovery requests always return a generic response even if delivery fails; review Worker error logs for delivery failure events.

Provider acceptance is not proof of inbox delivery. Check bounces and delivery events in Resend; actual domain verification and delivery must be verified in your accounts before launch.

## Publication email outbox

Publishing creates the schedule change, audit entry and one notification per affected worker in a single D1 batch. A minute cron drains at most 10 jobs per invocation. Jobs have leases, provider idempotency keys, bounded retries and a terminal failed state. Users who have been deactivated are skipped. Email contains a sign-in link, not coworkers' names or shift details. Larger teams may take several cron cycles; live schedules remain visible through polling immediately.

Monitor pending and failed `email_jobs` records, Worker delivery errors, and Resend delivery/bounce events. To retry a terminal job after fixing delivery, use an audited administrative operation and retain its existing ID/idempotency key. Do not delete historical shifts or users to clean up delivery records.

## Live demo (demo.ohshifts.com)

"Try the live demo" on the landing page creates a private sandbox company per visitor (`POST /demo/start`, `backend/src/lib/demo/`): a seeded café team with schedules, requests and timesheets, signed in as its owner, with a guided tour. Visitors switch between the owner, manager and employee personas (`POST /demo/switch`, demo sessions only).

- Sandboxes are companies with `demo_expires_at` set (migration 0006). They expire after 24 hours; the minute cron deletes expired ones every 15 minutes.
- Demo users have no password and an unroutable `*.demo.invalid` address. Demo invites add the teammate directly (the typed address is never stored), publishing enqueues no email, password/avatar changes are refused, and recovery mail is never sent. Demo traffic never reaches Resend.
- Limits: 10 starts per IP per minute and 20 per hour, at most 2,000 live sandboxes, and 5 assistant questions per sandbox (on top of `AI_LIMITER`).
- Setup: attach `demo.ohshifts.com` as a second custom domain on the **`ohshifts`** Pages project (same build; its root redirects to `/demo`). `FRONTEND_URLS` in `backend/wrangler.toml` allows it for CORS. Set the GitHub variable `VITE_DEMO_URL=https://demo.ohshifts.com`; without it the button opens `/demo` on the main site, which works the same way.
- Deploy order: `bun run db:migrate:remote` (0006), then the Worker, then Pages.

## Local verification

```sh
bun install --frozen-lockfile
bun install --cwd backend --frozen-lockfile
bunx playwright install chromium
bun run verify
```

In a new Git worktree, run `bun run prepare` before the first commit to install that checkout’s Husky hooks.

On Linux CI, install Chromium with `bunx playwright install --with-deps chromium`. Verification includes lint, backend/frontend test type checks, unit/route tests, production build, local workerd/D1 integration and Chromium regressions. Runtime tests supply their own test bindings and intercept outbound mail; they do not load Wrangler secrets or send email.

## Deployment and operations

- GitHub Actions deploys the frontend to the existing Pages project **`ohshifts`**, which must own `ohshifts.com`. The workflow never creates a Pages project automatically. Build variables (`VITE_API_URL`, `VITE_APP_URL`, `VITE_BASE_PATH`) come from GitHub repository variables, not the Pages build settings.
- Disable automatic Git deployments for both production and preview branches in the `ohshifts` Pages project's build/branch controls, so GitHub Actions is the only deployment path. Wrangler uploads to an existing Git-integrated project are supported: see [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).
- After this workflow change reaches `main`, wait for **Deploy to Cloudflare → Deploy Pages (frontend)** to succeed. Confirm its output targets `ohshifts`, confirm `ohshifts.com` is attached to that project, and smoke-test login and API access on the custom domain. Then delete only the duplicate **`ohshift`** Pages project (`ohshift-6v7.pages.dev`), after confirming it has no required custom domains. Keep **`ohshifts`** and **`ohshift-api`**.
- Deploy migrations and the Worker before Pages. CI orders deployments this way so a new frontend cannot arrive before its API.
- Configure exact CORS origins; production no longer allows arbitrary `*.pages.dev` origins. The committed `APP_URL` enables `https://ohshifts.com`; set public Pages/GitHub variables separately from Worker secrets.
- Use a separate Worker, D1 database, sender/test recipients and secrets for staging. Do not point staging or local tests at production D1. Real resource IDs must be created/configured in your Cloudflare account; they are not inferred or fabricated in the repository.
- Make the Verify status required on main in GitHub branch protection/rulesets; local hooks can be bypassed. Allow direct pushes only with the checks/policies you intend to enforce.
- Configure an uptime monitor on `/health` and alert on HTTP 503. Worker errors include request IDs and paths without dumping SQL parameters or credentials. Enable alerts for elevated 5xx rates, authentication throttles, failed email jobs and unexpected mail volume.
- Confirm D1 recovery retention for your plan, take an export before applying schema changes to existing data, and rehearse a restore into a separate staging database. Never test a restore by overwriting production.
- Keep deployed API/schema changes backward-compatible until both deployments complete. A frontend failure after a successful Worker deployment should not require reversing destructive migrations.
- Existing overlapping shifts are not silently deleted by migration 0003. Its guards prevent new conflicting writes. Review any existing conflicts before launch.
- Deactivated employee records remain for historical schedules/timesheets. Existing future shifts remain visible until a manager explicitly changes them. Employees with an open clock-in must clock out before deactivation.

Account creation, login, recovery and password completion are throttled by atomic D1 counters shared across isolates. Passwords are 12–128 characters for new accounts and changes; existing shorter passwords can still be used to sign in and upgrade. A successful change/reset invalidates prior JWTs. The frontend clears the session and cached data when an authenticated request receives 401.

Provider reference: [verified domains](https://resend.com/docs/dashboard/domains/introduction), [send email](https://resend.com/docs/api-reference/emails/send-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
