import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { etaDates, etaForMany, type Origin } from '../lib/eta';
import { asset, imageUrl } from '../lib/api';
import { omr } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { useAuth, useCart, useData, useToast, useWishlist } from '../lib/store';
import { Icon } from './Icon';

const WA = '96877246972';

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { tr } = usePrefs();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="search-ov" onClick={onClose}>
      <form
        className="search-box"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/shop?q=${encodeURIComponent(q.trim())}`);
          onClose();
        }}
      >
        <Icon name="search" size={22} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('ابحث عن قطعة، براند أو فئة', 'Search pieces, brands or categories')} />
        <button type="button" className="icon-btn" onClick={onClose} aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button>
      </form>
    </div>
  );
}

function CartDrawer() {
  const cart = useCart();
  const { tr, isAr } = usePrefs();
  const { delivery } = useData();
  const navigate = useNavigate();
  if (!cart.open) return null;
  const eta = etaForMany(cart.items.map((i) => (i.origin ?? 'europe') as Origin), delivery.eta);
  return (
    <div className="drawer-ov" onClick={() => cart.setOpen(false)}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label={tr('السلة', 'Bag')}>
        <header className="drawer-head">
          <span className="kicker">BAG · {tr('السلة', 'BAG')} ({cart.count})</span>
          <button className="icon-btn" onClick={() => cart.setOpen(false)} aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button>
        </header>
        {cart.items.length === 0 ? (
          <div className="empty">
            <Icon name="bag" size={34} stroke={1.1} />
            <p>{tr('السلة فارغة', 'Your bag is empty')}</p>
            <button className="btn outline" onClick={() => { cart.setOpen(false); navigate('/shop'); }}>{tr('تسوّق الآن', 'Shop now')}</button>
          </div>
        ) : (
          <>
            <div className="drawer-body">
              {cart.items.map((i) => (
                <div key={i.key} className="line">
                  <Link to={`/product/${i.productId}`} onClick={() => cart.setOpen(false)} className="line-img">{i.image ? <img src={imageUrl(i.image)} alt="" /> : null}</Link>
                  <div className="line-info">
                    {i.brand ? <div className="brand">{i.brand.toUpperCase()}</div> : null}
                    <div className="muted">{i.name}</div>
                    {i.options.map((o) => <div key={o.label} className="small">{o.label}: {o.value}</div>)}
                    <div className="line-row">
                      <div className="qty">
                        <button onClick={() => cart.setQuantity(i.key, i.quantity - 1)} aria-label={tr('إنقاص', 'Decrease')}><Icon name="minus" size={14} /></button>
                        <span>{i.quantity}</span>
                        <button onClick={() => cart.setQuantity(i.key, i.quantity + 1)} aria-label={tr('زيادة', 'Increase')}><Icon name="plus" size={14} /></button>
                      </div>
                      <span className="num">{omr(i.price * i.quantity)}</span>
                    </div>
                  </div>
                  <button className="icon-btn faint" onClick={() => cart.remove(i.key)} aria-label={tr('إزالة', 'Remove')}><Icon name="trash" size={16} /></button>
                </div>
              ))}
            </div>
            <footer className="drawer-foot">
              <div className="sum"><span>{tr('المجموع', 'Subtotal')}</span><b className="num">{omr(cart.subtotal)}</b></div>
              {eta ? <p className="eta-line"><Icon name="truck" size={16} />{tr('يوصلك تقريباً ', 'Arrives around ')}{etaDates(eta, isAr)}</p> : null}
              <p className="small muted">{tr('التوصيل وكود الخصم في الخطوة الجاية', 'Delivery and discount codes at checkout')}</p>
              <button className="btn" onClick={() => { cart.setOpen(false); navigate('/checkout'); }}>{tr('إتمام الطلب', 'Checkout')}</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function Toast() {
  const { toast } = useToast();
  const cart = useCart();
  const navigate = useNavigate();
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <Icon name="check" size={18} />
      <span>{toast.text}</span>
      {toast.action ? (
        <button onClick={() => (toast.action!.to === '#bag' ? cart.setOpen(true) : navigate(toast.action!.to))}>{toast.action.label}</button>
      ) : null}
    </div>
  );
}

function Header() {
  const { tr, pick, isAr, setLang, theme, setTheme } = usePrefs();
  const { user } = useAuth();
  const cart = useCart();
  const wish = useWishlist();
  const { categories, home } = useData();
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState<number | null>(null);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
    setMega(null);
  }, [loc.pathname, loc.search]);
  const dark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const top = categories.slice(0, 6);

  return (
    <>
      <div className="topbar">
        <span>{tr('تسوّق شخصي من بوتيكات العالم · توصيل لكل عُمان', 'Personal shopping from the world’s boutiques · Delivery across Oman')}</span>
      </div>
      <header className="header">
        <div className="header-row container">
          <div className="h-side">
            <button className="icon-btn only-mobile" onClick={() => setMenu(true)} aria-label={tr('القائمة', 'Menu')}><Icon name="menu" /></button>
            <button className="icon-btn" onClick={() => setSearch(true)} aria-label={tr('بحث', 'Search')}><Icon name="search" /></button>
            <button className="text-btn only-desktop" onClick={() => setLang(isAr ? 'en' : 'ar')}>{isAr ? 'English' : 'العربية'}</button>
          </div>
          <Link to="/" className="logo" aria-label="GH Shopper">
            <img src={home?.logo_url ? imageUrl(home.logo_url) : asset('logo.png')} alt="GH Shopper" />
          </Link>
          <div className="h-side end">
            <button className="icon-btn only-desktop" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={tr('المظهر', 'Appearance')}><Icon name={dark ? 'sun' : 'moon'} /></button>
            <Link to="/account" className="icon-btn" aria-label={user ? tr('حسابي', 'Account') : tr('تسجيل الدخول', 'Sign in')}><Icon name="user" /></Link>
            <Link to="/wishlist" className="icon-btn only-desktop" aria-label={tr('المفضلة', 'Wishlist')}>
              <Icon name="heart" />
              {wish.products.length ? <b className="dot">{wish.products.length}</b> : null}
            </Link>
            <button className="icon-btn" onClick={() => cart.setOpen(true)} aria-label={tr('السلة', 'Bag')}>
              <Icon name="bag" />
              {cart.count ? <b className="dot">{cart.count}</b> : null}
            </button>
          </div>
        </div>
        <nav className="nav only-desktop" onMouseLeave={() => setMega(null)}>
          <div className="container nav-row">
            <GenderSwitch />
            <NavLink to="/shop" end>{tr('وصل حديثاً', 'New in')}</NavLink>
            {top.map((c) => (
              <div key={c.id} className="nav-item" onMouseEnter={() => setMega(c.children?.length ? c.id : null)}>
                <NavLink to={`/shop?category=${c.id}`}>{pick(c, 'name')}</NavLink>
              </div>
            ))}
            <NavLink to="/brands">{tr('البراندات', 'Designers')}</NavLink>
            <NavLink to="/request" className="gold">{tr('اطلب قطعة', 'Request a piece')}</NavLink>
          </div>
          {mega ? (
            <div className="mega">
              <div className="container mega-row">
                {(categories.find((c) => c.id === mega)?.children ?? []).map((ch) => (
                  <Link key={ch.id} to={`/shop?category=${ch.id}`}>{pick(ch, 'name')}</Link>
                ))}
                <Link to={`/shop?category=${mega}`} className="all">{tr('عرض الكل', 'View all')}</Link>
              </div>
            </div>
          ) : null}
        </nav>
      </header>

      {menu ? (
        <div className="drawer-ov" onClick={() => setMenu(false)}>
          <aside className="drawer side" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-head">
              <img src={asset('logo.png')} alt="" height={40} />
              <button className="icon-btn" onClick={() => setMenu(false)} aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button>
            </header>
            <div className="drawer-body menu">
              <GenderSwitch />
              <Link to="/shop">{tr('وصل حديثاً', 'New in')}</Link>
              {categories.map((c) => (
                <Link key={c.id} to={`/shop?category=${c.id}`}>{pick(c, 'name')}</Link>
              ))}
              <Link to="/brands">{tr('البراندات', 'Designers')}</Link>
              <Link to="/request" className="gold">{tr('اطلب قطعة', 'Request a piece')}</Link>
              <Link to="/wishlist">{tr('المفضلة', 'Wishlist')}</Link>
              <Link to="/account">{user ? tr('حسابي', 'My account') : tr('تسجيل الدخول', 'Sign in')}</Link>
              <div className="menu-tools">
                <button className="chip" onClick={() => setLang(isAr ? 'en' : 'ar')}><Icon name="globe" size={16} /> {isAr ? 'English' : 'العربية'}</button>
                <button className="chip" onClick={() => setTheme(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} size={16} /> {dark ? tr('فاتح', 'Light') : tr('ليلي', 'Dark')}</button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
      {search ? <SearchOverlay onClose={() => setSearch(false)} /> : null}
    </>
  );
}

/** Women's / men's / everything: remembered, applied to every product list. */
export function GenderSwitch() {
  const { tr, gender, setGender } = usePrefs();
  const opts: { k: '' | 'women' | 'men'; ar: string; en: string }[] = [
    { k: 'women', ar: 'نسائي', en: 'Women' },
    { k: 'men', ar: 'رجالي', en: 'Men' },
    { k: '', ar: 'الكل', en: 'All' },
  ];
  return (
    <div className="g-switch" role="group" aria-label={tr('القسم', 'Department')}>
      {opts.map((o) => (
        <button key={o.k || 'all'} className={gender === o.k ? 'on' : ''} aria-pressed={gender === o.k} onClick={() => setGender(o.k)}>{tr(o.ar, o.en)}</button>
      ))}
    </div>
  );
}

function Footer() {
  const { tr, pick } = usePrefs();
  const { policies, categories } = useData();
  return (
    <footer className="footer">
      <div className="container features">
        <div><Icon name="shield" size={26} stroke={1.1} /><b>{tr('أصلية ١٠٠٪', '100% authentic')}</b><span>{tr('من البوتيك مباشرة، مع الفاتورة', 'Straight from the boutique, with receipt')}</span></div>
        <div><Icon name="truck" size={26} stroke={1.1} /><b>{tr('توصيل لكل عُمان', 'Delivery across Oman')}</b><span>{tr('مندوبنا أو جيناكم لباب البيت أو مكتبهم', 'Our driver or Genacom, door or office')}</span></div>
        <div><Icon name="lock" size={26} stroke={1.1} /><b>{tr('دفع آمن', 'Secure payment')}</b><span>{tr('بطاقة أو Apple Pay عبر أموال', 'Card or Apple Pay via Amwal')}</span></div>
        <div><Icon name="gift" size={26} stroke={1.1} /><b>{tr('تغليف هدايا', 'Gift wrapping')}</b><span>{tr('مع رسالة إهداء باسمك', 'With your personal message')}</span></div>
      </div>
      <div className="container footer-cols">
        <div className="footer-brand">
          <img src={asset('logo.png')} alt="GH Shopper" width={72} />
          <p>{tr('عالم من الفخامة في مكان واحد. نشتري لك من أرقى البوتيكات ونوصلها لباب بيتك.', 'A world of luxury in one place. We buy from the finest boutiques and bring it to your door.')}</p>
          <div className="social">
            <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Icon name="whatsapp" /></a>
            <a href="https://instagram.com/shopper.gh" target="_blank" rel="noreferrer" aria-label="Instagram"><Icon name="instagram" /></a>
          </div>
        </div>
        <div>
          <h4>{tr('تسوّق', 'Shop')}</h4>
          <Link to="/shop">{tr('وصل حديثاً', 'New in')}</Link>
          {categories.slice(0, 5).map((c) => <Link key={c.id} to={`/shop?category=${c.id}`}>{pick(c, 'name')}</Link>)}
          <Link to="/brands">{tr('البراندات', 'Designers')}</Link>
        </div>
        <div>
          <h4>{tr('خدمتك', 'Services')}</h4>
          <Link to="/request">{tr('اطلب قطعة غير متوفرة', 'Request a piece')}</Link>
          <a href="/track">{tr('تتبع طلب', 'Track an order')}</a>
          <Link to="/account">{tr('حسابي وطلباتي', 'My account & orders')}</Link>
          <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer">{tr('تواصل معنا', 'Contact us')}</a>
        </div>
        <div>
          <h4>{tr('السياسات', 'Policies')}</h4>
          {policies.slice(0, 6).map((p) => <Link key={p.id} to={`/policies#${p.type}`}>{pick(p, 'title')}</Link>)}
          <a href="/privacy">{tr('الخصوصية', 'Privacy')}</a>
        </div>
      </div>
      <div className="container footer-base">
        <span className="kicker">GH SHOPPER · GH SPC · CR 1666587 · OMAN</span>
        <span className="small">© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <CartDrawer />
      <Toast />
    </>
  );
}
