// Thin client for a self-hosted Mealie recipe manager
// (https://mealie.io). Configured via env vars so it works whenever
// Mealie happens to be reachable, and fails gracefully (reported to the
// client as "offline") when it isn't - matching the fact that this
// household's Mealie instance isn't always running.
//
// Required env vars (server/.env):
//   MEALIE_URL       e.g. http://localhost:9925 (no trailing slash needed)
//   MEALIE_API_TOKEN long-lived API token, created in Mealie under
//                    /user/profile/api-tokens

export interface MealieIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  originalText: string;
}

export interface MealieRecipeSummary {
  slug: string;
  name: string;
  image: string | null;
}

export interface MealieRecipeDetail extends MealieRecipeSummary {
  ingredients: MealieIngredient[];
  prepTime: string | null;
  totalTime: string | null;
}

function getConfig() {
  const baseUrl = process.env.MEALIE_URL?.replace(/\/$/, '');
  const token = process.env.MEALIE_API_TOKEN;
  return { baseUrl, token };
}

export function isMealieConfigured(): boolean {
  const { baseUrl, token } = getConfig();
  return Boolean(baseUrl && token);
}

async function mealieFetch(path: string): Promise<any> {
  const { baseUrl, token } = getConfig();
  if (!baseUrl || !token) {
    throw new Error('Mealie is not configured (set MEALIE_URL and MEALIE_API_TOKEN)');
  }

  // Mealie can take a moment to respond (or hang entirely if the box is
  // sleeping) - bound the wait so the household dashboard never stalls on it.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Mealie responded with ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch all recipes (name/slug/image) from Mealie, following pagination. */
export async function fetchAllRecipes(): Promise<MealieRecipeSummary[]> {
  const data = await mealieFetch('/api/recipes?perPage=-1');
  const items = data.items || data.data || [];
  return items.map((r: any) => ({
    slug: r.slug,
    name: r.name,
    image: r.image ? `${process.env.MEALIE_URL?.replace(/\/$/, '')}/api/media/recipes/${r.id}/images/min-original.webp` : null,
  }));
}

/** Fetch full recipe detail (including ingredients) by slug. */
export async function fetchRecipeDetail(slug: string): Promise<MealieRecipeDetail> {
  const r = await mealieFetch(`/api/recipes/${encodeURIComponent(slug)}`);
  const ingredients: MealieIngredient[] = (r.recipeIngredient || []).map((ing: any) => ({
    name: ing.food?.name || ing.note || ing.originalText || '',
    quantity: ing.quantity ?? null,
    unit: ing.unit?.name ?? null,
    note: ing.note || null,
    originalText: ing.originalText || ing.display || ing.note || '',
  }));

  return {
    slug: r.slug,
    name: r.name,
    image: r.image ? `${process.env.MEALIE_URL?.replace(/\/$/, '')}/api/media/recipes/${r.id}/images/min-original.webp` : null,
    ingredients,
    prepTime: r.prepTime || null,
    totalTime: r.totalTime || null,
  };
}
