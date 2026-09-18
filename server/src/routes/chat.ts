import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireHouseholdMembership } from '../auth';
import { prisma } from '../db';

const router = Router();
router.use(authenticateToken, requireHouseholdMembership);

router.get('/channels', async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId!;
  const channels = await prisma.chatChannel.findMany({
    where: { householdId },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 }, readStates: { where: { userId: req.user!.id } } },
    orderBy: { createdAt: 'asc' },
  });
  const result = channels.map(({ messages, readStates, ...channel }) => ({
    ...channel,
    unread: Boolean(messages[0] && (!readStates[0] || messages[0].createdAt > readStates[0].readAt)),
  }));
  res.json(result);
});

router.post('/channels', async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId!;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 80) return res.status(400).json({ error: 'Channel name is required' });
  try {
    const channel = await prisma.chatChannel.create({ data: { householdId, name } });
    res.status(201).json(channel);
  } catch {
    res.status(409).json({ error: 'A channel with that name already exists' });
  }
});

router.get('/channels/:channelId/messages', async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const channel = await prisma.chatChannel.findFirst({ where: { id: channelId, householdId: req.user!.householdId } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  const messages = await prisma.chatMessage.findMany({
    where: { channelId: channel.id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  await prisma.chatReadState.upsert({
    where: { channelId_userId: { channelId: channel.id, userId: req.user!.id } },
    update: { readAt: new Date() },
    create: { channelId: channel.id, userId: req.user!.id },
  });
  res.json(messages);
});

router.post('/channels/:channelId/messages', async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 4000) return res.status(400).json({ error: 'Message body is required' });
  const channel = await prisma.chatChannel.findFirst({ where: { id: channelId, householdId: req.user!.householdId } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  const message = await prisma.chatMessage.create({
    data: { channelId: channel.id, authorId: req.user!.id, body },
    include: { author: { select: { id: true, name: true } } },
  });
  res.status(201).json(message);
});

router.delete('/channels/:channelId/messages/:messageId', async (req: AuthRequest, res: Response) => {
  const channelId = req.params.channelId as string;
  const messageId = req.params.messageId as string;
  const channel = await prisma.chatChannel.findFirst({ where: { id: channelId, householdId: req.user!.householdId } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  const message = await prisma.chatMessage.findFirst({ where: { id: messageId, channelId } });
  if (!message) return res.status(404).json({ error: 'Message not found' });
  const membership = await prisma.membership.findFirst({ where: { userId: req.user!.id, householdId: req.user!.householdId } });
  if (message.authorId !== req.user!.id && membership?.role !== 'OWNER') {
    return res.status(403).json({ error: 'Only the author or household owner can delete a message' });
  }
  await prisma.chatMessage.delete({ where: { id: message.id } });
  res.json({ message: 'Message deleted' });
});

export default router;
