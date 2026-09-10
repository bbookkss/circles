// Recolors the Mapbox light base into a coffee-toned map with tan streets,
// applied on map load. A CSS filter can't remap land vs. streets to different
// colors, so we set paint properties per layer instead.

const COFFEE = '#cabca4'       // land / base (soft latte)
const MINOR = '#bcae96'        // subtle non-road lines (boundaries etc.)
const WATER = '#b4a68f'        // water bodies (gently darker than land)
const TAN = '#e8dfce'          // streets / roads (soft lift over land)
const LABEL = '#5e4f3f'        // label text (dark brown)
const LABEL_HALO = '#e8dfce'   // light halo so labels read on the land

type StyledMap = {
  getStyle: () => { layers?: { id: string; type: string }[] } | undefined
  // Loose signature so Mapbox's strongly-typed setPaintProperty is assignable.
  setPaintProperty: (...args: any[]) => unknown
  isStyleLoaded?: () => boolean
  on?: (event: string, cb: () => void) => unknown
}

export function applyCoffeeTheme(map: StyledMap) {
  const layers = map.getStyle()?.layers
  if (!layers) return

  for (const layer of layers) {
    const { id, type } = layer
    try {
      if (type === 'background') {
        map.setPaintProperty(id, 'background-color', COFFEE)
      } else if (type === 'fill') {
        map.setPaintProperty(id, 'fill-color', /water/i.test(id) ? WATER : COFFEE)
      } else if (type === 'line') {
        if (/water/i.test(id)) {
          map.setPaintProperty(id, 'line-color', WATER)
        } else if (/(road|street|bridge|tunnel|motorway|trunk|path|pedestrian|rail)/i.test(id)) {
          map.setPaintProperty(id, 'line-color', TAN)
        } else {
          map.setPaintProperty(id, 'line-color', MINOR)
        }
      } else if (type === 'symbol') {
        map.setPaintProperty(id, 'text-color', LABEL)
        map.setPaintProperty(id, 'text-halo-color', LABEL_HALO)
        map.setPaintProperty(id, 'text-halo-width', 1)
      }
    } catch {
      // layer doesn't support this paint property — skip it
    }
  }
}

/**
 * Apply the theme and keep it applied.
 *
 * `applyCoffeeTheme` on the map's load event is not enough on its own. Paint
 * properties live on the style, so anything that reloads or extends the style
 * afterwards — a late-arriving sprite or glyph set, a source finishing — puts
 * the stock light-v11 colours back, and the map silently returns to grey with
 * no error anywhere.
 *
 * `styledata` fires on each of those, so re-applying there holds the theme.
 * The re-entrancy guard is not optional: setPaintProperty itself mutates style
 * data and so fires `styledata`, and without the flag the handler calls itself
 * forever and freezes the renderer. It did exactly that when this was first
 * written — the map went blank rather than grey, which is how it announced
 * itself.
 */
export function keepCoffeeTheme(map: StyledMap) {
  let applying = false
  const reapply = () => {
    if (applying) return
    applying = true
    try {
      applyCoffeeTheme(map)
    } finally {
      // Cleared after the current task, so the styledata events our own
      // setPaintProperty calls emit are swallowed rather than re-entering.
      setTimeout(() => {
        applying = false
      }, 0)
    }
  }
  reapply()
  map.on?.('styledata', reapply)
}
