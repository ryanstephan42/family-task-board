import { Router, Response } from 'express';
import express from 'express';
import { authenticateToken, AuthRequest, requireHouseholdMembership } from '../auth';
import { prisma } from '../db';

const router = Router();
router.use(authenticateToken, requireHouseholdMembership);

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

router.get('/categories', async (req: AuthRequest, res: Response) => {
  res.json(await prisma.budgetCategory.findMany({ where: { householdId: req.user!.householdId }, orderBy: { name: 'asc' } }));
});

router.post('/categories', async (req: AuthRequest, res: Response) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 80) return res.status(400).json({ error: 'Category name is required' });
  try {
    res.status(201).json(await prisma.budgetCategory.create({ data: { householdId: req.user!.householdId!, name } }));
  } catch {
    res.status(409).json({ error: 'A category with that name already exists' });
  }
});

router.get('/transactions', async (req: AuthRequest, res: Response) => {
  res.json(await prisma.budgetTransaction.findMany({
    where: { householdId: req.user!.householdId },
    include: { category: true },
    orderBy: { occurredOn: 'desc' },
  }));
});

router.post('/transactions', async (req: AuthRequest, res: Response) => {
  const { description, amountCents, categoryId, occurredOn } = req.body;
  if (typeof description !== 'string' || !description.trim() || !Number.isInteger(amountCents)) {
    return res.status(400).json({ error: 'Description and integer amountCents are required' });
  }
  if (categoryId) {
    const category = await prisma.budgetCategory.findFirst({ where: { id: categoryId, householdId: req.user!.householdId } });
    if (!category) return res.status(400).json({ error: 'Category not found' });
  }
  const transaction = await prisma.budgetTransaction.create({
    data: { householdId: req.user!.householdId!, description: description.trim(), amountCents, categoryId: categoryId || null, occurredOn: occurredOn ? new Date(occurredOn) : undefined },
    include: { category: true },
  });

  router.get('/recurring', async (req: AuthRequest, res: Response) => {
    res.json(await prisma.recurringBudgetEntry.findMany({
      where: { householdId: req.user!.householdId },
      include: { category: true },
      orderBy: { nextDueOn: 'asc' },
    }));
  });

  router.post('/recurring', async (req: AuthRequest, res: Response) => {
    const { description, amountCents, categoryId, frequency, nextDueOn } = req.body;
    if (typeof description !== 'string' || !description.trim() || !Number.isInteger(amountCents) || !['WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency)) {
      return res.status(400).json({ error: 'Description, integer amountCents, frequency, and nextDueOn are required' });
    }
    const dueDate = new Date(nextDueOn);
    if (Number.isNaN(dueDate.getTime())) return res.status(400).json({ error: 'Invalid nextDueOn date' });
    if (categoryId && !await prisma.budgetCategory.findFirst({ where: { id: categoryId, householdId: req.user!.householdId } })) {
      return res.status(400).json({ error: 'Category not found' });
    }
    res.status(201).json(await prisma.recurringBudgetEntry.create({
      data: { householdId: req.user!.householdId!, description: description.trim(), amountCents, categoryId: categoryId || null, frequency, nextDueOn: dueDate },
    }));
  });

  router.post('/recurring/materialize', async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const entries = await prisma.recurringBudgetEntry.findMany({
      where: { householdId: req.user!.householdId, active: true, nextDueOn: { lte: now } },
    });
    let created = 0;
    for (const entry of entries) {
      const nextDueOn = new Date(entry.nextDueOn);
      if (entry.frequency === 'WEEKLY') nextDueOn.setDate(nextDueOn.getDate() + 7);
      if (entry.frequency === 'MONTHLY') nextDueOn.setMonth(nextDueOn.getMonth() + 1);
      if (entry.frequency === 'YEARLY') nextDueOn.setFullYear(nextDueOn.getFullYear() + 1);
      const materialized = await prisma.$transaction(async (transaction) => {
        const claimed = await transaction.recurringBudgetEntry.updateMany({
          where: { id: entry.id, active: true, nextDueOn: entry.nextDueOn },
          data: { nextDueOn },
        });
        if (claimed.count !== 1) return false;
        await transaction.budgetTransaction.create({
          data: { householdId: entry.householdId, categoryId: entry.categoryId, description: entry.description, amountCents: entry.amountCents, occurredOn: entry.nextDueOn },
        });
        return true;
      });
      if (materialized) created += 1;
    }
    res.json({ created });
  });
  res.status(201).json(transaction);
});

router.get('/summary', async (req: AuthRequest, res: Response) => {
  const transactions = await prisma.budgetTransaction.findMany({ where: { householdId: req.user!.householdId } });
  res.json({ totalCents: transactions.reduce((total, transaction) => total + transaction.amountCents, 0), transactionCount: transactions.length });
});

router.get('/export.csv', async (req: AuthRequest, res: Response) => {
  const transactions = await prisma.budgetTransaction.findMany({
    where: { householdId: req.user!.householdId },
    include: { category: true },
    orderBy: { occurredOn: 'asc' },
  });

  router.post('/import.csv', express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }), async (req: AuthRequest, res: Response) => {
    const householdId = req.user?.householdId;
    if (!householdId || typeof req.body !== 'string') return res.status(400).json({ error: 'CSV body is required' });
    try {
      const rows = parseCsv(req.body);
      if (rows.length < 2 || rows[0].join(',').toLowerCase() !== 'date,description,amountcents,category') {
        return res.status(400).json({ error: 'CSV header must be date,description,amountCents,category' });
      }
      const categories = new Map<string, string>();
      for (const row of rows.slice(1)) {
        if (row.length !== 4 || !row[1].trim() || !/^-?\d+$/.test(row[2])) {
          return res.status(400).json({ error: 'Each row requires date, description, integer amountCents, and category' });
        }
        const occurredOn = new Date(row[0]);
        if (Number.isNaN(occurredOn.getTime())) return res.status(400).json({ error: `Invalid date: ${row[0]}` });
        const categoryName = row[3].trim();
        let categoryId: string | null = null;
        if (categoryName) {
          categoryId = categories.get(categoryName) || null;
          if (!categoryId) {
            const category = await prisma.budgetCategory.upsert({
              where: { householdId_name: { householdId, name: categoryName } },
              update: {},
              create: { householdId, name: categoryName },
            });
            categoryId = category.id;
            categories.set(categoryName, category.id);
          }
        }
        await prisma.budgetTransaction.create({
          data: { householdId, description: row[1].trim(), amountCents: Number(row[2]), categoryId, occurredOn },
        });
      }
      res.status(201).json({ imported: rows.length - 1 });
    } catch (error) {
      console.error('Budget CSV import failed', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to import budget CSV' });
    }
  });
  const rows = [
    ['date', 'description', 'amountCents', 'category'],
    ...transactions.map((transaction) => [
      transaction.occurredOn.toISOString(),
      transaction.description,
      transaction.amountCents,
      transaction.category?.name || '',
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\n');
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="budget-transactions.csv"').send(`${csv}\n`);
});

export default router;
