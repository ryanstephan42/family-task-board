import { Router, Response } from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../auth';
import { parseReceiptText, ParsedReceiptItem } from '../receiptParser';
import { resolveCategory, resolveUnit } from '../categorize';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

interface ReviewItem extends ParsedReceiptItem {
  category: string;
  unit: string;
}

// Run local OCR (Tesseract) on the uploaded image and heuristically
// parse the resulting text into candidate line items. Free, no API key,
// works fully offline - the default path.
async function scanWithLocalOcr(buffer: Buffer): Promise<ParsedReceiptItem[]> {
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(buffer);
    return parseReceiptText(data.text);
  } finally {
    await worker.terminate();
  }
}

// Optional higher-accuracy path: if OPENAI_API_KEY is configured, send the
// receipt image to a vision-capable model and ask it to return structured
// JSON of the purchased items directly (handles messy/crumpled receipts
// far better than plain OCR).
async function scanWithCloudVision(buffer: Buffer, mimeType: string): Promise<ParsedReceiptItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const base64 = buffer.toString('base64');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Extract every purchased food/grocery line item from this receipt image. ' +
                'Ignore totals, tax, tender, and store info. Respond with ONLY a JSON array ' +
                'of objects like [{"name": "Whole Milk", "quantity": 1, "price": 3.49}]. ' +
                'Omit price or quantity if unclear.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloud vision request failed: ${response.status} ${errText}`);
  }

  const json: any = await response.json();
  const content: string = json.choices?.[0]?.message?.content || '[]';
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);

  return (Array.isArray(parsed) ? parsed : []).map((it: any) => ({
    name: String(it.name || '').trim(),
    quantity: it.quantity !== undefined ? Number(it.quantity) : undefined,
    price: it.price !== undefined ? Number(it.price) : undefined,
  })).filter((it: ParsedReceiptItem) => it.name.length > 0);
}

// POST /api/receipt/scan - upload a receipt photo, get back a reviewable
// list of parsed items with a suggested category for each. Nothing is
// saved to inventory here; the client confirms/edits then calls the
// normal /api/inventory bulk-create endpoint.
router.post('/scan', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'A receipt image file is required (field name "receipt")' });
  }

  const useCloud = Boolean(process.env.OPENAI_API_KEY);

  try {
    let parsedItems: ParsedReceiptItem[];
    let method: 'cloud' | 'local';

    if (useCloud) {
      try {
        parsedItems = await scanWithCloudVision(req.file.buffer, req.file.mimetype || 'image/jpeg');
        method = 'cloud';
      } catch (cloudError) {
        console.error('Cloud vision scan failed, falling back to local OCR:', cloudError);
        parsedItems = await scanWithLocalOcr(req.file.buffer);
        method = 'local';
      }
    } else {
      parsedItems = await scanWithLocalOcr(req.file.buffer);
      method = 'local';
    }

    const items: ReviewItem[] = await Promise.all(
      parsedItems.map(async (item) => {
        const category = await resolveCategory(prisma, item.name);
        const unit = await resolveUnit(prisma, item.name, undefined, category);
        return { ...item, category, unit };
      })
    );

    res.json({ method, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to scan receipt' });
  }
});

export default router;
