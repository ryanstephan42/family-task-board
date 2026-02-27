import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../auth';

const router = Router();
const prisma = new PrismaClient();

// Get events
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        creator: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create event
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { title, description, startTime, endTime, location, isRepeating, repeatFrequency, color } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.sendStatus(401);

  try {
    const event = await prisma.event.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        location,
        isRepeating: !!isRepeating,
        repeatFrequency: isRepeating ? repeatFrequency : null,
        color: color || '#0ea5e9',
        creatorId: userId,
      },
    });
    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create event' });
  }
});

// Delete event
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.event.delete({ where: { id: id as string } });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete event' });
  }
});

export default router;
