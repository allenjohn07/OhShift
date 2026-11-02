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

Provider reference: [verified domains](https://resend.com/docs/dashboard/domains/introduction), [send email](https://resend.com/docs/api-reference/emails/send-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
