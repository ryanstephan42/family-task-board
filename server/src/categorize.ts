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
