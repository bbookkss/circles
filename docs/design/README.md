# Circles design: the approved mockups

Static mockups of every page in the redesign, approved 2026-11-18. They are
the reference the app was ported from, not part of the app. To view them:

    cd docs/design && python3 -m http.server 4300
    open http://localhost:4300/pages.html

`pages.html` links every page. The sun and moon button switches light and
dark. The Ask Circles panel opens from the ring button on any signed-in page,
or by adding `#ask` to the address. Its answers are canned keyword rules
standing in for the real agent (`src/app/api/assistant`).

## The system

- **Type:** Host Grotesk only. Big headings at weight 300 with tight
  tracking. No all-caps labels, no monospace, no italics for emphasis.
- **Colour:** after FLIR's Arctic thermal palette, split 60-30-10:
  - 60, neutral: paper `#f7f8fa`, ink `#1a2230`, quiet `#5c6878`, rule
    `#e3e7ed`
  - 30, cool blue-grey: `#e2e9f1`, `#cfdbe8`, used for maps, glass and
    controls
  - 10, heat: gold `#f2a531` (or `#9a6200` as text), only for what you can act
    on now: check-in open, Going, unread
  - Dark mode is slate (`#252b34`), not black.
- **Glass** is only for things that float over content: the nav, the tab bar,
  and panels over the map.
- **Motion:** the logo's five-dash ring turns once a minute, and the map's
  heat patches breathe slowly. Both stop under reduced motion.
- **The map** shows circles you're not in as areas of heat. Hotter means
  sooner or more active. Only members see an exact dot.

Rejected along the way, so they don't come back: the dark thermal and
particle look, and the cream paper, serif and coloured-italic greeting the
app had before.
