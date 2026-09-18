import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Chat() {
  const [channels, setChannels] = useState<any[]>([]);
  const [channelId, setChannelId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newChannel, setNewChannel] = useState('');

  const loadMessages = async (id: string) => {
    const response = await api.get(`/chat/channels/${id}/messages`);
    setMessages(response.data);
  };

  const load = async () => {
    try {
      const response = await api.get('/chat/channels');
      const nextChannels = response.data;
      setChannels(nextChannels);
      const nextChannel = nextChannels.find((channel: any) => channel.id === channelId) || nextChannels[0];
      if (nextChannel) {
        setChannelId(nextChannel.id);
        await loadMessages(nextChannel.id);
      }
    } catch {
      setError('Unable to load household chat.');
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!channelId) return undefined;
    const interval = window.setInterval(() => {
      void loadMessages(channelId).catch(() => setError('Unable to refresh household chat.'));
    }, 10000);
    return () => window.clearInterval(interval);
  }, [channelId]);

  const send = async () => {
    if (!channelId || !body.trim()) return;
    try {
      await api.post(`/chat/channels/${channelId}/messages`, { body });
      setBody('');
      await loadMessages(channelId);
    } catch {
      setError('Unable to send message.');
    }
  };

  const createChannel = async () => {
    if (!newChannel.trim()) return;
    try {
      await api.post('/chat/channels', { name: newChannel });
      setNewChannel('');
      await load();
    } catch {
      setError('Unable to create channel.');
    }
  };

  return (
    <section className="grid gap-4 md:grid-cols-[220px_1fr]">
      {error && <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-red-300 md:col-span-2">{error}</p>}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-3 font-bold">Household chat</h2>
        <div className="mb-3 flex gap-1">
          <input value={newChannel} onChange={(event) => setNewChannel(event.target.value)} className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1 text-sm" placeholder="new channel" />
          <button onClick={() => void createChannel()} className="rounded bg-slate-800 px-2 text-sm">+</button>
        </div>
        {channels.map((channel) => (
          <button key={channel.id} onClick={async () => { setChannelId(channel.id); await loadMessages(channel.id); }} className="block w-full rounded px-3 py-2 text-left text-slate-300 hover:bg-slate-800">
            #{channel.name} {channel.unread && <span className="float-right text-xs text-sky-400">new</span>}
          </button>
        ))}
        {!channels.length && <p className="text-sm text-slate-500">Create a channel through the API to begin.</p>}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="min-h-[360px] space-y-3">
          {messages.map((message) => <p key={message.id}><strong className="text-sky-400">{message.author.name}:</strong> {message.body}</p>)}
        </div>
        {channelId && <div className="flex gap-2"><input value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void send()} className="flex-1 rounded bg-slate-800 px-3 py-2" placeholder="Write a message..." /><button onClick={() => void send()} className="rounded bg-sky-600 px-4">Send</button></div>}
      </div>
    </section>
  );
}
