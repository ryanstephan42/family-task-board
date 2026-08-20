import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X, Barcode, Loader2, Check } from 'lucide-react';
import api from '../services/api';

interface BarcodeResult {
  barcode: string;
  name: string;
  category: string | null;
  unit: string | null;
  source: 'memory' | 'openfoodfacts';
}

interface Props {
  onClose: () => void;
  onConfirm: (item: { name: string; category?: string; unit?: string; barcode: string }) => void;
}

// Live camera barcode scanner using the device's back camera (works on phone
// browsers and any desktop with a webcam). Once a barcode is decoded, looks
// it up against household memory / Open Food Facts and lets the user review
// the result before adding it to inventory.
const BarcodeScannerModal = ({ onClose, onConfirm }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const lookupBarcode = async (code: string) => {
    setScanning(false);
    setLookingUp(true);
    setError(null);
    try {
      const res = await api.get(`/inventory/barcode/${encodeURIComponent(code)}`);
      const product: BarcodeResult = res.data;
      setResult(product);
      setEditName(product.name);
      setEditUnit(product.unit || '');
      setEditCategory(product.category || '');
    } catch (err: any) {
      setResult({ barcode: code, name: '', category: null, unit: null, source: 'openfoodfacts' });
      setEditName('');
      setError(
        err?.response?.status === 404
          ? "Couldn't find that product - enter its name manually."
          : 'Lookup failed - enter the item manually.'
      );
    } finally {
      setLookingUp(false);
    }
  };

  useEffect(() => {
    if (!scanning) return;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let stopped = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (decodeResult) => {
          if (decodeResult && !stopped) {
            stopped = true;
            lookupBarcode(decodeResult.getText());
          }
        }
      )
      .catch((err) => {
        console.error(err);
        setError('Could not access camera - you can type the barcode number instead.');
      });

    return () => {
      stopped = true;
      try {
        BrowserMultiFormatReader.releaseAllStreams();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const handleConfirm = () => {
    if (!result || !editName.trim()) return;
    onConfirm({ name: editName.trim(), category: editCategory || undefined, unit: editUnit || undefined, barcode: result.barcode });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-100 flex items-center">
            <Barcode className="mr-2 text-sky-500" size={20} />
            Scan Barcode
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {scanning ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted />
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-sky-500/70" />
            </div>
            <p className="text-xs text-slate-500 text-center">Point the camera at a product barcode</p>
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type the barcode number"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={() => manualCode.trim() && lookupBarcode(manualCode.trim())}
                disabled={!manualCode.trim()}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
              >
                Look Up
              </button>
            </div>
          </div>
        ) : lookingUp ? (
          <div className="py-10 flex flex-col items-center text-slate-400">
            <Loader2 size={28} className="animate-spin mb-2" />
            <p className="text-sm">Looking up product...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-xs text-amber-400">{error}</p>}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold uppercase">Item Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Product name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Category</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Unit</label>
                <input
                  type="text"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>
            <div className="flex space-x-2 pt-1">
              <button
                onClick={handleConfirm}
                disabled={!editName.trim()}
                className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center justify-center"
              >
                <Check size={16} className="mr-1.5" />
                Add to Inventory
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setScanning(true);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-lg"
              >
                Rescan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
