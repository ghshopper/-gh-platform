import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { imageUrl } from '../lib/api';
import { inStock, isOnOrder, omr, productAttributes, productImages, productPrice, productWasPrice } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { useCart, useToast, useWishlist } from '../lib/store';
import type { Product } from '../lib/types';
import { Icon } from './Icon';

export const brandOf = (p: Product) => (p.brand_name_en || p.brand_name || '').trim();

/** Adds a piece to the bag with the chosen options and says so. */
export function useAddToBag() {
  const cart = useCart();
  const { pick, tr } = usePrefs();
  const { show } = useToast();
  return (p: Product, chosen: Record<string, string>) => {
    cart.add({
      productId: p.id,
      name: pick(p, 'name'),
      nameEn: p.name_en,
      brand: brandOf(p),
      price: productPrice(p),
      comparePrice: productWasPrice(p),
      image: productImages(p)[0] ?? '',
      options: Object.entries(chosen).map(([label, value]) => ({ label, value })),
    });
    show(tr('تمت الإضافة إلى السلة', 'Added to your bag'), { label: tr('عرض السلة', 'View bag'), to: '#bag' });
  };
}

/* Quick add: one modal for the whole site. */
const QuickCtx = createContext<(p: Product) => void>(() => undefined);
export const useQuickAdd = () => useContext(QuickCtx);

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<Product | null>(null);
  return (
    <QuickCtx.Provider value={setProduct}>
      {children}
      {product ? <QuickAddModal product={product} onClose={() => setProduct(null)} /> : null}
    </QuickCtx.Provider>
  );
}

export function OptionPicker({ product, chosen, setChosen }: { product: Product; chosen: Record<string, string>; setChosen: (c: Record<string, string>) => void }) {
  const { pick, tr } = usePrefs();
  const attrs = productAttributes(product).filter((a) => a.is_selectable !== false);
  return (
    <>
      {attrs.map((a, i) => {
        const label = pick(a, 'name') || tr('الخيار', 'Option');
        return (
          <div key={i} className="opt">
            <div className="opt-label">{label}{chosen[label] ? <span>: {chosen[label]}</span> : null}</div>
            <div className="opt-values">
              {(a.values ?? []).map((v, k) => {
                const val = pick(v, 'value');
                const on = chosen[label] === val;
                return v.image ? (
                  <button key={k} type="button" className={`swatch img${on ? ' on' : ''}`} title={val} aria-label={val} aria-pressed={on} onClick={() => setChosen({ ...chosen, [label]: val })}>
                    <img src={imageUrl(v.image)} alt="" />
                  </button>
                ) : v.color_code ? (
                  <button key={k} type="button" className={`swatch${on ? ' on' : ''}`} title={val} aria-label={val} aria-pressed={on} onClick={() => setChosen({ ...chosen, [label]: val })}>
                    <span style={{ background: v.color_code }} />
                  </button>
                ) : (
                  <button key={k} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setChosen({ ...chosen, [label]: val })}>{val}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function QuickAddModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { pick, tr } = usePrefs();
  const add = useAddToBag();
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string | null>(null);
  const attrs = productAttributes(product).filter((a) => a.is_selectable !== false);
  const confirm = () => {
    const need = attrs.find((a) => !chosen[pick(a, 'name')]);
    if (need) return setMissing(pick(need, 'name'));
    add(product, chosen);
    onClose();
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-x" onClick={onClose} aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button>
        <div className="qa-head">
          <div className="qa-img">{productImages(product)[0] ? <img src={imageUrl(productImages(product)[0])} alt="" /> : null}</div>
          <div>
            <div className="brand">{brandOf(product).toUpperCase()}</div>
            <div className="muted">{pick(product, 'name')}</div>
            <Price p={product} />
          </div>
        </div>
        <OptionPicker product={product} chosen={chosen} setChosen={(c) => { setChosen(c); setMissing(null); }} />
        {missing ? <p className="err">{tr(`اختر ${missing} أول`, `Choose ${missing} first`)}</p> : null}
        <button className="btn" onClick={confirm}><Icon name="bagAdd" /> {tr('أضف إلى السلة', 'Add to bag')}</button>
      </div>
    </div>
  );
}

export function Price({ p, big }: { p: Product; big?: boolean }) {
  const price = productPrice(p);
  const was = productWasPrice(p);
  const off = was && was > price ? Math.round((1 - price / was) * 100) : 0;
  return (
    <div className={`price${big ? ' big' : ''}`}>
      <span className={off ? 'sale' : ''}>{omr(price)}</span>
      {off ? <s>{omr(was)}</s> : null}
      {off && big ? <em>-{off}%</em> : null}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { pick, tr } = usePrefs();
  const wish = useWishlist();
  const quick = useQuickAdd();
  const add = useAddToBag();
  const navigate = useNavigate();
  const { show } = useToast();
  const imgs = productImages(product);
  const out = !inStock(product);
  const price = productPrice(product);
  const was = productWasPrice(product);
  const off = was && was > price ? Math.round((1 - price / was) * 100) : 0;
  const saved = wish.has(product.id);

  return (
    <article className="pcard">
      <Link to={`/product/${product.id}`} className="pcard-media" aria-label={`${brandOf(product)} ${pick(product, 'name')}`}>
        {imgs[0] ? <img src={imageUrl(imgs[0])} alt={`${brandOf(product)} ${pick(product, 'name')}`.trim()} loading="lazy" /> : <span className="ph">{brandOf(product).toUpperCase()}</span>}
        {imgs[1] ? <img src={imageUrl(imgs[1])} alt="" loading="lazy" className="alt" /> : null}
        {out ? <span className="badge soft">{tr('نفدت الكمية', 'Sold out')}</span> : off >= 5 ? <span className="badge">-{off}%</span> : null}
      </Link>
      <button
        className={`pcard-heart${saved ? ' on' : ''}`}
        aria-label={saved ? tr('إزالة من المفضلة', 'Remove from wishlist') : tr('أضف إلى المفضلة', 'Add to wishlist')}
        onClick={async () => {
          if (!(await wish.toggle(product))) {
            show(tr('سجّل دخولك لحفظ القطع', 'Sign in to save pieces'), { label: tr('تسجيل الدخول', 'Sign in'), to: '/account' });
          }
        }}
      >
        <Icon name={saved ? 'heartFill' : 'heart'} size={18} />
      </button>
      {!out ? (
        <button
          className="pcard-add"
          aria-label={tr('أضف إلى السلة', 'Add to bag')}
          onClick={() => (productAttributes(product).some((a) => a.is_selectable !== false) ? quick(product) : add(product, {}))}
        >
          <Icon name="bagAdd" size={18} />
          <span>{tr('أضف للسلة', 'Add to bag')}</span>
        </button>
      ) : null}
      <div className="pcard-body" onClick={() => navigate(`/product/${product.id}`)}>
        {brandOf(product) ? <div className="brand">{brandOf(product).toUpperCase()}</div> : null}
        <div className="pcard-name">{pick(product, 'name')}</div>
        <Price p={product} />
        {!out ? <div className={`avail${isOnOrder(product) ? ' order' : ''}`}><i />{isOnOrder(product) ? tr('بالطلب', 'On order') : tr('تسليم فوري', 'Ready to deliver')}</div> : null}
      </div>
    </article>
  );
}
