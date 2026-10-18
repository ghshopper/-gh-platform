import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, imageUrl, listOf } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useData } from '../lib/store';
import type { Paginated, Product } from '../lib/types';
import { Icon } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';

interface AttributeRow {
  id: number;
  name_ar?: string;
  name_en?: string;
  values?: { id: number; value_ar?: string; value_en?: string; color_code?: string | null }[];
}

const SORTS = [
  { key: 'new', ar: 'الأحدث', en: 'Newest', field: 'created_at', dir: 'desc' },
  { key: 'price_asc', ar: 'السعر: من الأقل', en: 'Price: low to high', field: 'price', dir: 'asc' },
  { key: 'price_desc', ar: 'السعر: من الأعلى', en: 'Price: high to low', field: 'price', dir: 'desc' },
  { key: 'old', ar: 'الأقدم', en: 'Oldest', field: 'created_at', dir: 'asc' },
];

/** Product listing for everything: new in, a category, a brand, a search. */
export default function Shop() {
  const { tr, pick } = usePrefs();
  const { brand: brandParam } = useParams();
  const [sp, setSp] = useSearchParams();
  const { categories, brands } = useData();
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attrs, setAttrs] = useState<AttributeRow[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const category = sp.get('category') ?? '';
  const brand = brandParam ?? sp.get('brand') ?? '';
  const q = sp.get('q') ?? '';
  const sort = sp.get('sort') ?? 'new';
  const chosenAttrs = (sp.get('attributes') ?? '').split(',').filter(Boolean);
  const min = sp.get('min') ?? '';
  const max = sp.get('max') ?? '';

  const allCats = useMemo(() => categories.flatMap((c) => [c, ...(c.children ?? [])]), [categories]);
  const cat = allCats.find((c) => String(c.id) === category);
  const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : cat;
  const br = brands.find((b) => String(b.id) === brand);
  const title = q ? tr(`نتائج "${q}"`, `Results for "${q}"`) : br ? (br.name_en || br.name_ar || '').toUpperCase() : cat ? pick(cat, 'name') : tr('وصل حديثاً', 'New in');
  useTitle(title);

  useEffect(() => {
    api.get<unknown>('/customer/attributes').then((r) => setAttrs(listOf<AttributeRow>(r))).catch(() => undefined);
  }, []);

  const key = `${category}|${brand}|${q}|${sort}|${chosenAttrs.join(',')}|${min}|${max}`;
  const load = async (p: number) => {
    setLoading(true);
    const s = SORTS.find((x) => x.key === sort) ?? SORTS[0];
    try {
      const r = await api.get<Paginated<Product>>('/customer/products', {
        page: p, per_page: 24, search: q || undefined, category_id: category || undefined, brand_id: brand || undefined,
        attributes: chosenAttrs.length ? chosenAttrs.join(',') : undefined, min_price: min || undefined, max_price: max || undefined,
        sort_field: s.field, sort_direction: s.dir,
      });
      const rows = listOf<Product>(r);
      setItems((prev) => (p === 1 ? rows : [...prev, ...rows.filter((x) => !prev.some((y) => y.id === x.id))]));
      setPage(r?.current_page ?? p);
      setLast(r?.last_page ?? p);
      setTotal(r?.total ?? rows.length);
    } catch {
      if (p === 1) setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    setSp(next, { replace: true });
  };
  const toggleAttr = (id: number) => {
    const s = new Set(chosenAttrs);
    const k = String(id);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    set('attributes', [...s].join(',') || null);
  };

  const filters = (
    <div className="filters">
      {parent?.children?.length ? (
        <div className="f-group">
          <h4>{pick(parent, 'name')}</h4>
          <button className={`f-link${String(parent.id) === category ? ' on' : ''}`} onClick={() => set('category', String(parent.id))}>{tr('الكل', 'All')}</button>
          {parent.children.map((c) => (
            <button key={c.id} className={`f-link${String(c.id) === category ? ' on' : ''}`} onClick={() => set('category', String(c.id))}>{pick(c, 'name')}</button>
          ))}
        </div>
      ) : (
        <div className="f-group">
          <h4>{tr('الأقسام', 'Categories')}</h4>
          {categories.map((c) => (
            <button key={c.id} className={`f-link${String(c.id) === category ? ' on' : ''}`} onClick={() => set('category', String(c.id) === category ? null : String(c.id))}>{pick(c, 'name')}</button>
          ))}
        </div>
      )}
      {!brandParam && brands.length ? (
        <div className="f-group">
          <h4>{tr('البراندات', 'Designers')}</h4>
          <div className="f-scroll">
            {brands.map((b) => (
              <label key={b.id} className="f-check">
                <input type="radio" name="brand" checked={String(b.id) === brand} onChange={() => set('brand', String(b.id))} />
                <span>{(b.name_en || b.name_ar || '').toUpperCase()}</span>
              </label>
            ))}
          </div>
          {brand ? <button className="link small" onClick={() => set('brand', null)}>{tr('كل البراندات', 'All designers')}</button> : null}
        </div>
      ) : null}
      {attrs.filter((a) => (a.values ?? []).length).map((a) => (
        <div key={a.id} className="f-group">
          <h4>{pick(a, 'name')}</h4>
          <div className="opt-values">
            {(a.values ?? []).map((v) => {
              const on = chosenAttrs.includes(String(v.id));
              return v.color_code ? (
                <button key={v.id} className={`swatch${on ? ' on' : ''}`} title={pick(v, 'value')} onClick={() => toggleAttr(v.id)}><span style={{ background: v.color_code }} /></button>
              ) : (
                <button key={v.id} className={`chip${on ? ' on' : ''}`} onClick={() => toggleAttr(v.id)}>{pick(v, 'value')}</button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="f-group">
        <h4>{tr('السعر (ر.ع.)', 'Price (OMR)')}</h4>
        <div className="f-price">
          <input inputMode="decimal" placeholder={tr('من', 'Min')} defaultValue={min} onBlur={(e) => set('min', e.target.value.replace(/[^0-9.]/g, '') || null)} />
          <span>—</span>
          <input inputMode="decimal" placeholder={tr('إلى', 'Max')} defaultValue={max} onBlur={(e) => set('max', e.target.value.replace(/[^0-9.]/g, '') || null)} />
        </div>
      </div>
      {category || (!brandParam && brand) || chosenAttrs.length || min || max ? (
        <button className="btn outline small-btn" onClick={() => setSp(q ? { q } : {}, { replace: true })}>{tr('مسح الفلاتر', 'Clear filters')}</button>
      ) : null}
    </div>
  );

  return (
    <div className="container shop">
      {br?.banner ? <div className="brand-banner"><img src={imageUrl(br.banner)} alt="" /></div> : null}
      <nav className="crumbs">
        <Link to="/">{tr('الرئيسية', 'Home')}</Link>
        {parent && parent !== cat ? <><span>/</span><Link to={`/shop?category=${parent.id}`}>{pick(parent, 'name')}</Link></> : null}
        {br ? <><span>/</span><Link to="/brands">{tr('البراندات', 'Designers')}</Link></> : null}
      </nav>
      <header className="shop-head">
        <h1 className={br ? 'brand-title' : ''}>{title}</h1>
        <span className="muted">{loading && !items.length ? '' : tr(`${total} قطعة`, `${total} pieces`)}</span>
      </header>
      <div className="shop-bar">
        <button className="btn outline only-mobile" onClick={() => setFiltersOpen(true)}><Icon name="filter" /> {tr('تصفية', 'Filter')}</button>
        <label className="sort">
          <span>{tr('ترتيب', 'Sort')}</span>
          <select value={sort} onChange={(e) => set('sort', e.target.value === 'new' ? null : e.target.value)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{tr(s.ar, s.en)}</option>)}
          </select>
        </label>
      </div>
      <div className="shop-body">
        <aside className="only-desktop">{filters}</aside>
        <section>
          {loading && !items.length ? (
            <div className="grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
          ) : items.length ? (
            <>
              <div className="grid">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              {page < last ? (
                <div className="more"><button className="btn outline" disabled={loading} onClick={() => load(page + 1)}>{loading ? '…' : tr('عرض المزيد', 'Load more')}</button></div>
              ) : null}
            </>
          ) : (
            <div className="empty">
              <Icon name="search" size={34} stroke={1.1} />
              <p>{tr('ما لقينا قطع مطابقة', 'No matching pieces')}</p>
              <Link to="/request" className="btn outline">{tr('اطلبها منا', 'Ask us for it')}</Link>
            </div>
          )}
        </section>
      </div>
      {filtersOpen ? (
        <div className="drawer-ov" onClick={() => setFiltersOpen(false)}>
          <aside className="drawer side" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-head"><span className="kicker">{tr('تصفية', 'FILTER')}</span><button className="icon-btn" onClick={() => setFiltersOpen(false)}><Icon name="close" /></button></header>
            <div className="drawer-body">{filters}</div>
            <footer className="drawer-foot"><button className="btn" onClick={() => setFiltersOpen(false)}>{tr(`عرض ${total} قطعة`, `Show ${total} pieces`)}</button></footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
