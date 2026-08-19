import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../auth';
import { resolveCategory, suggestExpirationDate } from '../categorize';

const router = Router();
const prisma = new PrismaClient();

// Get all inventory items (optionally filter by location or category)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { location, category } = req.query;
    const items = await prisma.foodItem.findMany({
      where: {
        ...(location ? { location: String(location) } : {}),
        ...(category ? { category: String(category) } : {}),
      },
      orderBy: { purchaseDate: 'desc' },
    });
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
});

// Add items to inventory (bulk supported). purchaseDate is always
// auto-stamped to "now" unless explicitly provided (e.g. receipt scan
// with a known purchase date).
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { items } = req.body; // Array of { name, quantity, unit, category, location, expirationDate, purchaseDate, notes }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  try {
    const createdItems = await Promise.all(
      items.map(async (item: any) => {
        const category = await resolveCategory(prisma, item.name, item.category);
        const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : new Date();
        const expirationDate = item.expirationDate
          ? new Date(item.expirationDate)
          : suggestExpirationDate(category, purchaseDate);

        return prisma.foodItem.create({
          data: {
            name: item.name,
            quantity: item.quantity !== undefined && item.quantity !== null && item.quantity !== ''
              ? Number(item.quantity)
              : 1,
            unit: item.unit || null,
            category,
            location: item.location || 'Pantry',
            purchaseDate,
            expirationDate,
            notes: item.notes || null,
          },
        });
      })
    );
    res.status(201).json(createdItems);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create inventory items' });
  }
});

// Update an inventory item (quantity, location, category, etc.)
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, quantity, unit, category, location, purchaseDate, expirationDate, notes, lowStock } = req.body;

  try {
    const item = await prisma.foodItem.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(purchaseDate !== undefined ? { purchaseDate: new Date(purchaseDate) } : {}),
        ...(expirationDate !== undefined ? { expirationDate: expirationDate ? new Date(expirationDate) : null } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(lowStock !== undefined ? { lowStock } : {}),
      },
    });

    // Learn the category preference for next time, same pattern grocery uses.
    if (name && category) {
      await prisma.itemCategoryPreference.upsert({
        where: { itemName: name.toLowerCase().trim() },
        update: { category },
        create: { itemName: name.toLowerCase().trim(), category },
      });
    }

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update inventory item' });
  }
});

// Quick +/- quantity adjustment (used for "use up" / restock taps in the UI)
router.patch('/:id/quantity', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { delta } = req.body; // e.g. -1 or +1

  try {
    const existing = await prisma.foodItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const newQuantity = Math.max(0, existing.quantity + Number(delta || 0));
    const item = await prisma.foodItem.update({
      where: { id },
      data: { quantity: newQuantity },
    });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to adjust quantity' });
  }
});

// Remove an inventory item (e.g. used up / thrown out)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    await prisma.foodItem.delete({ where: { id } });
    res.json({ message: 'Inventory item removed' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to remove inventory item' });
  }
});

export default router;
