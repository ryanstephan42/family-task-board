import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../auth';
import { resolveCategory, resolveUnit, rememberUnit, suggestExpirationDate, COMMON_UNITS } from '../categorize';
import { UPLOADS_DIR, ensureUploadsDir } from '../uploads';

const router = Router();
const prisma = new PrismaClient();

ensureUploadsDir();
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname) || '.jpg'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

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

// Get the common unit presets plus any units the household has used before,
// so the client can offer a smart, customizable unit picker.
router.get('/unit-options', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const preferences = await prisma.itemUnitPreference.findMany();
    const learnedUnits = preferences.map((p) => p.unit);
    const allUnits = Array.from(new Set([...COMMON_UNITS, ...learnedUnits]));
    res.json({ commonUnits: allUnits, preferences });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch unit options' });
  }
});

// Add items to inventory (bulk supported). purchaseDate is always
// auto-stamped to "now" unless explicitly provided (e.g. receipt scan
// with a known purchase date).
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { items } = req.body; // Array of { name, quantity, unit, category, location, trackExpiration, expirationDate, purchaseDate, notes }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  try {
    const createdItems = await Promise.all(
      items.map(async (item: any) => {
        const category = await resolveCategory(prisma, item.name, item.category);
        const unit = await resolveUnit(prisma, item.name, item.unit, category);
        const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : new Date();
        const trackExpiration = item.trackExpiration !== undefined ? Boolean(item.trackExpiration) : true;
        const expirationDate = !trackExpiration
          ? null
          : item.expirationDate
          ? new Date(item.expirationDate)
          : suggestExpirationDate(category, purchaseDate);

        // If the caller explicitly chose a unit, remember it for next time.
        if (item.unit) {
          await rememberUnit(prisma, item.name, item.unit);
        }

        return prisma.foodItem.create({
          data: {
            name: item.name,
            quantity: item.quantity !== undefined && item.quantity !== null && item.quantity !== ''
              ? Number(item.quantity)
              : 1,
            unit,
            category,
            location: item.location || 'Pantry',
            purchaseDate,
            trackExpiration,
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

// Update an inventory item (quantity, unit, location, category, expiration toggle, etc.)
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, quantity, unit, category, location, purchaseDate, trackExpiration, expirationDate, notes, lowStock } = req.body;

  try {
    const existing = await prisma.foodItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const nextTrackExpiration = trackExpiration !== undefined ? Boolean(trackExpiration) : existing.trackExpiration;
    const nextCategory = category !== undefined ? category : existing.category;

    let nextExpirationDate: Date | null | undefined = undefined;
    if (!nextTrackExpiration) {
      // Toggled off (or staying off): clear the expiration date entirely.
      nextExpirationDate = null;
    } else if (expirationDate !== undefined) {
      nextExpirationDate = expirationDate ? new Date(expirationDate) : null;
    } else if (trackExpiration === true && !existing.trackExpiration) {
      // Just toggled back on with no explicit date: suggest a fresh one.
      nextExpirationDate = suggestExpirationDate(nextCategory, existing.purchaseDate);
    }

    const item = await prisma.foodItem.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(purchaseDate !== undefined ? { purchaseDate: new Date(purchaseDate) } : {}),
        trackExpiration: nextTrackExpiration,
        ...(nextExpirationDate !== undefined ? { expirationDate: nextExpirationDate } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(lowStock !== undefined ? { lowStock } : {}),
      },
    });

    // Learn preferences for next time, same pattern grocery uses.
    if (name && category) {
      await prisma.itemCategoryPreference.upsert({
        where: { itemName: name.toLowerCase().trim() },
        update: { category },
        create: { itemName: name.toLowerCase().trim(), category },
      });
    }
    if (name && unit) {
      await rememberUnit(prisma, name, unit);
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

function deletePhotoFile(photoUrl: string | null) {
  if (!photoUrl) return;
  const filename = path.basename(photoUrl);
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.unlink(filePath, () => {
    /* ignore errors - file may already be gone */
  });
}

// Attach (or replace) a photo for an item - e.g. a snapshot of the product
// itself, taken from a phone camera or uploaded from the browser.
router.post('/:id/photo', authenticateToken, photoUpload.single('photo'), async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  if (!req.file) {
    return res.status(400).json({ error: 'A photo file is required (field name "photo")' });
  }

  try {
    const existing = await prisma.foodItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    deletePhotoFile(existing.photoUrl);

    const item = await prisma.foodItem.update({
      where: { id },
      data: { photoUrl: `/uploads/${req.file.filename}` },
    });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to attach photo' });
  }
});

// Remove a photo from an item
router.delete('/:id/photo', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const existing = await prisma.foodItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    deletePhotoFile(existing.photoUrl);

    const item = await prisma.foodItem.update({
      where: { id },
      data: { photoUrl: null },
    });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to remove photo' });
  }
});

// Remove an inventory item (e.g. used up / thrown out)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const existing = await prisma.foodItem.findUnique({ where: { id } });
    await prisma.foodItem.delete({ where: { id } });
    if (existing) deletePhotoFile(existing.photoUrl);
    res.json({ message: 'Inventory item removed' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to remove inventory item' });
  }
});

export default router;
