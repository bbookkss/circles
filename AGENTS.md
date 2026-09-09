<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- **[PRODUCTION.md](PRODUCTION.md)** is the running list of what still needs
  doing before launch — blocking items, environment gaps, what has never been
  tested, and decisions not yet made. Read it before starting work, and add to
  it whenever a new feature leaves something undone. Do not let this knowledge
  live only in a chat transcript.
- **[HANDOFF.md](HANDOFF.md)** is the historical record: what was changed, why,
  and the traps that cost real time (RLS recursion, silently inert column
  revokes).
- Database changes are checked-in SQL files under `supabase/`, named
  `<topic>-<date>.sql`, applied against production by hand. `supabase/schema.sql`
  is a generated dump of live state — regenerate it, don't edit it.
