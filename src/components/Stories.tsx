import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, imageUrl } from '../lib/api';
import { omr, productPrice, productWasPrice } from '../lib/format';
import { useLoad } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useFeature } from '../lib/store';
import type { Product, WeeklyProduct } from '../lib/types';
import { Icon } from './Icon';

/* "جديدنا هذا الأسبوع" (feature weekly_new): round story bubbles on Home and a
   full-screen viewer — one piece per story, 5 s each, progress bars on top. */

const SEEN_KEY = 'gh_seen_stories';
const STORY_MS = 5000;

function readSeen(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
function writeSeen(ids: number[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-300)));
  } catch {
    // ignore
  }
}

const imgOf = (p: WeeklyProduct) => p.image || p.images?.[0] || '';
const asProduct = (p: WeeklyProduct) => p as unknown as Product;

export function WeeklyStories() {
  const flag = useFeature('weekly_new');
  const { pick, tr } = usePrefs();
  const weekly = useLoad(async () => (flag ? await api.get<{ title_ar?: string; title_en?: string; products?: WeeklyProduct[] }>('/app/weekly') : null), [!!flag]);
  const [seen, setSeen] = useState<number[]>(readSeen);
  const [open, setOpen] = useState<{ list: WeeklyProduct[]; at: number } | null>(null);
  const products = (weekly.data?.products ?? []).filter((p) => p && p.id);
  if (!flag || !products.length) return null;
  const title = (weekly.data ? pick(weekly.data, 'title') : '') || pick(flag, 'title') || tr('جديدنا هذا الأسبوع', 'New this week');
  const markSeen = (id: number) =>
    setSeen((s) => {
      if (s.includes(id)) return s;
      const next = [...s, id];
      writeSeen(next);
      return next;
    });
  // unseen first keeps the row inviting; the viewer follows the same order
  const ordered = [...products.filter((p) => !seen.includes(p.id)), ...products.filter((p) => seen.includes(p.id))];

  return (
    <section className="stories container" aria-label={title}>
      <div className="stories-head"><span className="kicker gold">NEW THIS WEEK</span><h2>{title}</h2></div>
      <div className="stories-row">
        {ordered.map((p, i) => (
          <button key={p.id} className={`story-bubble${seen.includes(p.id) ? ' seen' : ''}`} onClick={() => setOpen({ list: ordered, at: i })}>
            <span className="story-ring"><span className="story-img">{imgOf(p) ? <img src={imageUrl(imgOf(p))} alt="" loading="lazy" /> : <b>{(p.brand || 'GH').slice(0, 2)}</b>}</span></span>
            <span className="story-name l">{(p.brand || pick(p, 'name')).toUpperCase()}</span>
          </button>
        ))}
      </div>
      {/* the order is frozen while viewing, so marking seen does not reshuffle it */}
      {open ? <StoryViewer products={open.list} start={open.at} onSeen={markSeen} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

export function StoryViewer({ products, start, onSeen, onClose }: { products: WeeklyProduct[]; start: number; onSeen: (id: number) => void; onClose: () => void }) {
  const { pick, tr, isAr } = usePrefs();
  const navigate = useNavigate();
  const [i, setI] = useState(start);
  const [hold, setHold] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const p = products[i];

  const next = () => (i + 1 < products.length ? setI(i + 1) : onClose());
  const prev = () => (i > 0 ? setI(i - 1) : setI(0));

  useEffect(() => {
    setLoaded(!imgOf(products[i]));
    if (products[i]) onSeen(products[i].id);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: arrows follow the reading direction, Esc closes
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') (isAr ? prev : next)();
      else if (e.key === 'ArrowLeft') (isAr ? next : prev)();
      else if (e.key === ' ') {
        e.preventDefault();
        setHold((h) => !h);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  // no page scroll behind the viewer
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!p) return null;
  const price = productPrice(asProduct(p));
  const was = productWasPrice(asProduct(p));
  const paused = hold || !loaded;

  // tap the side you read towards for the next one (left in Arabic, right in English)
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const leftHalf = e.clientX - r.left < r.width / 2;
    if (leftHalf === isAr) next();
    else prev();
  };

  return (
    <div className="story-ov" role="dialog" aria-modal="true" aria-label={tr('القصص', 'Stories')}>
      <div className="story-frame">
        <div className="story-bars" dir="ltr">
          {(isAr ? [...products].reverse() : products).map((x) => {
            const k = products.indexOf(x);
            return (
              <span key={x.id} className="story-bar">
                <i
                  key={k === i ? `on-${i}` : `off-${k}`}
                  className={k < i ? 'done' : k === i ? 'run' : ''}
                  style={k === i ? { animationDuration: `${STORY_MS}ms`, animationPlayState: paused ? 'paused' : 'running', transformOrigin: isAr ? 'right' : 'left' } : { transformOrigin: isAr ? 'right' : 'left' }}
                  onAnimationEnd={k === i ? next : undefined}
                />
              </span>
            );
          })}
        </div>
        <div className="story-top">
          <span className="kicker gold">NEW THIS WEEK</span>
          <span className="story-count num">{i + 1} / {products.length}</span>
          <button className="icon-btn" onClick={onClose} aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button>
        </div>

        <div
          className="story-media"
          onClick={onTap}
          onPointerDown={() => setHold(true)}
          onPointerUp={() => setHold(false)}
          onPointerLeave={() => setHold(false)}
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() })}
          onTouchEnd={(e) => {
            const s = touch.current;
            touch.current = null;
            if (!s) return;
            const dy = e.changedTouches[0].clientY - s.y;
            const dx = e.changedTouches[0].clientX - s.x;
            if (dy > 80 && Math.abs(dy) > Math.abs(dx)) onClose(); // swipe down closes
          }}
        >
          {imgOf(p) ? <img key={p.id} src={imageUrl(imgOf(p))} alt={pick(p, 'name')} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} draggable={false} /> : <span className="ph">{(p.brand || '').toUpperCase()}</span>}
          <button type="button" className="story-nav prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label={tr('السابق', 'Previous')}><Icon name={isAr ? 'forward' : 'back'} /></button>
          <button type="button" className="story-nav next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label={tr('التالي', 'Next')}><Icon name={isAr ? 'back' : 'forward'} /></button>
        </div>

        <div className="story-info">
          {p.brand ? <div className="brand big">{p.brand.toUpperCase()}</div> : null}
          <div className="story-pname">{pick(p, 'name')}</div>
          <div className="price big">
            <span className={was ? 'sale' : ''}>{omr(price)}</span>
            {was ? <s>{omr(was)}</s> : null}
          </div>
          <button className="btn light wide" onClick={() => { onClose(); navigate(`/product/${p.id}`); }}>{tr('شوف القطعة', 'See the piece')}</button>
        </div>
      </div>
    </div>
  );
}
