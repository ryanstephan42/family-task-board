import { PrismaClient } from '@prisma/client';
import { guessCategory, guessUnit } from './categorize';

export interface BarcodeProduct {
  barcode: string;
  name: string;
  category: string | null;
  unit: string | null;
  source: 'memory' | 'openfoodfacts';
}

// Open Food Facts is a free, keyless, community-run product database -
// good enough coverage for packaged groceries without requiring any API key
// or paid signup from the user.
const OFF_API_URL = 'https://world.openfoodfacts.org/api/v2/product';

async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const res = await fetch(`${OFF_API_URL}/${encodeURIComponent(barcode)}.json`);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const name: string | undefined = data.product.product_name || data.product.generic_name;
    if (!name) return null;

    const offCategory: string | undefined = data.product.categories_tags?.[0]
      ?.replace(/^[a-z]{2}:/, '')
      ?.replace(/-/g, ' ');

    const category = offCategory ? guessCategory(`${name} ${offCategory}`) : guessCategory(name);
    const unit = guessUnit(name, category);

    return { barcode, name, category, unit, source: 'openfoodfacts' };
  } catch (err) {
    console.error('Open Food Facts lookup failed:', err);
    return null;
  }
}

/**
 * Resolve a scanned barcode to a product name/category/unit. Checks
 * household memory (previously scanned/confirmed barcodes) first so repeat
 * scans are instant and don't depend on the external API, then falls back
 * to the free Open Food Facts database.
 */
export async function resolveBarcodeProduct(
  prisma: PrismaClient,
  barcode: string
): Promise<BarcodeProduct | null> {
  const remembered = await prisma.barcodeProductPreference.findUnique({ where: { barcode } });
  if (remembered) {
    return {
      barcode,
      name: remembered.name,
      category: remembered.category,
      unit: remembered.unit,
      source: 'memory',
    };
  }

  return lookupOpenFoodFacts(barcode);
}

/** Remember a barcode -> product mapping (e.g. after the user confirms/edits it). */
export async function rememberBarcodeProduct(
  prisma: PrismaClient,
  barcode: string,
  name: string,
  category?: string | null,
  unit?: string | null
): Promise<void> {
  await prisma.barcodeProductPreference.upsert({
    where: { barcode },
    update: { name, category: category || null, unit: unit || null },
    create: { barcode, name, category: category || null, unit: unit || null },
  });
}
