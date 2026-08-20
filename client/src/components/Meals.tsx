import { useState, useEffect } from 'react';
import api from '../services/api';
import { ChefHat, WifiOff, RefreshCw, CheckCircle2, XCircle, ExternalLink, Link2, Search } from 'lucide-react';

interface MealSummary {
  slug: string;
  name: string;
  image: string | null;
  missingCount: number | null;
  totalIngredients: number;
}

interface IngredientMatch {
  ingredient: string;
  originalText: string;
  haveIt: boolean;
  matchedItem: { id: string; name: string; quantity: number; unit: string | null } | null;
  confidence: number;
  isManualLink: boolean;
}

interface RecipeMatchDetail {
  recipe: { slug: string; name: string; image: string | null };
  matches: IngredientMatch[];
  missingCount: number;
  canMake: boolean;
}

interface FoodItem {
  id: string;
  name: string;
}

type Status = { configured: boolean; online: boolean; error?: string };

// Links inventory to recipes saved in a self-hosted Mealie instance
// (https://mealie.io). Since Mealie may not always be running, this tab
// degrades gracefully: it shows a clear "offline"/"not configured" state
// instead of erroring, and everything else in the app keeps working.
const Meals = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [meals, setMeals] = useState<MealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RecipeMatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inventory, setInventory] = useState<FoodItem[]>([]);
  const [linkingIngredient, setLinkingIngredient] = useState<string | null>(null);
  const [linkChoice, setLinkChoice] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/meals/status');
      setStatus(res.data);
      return res.data as Status;
    } catch (err) {
      console.error(err);
      setStatus({ configured: false, online: false });
      return null;
    }
  };

  const fetchMeals = async () => {
    try {
      const res = await api.get('/meals/what-can-i-make');
      setMeals(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await api.get('/inventory');
      setInventory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const init = async () => {
    setLoading(true);
    const s = await fetchStatus();
    if (s?.configured && s.online) {
      await Promise.all([fetchMeals(), fetchInventory()]);
    }
    setLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRecipe = async (slug: string) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      const res = await api.get(`/meals/recipes/${encodeURIComponent(slug)}/match`);
      setSelected(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveLink = async (ingredientName: string) => {
    if (!selected || !linkChoice) return;
    try {
      await api.post(`/meals/recipes/${selected.recipe.slug}/link`, {
        ingredientName,
        inventoryItemName: linkChoice,
      });
      setLinkingIngredient(null);
      setLinkChoice('');
      openRecipe(selected.recipe.slug);
    } catch (err) {
      console.error(err);
    }
  };

  const removeLink = async (ingredientName: string) => {
    if (!selected) return;
    try {
      await api.delete(`/meals/recipes/${selected.recipe.slug}/link/${encodeURIComponent(ingredientName)}`);
      openRecipe(selected.recipe.slug);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMeals = meals.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-6 h-full flex items-center justify-center">
        <RefreshCw className="animate-spin text-sky-500" size={32} />
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-6 h-full flex flex-col items-center justify-center text-center">
        <ChefHat className="text-slate-600 mb-3" size={40} />
        <h2 className="text-lg font-bold text-slate-200 mb-1">Mealie isn't connected yet</h2>
        <p className="text-slate-500 text-sm max-w-md">
          Set <code className="text-sky-400">MEALIE_URL</code> and <code className="text-sky-400">MEALIE_API_TOKEN</code> in
          the server's <code className="text-sky-400">.env</code> to link your saved recipes to inventory and see what you
          can make right now.
        </p>
      </div>
    );
  }

  if (!status.online) {
    return (
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-6 h-full flex flex-col items-center justify-center text-center">
        <WifiOff className="text-amber-500 mb-3" size={40} />
        <h2 className="text-lg font-bold text-slate-200 mb-1">Mealie is offline</h2>
        <p className="text-slate-500 text-sm max-w-md mb-4">
          Couldn't reach your Mealie instance right now. Everything else in the household board still works fine -
          this tab will pick back up automatically once Mealie is running again.
        </p>
        <button
          onClick={init}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-6 h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-100 flex items-center">
          <ChefHat className="mr-2 text-sky-500" size={24} />
          Meals from Mealie
        </h2>
        <button
          onClick={init}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your recipes..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {filteredMeals.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-500 italic">No recipes found in Mealie.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMeals.map((meal) => (
              <button
                key={meal.slug}
                onClick={() => openRecipe(meal.slug)}
                className="text-left bg-slate-800/30 border border-slate-800/50 hover:border-sky-500/40 rounded-xl p-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-medium text-slate-200 leading-tight">{meal.name}</span>
                  {meal.missingCount === 0 ? (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 size={10} />
                      Ready
                    </span>
                  ) : meal.missingCount !== null ? (
                    <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {meal.missingCount} missing
                    </span>
                  ) : null}
                </div>
                {meal.totalIngredients > 0 && (
                  <p className="text-xs text-slate-500">
                    {meal.totalIngredients - (meal.missingCount ?? meal.totalIngredients)}/{meal.totalIngredients}{' '}
                    ingredients on hand
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {(detailLoading || selected) && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-100">{selected?.recipe.name || 'Loading...'}</h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2">
              {detailLoading ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="animate-spin text-sky-500" size={24} />
                </div>
              ) : (
                selected?.matches.map((m) => (
                  <div
                    key={m.ingredient}
                    className="flex items-center justify-between gap-2 p-2.5 bg-slate-800/30 border border-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {m.haveIt ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle size={16} className="text-red-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate">{m.originalText || m.ingredient}</p>
                        {m.matchedItem && (
                          <p className="text-[11px] text-slate-500 truncate">
                            matched: {m.matchedItem.name} ({m.matchedItem.quantity}
                            {m.matchedItem.unit ? ` ${m.matchedItem.unit}` : ''})
                            {m.isManualLink ? ' · manual link' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {linkingIngredient === m.ingredient ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={linkChoice}
                            onChange={(e) => setLinkChoice(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-200"
                          >
                            <option value="">Select item</option>
                            {inventory.map((i) => (
                              <option key={i.id} value={i.name}>{i.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => saveLink(m.ingredient)}
                            disabled={!linkChoice}
                            className="px-2 py-1 bg-sky-600 disabled:opacity-50 text-white text-xs font-bold rounded"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setLinkingIngredient(m.ingredient);
                              setLinkChoice(m.matchedItem?.name || '');
                            }}
                            title="Manually link to an inventory item"
                            className="p-1.5 text-slate-500 hover:text-sky-400 rounded-lg hover:bg-slate-800"
                          >
                            <Link2 size={14} />
                          </button>
                          {m.isManualLink && (
                            <button
                              onClick={() => removeLink(m.ingredient)}
                              title="Remove manual link"
                              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <ExternalLink size={12} />
                Open the full recipe in Mealie to cook.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Meals;
