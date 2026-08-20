import { PrismaClient } from '@prisma/client';

// Words too generic to be useful for matching (measurement/prep noise that
// sometimes leaks into ingredient "name" fields from recipe parsers).
const STOPWORDS = new Set([
  'fresh', 'chopped', 'diced', 'sliced', 'minced', 'ground', 'large', 'small',
  'medium', 'boneless', 'skinless', 'organic', 'of', 'the', 'and', 'a', 'an',
  'to', 'taste', 'for', 'optional', 'or', 'shredded', 'grated', 'whole',
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Very small stemmer: strip trailing "es"/"s" so "tomatoes"/"tomato" and
// "onions"/"onion" line up without a full NLP dependency.
function stem(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Fuzzy-match a Mealie ingredient name against an inventory item name.
 * Returns a 0-1 confidence score based on shared stemmed keywords in
 * either direction (e.g. "chicken breast" ingredient vs "Chicken Breast -
 * Family Pack" inventory item).
 */
export function matchScore(ingredientName: string, inventoryName: string): number {
  const a = new Set(normalize(ingredientName).map(stem));
  const b = new Set(normalize(inventoryName).map(stem));
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const word of a) {
    if (b.has(word)) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
}

export interface InventoryLike {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
}

/**
 * Find the best-matching inventory item for a recipe ingredient, preferring
 * an explicit household-confirmed MealieIngredientLink over the fuzzy guess.
 */
export async function findBestInventoryMatch(
  prisma: PrismaClient,
  recipeSlug: string,
  ingredientName: string,
  inventory: InventoryLike[]
): Promise<{ item: InventoryLike | null; confidence: number; isManualLink: boolean }> {
  const link = await prisma.mealieIngredientLink.findUnique({
    where: { recipeSlug_ingredientName: { recipeSlug, ingredientName } },
  });
  if (link) {
    const item = inventory.find((i) => i.name.toLowerCase().trim() === link.inventoryItemName.toLowerCase().trim());
    if (item) return { item, confidence: 1, isManualLink: true };
  }

  let best: InventoryLike | null = null;
  let bestScore = 0;
  for (const item of inventory) {
    const score = matchScore(ingredientName, item.name);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  // Require at least a 50% keyword overlap to count as a real match -
  // otherwise treat the ingredient as "missing" rather than guessing wrong.
  if (bestScore < 0.5) return { item: null, confidence: 0, isManualLink: false };
  return { item: best, confidence: bestScore, isManualLink: false };
}
