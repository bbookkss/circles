// Recolors the Mapbox light base into a coffee-toned map with tan streets.
// A CSS filter can't remap land vs. streets to different colors, so we set
// paint properties per layer instead.
//
// Why this is installed rather than applied once: the recolour used to run on
// the map's `load` event only, and on the explore page the map came up grey
// on first paint and only turned tan after the first fly-to. Mapbox rebuilds
// the style in a few situations (a style reload, a `setStyle`, some v3 style
// updates), each of which fires `styledata` and puts the stock colours back.
// Listening for that and re-applying fixes every case at once. The guard is
// idempotence, not a flag: `setPaintProperty` itself fires `styledata`, and a
// listener that re-applied unconditionally would loop until the renderer
// froze, which is exactly what happened the last time this was tried.

export const COFFEE = '#cabca4' // land / base (soft latte)
const MINOR = '#bcae96'         // subtle non-road lines (boundaries etc.)
const WATER = '#b4a68f'         // water bodies (gently darker than land)
const TAN = '#e8dfce'           // streets / roads (soft lift over land)
const LABEL = '#5e4f3f'         // label text (dark brown)
const LABEL_HALO = '#e8dfce'    // light halo so labels read on the land

type StyledMap = {
  getStyle: () => { layers?: { id: string; type: string }[] } | undefined
  // Loose signatures so Mapbox's strongly-typed methods are assignable.
  setPaintProperty: (...args: any[]) => unknown
  getPaintProperty?: (...args: any[]) => unknown
  isStyleLoaded?: () => boolean
  on?: (event: string, handler: () => void) => unknown
}

/** True once the background layer already carries our colour. */
function alreadyThemed(map: StyledMap): boolean {
  const layers = map.getStyle()?.layers
  const bg = layers?.find((l) => l.type === 'background')
  if (!bg || !map.getPaintProperty) return false
  try {
    return map.getPaintProperty(bg.id, 'background-color') === COFFEE
  } catch {
    return false
  }
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
 * Apply now and keep it applied. Call from the map's onLoad.
 */
export function installCoffeeTheme(map: StyledMap) {
  const reapply = () => {
    if (map.isStyleLoaded && !map.isStyleLoaded()) return
    if (alreadyThemed(map)) return
    applyCoffeeTheme(map)
  }
  reapply()
  map.on?.('styledata', reapply)
  map.on?.('style.load', reapply)
}
