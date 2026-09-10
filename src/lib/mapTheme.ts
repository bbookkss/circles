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
