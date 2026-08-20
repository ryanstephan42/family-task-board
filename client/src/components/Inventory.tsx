import { useState, useEffect, useMemo } from 'react';
import api, { resolveUploadUrl } from '../services/api';
import {
  Plus,
  Trash2,
  Edit2,
  Minus,
  Package,
  X,
  Camera,
  AlertTriangle,
  ImagePlus,
  ImageOff,
  Barcode,
  TrendingDown,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import ReceiptScanModal from './ReceiptScanModal';
import BarcodeScannerModal from './BarcodeScannerModal';

interface FoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: string;
  location: string;
  purchaseDate: string;
  trackExpiration: boolean;
  expirationDate: string | null;
  notes: string | null;
  photoUrl: string | null;
  parLevel: number | null;
  lowStock: boolean;
}

const LOCATIONS = ['All', 'Fridge', 'Freezer', 'Deep Freezer', 'Pantry', 'Kitchen Shelf'];

const daysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

// Color-coded expiration urgency: red = expired/within 3 days,
// yellow = within 2 weeks, otherwise a neutral badge.
const ExpirationBadge = ({ expirationDate }: { expirationDate: string | null }) => {
  const days = daysUntil(expirationDate);
  if (days === null) return null;

  let classes = 'bg-slate-800 text-slate-400 border-slate-700';
  let label = `${days}d left`;
  if (days < 0) {
    classes = 'bg-red-500/10 text-red-400 border-red-500/30';
    label = 'Expired';
  } else if (days === 0) {
    classes = 'bg-red-500/10 text-red-400 border-red-500/30';
    label = 'Today';
  } else if (days <= 3) {
    classes = 'bg-red-500/10 text-red-400 border-red-500/30';
  } else if (days <= 14) {
    classes = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }

  return (
    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap', classes)}>
      {label}
    </span>
  );
};

const Inventory = () => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [locationFilter, setLocationFilter] = useState('All');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkLocation, setBulkLocation] = useState('Pantry');
  const [isAdding, setIsAdding] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expirationFilter, setExpirationFilter] = useState<'All' | 'Expiring Soon' | 'Expired'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FoodItem>>({});
  const [unitOptions, setUnitOptions] = useState<string[]>([]);

  const fetchItems = async () => {
    try {
      const res = await api.get('/inventory');
      setItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnitOptions = async () => {
    try {
      const res = await api.get('/inventory/unit-options');
      setUnitOptions(res.data.commonUnits || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchUnitOptions();
  }, []);

  const handleBulkSubmit = async () => {
    if (!bulkInput.trim()) return;

    const names = bulkInput
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newItems = names.map((name) => ({ name, location: bulkLocation }));

    try {
      await api.post('/inventory', { items: newItems });
      setBulkInput('');
      setIsAdding(false);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustQuantity = async (item: FoodItem, delta: number) => {
    if (item.quantity + delta <= 0) {
      handleDelete(item.id, true);
      return;
    }
    try {
      await api.patch(`/inventory/${item.id}/quantity`, { delta });
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm('Remove this item from inventory?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (item: FoodItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handlePhotoUpload = async (itemId: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await api.post(`/inventory/${itemId}/photo`, formData);
      fetchItems();
      if (editingId === itemId) setEditForm((prev) => ({ ...prev, photoUrl: res.data.photoUrl }));
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhotoRemove = async (itemId: string) => {
    try {
      await api.delete(`/inventory/${itemId}/photo`);
      fetchItems();
      if (editingId === itemId) setEditForm((prev) => ({ ...prev, photoUrl: null }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !editForm.name) return;
    try {
      await api.put(`/inventory/${editingId}`, editForm);
      setEditingId(null);
      fetchItems();
      fetchUnitOptions(); // Refresh in case a new unit was learned
    } catch (err) {
      console.error(err);
    }
  };

  const handleBarcodeConfirm = async (item: { name: string; category?: string; unit?: string; barcode: string }) => {
    try {
      await api.post('/inventory', { items: [{ ...item, location: bulkLocation }] });
      setShowBarcodeScanner(false);
      fetchItems();
      fetchUnitOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items
      .filter((i) => locationFilter === 'All' || i.location === locationFilter)
      .filter((i) => !lowStockOnly || i.lowStock)
      .filter((i) => categoryFilter === 'All' || (i.category || 'General') === categoryFilter)
      .filter((i) => {
        if (expirationFilter === 'All') return true;
        const days = daysUntil(i.expirationDate);
        if (!i.trackExpiration || days === null) return false;
        if (expirationFilter === 'Expired') return days < 0;
        // "Expiring Soon" = within 2 weeks (matches the yellow/red badge thresholds)
        return days >= 0 && days <= 14;
      })
      .filter((i) => {
        if (!query) return true;
        const haystack = `${i.name} ${i.category} ${i.location} ${i.notes || ''}`.toLowerCase();
        return haystack.includes(query);
      });
  }, [items, locationFilter, lowStockOnly, categoryFilter, expirationFilter, searchQuery]);

  const lowStockCount = items.filter((i) => i.lowStock).length;
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category || 'General'))).sort(),
    [items]
  );
  const activeFilterCount = [
    categoryFilter !== 'All',
    expirationFilter !== 'All',
  ].filter(Boolean).length;

  const groupedItems = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, FoodItem[]>);

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-6 h-full flex flex-col">
      <datalist id="unit-options">
        {unitOptions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-100 flex items-center">
          <Package className="mr-2 text-sky-500" size={24} />
          Food Inventory
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-bold flex items-center"
            title="Scan Barcode"
          >
            <Barcode size={16} className="mr-1.5" />
            Scan Barcode
          </button>
          <button
            onClick={() => setShowScanner(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-bold flex items-center"
            title="Scan Receipt"
          >
            <Camera size={16} className="mr-1.5" />
            Scan Receipt
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <button
          onClick={() => setLowStockOnly((v) => !v)}
          className={clsx(
            'mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold w-fit transition-colors',
            lowStockOnly
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-500/40'
          )}
        >
          <TrendingDown size={14} />
          {lowStockCount} item{lowStockCount === 1 ? '' : 's'} running low
          {lowStockOnly ? ' · showing only these' : ' · tap to filter'}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, categories, notes..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold shrink-0 transition-colors',
            showFilters || activeFilterCount > 0
              ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
          )}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-sky-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex flex-wrap items-end gap-3 p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="All">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Expiration</label>
                <select
                  value={expirationFilter}
                  onChange={(e) => setExpirationFilter(e.target.value as typeof expirationFilter)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="All">All</option>
                  <option value="Expiring Soon">Expiring Soon (≤14 days)</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setCategoryFilter('All');
                    setExpirationFilter('All');
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-800 w-fit mb-6 overflow-x-auto max-w-full">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            onClick={() => setLocationFilter(loc)}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0',
              locationFilter === loc ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {loc}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Add Items (Comma or New Line separated)
              </label>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Milk, Eggs, Chicken Breast..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 h-24 resize-none"
              />
              <div className="flex items-center space-x-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Location</label>
                <select
                  value={bulkLocation}
                  onChange={(e) => setBulkLocation(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {LOCATIONS.filter((l) => l !== 'All').map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleBulkSubmit}
                disabled={!bulkInput.trim()}
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              >
                Add to Inventory
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-500 italic">
              {items.length === 0 ? 'No items in inventory yet.' : 'No items match your search/filters.'}
            </p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([category, catItems]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-2"></span>
                {category}
              </h3>
              <div className="space-y-2">
                {catItems.map((item) => {
                  const days = daysUntil(item.expirationDate);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group relative bg-slate-800/30 border border-slate-800/50 rounded-xl p-3 transition-all hover:border-slate-700"
                    >
                      {editingId === item.id ? (
                        <div className="space-y-3 p-1">
                          <div className="flex items-center space-x-3">
                            {editForm.photoUrl ? (
                              <div className="relative shrink-0">
                                <img
                                  src={resolveUploadUrl(editForm.photoUrl) || ''}
                                  alt={editForm.name}
                                  className="w-14 h-14 rounded-lg object-cover border border-slate-700"
                                />
                                <button
                                  onClick={() => handlePhotoRemove(item.id)}
                                  className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-slate-700 rounded-full p-0.5 text-slate-400 hover:text-red-400"
                                  title="Remove photo"
                                >
                                  <ImageOff size={12} />
                                </button>
                              </div>
                            ) : (
                              <label className="w-14 h-14 shrink-0 rounded-lg border-2 border-dashed border-slate-700 hover:border-sky-500 flex items-center justify-center text-slate-500 hover:text-sky-400 cursor-pointer transition-colors">
                                <ImagePlus size={20} />
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePhotoUpload(item.id, file);
                                  }}
                                />
                              </label>
                            )}
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              placeholder="Item Name"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Qty</label>
                              <input
                                type="number"
                                value={editForm.quantity ?? 1}
                                onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Unit</label>
                              <input
                                type="text"
                                list="unit-options"
                                value={editForm.unit || ''}
                                onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                placeholder="e.g. lbs, bags"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Category</label>
                              <input
                                type="text"
                                value={editForm.category || ''}
                                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Location</label>
                              <select
                                value={editForm.location || 'Pantry'}
                                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              >
                                {LOCATIONS.filter((l) => l !== 'All').map((l) => (
                                  <option key={l} value={l}>{l}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold uppercase">
                              Par Level (low-stock alert when qty drops to/below this)
                            </label>
                            <input
                              type="number"
                              value={editForm.parLevel ?? ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, parLevel: e.target.value === '' ? null : Number(e.target.value) })
                              }
                              placeholder="e.g. 2 (leave blank to disable)"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase">Track Expiration</label>
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, trackExpiration: !editForm.trackExpiration })}
                              className={clsx(
                                'w-9 h-5 rounded-full relative transition-colors shrink-0',
                                editForm.trackExpiration ? 'bg-sky-600' : 'bg-slate-700'
                              )}
                            >
                              <span
                                className={clsx(
                                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                                  editForm.trackExpiration ? 'translate-x-4' : 'translate-x-0.5'
                                )}
                              />
                            </button>
                          </div>
                          {editForm.trackExpiration && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Expiration Date</label>
                              <input
                                type="date"
                                value={editForm.expirationDate ? new Date(editForm.expirationDate).toISOString().split('T')[0] : ''}
                                onChange={(e) => setEditForm({ ...editForm, expirationDate: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                              />
                            </div>
                          )}
                          <div className="flex space-x-2 pt-1">
                            <button onClick={handleUpdate} className="flex-1 py-1.5 bg-sky-600 text-white text-xs font-bold rounded">Save</button>
                            <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 bg-slate-700 text-white text-xs font-bold rounded">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            {item.photoUrl ? (
                              <img
                                src={resolveUploadUrl(item.photoUrl) || ''}
                                alt={item.name}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-600 shrink-0">
                                <Package size={16} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-1.5">
                                <span className="font-medium text-slate-200 truncate">{item.name}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                  {item.location}
                                </span>
                                {item.lowStock && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                    <TrendingDown size={10} />
                                    Low
                                  </span>
                                )}
                                {item.trackExpiration && days !== null && days <= 3 && (
                                  <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                                )}
                                {item.trackExpiration && <ExpirationBadge expirationDate={item.expirationDate} />}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Purchased {new Date(item.purchaseDate).toLocaleDateString()}
                                {item.notes && <span> · {item.notes}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0 ml-2">
                            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                              <button
                                onClick={() => handleAdjustQuantity(item, -1)}
                                className="px-2 py-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="px-2 text-sm font-bold text-slate-200 min-w-[2rem] text-center">
                                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                              </span>
                              <button
                                onClick={() => handleAdjustQuantity(item, 1)}
                                className="px-2 py-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {showScanner && (
        <ReceiptScanModal
          onClose={() => setShowScanner(false)}
          onImported={() => {
            setShowScanner(false);
            fetchItems();
          }}
        />
      )}

      {showBarcodeScanner && (
        <BarcodeScannerModal onClose={() => setShowBarcodeScanner(false)} onConfirm={handleBarcodeConfirm} />
      )}
    </div>
  );
};

export default Inventory;
