// Heuristic parsing of raw OCR'd receipt text into candidate grocery/food
// line items. This is intentionally forgiving - it is meant to produce a
// "best guess" list that the user reviews/edits before importing, not a
// perfect parse. The optional cloud vision path (see routes/receipt.ts)
// produces much cleaner results when an API key is configured.

const NOISE_LINE_PATTERNS: RegExp[] = [
  /\btotal\b/i,
  /\bsub ?total\b/i,
  /\btax\b/i,
  /\bbalance\b/i,
  /\bcash\b/i,
  /\bchange\b/i,
  /\bcredit\b/i,
  /\bdebit\b/i,
  /\bvisa\b/i,
  /\bmastercard\b/i,
  /\bamex\b/i,
  /\bdiscover\b/i,
  /\btender\b/i,
  /\bapproved\b/i,
  /\bauth(orization)?\b/i,
  /\bterminal\b/i,
  /\bref\s*#/i,
  /\bstore\b/i,
  /\bmember\b/i,
  /\bthank you\b/i,
  /\bsaving[s]?\b/i,
  /\bitems? sold\b/i,
  /\breceipt\b/i,
  /\bdate\b/i,
  /\btime\b/i,
  /\btransaction\b/i,
  /\bcashier\b/i,
  /\bregister\b/i,
  /www\./i,
  /http/i,
  /\btel\b|\bphone\b/i,
  /^\d{1,2}[/:-]\d{1,2}([/:-]\d{2,4})?$/, // dates/times alone
  /^[\d\s\-()]{7,}$/, // phone numbers / long digit-only lines
];

// Matches a trailing price like "1.99", "$1.99", "1.99 F", "1.99 T"
const TRAILING_PRICE = /\$?\s*\d{1,4}\.\d{2}\s*[A-Z]?\s*$/;
// Matches a leading quantity like "2 " or "2 @ $1.50 " or "2x "
const LEADING_QTY = /^(\d+(\.\d+)?)\s*(x|@|ea\.?)?\s*(\$?\d+\.\d{2})?\s*/i;
// Long digit runs are usually UPC/PLU codes, not part of the name
const UPC_CODE = /\b\d{6,}\b/g;

export interface ParsedReceiptItem {
  name: string;
  price?: number;
  quantity?: number;
}

function extractTrailingPrice(line: string): { rest: string; price?: number } {
  const match = line.match(TRAILING_PRICE);
  if (!match) return { rest: line };
  const priceStr = match[0].replace(/[^0-9.]/g, '');
  const price = parseFloat(priceStr);
  return { rest: line.slice(0, match.index).trim(), price: isNaN(price) ? undefined : price };
}

function extractLeadingQuantity(line: string): { rest: string; quantity?: number } {
  const match = line.match(LEADING_QTY);
  if (!match || !match[1]) return { rest: line };
  const quantity = parseFloat(match[1]);
  // Only treat as a quantity prefix if there's meaningful text left after it
  const rest = line.slice(match[0].length).trim();
  if (rest.length < 2) return { rest: line };
  return { rest, quantity: isNaN(quantity) ? undefined : quantity };
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function parseReceiptText(rawText: string): ParsedReceiptItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedReceiptItem[] = [];

  for (const line of lines) {
    if (NOISE_LINE_PATTERNS.some((re) => re.test(line))) continue;

    let working = line.replace(UPC_CODE, ' ').replace(/\s+/g, ' ').trim();
    if (!working) continue;

    const { rest: afterPrice, price } = extractTrailingPrice(working);
    working = afterPrice;
    if (!working) continue;

    const { rest: afterQty, quantity } = extractLeadingQuantity(working);
    working = afterQty;

    // Require at least a couple of letters to consider this a real item name
    const letterCount = (working.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 2) continue;

    const name = titleCase(working.replace(/[^a-zA-Z0-9&'.\- ]/g, ' ').replace(/\s+/g, ' ').trim());
    if (!name) continue;

    items.push({ name, price, quantity });
  }

  return items;
}
