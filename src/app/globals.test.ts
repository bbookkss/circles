import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')

/**
 * Guards the fix for 459px of dead space on /circles/new.
 *
 * Base UI gives a named Select's hidden 1px input `position: absolute` with no
 * offsets, so it sits at its static position while its containing block is the
 * nearest positioned ancestor. A plain `overflow-y: auto` scroller is static,
 * so it neither contains nor clips the input: the input projects its offset
 * onto the page box and the document stretches to reach it.
 *
 * This cannot be caught by the unit tests, which never build a layout, and
 * there is no browser runner in this project. So the test asserts the rule is
 * still in the stylesheet rather than that the page is still the right height.
 * It catches deletion during a refactor, which is the realistic way to lose
 * it. It does not catch Base UI changing the attributes it renders, which
 * would make the selector silently stop matching — scripts/deadspace-sweep.js
 * is what finds that, and it has to be run by hand.
 */
test('the Base UI hidden input is kept out of the page box', () => {
  const rule = css.match(/input\[aria-hidden="true"\]\[tabindex="-1"\]\s*\{[^}]*\}/)
  assert.ok(rule, 'the rule neutralising Base UI\'s hidden Select input is gone from globals.css')
  assert.match(
    rule[0],
    /position:\s*fixed\s*!important/,
    'the rule must be `position: fixed !important` — the style it overrides is inline, so without !important it does nothing',
  )
})
