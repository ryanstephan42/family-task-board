import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const Setup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    householdName: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    username: '',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/setup/bootstrap', {
        householdName: form.householdName,
        timezone: form.timezone,
        username: form.username,
        name: form.name,
        password: form.password,
      });
      navigate('/login', { replace: true, state: { message: 'Setup complete. Sign in to continue.' } });
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Setup could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-sky-400">First-run setup</p>
      <h1 className="mb-2 text-3xl font-bold text-white">Create your household</h1>
      <p className="mb-8 text-slate-400">
        This creates the private household and owner account for this deployment.
      </p>

      <form onSubmit={submit} className="space-y-5">
        {[
          ['householdName', 'Household name', 'e.g. The Smiths'],
          ['timezone', 'Timezone', 'e.g. America/New_York'],
          ['name', 'Your name', 'Displayed to household members'],
          ['username', 'Username', 'Used when signing in'],
        ].map(([field, label, placeholder]) => (
          <label key={field} className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
            <input
              required
              value={form[field as keyof typeof form]}
              onChange={(event) => updateField(field as keyof typeof form, event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-sky-500"
            />
          </label>
        ))}

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
          <input
            required
            minLength={12}
            type="password"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-sky-500"
          />
          <span className="mt-1 block text-xs text-slate-500">At least 12 characters.</span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">Confirm password</span>
          <input
            required
            minLength={12}
            type="password"
            value={form.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-sky-500"
          />
        </label>

        {error && <p className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating household…' : 'Complete setup'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already initialized?{' '}
        <Link to="/login" className="text-sky-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default Setup;
