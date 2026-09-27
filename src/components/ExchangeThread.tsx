import { useRef, useState } from 'react';
import { useExchangeMessages, useSendExchangeMessage } from '@/hooks/api/useApi';

/** Plain text only. Never render contact details, HTML or external links automatically. */
export function ExchangeThread({ requestId, userId, status }: { requestId: string; userId: string; status: string }) {
  const [open, setOpen] = useState(false);
  return <section aria-label="Exchange conversation">
    <button type="button" className="text-sm text-primary underline py-2" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Hide conversation' : 'Open conversation'}
    </button>
    {open && <ThreadContents requestId={requestId} userId={userId} status={status} />}
  </section>;
}

function ThreadContents({ requestId, userId, status }: { requestId: string; userId: string; status: string }) {
  const query = useExchangeMessages(requestId, userId);
  const send = useSendExchangeMessage(requestId, userId);
  const [body, setBody] = useState('');
  const retry = useRef<{ body: string; clientId: string } | null>(null);
  const busy = useRef(false);
  const writable = ['SENT', 'ACCEPTED', 'MEETING_SCHEDULED'].includes(status.toUpperCase());
  const messages = [...(query.data?.pages ?? [])].reverse().flatMap(page => page.data.messages);
  const unique = messages.filter((m, i) => messages.findIndex(other => other.id === m.id) === i);
  return <div className="space-y-3 border-t border-white/10 pt-3">
    <p className="text-xs text-white/60">Arrange a public campus meeting. Never share passwords, OTPs or payment details. Participants and campus administrators can read this thread. Use the exchange dispute action to report abuse.</p>
    {query.isPending && <p role="status">Loading conversation…</p>}
    {query.isError && <div role="alert">Could not load the conversation. <button type="button" onClick={() => query.refetch()}>Retry</button></div>}
    {query.hasNextPage && <button type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load earlier messages</button>}
    <ol aria-label="Messages" className="max-h-80 overflow-y-auto space-y-3">
      {unique.map(message => <li key={message.id} className="rounded border border-white/10 p-3">
        <p className="text-xs text-primary">{message.senderId === userId ? 'You' : 'Exchange partner'} · <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></p>
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
      </li>)}
    </ol>
    {!query.isPending && !query.isError && unique.length === 0 && <p className="text-sm">No messages yet. Suggest a meeting time and place.</p>}
    {writable ? <form onSubmit={async event => {
      event.preventDefault();
      if (busy.current || !body.trim()) return;
      busy.current = true;
      const text = body.trim();
      if (!retry.current || retry.current.body !== text) retry.current = { body: text, clientId: crypto.randomUUID() };
      try { await send.mutateAsync(retry.current); setBody(''); retry.current = null; }
      catch { /* Error is rendered below. Keep text and key for safe retry. */ }
      finally { busy.current = false; }
    }} className="space-y-2">
      <label htmlFor={`message-${requestId}`} className="block text-sm">Message your exchange partner</label>
      <textarea id={`message-${requestId}`} value={body} onChange={e => setBody(e.target.value)} maxLength={2000} required disabled={send.isPending}
        className="w-full bg-black/20 border border-white/20 rounded p-3 text-sm" rows={3} />
      <p className="text-xs text-white/60">{body.length}/2000</p>
      {send.isError && <p role="alert">{send.error.message || 'Message not sent. Please retry.'}</p>}
      <button type="submit" disabled={send.isPending || !body.trim()} className="px-4 py-2 border border-primary text-primary disabled:opacity-50">{send.isPending ? 'Sending…' : 'Send message'}</button>
    </form> : <p role="status" className="text-sm">This exchange is read-only. Its conversation remains available for review.</p>}
  </div>;
}
