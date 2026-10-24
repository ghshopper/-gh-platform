import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, imageUrl } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { useAuth, useFeature } from '../lib/store';
import type { ChatMessage, ChatResponse } from '../lib/types';
import { Icon } from './Icon';

/* Live chat with the GH team (feature "chat"): a floating button on every page,
   a panel that polls every 4 s while open, text + photo, and an optional
   "about" context (an order from the account page, a piece from its page). */

export interface ChatContext {
  psOrderId?: string;
  invoiceNo?: string | null;
  product?: { id: number; name: string; image?: string | null };
}

interface ChatApi {
  enabled: boolean;
  open: (ctx?: ChatContext) => void;
  unread: number;
}

const ChatCtx = createContext<ChatApi>({ enabled: false, open: () => undefined, unread: 0 });
export const useChat = () => useContext(ChatCtx);

const merge = (a: ChatMessage[], b: ChatMessage[]) => {
  if (!b.length) return a;
  const seen = new Set(a.map((m) => m.id));
  return [...a, ...b.filter((m) => !seen.has(m.id))].sort((x, y) => x.id - y.id);
};

function timeText(iso: string | null | undefined, isAr: boolean) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = new Date().toDateString() === d.toDateString();
  try {
    return d.toLocaleString(isAr ? 'ar-OM-u-nu-latn' : 'en-GB', sameDay ? { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Muscat' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Muscat' });
  } catch {
    return '';
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const flag = useFeature('chat');
  const { user } = useAuth();
  const [isOpen, setOpen] = useState(false);
  const [ctx, setCtx] = useState<ChatContext | null>(null);
  const [unread, setUnread] = useState(0);
  const enabled = !!flag;

  // closed: a light check for replies every minute (after the newest seen id)
  const lastSeen = useRef(0);
  useEffect(() => {
    if (!enabled || !user || isOpen) return;
    let alive = true;
    const check = () =>
      api.get<ChatResponse>('/customer/chat', lastSeen.current ? { after_id: lastSeen.current } : undefined).then((r) => {
        if (!alive) return;
        const msgs = r?.messages ?? [];
        if (msgs.length) lastSeen.current = Math.max(lastSeen.current, ...msgs.map((m) => m.id));
        setUnread(Number(r?.thread?.unread_customer ?? 0));
      }).catch(() => undefined);
    check();
    const t = setInterval(check, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [enabled, user, isOpen]);

  const open = useCallback((c?: ChatContext) => {
    setCtx(c ?? null);
    setOpen(true);
  }, []);

  return (
    <ChatCtx.Provider value={{ enabled, open, unread }}>
      {children}
      {enabled ? <ChatFab onOpen={() => open()} unread={unread} hidden={isOpen} /> : null}
      {enabled && isOpen ? <ChatPanel ctx={ctx} clearCtx={() => setCtx(null)} onClose={() => setOpen(false)} onRead={() => setUnread(0)} onSeen={(id) => (lastSeen.current = Math.max(lastSeen.current, id))} /> : null}
    </ChatCtx.Provider>
  );
}

function ChatFab({ onOpen, unread, hidden }: { onOpen: () => void; unread: number; hidden: boolean }) {
  const { tr } = usePrefs();
  const loc = useLocation();
  if (hidden || loc.pathname.startsWith('/checkout')) return null;
  return (
    <button className="chat-fab" onClick={onOpen} aria-label={tr('المحادثة المباشرة', 'Live chat')}>
      <Icon name="chat" size={22} />
      <span className="only-desktop">{tr('تحدّث معنا', 'Chat with us')}</span>
      {unread ? <b className="dot">{unread}</b> : null}
    </button>
  );
}

function ChatPanel({ ctx, clearCtx, onClose, onRead, onSeen }: { ctx: ChatContext | null; clearCtx: () => void; onClose: () => void; onRead: () => void; onSeen: (id: number) => void }) {
  const { tr, isAr, pick } = usePrefs();
  const flag = useFeature('chat');
  const { user } = useAuth();
  const loc = useLocation();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [hours, setHours] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && (zoom ? setZoom(null) : onClose());
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose, zoom]);

  // the first load, then every 4 s for anything newer
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async (first: boolean) => {
      try {
        const r = await api.get<ChatResponse>('/customer/chat', first ? undefined : { after_id: lastId.current || undefined });
        if (!alive) return;
        if (first) {
          setWelcome(r?.welcome ?? null);
          setHours(r?.hours ?? null);
        }
        const fresh = r?.messages ?? [];
        if (fresh.length) {
          setMsgs((m) => merge(m, fresh));
          lastId.current = Math.max(lastId.current, ...fresh.map((m) => m.id));
          onSeen(lastId.current);
        }
        if (first || fresh.some((m) => m.from === 'staff')) {
          api.post('/customer/chat/read').catch(() => undefined);
          onRead();
        }
      } catch (e) {
        if (first && alive) setErr(e instanceof Error ? e.message : null);
      } finally {
        if (first && alive) setLoading(false);
        if (alive) timer = setTimeout(() => tick(false), document.visibilityState === 'visible' ? 4000 : 15000);
      }
    };
    tick(true);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // newest at the bottom
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, loading]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !file) || busy) return;
    setBusy(true);
    setErr(null);
    try {
      let r: { message?: ChatMessage; data?: ChatMessage };
      if (file) {
        const f = new FormData();
        if (body) f.append('body', body);
        f.append('image', file);
        if (ctx?.psOrderId) f.append('ps_order_id', ctx.psOrderId);
        if (ctx?.product) f.append('product_id', String(ctx.product.id));
        r = await api.upload('/customer/chat', f);
      } else {
        r = await api.post('/customer/chat', { body, ps_order_id: ctx?.psOrderId || undefined, product_id: ctx?.product?.id || undefined });
      }
      const m = r?.message ?? r?.data;
      if (m?.id) {
        setMsgs((x) => merge(x, [m]));
        lastId.current = Math.max(lastId.current, m.id);
      }
      setText('');
      setFile(null);
      clearCtx();
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('تعذّر الإرسال', 'Could not send'));
    } finally {
      setBusy(false);
    }
  };

  const welcomeText = welcome || (flag ? pick(flag, 'welcome') : '') || tr('أهلاً فيك 🤍 كيف نقدر نساعدك؟', 'Welcome 🤍 How can we help?');
  const hoursText = hours || (flag ? pick(flag, 'hours') : '');

  return (
    <div className="chat-ov" onClick={onClose}>
      <section className="chat-panel" role="dialog" aria-modal="true" aria-label={tr('المحادثة المباشرة', 'Live chat')} onClick={(e) => e.stopPropagation()}>
        <header className="chat-head">
          <div className="chat-avatar">GH</div>
          <div>
            <b>GH Shopper</b>
            <span>{hoursText || tr('فريقنا معك', 'Our team is here')}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button>
        </header>

        {!user ? (
          <div className="chat-signin">
            <Icon name="chat" size={34} stroke={1.1} />
            <p>{tr('سجّل دخولك عشان نكلمك ونتابع معك طلباتك', 'Sign in so we can chat and follow your orders with you')}</p>
            <Link className="btn" to={`/account?next=${encodeURIComponent(loc.pathname + loc.search)}`} onClick={onClose}>{tr('تسجيل الدخول', 'Sign in')}</Link>
          </div>
        ) : (
          <>
            <div className="chat-list" ref={listRef} aria-live="polite">
              <div className="chat-msg staff"><div className="chat-bubble">{welcomeText}</div></div>
              {loading ? <div className="chat-loading">…</div> : null}
              {msgs.map((m) => (
                <div key={m.id} className={`chat-msg ${m.from === 'customer' ? 'me' : 'staff'}`}>
                  <div className="chat-bubble">
                    {m.ps_order ? <span className="chat-ref"><Icon name="box" size={13} /> {tr('بخصوص الطلب', 'About order')} <b className="l">{m.ps_order.invoice_no}</b></span> : null}
                    {m.product ? (
                      <Link className="chat-ref prod" to={`/product/${m.product.id}`} onClick={onClose}>
                        {m.product.image ? <img src={imageUrl(m.product.image)} alt="" /> : null}
                        <span>{m.product.name}</span>
                      </Link>
                    ) : null}
                    {m.image_url ? <button type="button" className="chat-img" onClick={() => setZoom(m.image_url!)}><img src={m.image_url} alt="" loading="lazy" /></button> : null}
                    {m.body ? <p>{m.body}</p> : null}
                  </div>
                  <small>{m.from === 'staff' && m.staff_name ? `${m.staff_name} · ` : ''}{timeText(m.created_at, isAr)}</small>
                </div>
              ))}
            </div>

            <form className="chat-compose" onSubmit={send}>
              {ctx?.psOrderId || ctx?.product ? (
                <div className="chat-ctx">
                  {ctx.product?.image ? <img src={imageUrl(ctx.product.image)} alt="" /> : <Icon name={ctx.product ? 'tag' : 'box'} size={16} />}
                  <span>{ctx.product ? tr(`بخصوص: ${ctx.product.name}`, `About: ${ctx.product.name}`) : tr(`بخصوص الطلب ${ctx.invoiceNo ?? ''}`, `About order ${ctx.invoiceNo ?? ''}`)}</span>
                  <button type="button" className="icon-btn" onClick={clearCtx} aria-label={tr('إزالة', 'Remove')}><Icon name="close" size={14} /></button>
                </div>
              ) : null}
              {preview ? (
                <div className="chat-preview">
                  <img src={preview} alt="" />
                  <button type="button" className="icon-btn" onClick={() => setFile(null)} aria-label={tr('إزالة الصورة', 'Remove photo')}><Icon name="close" size={14} /></button>
                </div>
              ) : null}
              {err ? <p className="err">{err}</p> : null}
              <div className="chat-row">
                <label className="icon-btn chat-attach" aria-label={tr('أرفق صورة', 'Attach a photo')}>
                  <Icon name="image" />
                  <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                </label>
                <textarea
                  rows={1}
                  value={text}
                  maxLength={2000}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={tr('اكتب رسالتك…', 'Write a message…')}
                />
                <button className="chat-send" disabled={busy || (!text.trim() && !file)} aria-label={tr('إرسال', 'Send')}>
                  {busy ? '…' : <Icon name="send" size={18} className="flip-rtl" />}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
      {zoom ? <div className="lightbox" onClick={(e) => { e.stopPropagation(); setZoom(null); }}><img src={zoom} alt="" /></div> : null}
    </div>
  );
}

/** "اسأل عن طلبك" / "اسأل عن القطعة": opens the chat about something (hidden when chat is off). */
export function AskButton({ ctx, label, className = 'btn ghost' }: { ctx: ChatContext; label: string; className?: string }) {
  const chat = useChat();
  if (!chat.enabled) return null;
  return (
    <button type="button" className={className} onClick={() => chat.open(ctx)}>
      <Icon name="chat" size={18} /> {label}
    </button>
  );
}
