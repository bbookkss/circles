/**
 * Understanding what someone typed, without a model: shared by public search
 * and Radius, so "hoops on saturday", "running", and "anything free this
 * weekend" all mean the same thing in both.
 *
 * The old matching was a literal substring per word, so "running" missed
 * "Run club", "hoops" missed basketball, and "this weekend" matched nothing
 * (and, with no word left, returned nothing). Now:
 *
 *   - day words become a day filter (saturday, weekend, weeknight, tonight)
 *   - free / paid become a cost filter
 *   - filler is dropped ("things to do", "looking for", "near me")
 *   - every remaining word is stemmed and widened through a synonym group
 *
 * Pure, no I/O. Matching happens in code over rows the database already
 * allowed, so nothing typed ever becomes a query string.
 */

export type Parsed = {
  /** Each entry is one thing asked for; any variant in it counts as a hit. */
  terms: string[][]
  /** Days of week (0 = Sunday) the circle must meet on, or null for any. */
  days: number[] | null
  free: boolean | null
}

const FILLER = new Set(
  (
    'a an the i im me my mine we us our to for in on at of and or with near nearby around close by some any anything ' +
    'something somewhere find finding look looking want wanna need get going go join meet meets meeting ' +
    'group groups club clubs circle circles community crew people folks friends new other others ' +
    'thing things stuff do doing fun activity activities event events happening whats what where when who how ' +
    'is are there here can could should would will be been please show tell list give recommend recommendations ' +
    'local area city town neighborhood neighbourhood this next coming upcoming week weekly every regular ' +
    'good best cool nice like into love try start starting beginner beginners all kind kinds type sort ' +
    'evening evenings morning mornings night nights afternoon afternoons today tomorrow day days time ' +
    'free cost costs paid price cheap pickup casual class classes lesson lessons session sessions'
  ).split(' ')
)

const DAY_WORDS: Record<string, number[]> = {
  sun: [0], sunday: [0], sundays: [0],
  mon: [1], monday: [1], mondays: [1],
  tue: [2], tues: [2], tuesday: [2], tuesdays: [2],
  wed: [3], weds: [3], wednesday: [3], wednesdays: [3],
  thu: [4], thur: [4], thurs: [4], thursday: [4], thursdays: [4],
  fri: [5], friday: [5], fridays: [5],
  sat: [6], saturday: [6], saturdays: [6],
  weekend: [0, 6], weekends: [0, 6],
  weekday: [1, 2, 3, 4, 5], weekdays: [1, 2, 3, 4, 5],
  weeknight: [1, 2, 3, 4, 5], weeknights: [1, 2, 3, 4, 5],
}

/**
 * Words that mean the same activity. The first entry is only a name; every
 * entry is a variant. Keep each group to one activity: "sports" is not a
 * synonym for basketball, it's a category, and the category field matches it.
 */
const SYNONYMS: string[][] = [
  ['basketball', 'hoop', 'hoops', 'bball'],
  ['soccer', 'football', 'futbol', 'footy'],
  ['volleyball', 'volley'],
  ['pickleball', 'pickle'],
  ['tennis'],
  ['run', 'running', 'runner', 'runners', 'jog', 'jogging', '5k', '10k'],
  ['walk', 'walking', 'stroll'],
  ['hike', 'hiking', 'hiker', 'trail', 'trails'],
  ['bike', 'biking', 'cycling', 'cyclist', 'ride', 'rides'],
  ['climb', 'climbing', 'bouldering', 'boulder'],
  ['swim', 'swimming'],
  ['yoga'],
  ['workout', 'fitness', 'exercise', 'gym', 'bootcamp', 'training'],
  ['skate', 'skating', 'skater', 'roller', 'skateboard', 'skateboarding', 'rollerskating'],
  ['dance', 'dancing', 'salsa', 'swing', 'lindy', 'bachata', 'ballroom', 'disco'],
  ['chess'],
  ['boardgame', 'boardgames', 'board', 'games', 'game', 'tabletop', 'dnd', 'd&d', 'catan'],
  ['trivia', 'quiz', 'pub'],
  ['book', 'books', 'reading', 'reader', 'readers', 'bookclub', 'literature'],
  ['write', 'writing', 'writer', 'writers', 'poetry', 'poem'],
  ['art', 'arts', 'drawing', 'draw', 'sketch', 'sketching', 'painting', 'paint'],
  ['photo', 'photography', 'photographer', 'camera'],
  ['music', 'jam', 'band', 'musician', 'musicians', 'guitar', 'singing', 'choir', 'karaoke'],
  ['film', 'films', 'movie', 'movies', 'cinema'],
  ['knit', 'knitting', 'crochet', 'craft', 'crafts', 'sewing'],
  ['code', 'coding', 'programming', 'developer', 'developers', 'hack', 'hacking', 'tech', 'startup', 'startups'],
  ['language', 'languages', 'spanish', 'french', 'japanese', 'conversation', 'exchange'],
  ['coffee', 'cafe'],
  ['drink', 'drinks', 'bar', 'bars', 'beer', 'wine', 'happy'],
  ['food', 'dinner', 'brunch', 'lunch', 'cook', 'cooking', 'potluck', 'supper'],
  ['dog', 'dogs', 'puppy', 'pup'],
  ['kid', 'kids', 'family', 'families', 'parent', 'parents', 'toddler', 'storytime'],
  ['garden', 'gardening', 'plants'],
  ['volunteer', 'volunteering', 'cleanup'],
  ['meditation', 'meditate', 'mindfulness'],
  ['comedy', 'improv', 'standup'],
  ['social', 'mixer', 'meetup', 'hangout'],
  ['outdoor', 'outdoors', 'outside', 'park', 'parks', 'nature'],
]

const GROUP_OF = new Map<string, string[]>()
for (const g of SYNONYMS) for (const w of g) GROUP_OF.set(w, g)

/** A light English stem: enough that run/running/runners and game/games meet. */
export function stem(w: string): string {
  if (w.length <= 4) return w.replace(/s$/, '')
  const out = w
    .replace(/ies$/, 'y')
    .replace(/(?:ing|ers|er)$/, '')
    .replace(/([^su])s$/, '$1')
  // runn -> run, but leave chess, ball, class alone.
  return out !== w ? out.replace(/([bdgmnpt])\1$/, '$1') : out
}

export function parseQuery(text: string): Parsed {
  const lower = String(text ?? '').toLowerCase().slice(0, 200)
  const words = lower.split(/[^\p{L}\p{N}&]+/u).filter(Boolean)

  let days: Set<number> | null = null
  const addDays = (d: number[]) => {
    days ??= new Set()
    for (const x of d) days.add(x)
  }
  const today = new Date().getDay()
  if (/\btonight\b|\btoday\b/.test(lower)) addDays([today])
  if (/\btomorrow\b/.test(lower)) addDays([(today + 1) % 7])

  let free: boolean | null = null
  if (/\b(free|no cost|cheap)\b/.test(lower)) free = true
  if (/\b(paid|ticketed)\b/.test(lower)) free = false

  const terms: string[][] = []
  const seen = new Set<string>()
  for (const w of words) {
    if (DAY_WORDS[w]) { addDays(DAY_WORDS[w]); continue }
    if (FILLER.has(w) || w.length < 2 || w.length > 30) continue
    const group = GROUP_OF.get(w) ?? GROUP_OF.get(stem(w))
    const variants = group ?? [w]
    const key = variants[0]
    if (seen.has(key)) continue
    seen.add(key)
    // Listed synonyms are exact; an unknown word also matches its stem.
    const st = stem(w)
    terms.push(group ? group : st.length >= 4 && st !== w ? [w, st] : [w])
    if (terms.length >= 6) break
  }

  return { terms, days: days ? [...(days as Set<number>)].sort() : null, free }
}

/** True when `variant` appears in `hay` as the start of a word. */
function hasWord(hay: string, variant: string): boolean {
  let i = hay.indexOf(variant)
  while (i !== -1) {
    if (i === 0 || !/[\p{L}\p{N}]/u.test(hay[i - 1])) return true
    i = hay.indexOf(variant, i + 1)
  }
  return false
}

/**
 * How many of the things asked for a circle's text covers. Name and category
 * hits count double, so "chess" ranks Thursday Chess above a social club
 * that mentions chess once in its description.
 */
export function scoreText(
  fields: { name?: string | null; category?: string | null; description?: string | null; place?: string | null },
  parsed: Parsed
): number {
  if (!parsed.terms.length) return 1
  const strong = `${fields.name ?? ''} ${fields.category ?? ''}`.toLowerCase()
  const weak = `${fields.description ?? ''} ${fields.place ?? ''}`.toLowerCase()
  let score = 0
  for (const variants of parsed.terms) {
    if (variants.some((v) => hasWord(strong, v))) score += 2
    // Short words only count in the name or category: in prose they are
    // usually something else ("run by volunteers", "a bar nearby").
    else if (variants.some((v) => v.length >= 5 && hasWord(weak, v))) score += 1
  }
  return score
}

export function meetsOn(days: number[] | null | undefined, wanted: number[] | null): boolean {
  if (!wanted) return true
  return (days ?? []).some((d) => wanted.includes(d))
}

export function costOk(isFree: boolean | null | undefined, wanted: boolean | null): boolean {
  if (wanted === null) return true
  // Circles with no cost set are treated as free: that's what the app shows.
  return wanted ? isFree !== false : isFree === false
}
