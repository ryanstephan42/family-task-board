import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  ShoppingCart, 
  X,
  PackagePlus,
  TrendingDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface GroceryItem {
  id: string;
  name: string;
  quantity: string | null;
  details: string | null;
  category: string | null;
  completed: boolean;
}

interface Preference {
  itemName: string;
  category: string;
}

interface Suggestion {
  name: string;
  category: string | null;
  quantity?: string;
  reason: string;
}

const GroceryList = () => {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<GroceryItem>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const res = await api.get('/grocery');
      setItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/grocery/preferences');
      setPreferences(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await api.get('/grocery/suggestions');
      setSuggestions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchPreferences();
    fetchSuggestions();
  }, []);

  const handleAddSuggestion = async (s: Suggestion) => {
    try {
      await api.post('/grocery', { items: [{ name: s.name, category: s.category, quantity: s.quantity || '' }] });
      setDismissedSuggestions((prev) => [...prev, s.name]);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const visibleSuggestions = suggestions.filter((s) => !dismissedSuggestions.includes(s.name));

  const handleBulkSubmit = async () => {
    if (!bulkInput.trim()) return;

    const names = bulkInput
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const newItems = names.map(name => {
      const pref = preferences.find(p => p.itemName === name.toLowerCase());
      return {
        name,
        category: pref ? pref.category : 'General',
        quantity: '',
        details: ''
      };
    });

    try {
      await api.post('/grocery', { items: newItems });
      setBulkInput('');
      setIsAdding(false);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleComplete = async (item: GroceryItem) => {
    if (item.completed) {
      // Just toggle back without animation
      try {
        await api.put(`/grocery/${item.id}`, { ...item, completed: false });
        fetchItems();
      } catch (err) { console.error(err); }
      return;
    }

    setCompletingId(item.id);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      await api.put(`/grocery/${item.id}`, { ...item, completed: true });
      fetchItems();
      setCompletingId(null);
    } catch (err) {
      console.error(err);
      setCompletingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/grocery/${id}`);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToInventory = async (id: string) => {
    try {
      await api.post(`/grocery/${id}/purchase`);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const clearCompleted = async () => {
    const completedItems = items.filter(i => i.completed);
    if (completedItems.length === 0) return;
    if (!confirm(`Clear all ${completedItems.length} completed items?`)) return;
    
    try {
      await Promise.all(completedItems.map(i => api.delete(`/grocery/${i.id}`)));
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (item: GroceryItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handleUpdate = async () => {
    if (!editingId || !editForm.name) return;
    try {
      await api.put(`/grocery/${editingId}`, editForm);
      setEditingId(null);
      fetchItems();
      fetchPreferences(); // Refresh preferences in case category changed
    } catch (err) {
      console.error(err);
    }
  };

  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-100 flex items-center">
          <ShoppingCart className="mr-2 text-sky-500" size={24} />
          Grocery List
        </h2>
        <div className="flex items-center space-x-2">
          {items.some(i => i.completed) && (
            <button
              onClick={clearCompleted}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-lg transition-all text-xs font-bold flex items-center"
              title="Clear Completed"
            >
              <Trash2 size={14} className="mr-1.5" />
              Clear
            </button>
          )}
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center">
            <TrendingDown size={14} className="mr-1.5" />
            Running Low - Add to List?
          </h3>
          <div className="flex flex-wrap gap-2">
            {visibleSuggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => handleAddSuggestion(s)}
                title={s.reason}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-amber-500/10 border border-slate-700 hover:border-amber-500/40 rounded-lg text-xs font-medium text-slate-300 hover:text-amber-300 transition-colors"
              >
                <Plus size={12} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Add Items (Comma or New Line separated)</label>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Milk, Eggs, Bread..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 h-24 resize-none"
              />
              <button
                onClick={handleBulkSubmit}
                disabled={!bulkInput.trim()}
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              >
                Add to List
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-500 italic">No grocery items yet.</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([category, catItems]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-2"></span>
                {category}
              </h3>
              <div className="space-y-2">
                {catItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={clsx(
                      "group relative bg-slate-800/30 border border-slate-800/50 rounded-xl p-3 transition-all hover:border-slate-700",
                      item.completed && "opacity-50"
                    )}
                  >
                    <AnimatePresence>
                      {completingId === item.id && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-sky-500/10 flex items-center justify-center z-10 backdrop-blur-[1px] rounded-xl"
                        >
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1.2, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                            className="bg-sky-500 text-white rounded-full p-1.5"
                          >
                            <Check size={20} strokeWidth={3} />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {editingId === item.id ? (
                      <div className="space-y-3 p-1">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                          placeholder="Item Name"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold uppercase">Quantity</label>
                            <input
                              type="text"
                              value={editForm.quantity || ''}
                              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              placeholder="e.g. 2 boxes"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold uppercase">Category</label>
                            <input
                              type="text"
                              value={editForm.category || ''}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              placeholder="e.g. Produce"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase">Details</label>
                          <input
                            type="text"
                            value={editForm.details || ''}
                            onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                            placeholder="Any extra info..."
                          />
                        </div>
                        <div className="flex space-x-2 pt-1">
                          <button onClick={handleUpdate} className="flex-1 py-1.5 bg-sky-600 text-white text-xs font-bold rounded">Save</button>
                          <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 bg-slate-700 text-white text-xs font-bold rounded">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <button
                            onClick={() => handleToggleComplete(item)}
                            className={clsx(
                              "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              item.completed ? "bg-sky-500 border-sky-500 text-white" : "border-slate-600 hover:border-sky-500"
                            )}
                          >
                            {item.completed && <Check size={12} strokeWidth={4} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className={clsx(
                                "font-medium text-slate-200 truncate",
                                item.completed && "line-through text-slate-500"
                              )}>
                                {item.name}
                              </span>
                              {item.quantity && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
                                  {item.quantity}
                                </span>
                              )}
                            </div>
                            {item.details && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">{item.details}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.completed && (
                            <button
                              onClick={() => handleMoveToInventory(item.id)}
                              className="p-1.5 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-slate-800"
                              title="Move to Inventory"
                            >
                              <PackagePlus size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-sky-400 rounded-lg hover:bg-slate-800"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GroceryList;
