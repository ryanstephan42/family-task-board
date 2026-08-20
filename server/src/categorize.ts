import { PrismaClient } from '@prisma/client';

// Keyword -> category map used as a fallback "smart" categorizer for
// grocery / inventory items before any user-specific preference exists.
const KEYWORD_CATEGORIES: { category: string; keywords: string[] }[] = [
  {
    category: 'Dairy & Eggs',
    keywords: [
      'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'egg',
      'sour cream', 'cottage cheese', 'half and half', 'creamer',
    ],
  },
  {
    category: 'Produce',
    keywords: [
      'apple', 'banana', 'orange', 'grape', 'lettuce', 'spinach', 'kale',
      'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery', 'pepper',
      'cucumber', 'broccoli', 'cauliflower', 'avocado', 'lemon', 'lime',
      'berries', 'strawberry', 'blueberry', 'mushroom', 'squash', 'zucchini',
      'fruit', 'vegetable', 'salad',
    ],
  },
  {
    category: 'Meat & Seafood',
    keywords: [
      'chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham',
      'steak', 'ground beef', 'fish', 'salmon', 'shrimp', 'tuna', 'crab',
      'lamb', 'meatball',
    ],
  },
  {
    category: 'Frozen',
    keywords: ['frozen', 'ice cream', 'popsicle', 'freezer'],
  },
  {
    category: 'Bakery',
    keywords: ['bread', 'bagel', 'muffin', 'roll', 'tortilla', 'bun', 'croissant', 'cake', 'pastry'],
  },
  {
    category: 'Pantry & Canned',
    keywords: [
      'rice', 'pasta', 'noodle', 'bean', 'canned', 'soup', 'sauce',
      'flour', 'sugar', 'oil', 'vinegar', 'cereal', 'oat', 'peanut butter',
      'jam', 'jelly', 'honey', 'spice', 'salt', 'pepper corn', 'broth',
      'stock', 'ketchup', 'mustard', 'mayo', 'mayonnaise',
    ],
  },
  {
    category: 'Snacks',
    keywords: ['chips', 'cracker', 'cookie', 'candy', 'chocolate', 'popcorn', 'pretzel', 'granola', 'nuts'],
  },
  {
    category: 'Beverages',
    keywords: ['soda', 'juice', 'water', 'coffee', 'tea', 'beer', 'wine', 'drink', 'lemonade'],
  },
  {
    category: 'Household',
    keywords: ['paper towel', 'toilet paper', 'detergent', 'soap', 'cleaner', 'trash bag', 'foil', 'wrap', 'napkin'],
  },
];

/**
 * Guess a category for an item name using simple keyword matching.
 * Falls back to 'General' when nothing matches.
 */
export function guessCategory(name: string): string {
  const normalized = name.toLowerCase();
  for (const { category, keywords } of KEYWORD_CATEGORIES) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return category;
    }
  }
  return 'General';
}

/**
 * Resolve the best category for an item, preferring a learned
 * ItemCategoryPreference (from prior user edits) over the keyword guess.
 */
export async function resolveCategory(
  prisma: PrismaClient,
  name: string,
  explicitCategory?: string | null
): Promise<string> {
  if (explicitCategory) return explicitCategory;

  const pref = await prisma.itemCategoryPreference.findUnique({
    where: { itemName: name.toLowerCase().trim() },
  });
  if (pref) return pref.category;

  return guessCategory(name);
}

// Rough shelf-life guesses (in days from purchase) per category, used to
// auto-suggest an expiration date for inventory items when none is given.
const DEFAULT_SHELF_LIFE_DAYS: Record<string, number> = {
  'Dairy & Eggs': 14,
  'Produce': 7,
  'Meat & Seafood': 4,
  'Frozen': 180,
  'Bakery': 7,
  'Pantry & Canned': 365,
  'Snacks': 120,
  'Beverages': 180,
  'Household': 3650,
  'General': 30,
};

export function suggestExpirationDate(category: string, purchaseDate: Date = new Date()): Date {
  const days = DEFAULT_SHELF_LIFE_DAYS[category] ?? DEFAULT_SHELF_LIFE_DAYS.General;
  const date = new Date(purchaseDate);
  date.setDate(date.getDate() + days);
  return date;
}

// Common, sensible units offered in the UI (customizable - users can also
// type any free-text unit, which then gets remembered per item name).
export const COMMON_UNITS = [
  'count', 'lbs', 'oz', 'g', 'kg', 'bags', 'boxes', 'cans', 'bottles',
  'cartons', 'gallons', 'quarts', 'liters', 'packs', 'rolls', 'dozen', 'loaf',
];

// Keyword -> unit map so a freshly-added item gets a sensible default unit
// (e.g. "chicken breast" -> lbs, "eggs" -> dozen) before any per-item memory
// exists. Checked in order, first match wins.
const UNIT_KEYWORD_MAP: { unit: string; keywords: string[] }[] = [
  { unit: 'dozen', keywords: ['egg'] },
  { unit: 'gallon', keywords: ['milk', 'apple juice', 'orange juice'] },
  { unit: 'loaf', keywords: ['bread'] },
  {
    unit: 'count',
    keywords: [
      'apple', 'banana', 'orange', 'lemon', 'lime', 'avocado', 'tomato',
      'cucumber', 'onion', 'potato', 'bell pepper',
    ],
  },
  {
    unit: 'lbs',
    keywords: [
      'chicken', 'beef', 'pork', 'turkey', 'steak', 'ground beef', 'fish',
      'salmon', 'shrimp', 'meat', 'bacon', 'sausage', 'ham',
    ],
  },
  { unit: 'bags', keywords: ['frozen', 'chips', 'pretzel', 'rice', 'sugar', 'flour', 'popcorn'] },
  { unit: 'cans', keywords: ['soup', 'canned', 'beans', 'tuna', 'soda'] },
  { unit: 'bottles', keywords: ['water', 'juice', 'wine', 'beer', 'ketchup', 'oil', 'vinegar'] },
  { unit: 'rolls', keywords: ['paper towel', 'toilet paper'] },
];

// Fallback default unit per category when no keyword or learned
// preference matches.
const CATEGORY_DEFAULT_UNIT: Record<string, string> = {
  'Dairy & Eggs': 'count',
  'Produce': 'lbs',
  'Meat & Seafood': 'lbs',
  'Frozen': 'bags',
  'Bakery': 'count',
  'Pantry & Canned': 'boxes',
  'Snacks': 'bags',
  'Beverages': 'bottles',
  'Household': 'count',
  'General': 'count',
};

export function guessUnit(name: string, category?: string): string {
  const normalized = name.toLowerCase();
  for (const { unit, keywords } of UNIT_KEYWORD_MAP) {
    if (keywords.some((kw) => normalized.includes(kw))) return unit;
  }
  return CATEGORY_DEFAULT_UNIT[category || 'General'] || 'count';
}

/**
 * Resolve the best unit for an item, preferring an explicit value, then a
 * learned ItemUnitPreference (remembered from a prior edit), then a
 * keyword/category-based smart guess.
 */
export async function resolveUnit(
  prisma: PrismaClient,
  name: string,
  explicitUnit?: string | null,
  category?: string
): Promise<string> {
  if (explicitUnit) return explicitUnit;

  const pref = await prisma.itemUnitPreference.findUnique({
    where: { itemName: name.toLowerCase().trim() },
  });
  if (pref) return pref.unit;

  return guessUnit(name, category);
}

/**
 * Remember a user's chosen unit for this item name so future adds/scans
 * default to it automatically.
 */
export async function rememberUnit(prisma: PrismaClient, name: string, unit: string): Promise<void> {
  await prisma.itemUnitPreference.upsert({
    where: { itemName: name.toLowerCase().trim() },
    update: { unit },
    create: { itemName: name.toLowerCase().trim(), unit },
  });
}

/** Whether an item's quantity has dropped to/below its configured par level. */
export function computeLowStock(quantity: number, parLevel: number | null | undefined): boolean {
  if (parLevel === null || parLevel === undefined) return false;
  return quantity <= parLevel;
}

/**
 * Days remaining until expiration (negative = already expired), or null if
 * there's no date to compare against.
 */
export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Expiration urgency bucket used by the client to color-code items:
// red = expired or expiring within 3 days, yellow = within 2 weeks,
// green = everything else / not tracked.
export type ExpirationUrgency = 'red' | 'yellow' | 'green' | null;

export function expirationUrgency(date: Date | null | undefined): ExpirationUrgency {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days <= 3) return 'red';
  if (days <= 14) return 'yellow';
  return 'green';
}
