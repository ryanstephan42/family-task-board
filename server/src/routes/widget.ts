import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../auth';

const router = Router();
const prisma = new PrismaClient();

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// Create (or rotate) the caller's read-only widget token. The plaintext is
// returned once; only its hash is stored.
router.post('/token', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) return res.sendStatus(401);
  const token = 'fw_' + crypto.randomBytes(32).toString('hex');
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { widgetTokenHash: hashToken(token) },
    });
    res.json({ token });
  } catch {
    res.status(500).json({ error: 'Failed to create widget token' });
  }
});

// Revoke the caller's widget token.
router.delete('/token', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) return res.sendStatus(401);
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { widgetTokenHash: null } });
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Failed to revoke widget token' });
  }
});

// Read-only: open tasks assigned to the token's owner (for iOS widgets).
router.get('/tasks', async (req, res) => {
  const header = req.headers['authorization'];
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.sendStatus(401);

  try {
    const user = await prisma.user.findUnique({ where: { widgetTokenHash: hashToken(token) } });
    if (!user) return res.sendStatus(403);

    const tasks = await prisma.task.findMany({
      where: { assigneeId: user.id, status: { not: 'DONE' } },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, type: true },
    });
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    tasks.sort((a, b) => {
      const ad = a.dueDate ? a.dueDate.getTime() : Infinity;
      const bd = b.dueDate ? b.dueDate.getTime() : Infinity;
      if (ad !== bd) return ad < bd ? -1 : 1;
      return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
    });
    res.set('Cache-Control', 'no-store');
    res.json({ user: { name: user.name }, tasks });
  } catch {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

export default router;
