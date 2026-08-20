import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../auth';
import { isMealieConfigured, fetchAllRecipes, fetchRecipeDetail } from '../mealieClient';
import { findBestInventoryMatch } from '../ingredientMatch';

const router = Router();
const prisma = new PrismaClient();

// Simple status check the client can use to show "Mealie is offline"
// messaging instead of erroring out.
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isMealieConfigured()) {
    return res.json({ configured: false, online: false });
  }
  try {
    await fetchAllRecipes();
    res.json({ configured: true, online: true });
  } catch (error) {
    res.json({ configured: true, online: false, error: (error as Error).message });
  }
});

// List recipes from Mealie (name/slug/image only - lightweight for a list view).
router.get('/recipes', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isMealieConfigured()) {
    return res.status(503).json({ error: 'Mealie is not configured', configured: false });
  }
  try {
    const recipes = await fetchAllRecipes();
    res.json(recipes);
  } catch (error) {
    console.error('Mealie fetch failed:', error);
    res.status(502).json({ error: 'Could not reach Mealie - is it running?', configured: true, online: false });
  }
});

// For a given recipe, match its ingredients against current inventory and
// report what's on hand vs. missing - the core "what can I make" logic.
router.get('/recipes/:slug/match', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isMealieConfigured()) {
    return res.status(503).json({ error: 'Mealie is not configured', configured: false });
  }
  const slug = req.params.slug as string;

  try {
    const [recipe, inventory] = await Promise.all([
      fetchRecipeDetail(slug),
      prisma.foodItem.findMany({ select: { id: true, name: true, quantity: true, unit: true } }),
    ]);

    const matches = await Promise.all(
      recipe.ingredients
        .filter((ing) => ing.name.trim().length > 0)
        .map(async (ing) => {
          const { item, confidence, isManualLink } = await findBestInventoryMatch(
            prisma,
            slug,
            ing.name,
            inventory
          );
          return {
            ingredient: ing.name,
            originalText: ing.originalText,
            haveIt: Boolean(item),
            matchedItem: item ? { id: item.id, name: item.name, quantity: item.quantity, unit: item.unit } : null,
            confidence,
            isManualLink,
          };
        })
    );

    const missingCount = matches.filter((m) => !m.haveIt).length;

    res.json({
      recipe: { slug: recipe.slug, name: recipe.name, image: recipe.image },
      matches,
      missingCount,
      canMake: missingCount === 0,
    });
  } catch (error) {
    console.error('Mealie ingredient match failed:', error);
    res.status(502).json({ error: 'Could not reach Mealie - is it running?', configured: true, online: false });
  }
});

// Check ALL recipes against inventory in one call, so the client can show a
// sorted "what can I make right now" / "closest matches" list without an
// N-request waterfall per recipe.
router.get('/what-can-i-make', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!isMealieConfigured()) {
    return res.status(503).json({ error: 'Mealie is not configured', configured: false });
  }
  try {
    const [recipes, inventory] = await Promise.all([
      fetchAllRecipes(),
      prisma.foodItem.findMany({ select: { id: true, name: true, quantity: true, unit: true } }),
    ]);

    const results = await Promise.all(
      recipes.map(async (summary) => {
        try {
          const recipe = await fetchRecipeDetail(summary.slug);
          const usable = recipe.ingredients.filter((ing) => ing.name.trim().length > 0);
          if (usable.length === 0) {
            return { slug: recipe.slug, name: recipe.name, image: recipe.image, missingCount: null, totalIngredients: 0 };
          }
          const matches = await Promise.all(
            usable.map((ing) => findBestInventoryMatch(prisma, summary.slug, ing.name, inventory))
          );
          const missingCount = matches.filter((m) => !m.item).length;
          return {
            slug: recipe.slug,
            name: recipe.name,
            image: recipe.image,
            missingCount,
            totalIngredients: usable.length,
          };
        } catch (err) {
          console.error(`Failed to check recipe ${summary.slug}:`, err);
          return { slug: summary.slug, name: summary.name, image: summary.image, missingCount: null, totalIngredients: 0 };
        }
      })
    );

    // Sort by fewest missing ingredients first (ready-to-cook recipes on top).
    results.sort((a, b) => {
      if (a.missingCount === null) return 1;
      if (b.missingCount === null) return -1;
      return a.missingCount - b.missingCount;
    });

    res.json(results);
  } catch (error) {
    console.error('Mealie what-can-i-make failed:', error);
    res.status(502).json({ error: 'Could not reach Mealie - is it running?', configured: true, online: false });
  }
});

// Manually link a recipe ingredient's text to a specific inventory item
// name, for cases where the auto-match misses (e.g. brand-specific naming).
router.post('/recipes/:slug/link', authenticateToken, async (req: AuthRequest, res: Response) => {
  const slug = req.params.slug as string;
  const { ingredientName, inventoryItemName } = req.body;

  if (!ingredientName || !inventoryItemName) {
    return res.status(400).json({ error: 'ingredientName and inventoryItemName are required' });
  }

  try {
    const link = await prisma.mealieIngredientLink.upsert({
      where: { recipeSlug_ingredientName: { recipeSlug: slug, ingredientName } },
      update: { inventoryItemName },
      create: { recipeSlug: slug, ingredientName, inventoryItemName },
    });
    res.status(201).json(link);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to save ingredient link' });
  }
});

// Remove a manual ingredient link (falls back to auto-fuzzy-matching again).
router.delete('/recipes/:slug/link/:ingredientName', authenticateToken, async (req: AuthRequest, res: Response) => {
  const slug = req.params.slug as string;
  const ingredientName = decodeURIComponent(req.params.ingredientName as string);

  try {
    await prisma.mealieIngredientLink.delete({
      where: { recipeSlug_ingredientName: { recipeSlug: slug, ingredientName } },
    });
    res.json({ message: 'Link removed' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to remove link' });
  }
});

export default router;
