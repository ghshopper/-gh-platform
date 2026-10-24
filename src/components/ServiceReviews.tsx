import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { dateText } from '../lib/format';
import { useLoad } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth, useFeature } from '../lib/store';
import type { PublicServiceReviews, ServiceReviewPending } from '../lib/types';
import { Icon } from './Icon';
import { Stars } from './Stars';

/* Service reviews (feature reviews, setting service): the "how was it?" prompt
   for a recently delivered order, and the "آراء عملائنا" block on Home. */

const LATER_KEY = 'gh_review_later';
const keyOf = (p: ServiceReviewPending) => String(p.ps_order_id ?? p.order_id ?? p.invoice_no ?? '');
const readLater = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(LATER_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function useServiceOn() {
  const f = useFeature('reviews');
  return !!f && f.service !== false;
}

export function ServiceReviewPrompt() {
  const on = useServiceOn();
  const { user } = useAuth();
  const { tr, isAr } = usePrefs();
  const pending = useLoad(async () => (on && user ? await api.get<unknown>('/customer/service-reviews/pending') : null), [on, user?.id]);
  const [later, setLater] = useState<string[]>(readLater);
  const [done, setDone] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  if (!on || !user) return null;
  const raw = pending.data;
  const list: ServiceReviewPending[] = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: ServiceReviewPending[] }).data : [];
  const cur = list.find((p) => !later.includes(keyOf(p)) && !done.includes(keyOf(p)));
  if (thanks) {
    return (
      <div className="svc-prompt thanks">
        <Icon name="check" size={22} />
        <p>{tr('شكراً لك 🤍 رأيك يفرق معنا', 'Thank you 🤍 Your feedback means a lot')}</p>
        <button className="icon-btn" onClick={() => setThanks(false)} aria-label={tr('إغلاق', 'Close')}><Icon name="close" size={16} /></button>
      </div>
    );
  }
  if (!cur) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setErr(tr('اختر عدد النجوم', 'Choose a rating'));
    setBusy(true);
    setErr(null);
    try {
      await api.post('/customer/service-reviews', { rating, comment: comment.trim() || undefined, order_id: cur.order_id || undefined, ps_order_id: cur.ps_order_id || undefined });
      setDone((d) => [...d, keyOf(cur)]);
      setRating(0);
      setComment('');
      setThanks(true);
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('تعذّر الإرسال', 'Could not send'));
    } finally {
      setBusy(false);
    }
  };
  const remindLater = () => {
    const next = [...later, keyOf(cur)];
    setLater(next);
    try {
      localStorage.setItem(LATER_KEY, JSON.stringify(next.slice(-50)));
    } catch {
      // ignore
    }
  };
  return (
    <form className="svc-prompt" onSubmit={submit}>
      <div className="svc-q">
        <span className="kicker gold">YOUR EXPERIENCE</span>
        <h3>{tr('كيف كانت تجربتك معنا؟', 'How was your experience with us?')}</h3>
        <p className="small muted">{tr('طلبك', 'Your order')} <b className="l">{cur.invoice_no}</b>{cur.delivered_at ? ` · ${tr('وصلك', 'delivered')} ${dateText(cur.delivered_at, isAr)}` : ''}</p>
      </div>
      <div className="stars pick big" role="radiogroup" aria-label={tr('التقييم', 'Rating')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n}`} aria-checked={n === rating} role="radio">★</button>
        ))}
      </div>
      {rating ? <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tr('كلمة عن تجربتك (اختياري)', 'A word about your experience (optional)')} maxLength={1000} /> : null}
      {err ? <p className="err">{err}</p> : null}
      <div className="svc-actions">
        <button className="btn small-btn" disabled={busy || !rating}>{busy ? '…' : tr('أرسل', 'Send')}</button>
        <button type="button" className="link small" onClick={remindLater}>{tr('لاحقاً', 'Later')}</button>
      </div>
    </form>
  );
}

/** "آراء عملائنا": the approved service reviews (latest 20 from the server). */
export function CustomerReviews() {
  const on = useServiceOn();
  const { tr, isAr } = usePrefs();
  const data = useLoad(async () => (on ? await api.get<PublicServiceReviews>('/app/service-reviews') : null), [on]);
  const ref = useRef<HTMLDivElement>(null);
  const d = data.data;
  const rows = (d?.data ?? []).filter((r) => r && r.rating);
  if (!on || !d || !rows.length) return null;
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (isAr ? -1 : 1) * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="section container testimonials">
      <div className="sec-head">
        <div>
          <span className="kicker">TESTIMONIALS</span>
          <h2>{tr('آراء عملائنا', 'What our clients say')}</h2>
        </div>
        <div className="sec-tools">
          {d.count ? <span className="t-score"><Stars value={Number(d.avg) || 0} size={15} /><b className="num">{(Number(d.avg) || 0).toFixed(1)}</b><span className="small muted">{tr(`من ${d.count} تقييم`, `from ${d.count} reviews`)}</span></span> : null}
          <button className="icon-btn ring only-desktop" onClick={() => scroll(-1)} aria-label={tr('السابق', 'Previous')}><Icon name={isAr ? 'forward' : 'back'} /></button>
          <button className="icon-btn ring only-desktop" onClick={() => scroll(1)} aria-label={tr('التالي', 'Next')}><Icon name={isAr ? 'back' : 'forward'} /></button>
        </div>
      </div>
      <div className="t-rail" ref={ref}>
        {rows.map((r, i) => (
          <figure key={i} className="t-card">
            <Stars value={r.rating} size={14} />
            <blockquote>{r.comment?.trim() || tr('تجربة ممتازة', 'An excellent experience')}</blockquote>
            <figcaption><b>{r.first_name || tr('عميل GH', 'GH client')}</b>{r.created_at ? <span className="small muted"> · {dateText(r.created_at, isAr)}</span> : null}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
