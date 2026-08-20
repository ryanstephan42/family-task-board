import path from 'path';
import fs from 'fs';

// Uploaded item photos live alongside the sqlite data file so they persist
// across container restarts via the same mounted volume (see
// docker-compose.yml's `./data:/app/server/data` mount).
export const UPLOADS_DIR = path.join(__dirname, '../data/uploads');

export function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
