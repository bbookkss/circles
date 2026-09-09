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
