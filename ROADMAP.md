# Desired features

Things we want to build, with enough detail to start cold. Not a commitment
and not ordered by priority — `PRODUCTION.md` is the list that gates launch,
this is the list that grows the product.

---

## @mentions in posts and comments, with caret autocomplete

**Status:** not started. Sized 2026-09-08.

Tag someone in a post or comment; they get it in their notifications, and the
mention renders as a link to their profile.

### Why the autocomplete version

The plain version — type `@rosa` and we parse it — is about an hour of work.
It is deliberately *not* what is pinned here. Without a dropdown, mentions
only work if you already know someone's exact username, which almost nobody
does, so the feature gets used once and abandoned. The typeahead is the
feature; the parsing is plumbing.

### What already exists, so it doesn't get re-derived

- **`notifications` is generic.** `type` is free text, `TYPE_TEXT` in
  `src/app/notifications/page.tsx` maps it to a phrase, and the href is
  derived from `circle_id` / `post_id`. Adding `mention: 'mentioned you'` is
  one line.
- **No RLS change needed.** `notifications: actor insert` is
  `WITH CHECK (auth.uid() = actor_id)`, so notifying another user already
  works. Three call sites in `src/app/actions/posts.ts` do it today.
- **Usernames are unambiguous to parse.** `[a-z0-9_]{3,20}`, lowercase, with a
  case-insensitive unique index. `/@([a-z0-9_]{3,20})/g` is sufficient; no
  need to handle spaces or display names.

### The work

1. **Parse and resolve.** Extract handles from content in `createPost` and
   `addComment`, resolve them in one `profiles.select('id, username').in(...)`,
   drop self-mentions, dedupe.
2. **Notify.** One `type: 'mention'` row per resolved user, carrying
   `circle_id` / `post_id` / `comment_id` so the existing href logic works.
   Add the `TYPE_TEXT` entry.
3. **Render.** A component that splits content on the mention regex and
   renders each handle as a `Link` to the profile. Used in the two places
   content is rendered in `PostItem.tsx` — the post body and each comment.
4. **The typeahead.** The actual work, and all of it client-side in
   `PostCompose` and the comment box:
   - detect an `@` token at the caret, and the partial handle after it
   - query matching usernames, debounced, scoped to circle members
   - dropdown with keyboard nav (up/down/enter/escape) and mouse
   - insert on select, put the caret after the inserted handle
   - dismiss on space, on escape, on blur

### Decisions to make first

- **Usernames are optional and nobody has one**, including Ben. Mentions
  resolve against usernames, so the feature is inert until people set one.
  Consider making username required at signup — that is a signup-flow change
  and a backfill for the two existing accounts.
- **Can you mention a non-member?** If yes, they get a notification linking to
  a circle they may not be able to read. RLS holds, so nothing leaks, but they
  land on a join prompt with no idea why. Recommend scoping both the
  autocomplete and the notification to circle members.
- **Anonymised posts.** A deleted author's posts survive with `user_id` null.
  Mentions inside them should still render as links; the mention target is
  unrelated to the author.

---

## Check-ins (yes / no / maybe)

**Status:** BUILT 2026-09-08, migrations not yet applied — see the resume
banner in PRODUCTION.md. Schedule anchor and per-circle timezones landed as
prerequisites. What follows is the original spec, kept because the reasoning
still explains the shape of the code.

Within 24 hours of a circle's next meet, members say whether they are coming.
Circles live or die on whether enough people show up, so the point is turning
"there is a schedule" into "six people are actually going".

- Public circle: any signed-in user can see who checked in.
- Private circle: members only.
- Your feed shows check-ins from people you are friends with.

### Prerequisite: schedules have no anchor date

`circle_schedules` stores `days_of_week`, `start_time`, `end_time` and
`frequency` ('weekly' | 'biweekly' | 'monthly'). It stores nothing to anchor
the recurrence, so **biweekly is undefined** — nothing says which week is the
"on" week, and monthly + `days_of_week` is worse. A check-in attaches to a
specific date, so this has to be settled first.

Also a live bug: the "this week" calculation in `src/app/home/page.tsx`
ignores `frequency` completely and just finds the nearest matching weekday, so
a biweekly circle currently displays as if it met every week.

Fix: add `anchor_date date` to `circle_schedules`, backfill it to `created_at`,
expose it in the create and edit forms, and write one shared occurrence helper
that every surface uses.

### The work

- `circle_check_ins(circle_id, user_id, occurs_on date, status, created_at)`,
  primary key `(circle_id, user_id, occurs_on)` so a person has one answer per
  occurrence and changing it is an upsert.
- Read policy is `can_read_circle_content(circle_id, auth.uid())` — the helper
  already encodes public-means-signed-in and private-means-member.
- Write policy: own rows only. Validate in a trigger that `occurs_on` is a
  real occurrence of that circle's schedule and inside the 24-hour window,
  since a server action alone is not a boundary.
- UI: yes/no/maybe control plus a "who is going" list on the circle page, and
  the same control on the home schedule pills.

**Rough size:** the largest of the three. The table and policies are small;
the occurrence maths and the UI surfaces are the work.

---

## Friends (mutual follows)

**Status:** not started. Sized 2026-09-08. **This is the next thing to build.**

`follows` is directional. A friend is a mutual follow — both rows exist. Needed
because the activity feed should only show people you are actually reciprocal
with, not everyone you happen to follow.

A `security definer` helper `are_friends(a, b)` plus a view over the self-join.
Cheap on its own; it exists to be used by the feed below.

**Rough size:** small — under an hour.

---

## Friend activity in the feed

**Status:** not started. Sized 2026-09-08. Depends on friends. Check-ins now
exist, so this can show both joins and "going" from day one.

Ben's call on the visibility trap below: **filter by circle visibility**, err
towards showing less.

See what people you are friends with are doing: joining a circle, checking in
to a meet.

No activity table needed for v1. Both facts are already timestamped —
`circle_members.joined_at` and the check-in rows — so this is a union query
over two tables filtered to friends, ordered by time.

### The trap

**"Ada joined Beach Volleyball" leaks that the circle exists, and that Ada is
in it.** For a private circle that is a real disclosure to someone who is not
a member. Every activity row must be filtered through
`circle_is_visible` / `can_read_circle_content`, not merely through friendship.
Get this wrong and the feature quietly undoes the RLS audit.

**Rough size:** medium. The query is straightforward; the visibility filtering
and the empty states are the care.

---

## Home page — design history

Keep this so the next rework does not repeat the last one.

- **Original:** three stacked sections — "This week", "Latest", "Your circles".
  Read as a digest rather than a feed: posts were the smallest element,
  sandwiched between two directory lists, with no avatars and nothing
  actionable on the page. "Your circles" duplicated `/profile` and, at nine
  rows, pushed the posts off screen.
- **2026-09-08 rework** (`652ffa3`): feed became the page. Posts render through
  the same `PostItem` as inside a circle (avatars, likes, inline comments), a
  composer with a circle picker sits at the top, the schedule shrank to a row
  of pills, and "Your circles" moved into the previously empty left rail.
  Options considered and rejected at the time: a feed with a sticky right
  rail; one merged stream interleaving posts and meets chronologically; and
  leaning in to a weekly digest.
- **2026-09-09 rework:** agenda-first. The week became the page: every meet in
  the next seven days is a card carrying its own check-in control, a live
  "N going", and the names of who is coming, so home answers "where am I meant
  to be and who else is going" without opening a circle. Posts kept the full
  `PostItem` treatment but moved below, under a "Chatter" label. Rail widened
  190px → 230px. A meet stays its circle's "next occurrence" until local
  midnight, so a finished one would otherwise hold a full card all evening —
  it collapses to a single "finished · N went" line instead, and goes when the
  date rolls.
- **On the merged stream**, which the note above nominated: it does not
  survive contact with the layout. Posts run newest-first, meets run
  soonest-first, so a single chronological column has to choose a direction
  and the other half then reads backwards. Anchoring at *now* — meets above,
  chatter below — is the coherent version, and that is what was built. Treat
  the merged stream as tried and rejected rather than untried.
- **Verdict:** not yet reviewed by Ben.

---

## Ideas not yet specced

Capture things here as they come up, even one line. Better than a chat log.

- **Admin delete path for posts by deleted accounts.** Anonymised posts are
  uneditable by everyone, since every write policy is `auth.uid() = user_id`
  and that is never true against null. Means an admin cannot remove an abusive
  post left behind by someone who deleted their account. Also in
  `PRODUCTION.md` under known issues.
- **Backfill an admin into the 5 adminless circles**, and decide whether
  circles should be allowed to exist with no admin at all.
- **Events.** The `events` table exists, is empty, and nothing in the app
  writes to it. Either build it or drop it.
