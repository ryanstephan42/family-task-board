import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../auth';

const router = Router();
const prisma = new PrismaClient();

// Get tasks based on type or assignedToMe
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { type, assignedToMe, status } = req.query; // FAMILY, PRIVATE, CHORE
  const userId = req.user?.id;

  try {
    const where: any = {};
    
    if (assignedToMe === 'true') {
      where.assigneeId = userId;
    } else if (type) {
      where.type = type as string;
      if (type === 'PRIVATE') {
        where.creatorId = userId;
      }
    }

    if (status === 'DONE') {
      where.status = 'DONE';
    } else {
      where.status = { not: 'DONE' };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        steps: true,
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { title, description, type, priority, dueDate, assigneeId, steps, isRepeating, repeatFrequency } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.sendStatus(401);

  try {
    // If it's a private task, it MUST be assigned to the creator
    // Also if no assignee is provided and it's MY_TASKS (logic handled in frontend)
    const effectiveAssigneeId = type === 'PRIVATE' ? userId : (assigneeId || null);

    const task = await prisma.task.create({
      data: {
        title,
        description,
        type,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        isRepeating: !!isRepeating,
        repeatFrequency: isRepeating ? repeatFrequency : null,
        creatorId: userId,
        assigneeId: effectiveAssigneeId,
        steps: {
          create: steps?.map((s: string) => ({ content: s })) || [],
        },
      },
      include: {
        steps: true,
      },
    });
    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, status, priority, assigneeId, dueDate, isRepeating, repeatFrequency } = req.body;

  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        status,
        priority,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        isRepeating,
        repeatFrequency: isRepeating ? repeatFrequency : null,
      },
    });
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.id;

  // Check if it's a private task and if the user is the creator
  const task = await prisma.task.findUnique({ where: { id } });
  if (task?.type === 'PRIVATE' && task.creatorId !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await prisma.task.delete({ where: { id } });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete task' });
  }
});

// Toggle step completion
router.patch('/:taskId/steps/:stepId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const stepId = req.params.stepId as string;
  const { completed } = req.body;

  try {
    const step = await prisma.step.update({
      where: { id: stepId },
      data: { completed },
    });
    res.json(step);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update step' });
  }
});

export default router;
