import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, imageUrl, listOf } from '../lib/api';
import { inStock, isOnOrder, num, productAttributes, productImages } from '../lib/format';
import { useLoad, useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth, useToast, useWishlist } from '../lib/store';
import type { Product } from '../lib/types';
import { Icon } from '../components/Icon';
import { brandOf, OptionPicker, Price, ProductCard, useAddToBag } from '../components/ProductCard';

const WA = '96877246972';

interface Review {
  id: number;
  rating: number;
  comment?: string | null;
  user_name?: string | null;
  date?: string;
}

export default function ProductPage() {
  const { id } = useParams();
  const { tr, pick } = usePrefs();
  const { user } = useAuth();
  const wish = useWishlist();
  const { show } = useToast();
  const add = useAddToBag();
  const product = useLoad(async () => (await api.get<{ data?: Product } & Product>(`/customer/products/${id}`)).data ?? null, [id]);
  const p = product.data;
  const reviews = useLoad(async () => listOf<Review>(await api.get<unknown>(`/customer/products/${id}/reviews`)), [id]);
  const related = useLoad(async () => {
    if (!p?.category_id) return [] as Product[];
    return listOf<Product>(await api.get<unknown>('/customer/products', { category_id: p.category_id, per_page: 9 })).filter((x) => x.id !== p.id).slice(0, 8);
  }, [p?.category_id, p?.id]);
  const [img, setImg] = useState(0);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [guide, setGuide] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  useTitle(p ? `${brandOf(p)} ${pick(p, 'name')}` : '');
  useEffect(() => {
    setImg(0);
    setChosen({});
  }, [id]);

  if (product.loading && !p) return <div className="container page"><div className="pdp"><div className="skeleton tall" /><div className="skeleton" /></div></div>;
  if (!p) return <div className="container page empty"><p>{tr('القطعة غير متوفرة حالياً', 'This piece is not available')}</p><Link to="/shop" className="btn outline">{tr('تسوّق', 'Shop')}</Link></div>;

  const images = productImages(p);
  const attrs = productAttributes(p);
  const selectable = attrs.filter((a) => a.is_selectable !== false);
  const specs = attrs.filter((a) => a.is_selectable === false);
  const available = inStock(p);
  const saved = wish.has(p.id);
  const name = pick(p, 'name');
  const desc = pick(p, 'description');
  const avg = num(p.reviews_avg_rating);

  const addToBag = () => {
    const need = selectable.find((a) => !chosen[pick(a, 'name')]);
    if (need) return setMissing(pick(need, 'name'));
    add(p, chosen);
  };
  const ask = `https://wa.me/${WA}?text=${encodeURIComponent(tr(`مرحبا، أبي أسأل عن ${brandOf(p)} ${name}\n${window.location.href}`, `Hi, I'd like to ask about ${brandOf(p)} ${name}\n${window.location.href}`))}`;

  return (
    <div className="container page">
      <nav className="crumbs">
        <Link to="/">{tr('الرئيسية', 'Home')}</Link><span>/</span>
        {p.category_id ? <><Link to={`/shop?category=${p.category_id}`}>{p.category_name || tr('القسم', 'Category')}</Link><span>/</span></> : null}
        {p.brand_id ? <Link to={`/brand/${p.brand_id}`}>{brandOf(p).toUpperCase()}</Link> : null}
      </nav>
      <div className="pdp">
        <div className="gallery">
          <div className="thumbs">
            {images.map((im, i) => (
              <button key={i} className={i === img ? 'on' : ''} onClick={() => setImg(i)} aria-label={`${i + 1}`}><img src={imageUrl(im)} alt="" /></button>
            ))}
          </div>
          <div className="main-img" onClick={() => images.length && setZoom(true)}>
            {images[img] ? <img src={imageUrl(images[img])} alt={name} /> : <span className="ph">{brandOf(p).toUpperCase()}</span>}
          </div>
          {p.video_url ? <video className="pdp-video" src={imageUrl(p.video_url)} controls playsInline muted /> : null}
        </div>
        <div className="info">
          {p.brand_id ? <Link to={`/brand/${p.brand_id}`} className="brand big">{brandOf(p).toUpperCase()}</Link> : null}
          <h1 className="pdp-name">{name}</h1>
          <Price p={p} big />
          <div className="pdp-tags">
            <span className={`avail${!available ? ' out' : isOnOrder(p) ? ' order' : ''}`}><i />{!available ? tr('نفدت الكمية', 'Sold out') : isOnOrder(p) ? tr('بالطلب · نجيبها لك بعد الطلب', 'On order · we source it for you') : tr('تسليم فوري', 'Ready to deliver')}</span>
            <span className="tag">{tr('أصلية ١٠٠٪', '100% authentic')}</span>
            {avg > 0 ? <span className="tag"><Icon name="star" size={14} /> {avg.toFixed(1)} ({num(p.reviews_count)})</span> : null}
          </div>
          {(p.variants ?? []).length > 1 ? (
            <div className="opt">
              <div className="opt-label">{tr('اللون', 'Colour')}{pick(p, 'variant') ? <span>: {pick(p, 'variant')}</span> : null}</div>
              <div className="opt-values">
                {(p.variants ?? []).map((v) => {
                  const label = pick(v, 'variant') || `#${v.id}`;
                  const pic = v.variant_image || (!v.variant_hex ? v.primary_image : null);
                  return (
                    <Link key={v.id} to={`/product/${v.id}`} replace className={`vswatch${v.id === p.id ? ' on' : ''}`} title={label} aria-label={label} aria-current={v.id === p.id ? 'true' : undefined}>
                      {pic ? <img src={imageUrl(pic)} alt="" /> : v.variant_hex ? <span style={{ background: v.variant_hex }} /> : <b>{label}</b>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
          <OptionPicker product={p} chosen={chosen} setChosen={(c) => { setChosen(c); setMissing(null); }} />
          {missing ? <p className="err">{tr(`اختر ${missing} أول`, `Choose ${missing} first`)}</p> : null}
          {p.size_guide_image ? <button className="link small" onClick={() => setGuide(true)}>{tr('دليل المقاسات', 'Size guide')}</button> : null}
          <div className="pdp-actions">
            <button className="btn grow" disabled={!available} onClick={addToBag}><Icon name="bagAdd" /> {available ? tr('أضف إلى السلة', 'Add to bag') : tr('نفدت الكمية', 'Sold out')}</button>
            <button
              className={`btn outline square${saved ? ' on' : ''}`}
              aria-label={tr('المفضلة', 'Wishlist')}
              onClick={async () => {
                if (!(await wish.toggle(p))) show(tr('سجّل دخولك لحفظ القطع', 'Sign in to save pieces'), { label: tr('تسجيل الدخول', 'Sign in'), to: '/account' });
              }}
            >
              <Icon name={saved ? 'heartFill' : 'heart'} />
            </button>
          </div>
          <a className="btn ghost" href={ask} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> {tr('اسأل عن القطعة على واتساب', 'Ask about it on WhatsApp')}</a>
          <ul className="perks">
            <li><Icon name="shield" size={18} />{tr('من البوتيك مباشرة، مع الفاتورة الأصلية', 'Straight from the boutique, with the original receipt')}</li>
            <li><Icon name="truck" size={18} />{tr('توصيل لكل عُمان: مندوبنا في مسقط وبركاء، وجيناكم لباب البيت أو من مكتبهم', 'Delivery across Oman: our driver in Muscat & Barka, Genacom to your door or office')}</li>
            <li><Icon name="gift" size={18} />{tr('تقدر ترسلها هدية مع رسالة', 'Send it as a gift with a message')}</li>
          </ul>
          {desc ? <details open><summary>{tr('الوصف', 'Description')}</summary><p className="desc">{desc}</p></details> : null}
          {specs.length ? (
            <details open>
              <summary>{tr('التفاصيل', 'Details')}</summary>
              <dl className="specs">{specs.map((a, i) => <div key={i}><dt>{pick(a, 'name')}</dt><dd>{(a.values ?? []).map((v) => pick(v, 'value')).join('، ')}</dd></div>)}</dl>
            </details>
          ) : null}
          <details>
            <summary>{tr('التقييمات', 'Reviews')} ({(reviews.data ?? []).length})</summary>
            {(reviews.data ?? []).slice(0, 10).map((r) => (
              <div key={r.id} className="review">
                <div className="stars">{'★'.repeat(Math.round(r.rating))}<span>{'★'.repeat(5 - Math.round(r.rating))}</span></div>
                {r.comment ? <p>{r.comment}</p> : null}
                <small className="muted">{r.user_name ?? ''} {r.date ? `· ${r.date}` : ''}</small>
              </div>
            ))}
            {user ? (
              <form
                className="review-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const r = await api.post<{ message?: string }>(`/customer/products/${p.id}/reviews`, { rating, comment: comment.trim() || null });
                    setComment('');
                    show(r?.message || tr('شكراً، بيظهر تقييمك بعد المراجعة', 'Thanks — your review appears after approval'));
                  } catch (err) {
                    show(err instanceof Error ? err.message : tr('تعذّر الإرسال', 'Could not send'));
                  }
                }}
              >
                <div className="stars pick">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>)}</div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tr('رأيك في القطعة', 'Your thoughts')} rows={3} />
                <button className="btn outline">{tr('أرسل التقييم', 'Send review')}</button>
              </form>
            ) : null}
          </details>
        </div>
      </div>

      {(related.data ?? []).length ? (
        <section className="section">
          <div className="sec-head"><div><span className="kicker">YOU MAY ALSO LIKE</span><h2>{tr('قد يعجبك أيضاً', 'You may also like')}</h2></div></div>
          <div className="grid">{(related.data ?? []).map((r) => <ProductCard key={r.id} product={r} />)}</div>
        </section>
      ) : null}

      {zoom ? (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <img src={imageUrl(images[img])} alt="" />
          <button className="icon-btn" aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button>
        </div>
      ) : null}
      {guide && p.size_guide_image ? (
        <div className="lightbox" onClick={() => setGuide(false)}><img src={imageUrl(p.size_guide_image)} alt="" /></div>
      ) : null}
    </div>
  );
}
