import { useState, useRef } from 'react';
import api from '../services/api';
import { X, Camera, Upload, Loader2, Trash2, CheckCircle2 } from 'lucide-react';

interface ReceiptScanModalProps {
  onClose: () => void;
  onImported: () => void;
}

interface ReviewItem {
  name: string;
  quantity: number;
  category: string;
  price?: number;
}

const LOCATIONS = ['Pantry', 'Fridge', 'Freezer'];

const ReceiptScanModal = ({ onClose, onImported }: ReceiptScanModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanMethod, setScanMethod] = useState<'cloud' | 'local' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [location, setLocation] = useState('Pantry');

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setError(null);
    setReviewItems([]);

    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const res = await api.post('/receipt/scan', formData);
      setScanMethod(res.data.method);
      setReviewItems(
        (res.data.items || []).map((it: any) => ({
          name: it.name,
          quantity: it.quantity && it.quantity > 0 ? it.quantity : 1,
          category: it.category || 'General',
          price: it.price,
        }))
      );
      if (!res.data.items || res.data.items.length === 0) {
        setError('No items detected. Try a clearer photo, or add items manually instead.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to scan receipt. Please try again or add items manually.');
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (index: number, patch: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (reviewItems.length === 0) return;
    setImporting(true);
    try {
      await api.post('/inventory', {
        items: reviewItems.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          category: it.category,
          location,
        })),
      });
      onImported();
    } catch (err) {
      console.error(err);
      setError('Failed to add items to inventory.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 flex items-center">
            <Camera className="mr-2 text-sky-500" size={20} />
            Scan Receipt
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
          {reviewItems.length === 0 && (
            <>
              <p className="text-sm text-slate-400">
                Take a photo of your receipt (or upload one) and we'll pull out the items automatically for you to review.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="w-full py-8 border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl flex flex-col items-center justify-center space-y-2 text-slate-400 hover:text-sky-400 transition-colors disabled:opacity-60"
              >
                {scanning ? (
                  <>
                    <Loader2 className="animate-spin" size={28} />
                    <span className="text-sm font-semibold">Scanning receipt…</span>
                  </>
                ) : (
                  <>
                    <Upload size={28} />
                    <span className="text-sm font-semibold">Tap to take a photo or upload</span>
                  </>
                )}
              </button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </>
          )}

          {reviewItems.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {reviewItems.length} item{reviewItems.length !== 1 ? 's' : ''} found
                  {scanMethod && <span className="text-slate-600 normal-case font-normal"> · {scanMethod === 'cloud' ? 'AI scan' : 'local OCR'}</span>}
                </p>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                >
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {reviewItems.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-slate-800/40 border border-slate-800 rounded-lg p-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
                    />
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => updateItem(idx, { category: e.target.value })}
                      className="w-28 shrink-0 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
                    />
                    <button onClick={() => removeItem(idx)} className="p-1.5 text-slate-500 hover:text-red-400 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex space-x-3">
          {reviewItems.length > 0 && (
            <button
              onClick={() => {
                setReviewItems([]);
                setError(null);
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-colors"
            >
              Rescan
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={reviewItems.length === 0 || importing}
            className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {importing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            <span>Add {reviewItems.length > 0 ? reviewItems.length : ''} to Inventory</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanModal;
