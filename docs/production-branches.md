# Production-readiness branches

All implementation branches were created from the synchronized origin/main at b90ad2f. Feature changes are committed separately and integrated locally after verification; pushing and production deployment remain manual. No production resources, secrets, migrations or emails were touched.

| Branch | Worktree | Scope |
| --- | --- | --- |
| feat/resend-account-security | /Users/allenjohn/Desktop/projects/OhShift | Resend invitations/recovery, expiring token digests, session revocation, authentication throttling |
| fix/scheduling-integrity | /Users/allenjohn/Desktop/projects/OhShift/.worktrees/scheduling-integrity | Atomic overlap/open-clock guards and conditional review/cancel transitions |
| fix/preserve-work-history | /Users/allenjohn/Desktop/projects/OhShift/.worktrees/preserve-work-history | Deactivate employees, deny access, preserve historical shifts/timesheets |
| fix/api-runtime-validation | /Users/allenjohn/Desktop/projects/OhShift/.worktrees/api-runtime-validation | Runtime input schemas, bounded request bodies, dates/timezones/password rules |
| fix/bounded-schedules-and-message-history | /Users/allenjohn/Desktop/projects/OhShift/.worktrees/bounded-schedules-and-message-history | Date-bounded polling, viewed-week schedules, latest messages and cursor history |
| feat/resend-schedule-notifications | /Users/allenjohn/Desktop/projects/OhShift/.worktrees/resend-schedule-notifications | Transactional outbox, private delivery, retries and cron |
| test/production-runtime-and-browser-checks | /Users/allenjohn/Desktop/projects/OhShift/.worktrees/production-runtime-and-browser-checks | Real Workers/D1 and Chromium checks, headers, health, tracing, deployment ordering |
| review/production-readiness | /Users/allenjohn/Desktop/projects/OhShift/.worktrees/production-readiness | Combined review tree with integration conflicts resolved and final migration metadata |

The combined review branch includes the feature branches, interaction fixes and the final Drizzle snapshot. It is verified as a complete result before local main is fast-forwarded. Run full verification before publishing. Do not apply only a subset of these new migrations to production from an isolated branch. The complete sequence is 0002 account security → 0003 scheduling integrity → 0004 history preservation → 0005 schedule outbox.
