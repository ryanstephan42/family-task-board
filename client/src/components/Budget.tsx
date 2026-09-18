import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Budget() {
  const [summary, setSummary] = useState({ totalCents: 0, transactionCount: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recurringForm, setRecurringForm] = useState({ description: '', amountCents: '', frequency: 'MONTHLY', nextDueOn: '' });

  useEffect(() => {
    Promise.all([api.get('/budget/summary'), api.get('/budget/transactions'), api.get('/budget/recurring')]).then(([summaryResponse, transactionsResponse, recurringResponse]) => {
      setSummary(summaryResponse.data);
      setTransactions(transactionsResponse.data);
      setRecurring(recurringResponse.data);
    }).catch(() => setError('Unable to load household budget.'));
  }, []);

  const exportCsv = async () => {
    try {
      const response = await api.get('/budget/export.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'budget-transactions.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Unable to export household budget.');
    }
  };

  const materializeRecurring = async () => {
    try {
      await api.post('/budget/recurring/materialize');
      const [summaryResponse, transactionsResponse] = await Promise.all([api.get('/budget/summary'), api.get('/budget/transactions')]);
      setSummary(summaryResponse.data);
      setTransactions(transactionsResponse.data);
    } catch {
      setError('Unable to apply recurring budget entries.');
    }
  };

  const importCsv = async (file: File) => {
    try {
      await api.post('/budget/import.csv', await file.text(), { headers: { 'Content-Type': 'text/csv' } });
      const [summaryResponse, transactionsResponse] = await Promise.all([api.get('/budget/summary'), api.get('/budget/transactions')]);
      setSummary(summaryResponse.data);
      setTransactions(transactionsResponse.data);
    } catch {
      setError('Unable to import household budget CSV.');
    }
  };

  const createRecurring = async () => {
    try {
      await api.post('/budget/recurring', { ...recurringForm, amountCents: Number(recurringForm.amountCents) });
      setRecurringForm({ description: '', amountCents: '', frequency: 'MONTHLY', nextDueOn: '' });
      setRecurring((await api.get('/budget/recurring')).data);
    } catch {
      setError('Unable to create recurring budget entry.');
    }
  };

  return (
    <section className="space-y-4">
      {error && <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-red-300">{error}</p>}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-400">Household balance total</p>
        <p className="text-3xl font-bold">${(summary.totalCents / 100).toFixed(2)}</p>
        <p className="text-sm text-slate-500">{summary.transactionCount} transactions</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Recurring entries</h2>
          <button onClick={() => void materializeRecurring()} className="rounded bg-sky-700 px-3 py-1 text-sm text-slate-100 hover:bg-sky-600">Apply due entries</button>
        </div>
        {recurring.map((entry) => <div key={entry.id} className="flex justify-between border-b border-slate-800 py-2 text-sm"><span>{entry.description} ({entry.frequency.toLowerCase()})</span><span>{new Date(entry.nextDueOn).toLocaleDateString()}</span></div>)}
        {!recurring.length && <p className="text-slate-500">No recurring entries configured.</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <input value={recurringForm.description} onChange={(event) => setRecurringForm({ ...recurringForm, description: event.target.value })} className="rounded bg-slate-800 px-2 py-1" placeholder="Description" />
          <input value={recurringForm.amountCents} onChange={(event) => setRecurringForm({ ...recurringForm, amountCents: event.target.value })} className="rounded bg-slate-800 px-2 py-1" placeholder="Amount cents" type="number" />
          <select value={recurringForm.frequency} onChange={(event) => setRecurringForm({ ...recurringForm, frequency: event.target.value })} className="rounded bg-slate-800 px-2 py-1"><option>WEEKLY</option><option>MONTHLY</option><option>YEARLY</option></select>
          <input value={recurringForm.nextDueOn} onChange={(event) => setRecurringForm({ ...recurringForm, nextDueOn: event.target.value })} className="rounded bg-slate-800 px-2 py-1" type="date" />
          <button onClick={() => void createRecurring()} className="rounded bg-slate-800 px-2 py-1">Add recurring</button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Recent transactions</h2>
          <div className="flex gap-2">
            <label className="cursor-pointer rounded bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700">
              Import CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} />
            </label>
            <button onClick={() => void exportCsv()} className="rounded bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700">Export CSV</button>
          </div>
        </div>
        {transactions.map((transaction) => <div key={transaction.id} className="flex justify-between border-b border-slate-800 py-2"><span>{transaction.description}</span><span>${(transaction.amountCents / 100).toFixed(2)}</span></div>)}
        {!transactions.length && <p className="text-slate-500">No transactions recorded yet.</p>}
      </div>
    </section>
  );
}
