import { Router, Response } from 'express';
import fs from 'fs/promises';
import { authenticateToken, AuthRequest, requireHouseholdMembership } from '../auth';
import { prisma } from '../db';
import { UPLOADS_DIR } from '../uploads';

const router = Router();
router.get('/', authenticateToken, requireHouseholdMembership, async (_req: AuthRequest, res: Response) => {
  let database = 'ok';
  let uploads = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Diagnostics database check failed', error);
    database = 'error';
  }
  try {
    await fs.access(UPLOADS_DIR);
  } catch (error) {
    console.error('Diagnostics upload storage check failed', error);
    uploads = 'error';
  }
  const healthy = database === 'ok' && uploads === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    database,
    uploads,
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
