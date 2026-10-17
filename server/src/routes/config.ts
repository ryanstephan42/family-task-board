import { Router } from 'express';

const router = Router();

// Bump when the API changes in a way native clients must know about.
const API_VERSION = 1;
const MIN_CLIENT_API_VERSION = 1;

// Small bag of public, non-secret runtime config the client needs but
// shouldn't have baked in at build time (so it can change without a
// container rebuild - just restart with a new env var).
router.get('/', (_req, res) => {
  res.json({
    apiVersion: API_VERSION,
    minClientApiVersion: MIN_CLIENT_API_VERSION,
    // Public "share link" embed URL for the family Nextcloud calendar
    // (Settings > Calendar app > "..." > Share link > embed code). Not a
    // secret - it's a read-only public share by design - so it's fine to
    // hand straight to the browser.
    nextcloudCalendarEmbedUrl: process.env.NEXTCLOUD_CALENDAR_EMBED_URL || null,
    // Element web (Matrix chat client) URL - not behind Cloudflare Access,
    // so it can be framed directly once logged in (session persists via
    // browser localStorage same as visiting it directly).
    chatUrl: process.env.CHAT_URL || null,
    // Budget tracker app URL - sits behind Cloudflare Access on its own
    // subdomain, so the very first load in the iframe may show a blank
    // frame until the family member logs into it directly once in a normal
    // tab; after that the Access session cookie lets it render embedded.
    budgetUrl: process.env.BUDGET_URL || null,
  });
});

export default router;
