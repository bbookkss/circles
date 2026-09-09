# Handoff — 2026-09-06

Session covered Vercel env setup, a git identity fix, and an RLS security audit
of the Supabase database. **Read `supabase/rls-applied-2026-09-06.sql` first** —
it is the consolidated live policy state and explains the reasoning.

---

## STOP — production is currently inconsistent

The RLS changes are **live in Supabase**, but the matching app change is
**uncommitted and undeployed**. Result: on a public circle page, a logged-out
visitor sees `0 members` instead of the real count.

Nothing leaks and nothing errors visibly. It fixes itself the moment the
working tree is committed and deployed.

Uncommitted:

| File | Status |
|---|---|
| `src/app/circles/[id]/page.tsx` | modified, +72/−22, `tsc` clean, builds |
| `supabase/rls-applied-2026-09-06.sql` | new — the live policy state |
| `supabase/rls-hardening.sql` | new — **first draft, do not run**, see below |
| `HANDOFF.md` | this file |

**Next action:** commit and push. The Vercel project deploys from `main`.

---

## Done

### Vercel environment
- `NEXT_PUBLIC_MAPBOX_TOKEN` added; `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` extended from Production-only to Preview and
  Development too.
- Production's anon key swapped from the legacy JWT to the `sb_publishable_…`
  key so all four environments match `.env.local`. Verified by pulling prod env
  and diffing.
- Vercel CLI installed and the project linked (`bookstaver/circles`), so
  `vercel env ls` / `vercel env pull` / `vercel --prod` work from the repo.

### Git identity
`user.email` was never set, so git synthesised `ben@Mac.hsd1.ca.comcast.net`
from the hostname, which Vercel rejected. Now set globally to
`140562315+bbookkss@users.noreply.github.com` / `Ben Bookstaver`. Only affects
future commits; the 17 existing ones keep the bad address (rewriting them means
a force-push, not worth it).

### RLS audit
Full findings and the applied SQL are in
`supabase/rls-applied-2026-09-06.sql`. Summary of what was actually wrong:

1. **`circles`, `circle_members`, `circle_schedules`** had bare
   `auth.role() = 'authenticated'` read policies — any signed-in user could
   read every private circle including coordinates, its full membership, and
   its meeting schedule. Signup is open, so this was ~30 seconds of effort to
   exploit. **Fixed.**
2. **`profiles`** was `using (true)` with a table-level grant to `anon`, so
   anyone could scrape every user's name, bio and Instagram handle and join it
   against public-circle membership. **Fixed** (column grants).
3. **Post content, comments and likes in public circles** were readable with no
   account at all. "Public" means discoverable by anyone but readable by
   account holders — not world-readable. **Fixed.**
4. **`events`** carried the same unqualified policy. Empty and unused by the
   app, so no live exposure, but it would have become one the moment the
   feature got built. **Fixed.**

Verified correct, left alone: `messages` (sender/recipient only),
`notifications` (owner only), `circle_join_requests` (own rows or circle
admins), and every INSERT/UPDATE/DELETE policy on every table.

`follows` is readable by any signed-in user — the entire follow graph. That's a
product decision rather than a bug; tightening it breaks follower counts on
other people's profiles.

---

## Two traps worth remembering

Both of these cost real time this session.

1. **RLS recursion.** A policy on `circle_members` that contains a subquery
   against `circle_members` produces `ERROR 42P17: infinite recursion` and
   takes down reads on every table that touches it. This actually happened —
   production reads were broken for a few minutes. The fix is to route every
   membership check through a `security definer` helper. All current policies
   do this.

2. **Column-level revokes are silently inert.** `revoke select (instagram) on
   profiles from anon` does nothing while `anon` holds a table-level `SELECT`
   grant. You must `revoke select on <table> from anon` and then re-grant
   column by column. The first attempt looked like it succeeded and changed
   nothing.

Neither was caught by the SQL editor reporting `success`. Both were caught by
probing the live REST API afterwards. **Always probe after changing policies.**

---

## Remaining work

1. **Commit and push** the working tree. Fixes the member-count regression.
2. **Verify with real data.** The database has 9 circles, all public, 0
   private, 2 profiles. Every private-circle protection is correct by
   inspection but has never actually been exercised. Create a private circle
   and a second account, then re-probe.
3. **Verify the signed-in path.** Only the anonymous side was measured. That a
   signed-in non-member can still read public-circle posts follows from
   `can_read_circle_content` returning true when `uid is not null`, but it was
   never observed. Click through a public circle while logged in.
4. **Confirm `post_likes` / `post_comments` / `comment_likes` predicates.**
   They were rewritten and probed anonymously, but their live definitions were
   never read back from `pg_policies`.
5. **Regenerate `supabase/schema.sql`.** It describes a database that no longer
   exists — missing the `{anon}` policies, the `posts` / `follows` /
   `circle_join_requests` tables, and everything from this session. That stale
   file is what sent the audit down the wrong path initially.
6. **Delete `supabase/rls-hardening.sql`** once the applied file is committed.
   It is the superseded first draft and contains the recursive policy.
7. **Restrict the Mapbox token** to the Vercel domain at
   mapbox.com/account/access-tokens. It is public (`pk.`) and billable.

---

## Re-running the probe

The audit was done by hitting the REST API as an anonymous caller holding the
publishable key. To repeat it from the repo root:

```bash
K=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"')
U=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
G() { curl -s -H "apikey: $K" -H "Authorization: Bearer $K" "$U/rest/v1/$1"; }

# should be denied / empty
G 'posts?select=content&limit=1'
G 'circle_members?select=user_id&limit=1'
G 'profiles?select=instagram&limit=1'

# should still work — the logged-out enticement card
G 'circles?select=name,description,visibility&limit=1'
G 'circle_schedules?select=days_of_week,start_time&limit=1'
```

To check write protection without inserting anything, POST a row with a
deliberately bogus foreign key. Code `42501` means RLS blocked it (good);
`23503` means only the FK constraint stopped it, i.e. RLS let it through.

To inspect live policies:

```sql
select tablename, policyname, cmd, roles, qual
from pg_policies where schemaname = 'public' order by tablename, cmd;
```
