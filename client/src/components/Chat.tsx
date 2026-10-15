import { useState, useEffect } from 'react';
import api from '../services/api';
import { AlertTriangle, ExternalLink } from 'lucide-react';

/**
 * Embeds the family's Element web (Matrix) chat client so the family-bot
 * conversation, budget/inbox/etc rooms are reachable without leaving the
 * board. Element isn't behind Cloudflare Access, so this frames cleanly;
 * the first time it loads in a given browser it'll show Element's normal
 * login screen, same as visiting chat.stephanfamily.com directly.
 */
const Chat = () => {
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/config');
        setChatUrl(res.data.chatUrl);
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

  if (!chatUrl) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 space-y-3">
        <AlertTriangle className="text-amber-500" size={32} />
        <p className="text-slate-400 max-w-md">
          The family chat isn't linked up yet. Set{' '}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-400">CHAT_URL</code>{' '}
          in the server's environment to the Element web URL.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h2 className="text-lg font-bold text-white">Family Chat</h2>
        <a
          href={chatUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300"
        >
          <span>Open in new tab</span>
          <ExternalLink size={12} />
        </a>
      </div>
      <iframe
        src={chatUrl}
        title="Family Chat"
        className="w-full border-0"
        style={{ height: '80vh' }}
        allow="clipboard-write; camera; microphone"
      />
    </div>
  );
};

export default Chat;
