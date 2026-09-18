import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { prisma } from './db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    householdId?: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, config.jwtSecret, async (err: any, user: any) => {
    if (err) return res.sendStatus(403);

    if (!user || typeof user.id !== 'string') return res.sendStatus(403);
    try {
      const membership = await prisma.membership.findFirst({
        where: {
          userId: user.id,
          ...(typeof user.householdId === 'string' ? { householdId: user.householdId } : {}),
        },
        select: {
          householdId: true,
          user: { select: { id: true, username: true } },
        },
      });
      if (!membership) return res.sendStatus(403);
      req.user = {
        id: membership.user.id,
        username: membership.user.username,
        householdId: membership.householdId,
      };
    } catch (error) {
      console.error('Failed to validate household membership', error);
      return res.sendStatus(503);
    }
    next();
  });
};

export const requireHouseholdMembership = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.householdId) {
    return res.status(403).json({ error: 'Household membership is required' });
  }

  next();
};
