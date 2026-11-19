/**
 * The circle categories, in the order the pickers and filters show them.
 * One list for create, edit and Explore, so a new category is one line.
 * The database doesn't constrain category, so older values still display.
 */
export const CATEGORIES = [
  'Music',
  'Sports',
  'Food & Drink',
  'Arts & Culture',
  'Outdoors',
  'Tech',
  'Trivia',
  'Social',
  'Other',
] as const
