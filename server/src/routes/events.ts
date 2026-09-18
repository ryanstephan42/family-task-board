import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth';
import { prisma } from '../db';

const router = Router();

// Get events
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.householdId) return res.status(403).json({ error: 'Household membership is required' });
    const events = await prisma.event.findMany({
      where: { householdId: req.user.householdId },
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
  const householdId = req.user?.householdId;

  if (!userId || !householdId) return res.status(403).json({ error: 'Household membership is required' });

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
        householdId,
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
  const householdId = req.user?.householdId;
  if (!householdId) return res.status(403).json({ error: 'Household membership is required' });
  try {
    const event = await prisma.event.findFirst({ where: { id: id as string, householdId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await prisma.event.delete({ where: { id: event.id } });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete event' });
  }
});

export default router;
