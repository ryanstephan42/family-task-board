import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';

const router = Router();

function readRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new Error(`${field} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value.trim();
}

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      setupRequired: userCount === 0,
      registrationEnabled: userCount === 0,
    });
  } catch (error) {
    console.error('Failed to read setup status', error);
    res.status(503).json({ error: 'Setup status is unavailable' });
  }
});

router.post('/bootstrap', async (req: Request, res: Response) => {
  try {
    const householdName = readRequiredString(req.body.householdName, 'householdName', 100);
    const timezone = readRequiredString(req.body.timezone || 'UTC', 'timezone', 100);
    const username = readRequiredString(req.body.username, 'username', 50);
    const name = readRequiredString(req.body.name, 'name', 100);
    const password = readRequiredString(req.body.password, 'password', 200);

    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.count();
      if (existingUser > 0) {
        return null;
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const household = await transaction.household.create({
        data: { name: householdName, timezone },
      });
      const user = await transaction.user.create({
        data: { username, password: hashedPassword, name },
      });
      await transaction.membership.create({
        data: { userId: user.id, householdId: household.id, role: 'OWNER' },
      });
      await transaction.chatChannel.create({
        data: { householdId: household.id, name: 'general' },
      });
      await transaction.budgetCategory.createMany({
        data: [
          { householdId: household.id, name: 'Housing' },
          { householdId: household.id, name: 'Food' },
          { householdId: household.id, name: 'Transport' },
          { householdId: household.id, name: 'Utilities' },
          { householdId: household.id, name: 'Other' },
        ],
      });

      return { household, user };
    });

    if (!result) {
      return res.status(409).json({ error: 'This deployment has already been initialized' });
    }

    res.status(201).json({
      household: {
        id: result.household.id,
        name: result.household.name,
        timezone: result.household.timezone,
      },
      owner: {
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
      },
    });
  } catch (error) {
    console.error('Failed to bootstrap deployment', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to initialize deployment' });
  }
});

export default router;
