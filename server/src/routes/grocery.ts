import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth';
import { prisma } from '../db';
import { resolveCategory, resolveUnit, suggestExpirationDate } from '../categorize';

const router = Router();

// Get all grocery items
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.householdId) return res.status(403).json({ error: 'Household membership is required' });
    const items = await prisma.groceryItem.findMany({
      where: { householdId: req.user.householdId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch grocery items' });
  }
});

// Create grocery items (bulk supported)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { items } = req.body; // Array of { name, quantity, details, category }

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required' });
  }
  if (!req.user?.householdId) return res.status(403).json({ error: 'Household membership is required' });

  try {
    const createdItems = await Promise.all(
      items.map(async (item: any) => {
        const category = await resolveCategory(prisma, item.name, req.user!.householdId!, item.category);
        return prisma.groceryItem.create({
          data: {
            name: item.name,
            householdId: req.user!.householdId,
            quantity: item.quantity || null,
            details: item.details || null,
            category,
          },
        });
      })
    );
    res.status(201).json(createdItems);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create grocery items' });
  }
});

// Update grocery item
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const householdId = req.user?.householdId;
  const { name, quantity, details, category, completed } = req.body;

  try {
    if (!householdId) return res.status(403).json({ error: 'Household membership is required' });
    const existingItem = await prisma.groceryItem.findFirst({ where: { id, householdId } });
    if (!existingItem) return res.status(404).json({ error: 'Grocery item not found' });
    const item = await prisma.groceryItem.update({
      where: { id: existingItem.id },
      data: {
        name,
        quantity,
        details,
        category,
        completed,
      },
    });

    // If a category was provided, update the preference
    if (name && category) {
      await prisma.itemCategoryPreference.upsert({
        where: { householdId_itemName: { householdId, itemName: name.toLowerCase().trim() } },
        update: { category },
        create: { householdId, itemName: name.toLowerCase().trim(), category },
      });
    }

    res.json(item);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update grocery item' });
  }
});

// Delete grocery item
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const householdId = req.user?.householdId;

  try {
    if (!householdId) return res.status(403).json({ error: 'Household membership is required' });
    const item = await prisma.groceryItem.findFirst({ where: { id, householdId } });
    if (!item) return res.status(404).json({ error: 'Grocery item not found' });
    await prisma.groceryItem.delete({ where: { id: item.id } });
    res.json({ message: 'Grocery item deleted' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete grocery item' });
  }
});

// Mark a grocery item as purchased: move it into the food inventory
// (stamping today as the purchase date) and remove it from the list.
router.post('/:id/purchase', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { location } = req.body || {};
  const householdId = req.user?.householdId;

  try {
    if (!householdId) return res.status(403).json({ error: 'Household membership is required' });
    const groceryItem = await prisma.groceryItem.findFirst({ where: { id, householdId } });
    if (!groceryItem) return res.status(404).json({ error: 'Grocery item not found' });

    const category = await resolveCategory(prisma, groceryItem.name, householdId, groceryItem.category);
    const unit = await resolveUnit(prisma, groceryItem.name, householdId, undefined, category);
    const purchaseDate = new Date();
    const foodItem = await prisma.foodItem.create({
      data: {
        name: groceryItem.name,
        householdId,
        quantity: 1,
        unit,
        category,
        location: location || 'Pantry',
        purchaseDate,
        expirationDate: suggestExpirationDate(category, purchaseDate),
        notes: groceryItem.details || groceryItem.quantity || null,
      },
    });

    await prisma.groceryItem.delete({ where: { id: groceryItem.id } });

    res.status(201).json(foodItem);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to move item to inventory' });
  }
});

// Suggest grocery-list additions based on items currently running low in
// inventory (at/below their par level). Purely a read - the client decides
// which suggestions to actually add to the list.
router.get('/suggestions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.householdId) return res.status(403).json({ error: 'Household membership is required' });
    const lowItems = await prisma.foodItem.findMany({
      where: { householdId: req.user.householdId, OR: [{ lowStock: true }, { parLevel: { not: null } } ] },
    });
    const existingGroceryNames = new Set(
      (await prisma.groceryItem.findMany({ where: { householdId: req.user.householdId, completed: false } })).map((g) =>
        g.name.toLowerCase().trim()
      )
    );

    const suggestions = lowItems
      .filter((i) => i.lowStock || (i.parLevel !== null && i.quantity <= i.parLevel))
      .filter((i) => !existingGroceryNames.has(i.name.toLowerCase().trim()))
      .map((i) => ({
        name: i.name,
        category: i.category,
        quantity: i.unit ? `${i.parLevel ?? 1} ${i.unit}` : undefined,
        reason: `Running low (${i.quantity}${i.unit ? ` ${i.unit}` : ''} left, par ${i.parLevel})`,
      }));

    res.json(suggestions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Get category preferences
router.get('/preferences', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.householdId) return res.status(403).json({ error: 'Household membership is required' });
    const preferences = await prisma.itemCategoryPreference.findMany({ where: { householdId: req.user.householdId } });
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

export default router;
