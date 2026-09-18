import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
import { authenticateToken, AuthRequest, requireHouseholdMembership } from '../auth';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  const { username, password, name } = req.body;
  try {
    if (await prisma.user.count()) {
      return res.status(403).json({ error: 'Open registration is disabled after setup' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
      },
    });
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({
    where: { username },
    include: { memberships: { select: { householdId: true }, take: 1 } },
  });
  if (!user) return res.status(400).json({ error: 'User not found' });
  if (user.memberships.length === 0) return res.status(403).json({ error: 'Household membership is required' });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign(
    { id: user.id, username: user.username, householdId: user.memberships[0]?.householdId },
    config.jwtSecret
  );
  res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
});

// Get only the members of the current authenticated household.
router.get('/', authenticateToken, requireHouseholdMembership, async (req: AuthRequest, res) => {
  const householdId = req.user?.householdId;

  if (!householdId) {
    return res.status(403).json({ error: 'Household membership is required' });
  }

  const memberships = await prisma.membership.findMany({
    where: { householdId },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(memberships.map((membership) => membership.user));
});

export default router;
