import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../auth';
import { resolveCategory, resolveUnit, suggestExpirationDate } from '../categorize';

const router = Router();
const prisma = new PrismaClient();

// Get all grocery items
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.groceryItem.findMany({
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

  try {
    const createdItems = await Promise.all(
      items.map(async (item: any) => {
        const category = await resolveCategory(prisma, item.name, item.category);
        return prisma.groceryItem.create({
          data: {
            name: item.name,
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
  const { name, quantity, details, category, completed } = req.body;

  try {
    const item = await prisma.groceryItem.update({
      where: { id },
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
        where: { itemName: name.toLowerCase().trim() },
        update: { category },
        create: { itemName: name.toLowerCase().trim(), category },
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

  try {
    await prisma.groceryItem.delete({ where: { id } });
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

  try {
    const groceryItem = await prisma.groceryItem.findUnique({ where: { id } });
    if (!groceryItem) return res.status(404).json({ error: 'Grocery item not found' });

    const category = await resolveCategory(prisma, groceryItem.name, groceryItem.category);
    const unit = await resolveUnit(prisma, groceryItem.name, undefined, category);
    const purchaseDate = new Date();
    const foodItem = await prisma.foodItem.create({
      data: {
        name: groceryItem.name,
        quantity: 1,
        unit,
        category,
        location: location || 'Pantry',
        purchaseDate,
        expirationDate: suggestExpirationDate(category, purchaseDate),
        notes: groceryItem.details || groceryItem.quantity || null,
      },
    });

    await prisma.groceryItem.delete({ where: { id } });

    res.status(201).json(foodItem);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to move item to inventory' });
  }
});

// Get category preferences
router.get('/preferences', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const preferences = await prisma.itemCategoryPreference.findMany();
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

export default router;
