# Production readiness

> **Migrations: up to date.** `schedule-timezone-2026-09-08.sql` and
> `check-ins-2026-09-08.sql` were applied to production on 2026-09-09 and
> verified against the live database: all 9 circles carry a timezone (Florida
> Eastern, the rest Pacific), the timezone guard rejects unknown zone names,
> and `circle_check_ins` has RLS on with 4 policies and no `anon` grant.
>
> When a migration is written but not yet applied, replace this block with a
> ▶ RESUME HERE banner naming the file — the failure mode is silent (the page
> degrades instead of erroring), so it has to be called out here.


Running list of what still needs doing before real users arrive. Add to it as
things come up; tick things off as they land. Newest features append to the
bottom of each section.

**Running a migration** (Docker-free; `supabase db dump` needs Docker, this
doesn't):

```bash
cd ~/circles
URL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '"')
PW="${${URL#*://}%%@*}"; PW="${PW#*:}"          # zsh
/opt/homebrew/opt/libpq/bin/psql \
  "postgresql://postgres:${PW}@db.vkmzsseilmahguqlgiok.supabase.co:5432/postgres" \
  -f supabase/<file>.sql
```

Use the **direct** host above, not the pooler — the pooler is region-stamped
and fails with a misleading `ENOTFOUND tenant/user`. It is IPv6-only, which
works fine from this machine.

---

## Blocking — do before anyone real signs up

- [ ] **Refresh the old Mapbox default token.** Console → home → Tokens →
      Refresh. It is unrestricted, sat in the public bundle for days, and
      cannot be deleted, only refreshed. Nothing uses it: production and
      `.env.local` both carry `hicircles.com web (URL-restricted)`. This is
      the one remaining live hole, and it is one click.

- [x] **Mapbox usage alerts set** (2026-09-09): Map Loads for Web at 25,000
      and 40,000 monthly, against a 50,000 free tier, so both fire before any
      charge. Sent to benjaminabookstaver@gmail.com.

      **Correction to what this list said before: Mapbox has no spend cap.**
      The earlier note called a spend limit "the actual guard". There is no
      such control on pay-as-you-go. The console says it outright, in bold:
      "Notifications help you monitor usage — they never pause your service.
      Usage beyond the free tier is billed as usual." A card is on file with
      Automatic Payments on, so overage is charged, not blocked.

      So the real position is: alerts are early warning, not a limit. What
      actually bounds the exposure is the free tier being generous (50,000
      map loads a month against current usage in the tens of requests), and
      the token restriction covering geocoding. Styles, fonts and iconsets
      remain fetchable from any origin with a copied token, which is the
      uncapped path.

      If a hard ceiling is ever wanted, the only lever is removing the payment
      method, which stops service at the free tier instead of billing past it.
      That trades a surprise bill for a broken map, so it is a real decision
      rather than an obvious win.

      Note for next time: URL restrictions can only be set on tokens you
      create. The Default public token has no such control, which is why this
      needed a new token rather than an edit.

- [x] **DKIM on hicircles.com — done 2026-09-13.** Google generated the
      2048-bit key once the 24-72 hour post-Gmail-activation wait elapsed; the
      TXT lives at `google._domainkey` and authentication is started. Verified
      end to end in a delivered message's raw headers:
      `dkim=pass header.i=@hicircles.com`.

      DMARC is still `p=none`. That was correct while DKIM was missing and is
      now merely cautious — worth tightening to `p=quarantine` after a week or
      two of clean reports, not before, because a mistake here sends your own
      mail to spam and you find out from the people who did not reply.

- [x] **Signup no longer depends on email.** Confirmation was the thing that
      made the default mailer a launch blocker: every signup sent one, and at
      a couple of messages an hour the fourth person to scan a flyer on the
      same evening would simply never get in, with nothing looking broken from
      our side. `Confirm email` is now off (2026-09-09, verified at
      `/auth/v1/settings`: `mailer_autoconfirm: true`), so `signUp` returns a
      session immediately. No code change was needed — `signup()` already
      branched on `if (!data.session)` and now falls through to `/welcome`.

      What this costs, and it is a real cost: addresses are unverified. Anyone
      can sign up with an email they do not own, which both squats that
      address against its real owner and points password reset at a stranger.
      Accepted for launch because the Instagram handle is the actual "is this
      person real" signal here, and because the alternative was losing most of
      the first evening's signups. Revisit when volume justifies Resend.

- [x] **Resend is live on `send.hicircles.com` — verified 2026-09-13.**
      A subdomain rather than the root because a domain may have exactly one
      SPF record, and adding a second TXT breaks every existing sender
      including Google Workspace. The root's SPF was never touched.

      Proven by a real reminder delivered to a real inbox, not by the
      provider's own dashboard. The raw headers of that message:

          dkim=pass   header.i=@send.hicircles.com  header.s=resend
          dkim=pass   header.i=@amazonses.com
          spf=pass    smtp.mailfrom=...@send.send.hicircles.com
          dmarc=pass  (p=NONE) header.from=hicircles.com

      DMARC passing on the root while the mail leaves a subdomain via Amazon
      SES is the whole point of the design working. It landed in INBOX.

      `List-Unsubscribe` and `List-Unsubscribe-Post` are present, so Gmail
      renders its own Unsubscribe button and the bulk-sender requirement is
      met before there is any volume to be judged on.

      Still on the default Supabase mailer: password reset. Moving it to
      Resend is a Supabase Auth SMTP config change, not code, and it is the
      remaining reason the default mailer matters at all.

- [ ] **Phone auth via Twilio — decide early, not on launch week.** Assessed
      2026-09-09. Supabase's side is config and takes minutes; the lift is US
      A2P 10DLC brand and campaign registration, which needs an EIN and takes
      days to weeks, and unregistered traffic is filtered by carriers rather
      than rejected loudly. Roughly $0.013 a message plus ~$15/month, so the
      first per-unit cost in the stack. Code is about a day: an OTP screen,
      signup and login reworked, and the username sign-in path currently
      resolves username to email so it would need to resolve to phone. Worth
      it for a flyer-to-phone product; not worth starting the week of launch.

- [x] **Reminder cron confirmed live 2026-09-13.** `cron.job` has one row,
      `circle-reminders`, `*/15 * * * *`, active. Checked the HTTP responses
      too, not just the job rows, because pg_cron reports "succeeded" when the
      `net.http_post` statement ran, which says nothing about what the server
      answered. In `net._http_response`: 9x 200, and the most recent is
      `{"mode":"live","due":0,"sent":0,"skipped":0,"failures":[]}`, so the
      deployed function is seeing `RESEND_API_KEY`.

- [ ] **Two cron runs returned Gateway Timeout** (22:00 and 22:15 on
      2026-09-13, 2 of 11). Not a pg_cron timeout: `timed_out` is false and
      the job's own budget is 25s, so this is Vercel killing the function at
      its own limit and returning a 504 body. The two are adjacent, which fits
      a deploy or cold-start window rather than a persistent fault.

      Mostly self-healing by design. A run that dies before claiming anything
      leaves the reminders unclaimed, so the next run 15 minutes later picks
      them up, and the `3h` band is three hours wide against a 30-minute
      floor. The real hole is a run killed *after* claiming a row and before
      the send returns: that reminder is marked sent and never goes. Harmless
      at one member per circle, worth revisiting before a circle has dozens.

- [ ] **Run `supabase/full-reset-2026-09-13.sql`.** Empties the app
      completely: every circle, every account except
      `benjaminabookstaver@gmail.com`. Pilot users should arrive at an empty
      product, not a museum of someone else's testing.

      **Supersedes `supabase/prelaunch-reset-2026-09-13.sql`**, which removed
      only the four fixture circles. Do not run both; the full reset is a
      superset. The partial file is kept only as a record of what was
      considered.

      Rehearsed against production 2026-09-13 by running the file as written,
      which ends in `rollback`. Every assertion passed and the database was
      confirmed unchanged afterwards. Removes 10 circles, 1 account, and by
      cascade 10 memberships, 5 schedules, 3 check-ins, 2 posts, 1 comment,
      1 post like, 1 comment like, 1 reminder-send.

      Two things the file is careful about, both of which would be easy to get
      wrong by hand:

      `circles.created_by` and `posts.user_id` are `ON DELETE SET NULL`, not
      cascade. That is right for account deletion, where a departed person's
      circles should survive and their posts go anonymous. It is wrong here:
      deleting the account first would strand that account's circles with
      `created_by = null`, owned by nobody. So circles are deleted first.

      `email_suppressions` is deliberately NOT cleared. It is keyed by email
      address rather than by user, and it is the record of who asked never to
      be emailed again. That request outlives the account and the reset.
      Clearing it would mean mailing someone who opted out, which is the one
      failure mode here with a legal dimension.

      It also asserts Ben's `platform_admins` row survives. Losing it silently
      would lock him out of `/admin` with no route back through the UI.

      To run it: paste into the Supabase dashboard SQL editor, read the
      previews, then change the final `rollback;` to `commit;`.

## Environment

- [ ] **`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.** Username sign-in
      resolves username → email with it. Production has it (via the Supabase
      integration); local does not, so username login throws under
      `npm run dev`. Email login is unaffected. Get it from Supabase →
      Project Settings → API Keys → `service_role`.

- [ ] **Same key in Vercel Preview and Development.**
      `vercel env add SUPABASE_SERVICE_ROLE_KEY preview`. Production is set.

- [ ] **Delete 11 dead env vars in Vercel Production.** This list previously
      named four; an audit on 2026-09-13 found eleven. The app reads exactly
      ten environment keys, established by grepping every `process.env.*`
      reference in `src/`:

          CRON_SECRET            NEXT_PUBLIC_MAPBOX_TOKEN
          RESEND_API_KEY         NEXT_PUBLIC_SITE_URL
          EMAIL_FROM             NEXT_PUBLIC_SUPABASE_URL
          EMAIL_REPLY_TO         NEXT_PUBLIC_SUPABASE_ANON_KEY
          SUPABASE_SERVICE_ROLE_KEY   SUPABASE_SECRET_KEY

      Everything else in Production is dead weight the Supabase Vercel
      integration created. Seven Postgres vars, `POSTGRES_URL`,
      `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`,
      `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, plus
      `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` and
      `SUPABASE_JWT_SECRET`.

      `SUPABASE_JWT_SECRET` is the one that matters most and was not on the
      old list at all. It signs auth tokens: anyone holding it can mint a JWT
      for any user. Nothing reads it. The Postgres credentials are next, being
      direct database access that bypasses PostgREST and therefore RLS.

      There is no `pg`, Prisma, Drizzle, Kysely or Knex dependency in
      `package.json`, so nothing in the app can open a Postgres connection
      even in principle.

      Removing an env var does not affect the running deployment; it takes
      effect on the next build. Caveat: these are integration-managed, so a
      Supabase integration re-sync may put them back. Check after the next
      deploy.

- [ ] **`NEXT_PUBLIC_SITE_URL` is not set in Vercel.** It only feeds the
      unsubscribe and circle links in reminder emails, and the code falls back
      to `https://hicircles.com`, which is correct today. Worth setting
      explicitly so a future preview deployment does not mail production
      links, or deleting the fallback so the omission is loud.

- [ ] **Accepted for pilots, not for strangers: email addresses are never
      verified.** Recorded here as its own item because it currently lives
      inside a ticked-off entry about signup, where it reads as settled rather
      than as an open risk.

      `Confirm email` is off, so `signUp` returns a session immediately and
      nobody proves they own the address they typed. Two consequences. Someone
      can squat an address against its real owner, and password reset for that
      account then mails a stranger, which is an account-takeover path that
      needs no password at all.

      Deliberately accepted, and genuinely fine for pilot users who are people
      Ben knows and can verify in person. It stops being fine the moment the
      audience is strangers scanning a flyer, which is the entire point of the
      product. The fix is turning confirmation back on once Resend handles
      auth mail, since the original reason for disabling it was the default
      mailer's rate limit losing most of an evening's signups.

      Decide this before the first flyer goes up, not after.

## Untested

Everything below has proven database logic (rolled-back transactions) but has
never been exercised through the UI by a real person.

- [ ] **Dropdowns on a real phone.** The seven native `<select>`s became Base
      UI `Select` so the open list could be themed — the OS draws a native
      select's list and no CSS reaches it. The cost is that phones no longer
      get their native wheel picker. Base UI handles touch, but this is the
      flyer → QR → mobile browser path, so it wants checking on an actual
      handset rather than a narrow desktop window.
      Still browser-drawn and unthemeable for the same reason: the calendar
      and clock panels behind `<input type="date">` and `type="time"` on the
      new-circle form. Only their glyphs are tinted.

- [ ] **Username round trip.** Set a username, sign out, sign back in with it.
- [ ] **Password reset round trip.** Depends on the two Auth items above.
- [ ] **Account deletion, actually submitted.** The panel and its disabled
      confirm button render correctly; nothing has ever been deleted through
      it. Best tested with a throwaway account, not yours.
- [x] **Check-ins work.** This list said nobody had ever pressed Going. Three
      rows exist in `circle_check_ins` (2026-09-09 and 09-10) covering all
      three states, `yes`, `maybe` and `no`, and one row has `updated_at`
      later than `created_at`, so changing an answer works too, not just
      setting one. Still unexercised: a *second* person checking in to the
      same meet, which is the only case where the count matters.
- [ ] **Timezone from coordinates.** tz-lookup resolves a circle's zone from
      its pin at write time. Verified for the existing nine (TEST Florida →
      America/New_York), never exercised by creating a new circle.
- [ ] **Business approve/reject.** `/admin` renders and gates correctly, but
      the queue has never had a row in it. Submit a request from
      `Test user 2`, approve it, and create a commercial circle.
- [ ] **Private circles — data layer verified 2026-09-13, UI still untested.**
      All 10 circles are public, so the protections have never run against a
      real private row. Three checks short of an end-to-end test:

      The predicate was evaluated directly against live data with visibility
      forced to 'private'. For all 10 circles a non-member returns false and
      the owner returns true, so `is_circle_member` and the `created_by`
      fallback both behave. `anon`'s policy on circles is
      `visibility = 'public'` with no escape hatch.

      More importantly, the service-role client bypasses RLS entirely, so a
      single admin-client query against `circles` would undo all of it.
      There are exactly four `createAdminClient` call sites, in
      `actions/email.ts`, `actions/auth.ts` and `api/cron/reminders/route.ts`,
      and none of them touch the circles table.

      What is still untested is the UI: creating a private circle, the join
      request flow, and the fact that `requestToJoin` notifies admins by
      querying for `role = 'admin'`, which returns nobody on a circle that has
      no admin. Run the admin backfill before making any circle private.
- [ ] **Signed-in non-member reading a public circle.** Follows from
      `can_read_circle_content` returning true when `uid is not null`, but was
      never observed.

## Known issues

- [x] **Explore map pins are blurred too** (verified in code 2026-09-13).
      This list previously said `/explore` still plotted every public circle
      at its real coordinates, which would have made the circle page's blur
      pointless one page over. It does not. `src/app/explore/page.tsx` runs
      the same `approxArea` over every circle the viewer does not belong to,
      server-side, before the props are serialised. Non-members' browsers
      never receive a real coordinate.

- [ ] **The coffee map theme is not applying; the map renders stock grey.**
      `applyCoffeeTheme` recolours every layer on the map's load event, and
      the map is plainly not tan any more at any zoom. Confirmed 2026-09-09
      that the code is not the missing piece: the compiled chunk served to the
      browser does contain the palette, so it ships and loads. Confirmed too
      that the style is still the classic kind — fetched
      `styles/v1/mapbox/light-v11` from the API and it has 50 layers with a
      background layer and ordinary fills and lines, not the newer
      import-based architecture that would have made per-layer recolouring
      inert.

      So it runs and does nothing visible. The untested explanation is that
      `setPaintProperty` is throwing for every layer and being swallowed by
      the `try {} catch {}` inside the loop, which would look exactly like
      this. Next step is to count successes and failures in that catch rather
      than guess again.

      Re-applying on the `styledata` event was tried and does not fix it, so
      that was reverted. Note for whoever picks this up: `setPaintProperty`
      itself fires `styledata`, so any listener there needs a re-entrancy
      guard or it freezes the renderer.

- [x] **psql is reliable on the direct host** (2026-09-13). Roughly a dozen
      consecutive statements, including both migration dry-runs, with no
      failures. The instability was only ever the Supavisor pooler, and the
      app never used that path anyway since it reaches the database over
      PostgREST.

      The pooler's `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found`
      is still unexplained and still on Supabase's side. It does not matter,
      because the direct host works and is what the migration recipe at the
      top of this file already tells you to use. Do not spend more time on it.

      What carried over and is worth keeping: wrap any reset in an explicit
      `begin; ... commit;` so a mid-connection drop rolls back rather than
      leaving the data half-deleted. Both migration files do this, and both
      raise rather than commit if their post-conditions fail.

- [ ] **Run `supabase/admin-backfill-2026-09-13.sql`.** Five circles have
      members but no admin (`Surf Club`, `Beach volleyball (baker beach)`,
      `WIne club`, `test`, `test 2`), so nobody can edit them or approve a
      join request. They predate the `role: 'admin'` line in `createCircle`.
      All five belong to Ben and have exactly one member.

      Promotes the earliest-joined member, which generalises correctly if a
      circle has since gained members. Idempotent. Dry-run 2026-09-13:
      `UPDATE 5`, assertion passed. Run it before the reset or after; the two
      do not depend on each other, and the reset removes two of the five.

- [ ] **Anonymised posts are uneditable by anyone, including admins.** After
      an account is deleted its posts remain with `user_id` null, and every
      write policy is `auth.uid() = user_id`, which is never true against
      null. Deliberate — a departed person's words should not become editable
      by someone else — but it means an admin cannot remove an abusive post
      left behind by a deleted account.

## Decisions not yet made

- [ ] **Should `bio` be world-readable?** `anon` can currently read `id`,
      `full_name`, `avatar_url`, `created_at` and `bio` for every profile,
      with no requirement that the person belong to a public circle. Name and
      avatar have to stay readable for circle pages to render. `bio` is a
      choice nobody has actually made. (`instagram` is correctly locked.)

- [ ] **Is the follow graph meant to be public?** Any signed-in user can read
      all of `follows`. Called a product decision during the RLS audit rather
      than a bug — tightening it breaks follower counts on other people's
      profiles — but worth revisiting before launch.

---

## Done

- [x] RLS audit applied and the app adapted to it (`41ca7ec`)
- [x] `supabase/schema.sql` regenerated from the live database (`07cec3e`)
- [x] Account deletion, with content anonymised and circles handed over
- [x] Commercial circles behind manual business verification
- [x] Password reset and optional usernames
- [x] **Custom domain `hicircles.com`** registered 2026-09-09 via Vercel,
      attached and verified, serving 200. `www` 307-redirects to the apex.
      Supabase Site URL is `https://hicircles.com`; redirect URLs cover the
      apex, `/**`, and `http://localhost:3000/**` — the localhost entry was
      missing entirely before, so password reset had never worked in dev.
      Mapbox token rotated to a URL-restricted one; map and location search
      both verified on the live domain.
- [x] Explore map opens where the user is, verified against production
      2026-09-09. Vercel does send `x-vercel-ip-latitude`, `-longitude` and
      `-city` (percent-encoded — `San%20Francisco` — and decoded correctly),
      alongside `-timezone` and `-postal-code` which may be useful later.
      Note `x-vercel-*` also carries `x-vercel-oidc-token`,
      `x-vercel-proxy-signature` and an `x-vercel-sc-headers` blob holding an
      Authorization bearer: never echo that namespace by prefix, allowlist the
      `-ip-` keys you want.
- [x] `anon` write privileges revoked on every public table
      (`revoke-anon-writes-2026-09-08.sql`, applied 2026-09-09). Probed live:
      an anon INSERT now fails with `42501 permission denied` rather than
      falling through to RLS, and anon SELECT still returns 200 on circles and
      on the profile columns the logged-out circle page reads.
