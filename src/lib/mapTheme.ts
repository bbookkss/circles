// Recolours the Mapbox light base into the Arctic palette: cool blue-grey land,
// near-white streets, blue water, quiet slate labels. A dark version follows
// the app's .dark class. A CSS filter can't remap land vs. streets to
// different colours, so we set paint properties per layer instead. Heat (gold)
// is never used here: on the map it belongs to circles, not to the city.
//
// Why this is installed rather than applied once: the recolour used to run on
// the map's `load` event only, and on the explore page the map came up grey
// on first paint and only turned the right colour after the first fly-to.
// Mapbox rebuilds the style in a few situations (a style reload, a `setStyle`,
// some v3 style updates), each of which fires `styledata` and puts the stock
// colours back. Listening for that and re-applying fixes every case at once.
// The guard is idempotence, not a flag: `setPaintProperty` itself fires
// `styledata`, and a listener that re-applied unconditionally would loop until
// the renderer froze, which is exactly what happened the last time this was
// tried.

type Palette = { land: string; minor: string; water: string; street: string; label: string; halo: string }

const LIGHT: Palette = {
  land: '#e2e9f1',
  minor: '#cfdbe8',
  water: '#c6d6e6',
  street: '#f7f9fb',
  label: '#4b5868',
  halo: '#f4f7fa',
}

const DARK: Palette = {
  land: '#2e3640',
  minor: '#3a4450',
  water: '#2c3d50',
  street: '#414b58',
  label: '#b5bfcc',
  halo: '#2e3640',
}

/** The map container's background while tiles load: the land colour, via the theme token. */
export const MAP_BG = 'var(--cool)'

type StyledMap = {
  getStyle: () => { layers?: { id: string; type: string }[] } | undefined
  // Loose signatures so Mapbox's strongly-typed methods are assignable.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  setPaintProperty: (...args: any[]) => unknown
  getPaintProperty?: (...args: any[]) => unknown
  /* eslint-enable @typescript-eslint/no-explicit-any */
  isStyleLoaded?: () => boolean
  on?: (event: string, handler: () => void) => unknown
}

function currentPalette(): Palette {
  if (typeof document === 'undefined') return LIGHT
  return document.documentElement.classList.contains('dark') ? DARK : LIGHT
}

/** True once the background layer already carries the current palette's land colour. */
function alreadyThemed(map: StyledMap, p: Palette): boolean {
  const layers = map.getStyle()?.layers
  const bg = layers?.find((l) => l.type === 'background')
  if (!bg || !map.getPaintProperty) return false
  try {
    return map.getPaintProperty(bg.id, 'background-color') === p.land
  } catch {
    return false
  }
}

export function applyMapTheme(map: StyledMap, p: Palette = currentPalette()) {
  const layers = map.getStyle()?.layers
  if (!layers) return

  for (const layer of layers) {
    const { id, type } = layer
    try {
      if (type === 'background') {
        map.setPaintProperty(id, 'background-color', p.land)
      } else if (type === 'fill') {
        map.setPaintProperty(id, 'fill-color', /water/i.test(id) ? p.water : p.land)
      } else if (type === 'line') {
        if (/water/i.test(id)) {
          map.setPaintProperty(id, 'line-color', p.water)
        } else if (/(road|street|bridge|tunnel|motorway|trunk|path|pedestrian|rail)/i.test(id)) {
          map.setPaintProperty(id, 'line-color', p.street)
        } else {
          map.setPaintProperty(id, 'line-color', p.minor)
        }
      } else if (type === 'symbol') {
        map.setPaintProperty(id, 'text-color', p.label)
        map.setPaintProperty(id, 'text-halo-color', p.halo)
        map.setPaintProperty(id, 'text-halo-width', 1)
      }
    } catch {
      // layer doesn't support this paint property — skip it
    }
  }
}

/**
 * Apply now and keep it applied, including when the person flips light/dark.
 * Call from the map's onLoad.
 */
export function installMapTheme(map: StyledMap) {
  const reapply = () => {
    if (map.isStyleLoaded && !map.isStyleLoaded()) return
    const p = currentPalette()
    if (alreadyThemed(map, p)) return
    applyMapTheme(map, p)
  }
  reapply()
  map.on?.('styledata', reapply)
  map.on?.('style.load', reapply)
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(reapply).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
}
