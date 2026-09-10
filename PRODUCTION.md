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

- [ ] **Cap Mapbox spend, and refresh the old default token.** The token is
      now rotated: `hicircles.com web (URL-restricted)` is live everywhere,
      restricted to hicircles.com, www, circles-rho-sand.vercel.app and
      localhost:3000. Two things remain, and the first matters more than the
      restriction does:
      - **Set a usage/spend limit** in the Mapbox account. Probed 2026-09-09:
        the URL restriction is enforced on the **geocoding** endpoint (403
        from a disallowed origin) but **not** on styles, fonts or iconset —
        those return 200 from any origin, with `access-control-allow-origin:
        *`. So a copied token can still load maps and bill you. A spend cap is
        the actual guard, not the URL list.
      - **Refresh the Default public token** (console → Tokens → Refresh).
        It is unrestricted, was in the public bundle for days, and cannot be
        deleted — only refreshed. Nothing uses it any more: production and
        `.env.local` both carry the new token, verified by grepping the
        deployed chunks.

      Note for next time: URL restrictions can only be set on tokens you
      create. The Default public token has no such control, which is why this
      needed a new token rather than an edit.

- [ ] **DKIM — blocked until 2026-09-10 at the earliest, do not forget.**
      Gmail on hicircles.com went live 2026-09-09 and Google refuses to
      generate a DKIM key for 24-72 hours after that ("You must wait 24 to 72
      hours after enabling Gmail with a registered domain"). Nothing is wrong;
      it just cannot be done yet.
      When it can: Admin console → Apps → Google Workspace → Gmail →
      Authenticate email → Generate new record (2048-bit, prefix `google`),
      then add the TXT at host `google._domainkey` and click Start
      authentication. MX, SPF and DMARC are already live and verified.
      Until DKIM lands, leave DMARC at `p=none` — tightening to quarantine or
      reject without DKIM would start sending your own mail to spam.

- [ ] **Real SMTP.** The default Supabase mailer is rate-limited to a couple
      of messages an hour. Password reset and signup confirmation both depend
      on it, so it will silently fail the moment more than one person signs up
      at once.

## Environment

- [ ] **`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.** Username sign-in
      resolves username → email with it. Production has it (via the Supabase
      integration); local does not, so username login throws under
      `npm run dev`. Email login is unaffected. Get it from Supabase →
      Project Settings → API Keys → `service_role`.

- [ ] **Same key in Vercel Preview and Development.**
      `vercel env add SUPABASE_SERVICE_ROLE_KEY preview`. Production is set.

- [ ] **Delete the unused `POSTGRES_*` secrets in Vercel.** `POSTGRES_URL`,
      `POSTGRES_PASSWORD`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`.
      Nothing in `src/` opens a Postgres connection — no `pg`, no Prisma, no
      Drizzle — so these are dead credentials with live database access.

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
- [ ] **Check-ins.** Table, trigger and UI are written and the SQL is verified
      in a rolled-back transaction, but nobody has ever pressed Going. Needs
      the migrations above applied first. Test inside the 24-hour window —
      outside it the buttons are correctly disabled.
- [ ] **Timezone from coordinates.** tz-lookup resolves a circle's zone from
      its pin at write time. Verified for the existing nine (TEST Florida →
      America/New_York), never exercised by creating a new circle.
- [ ] **Business approve/reject.** `/admin` renders and gates correctly, but
      the queue has never had a row in it. Submit a request from
      `Test user 2`, approve it, and create a commercial circle.
- [ ] **Private circles.** All 9 circles are public, so every private-circle
      protection in the RLS audit is correct by inspection and has never once
      run. Make a private circle and a second account.
- [ ] **Signed-in non-member reading a public circle.** Follows from
      `can_read_circle_content` returning true when `uid is not null`, but was
      never observed.

## Known issues

- [ ] **Confirm psql can reach the database before the pre-launch data reset.**
      The reset has to be surgical, and right now the tool that would do it is
      unreliable. `psql` through the Supavisor pooler fails intermittently
      with `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found`, which is
      not what it sounds like: the connection string is byte-identical between
      the runs that work and the runs that fail, so nothing is misconfigured
      here. Observed 2026-09-09: 14 consecutive successes, then 12 consecutive
      failures, no change in between.

      Two explanations tested and ruled out. It is not one bad node behind the
      load balancer (both IPs fail when pinned individually with SNI intact,
      via `host=... hostaddr=...` — note `PGHOSTADDR` alone is not a valid
      test, it breaks the SNI that Supavisor routes tenants by). It is not a
      cold cache after idle (0s/30s/60s/90s gaps, 12/12 failed). A per-IP
      connection throttle from ~40 rapid debug attempts is the remaining
      guess, weakened by a 120s quiet period still failing.

      Root cause not established, and it is on Supabase's side. What matters:
      the app is unaffected, since it reaches the database over PostgREST, not
      Postgres. Only hand-applied migrations and the data reset use this path,
      and a migration that half-applies is worse than one that never ran.

      Before the reset: connect, run something trivial, and only proceed if it
      is reliable across several minutes. If it still flaps, do the reset
      through the Supabase dashboard's SQL editor instead, which goes over
      HTTPS and does not touch the pooler. Wrap the reset in an explicit
      `begin; ... commit;` either way, so a mid-connection drop rolls back
      instead of leaving the data half-deleted.

- [ ] **5 circles have no admin.** `WIne club`, `test`, `Surf Club`,
      `test 2`, `Beach volleyball (baker beach)`. They predate the
      `role: 'admin'` line in `createCircle`, so nobody can edit them or
      approve join requests. One line to backfill: promote each one's
      earliest-joined member.

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
