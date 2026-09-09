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

- [ ] **Restrict the Mapbox token.** mapbox.com/account/access-tokens → the
      `pk.` token → URL restriction for `circles-rho-sand.vercel.app`. It is
      public and billable; this is the only open item with money attached.

- [ ] **Supabase Auth URL config.** Authentication → URL Configuration.
      Site URL `https://circles-rho-sand.vercel.app`; Redirect URLs must
      include `https://circles-rho-sand.vercel.app/**` and
      `http://localhost:3000/**`. Password reset links bounce without this.

- [ ] **Real SMTP.** The default Supabase mailer is rate-limited to a couple
      of messages an hour. Password reset and signup confirmation both depend
      on it, so it will silently fail the moment more than one person signs up
      at once.

- [ ] **Run `supabase/revoke-anon-writes-2026-09-08.sql`.** Strips
      INSERT/UPDATE/DELETE/TRUNCATE from `anon` on every public table, keeping
      SELECT. RLS blocks all of these today (probed: zero rows), but
      **TRUNCATE is not subject to RLS at all**, and the rest become live the
      moment anyone adds a permissive anon policy.

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
