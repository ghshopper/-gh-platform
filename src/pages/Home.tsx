import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, asset, imageUrl, listOf } from '../lib/api';
import { num } from '../lib/format';
import { useLoad, useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useData } from '../lib/store';
import type { HeroSlide, Product, SectionSetting } from '../lib/types';
import { CategoryArt } from '../components/CategoryArt';
import { Icon } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { GenderSwitch } from '../components/Layout';

const active = (s?: SectionSetting) => !s || (s.is_active !== 0 && s.is_active !== false);

function slideLink(s: HeroSlide): string | null {
  const v = s.link_value ?? '';
  if (!v) return null;
  switch (s.link_type) {
    case 'category': return `/shop?category=${v}`;
    case 'brand': return `/brand/${v}`;
    case 'product': return `/product/${v}`;
    case 'url': return v;
    default: return null;
  }
}

function Hero({ slides }: { slides: HeroSlide[] }) {
  const { pick, tr } = usePrefs();
  const [i, setI] = useState(0);
  const list = slides.length ? slides : [null];
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [list.length]);
  const s = list[i];
  const href = s ? slideLink(s) : '/shop';
  const title = s ? pick(s, 'title') : '';
  return (
    <section className="hero">
      <div className="hero-media">
        {list.map((x, k) => (
          <img key={k} src={x?.full_image_url ? imageUrl(x.full_image_url) : asset('hero.jpg')} alt="" className={k === i ? 'on' : ''} />
        ))}
      </div>
      <div className="hero-copy">
        <span className="kicker gold">THE WORLD OF LUXURY</span>
        {title ? <h1>{title}</h1> : <h1 className="serif">The World of Luxury</h1>}
        <p>{(s && pick(s, 'subtitle')) || tr('عالم من الفخامة في مكان واحد. نشتري لك من أرقى البوتيكات حول العالم، ونوصلها لبابك في عُمان.', 'A world of luxury in one place. We buy from the finest boutiques worldwide and deliver to your door in Oman.')}</p>
        <div className="hero-cta">
          {href && href.startsWith('http') ? (
            <a className="btn" href={href}>{(s && pick(s, 'button_text')) || tr('تسوّق الآن', 'Shop now')}</a>
          ) : (
            <Link className="btn" to={href ?? '/shop'}>{(s && pick(s, 'button_text')) || tr('تسوّق الآن', 'Shop now')}</Link>
          )}
          <Link className="btn outline" to="/request">{tr('اطلب قطعة', 'Request a piece')}</Link>
        </div>
        {list.length > 1 ? (
          <div className="dots">{list.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`${k + 1}`} />)}</div>
        ) : null}
      </div>
    </section>
  );
}

function Rail({ title, kicker, to, products }: { title: string; kicker: string; to: string; products: Product[] }) {
  const { tr, isAr } = usePrefs();
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (isAr ? -1 : 1) * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  if (!products.length) return null;
  return (
    <section className="section container">
      <div className="sec-head">
        <div><span className="kicker">{kicker}</span><h2>{title}</h2></div>
        <div className="sec-tools">
          <Link to={to} className="link">{tr('عرض الكل', 'View all')}</Link>
          <button className="icon-btn ring only-desktop" onClick={() => scroll(-1)} aria-label={tr('السابق', 'Previous')}><Icon name={isAr ? 'forward' : 'back'} /></button>
          <button className="icon-btn ring only-desktop" onClick={() => scroll(1)} aria-label={tr('التالي', 'Next')}><Icon name={isAr ? 'back' : 'forward'} /></button>
        </div>
      </div>
      <div className="rail" ref={ref}>
        {products.map((p) => <div key={p.id} className="rail-item"><ProductCard product={p} /></div>)}
      </div>
    </section>
  );
}

export default function Home() {
  const { tr, pick, gender } = usePrefs();
  useTitle('');
  const { home, categories, brands } = useData();
  const sections = home?.sections ?? {};
  const g = gender || undefined;
  const featured = useLoad(async () => listOf<Product>(await api.get<unknown>('/customer/products/featured', { gender: g })), [gender]);
  const latest = useLoad(async () => listOf<Product>(await api.get<unknown>('/customer/products', { per_page: 24, gender: g })), [gender]);
  const fast = useLoad(async () => listOf<Product>(await api.get<unknown>('/customer/products', { per_page: 12, fast: 1, gender: g })), [gender]);
  const sale = (latest.data ?? []).filter((p) => num(p.compare_price) > 0);
  const t = (s: SectionSetting | undefined, ar: string, en: string) => (s ? pick(s, 'title') : '') || tr(ar, en);

  return (
    <>
      <Hero slides={home?.hero_slides ?? []} />
      <div className="container only-mobile g-home"><GenderSwitch /></div>

      {active(sections.categories) && categories.length ? (
        <section className="section container">
          <div className="sec-head">
            <div><span className="kicker">SHOP BY CATEGORY</span><h2>{t(sections.categories, 'تسوّق حسب الفئة', 'Shop by category')}</h2></div>
            <Link to="/categories" className="link">{tr('كل الأقسام', 'All categories')}</Link>
          </div>
          <div className="cat-grid">
            {categories.slice(0, 8).map((c, i) => (
              <Link key={c.id} to={`/shop?category=${c.id}`} className={i === 0 ? 'wide' : ''}><CategoryArt c={c} index={i} /></Link>
            ))}
          </div>
        </section>
      ) : null}

      <Rail kicker="NEW IN" title={tr('وصل حديثاً', 'New in')} to="/shop" products={(latest.data ?? []).slice(0, 12)} />

      <Rail kicker="FAST DELIVERY" title={tr('توصيل سريع', 'Fast delivery')} to="/shop?fast=1" products={(fast.data ?? []).slice(0, 12)} />

      <section className="editorial container">
        <div className="editorial-img"><img src={asset('bags.jpg')} alt="" loading="lazy" /></div>
        <div className="editorial-copy">
          <span className="kicker gold">PERSONAL SHOPPING</span>
          <h2>{tr('ما لقيت القطعة؟ نجيبها لك', "Can't find it? We'll get it")}</h2>
          <p>{tr('صوّر القطعة أو الصق رابطها من أي بوتيك في العالم، ونشتريها لك ونوصلها لبابك في عُمان مع الفاتورة الأصلية.', 'Send a photo or a link from any boutique in the world. We buy it for you and deliver it to your door in Oman, with the original receipt.')}</p>
          <ol className="steps-list">
            <li><b>01</b>{tr('أرسل القطعة', 'Send the piece')}</li>
            <li><b>02</b>{tr('نأكد السعر', 'We confirm the price')}</li>
            <li><b>03</b>{tr('نشتريها ونوصلها', 'We buy and deliver')}</li>
          </ol>
          <Link to="/request" className="btn">{tr('اطلب قطعة', 'Request a piece')}</Link>
        </div>
      </section>

      {active(sections.featured_products) ? (
        <Rail kicker="EDITOR'S PICKS" title={t(sections.featured_products, 'منتجات مميزة', 'Featured')} to="/shop" products={(featured.data ?? []).slice(0, 12)} />
      ) : null}

      {sections.flash_sales && active(sections.flash_sales) ? (
        <Rail kicker="EXCLUSIVE OFFERS" title={t(sections.flash_sales, 'عروض حصرية', 'Exclusive offers')} to="/shop?sort=price_asc" products={sale.slice(0, 12)} />
      ) : null}

      {active(sections.brands) && brands.length ? (
        <section className="section container">
          <div className="sec-head">
            <div><span className="kicker">DESIGNERS</span><h2>{t(sections.brands, 'البراندات', 'Designers')}</h2></div>
            <Link to="/brands" className="link">{tr('كل البراندات A–Z', 'All designers A–Z')}</Link>
          </div>
          <div className="brand-wall">
            {brands.slice(0, 18).map((b) => (
              <Link key={b.id} to={`/brand/${b.id}`}>{(b.name_en || b.name_ar || '').toUpperCase()}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {active(sections.loyalty_program) ? (
        <section className="loyalty">
          <div className="container loyalty-row">
            <div>
              <span className="kicker gold">GH LOYALTY</span>
              <h2>{(sections.loyalty_program ? pick(sections.loyalty_program, 'title') : '') || tr('برنامج الولاء', 'Loyalty program')}</h2>
              <p>{tr('اجمع النقاط مع كل طلب واستبدلها بخصم على طلباتك الجاية.', 'Earn points with every order and redeem them on your next ones.')}</p>
            </div>
            <Link to="/account" className="btn light">{tr('انضم الآن', 'Join now')}</Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
