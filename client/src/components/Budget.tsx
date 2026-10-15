import { useState, useEffect } from 'react';
import api from '../services/api';
import { AlertTriangle, ExternalLink } from 'lucide-react';

/**
 * Embeds the family Budget app. It sits behind Cloudflare Access on its
 * own subdomain, so the browser's first-ever load of it needs to happen in
 * a normal tab (clicking "Open in new tab" below works) so the Access
 * login cookie gets set - after that this iframe will render it directly.
 * If it ever looks blank, that's the tell: log in via the link once.
 */
const Budget = () => {
  const [budgetUrl, setBudgetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/config');
        setBudgetUrl(res.data.budgetUrl);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  if (loading) {
    return <div className="h-[75vh] rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />;
  }

  if (!budgetUrl) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 space-y-3">
        <AlertTriangle className="text-amber-500" size={32} />
        <p className="text-slate-400 max-w-md">
          The budget tracker isn't linked up yet. Set{' '}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-400">BUDGET_URL</code>{' '}
          in the server's environment to the budget app's URL.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h2 className="text-lg font-bold text-white">Family Budget</h2>
        <a
          href={budgetUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
        >
          <span>Open in new tab</span>
          <ExternalLink size={12} />
        </a>
      </div>
      <iframe
        src={budgetUrl}
        title="Family Budget"
        className="w-full border-0"
        style={{ height: '80vh' }}
      />
      <p className="px-4 pb-3 text-[11px] text-slate-600">
        Blank? Use "Open in new tab" once to log in - it'll embed here after that.
      </p>
    </div>
  );
};

export default Budget;
