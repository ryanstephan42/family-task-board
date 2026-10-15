import { useState, useEffect } from 'react';
import api from '../services/api';
import { AlertTriangle, ExternalLink } from 'lucide-react';

/**
 * Renders the family's real Nextcloud calendar (the one the family-bot and
 * everyone's phones actually use) via its public "share link" embed page,
 * instead of the old built-in calendar that had its own separate/duplicate
 * event store. Read-only here by design - add/edit events in Nextcloud
 * directly (or by asking the family-bot in chat), and they'll show up here.
 */
const Calendar = () => {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/config');
        setEmbedUrl(res.data.nextcloudCalendarEmbedUrl);
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

  if (!embedUrl) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 space-y-3">
        <AlertTriangle className="text-amber-500" size={32} />
        <p className="text-slate-400 max-w-md">
          The Nextcloud calendar isn't linked up yet. Set{' '}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-400">NEXTCLOUD_CALENDAR_EMBED_URL</code>{' '}
          in the server's environment to the calendar's public share/embed link.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h2 className="text-lg font-bold text-white">Family Calendar</h2>
        <a
          href={embedUrl.replace('/embed/', '/')}
          target="_blank"
          rel="noreferrer"
          className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
        >
          <span>Open in Nextcloud</span>
          <ExternalLink size={12} />
        </a>
      </div>
      <iframe
        src={embedUrl}
        title="Nextcloud Family Calendar"
        className="w-full border-0"
        style={{ height: '75vh' }}
      />
    </div>
  );
};

export default Calendar;
