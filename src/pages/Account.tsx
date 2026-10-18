import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { dateText, num, omr } from '../lib/format';
import { useLoad, useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth } from '../lib/store';
import type { MyOrder, MyOrdersResponse } from '../lib/types';
import { Icon } from '../components/Icon';

const STEPS: [string, string][] = [['استلمناه', 'Received'], ['اشتريناه', 'Bought'], ['وصل عُمان', 'In Oman'], ['في الطريق', 'On the way'], ['تم التسليم', 'Delivered']];
const FLOW = ['requested', 'purchased', 'arrived', 'out_for_delivery', 'delivered'];

function SignIn() {
  const { tr } = usePrefs();
  const { login, register } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'in') await login(email, password);
      else await register(name, email, phone, password);
      const next = sp.get('next');
      if (next) navigate(next);
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('حدث خطأ', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth">
      <div className="auth-art">
        <span className="kicker gold">GH MEMBER</span>
        <h2>{tr('طلباتك، نقاطك، ومفضلتك في مكان واحد', 'Your orders, points and wishlist in one place')}</h2>
        <ul>
          <li><Icon name="crown" size={18} />{tr('اجمع نقاط مع كل طلب', 'Earn points on every order')}</li>
          <li><Icon name="truck" size={18} />{tr('تابع طلبك خطوة بخطوة', 'Follow your order step by step')}</li>
          <li><Icon name="heart" size={18} />{tr('احفظ القطع اللي تعجبك', 'Save the pieces you love')}</li>
        </ul>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>{tr('تسجيل الدخول', 'Sign in')}</button>
          <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>{tr('حساب جديد', 'Create account')}</button>
        </div>
        {mode === 'up' ? <label className="field"><span>{tr('الاسم', 'Name')}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label> : null}
        <label className="field"><span>{tr('البريد الإلكتروني', 'Email')}</span><input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        {mode === 'up' ? <label className="field"><span>{tr('رقم الهاتف', 'Phone')}</span><input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></label> : null}
        <label className="field"><span>{tr('كلمة المرور', 'Password')}</span><input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></label>
        {err ? <p className="err">{err}</p> : null}
        <button className="btn wide" disabled={busy}>{busy ? '…' : mode === 'in' ? tr('دخول', 'Sign in') : tr('إنشاء الحساب', 'Create account')}</button>
        {mode === 'in' ? <a className="link small center" href="https://wa.me/96877246972" target="_blank" rel="noreferrer">{tr('نسيت كلمة المرور؟ راسلنا', 'Forgot your password? Message us')}</a> : null}
      </form>
    </div>
  );
}

function OrderCard({ o }: { o: MyOrder }) {
  const { tr, isAr } = usePrefs();
  const [open, setOpen] = useState(false);
  const step = FLOW.indexOf(o.status);
  return (
    <article className="ord">
      <button className="ord-head" onClick={() => setOpen(!open)}>
        <div>
          <b className="l">{o.invoice_no}</b>
          <span className="small muted">{dateText(o.created_at, isAr)} · {o.items.length} {tr('قطعة', 'pieces')}</span>
        </div>
        <div className="ord-right">
          <span className="num">{omr(o.total)}</span>
          <span className={`pill${o.status === 'delivered' ? ' green' : ''}`}>{tr(STEPS[Math.max(0, step)][0], STEPS[Math.max(0, step)][1])}</span>
          <Icon name="down" size={18} />
        </div>
      </button>
      <div className="steps">{STEPS.map((s, i) => <div key={i} className={i <= step ? 'on' : ''}><i /><span>{tr(s[0], s[1])}</span></div>)}</div>
      {open ? (
        <div className="ord-body">
          {o.items.map((it, i) => (
            <div key={i} className="ord-item">
              <div className="co-img">{it.photo_url ? <img src={it.photo_url} alt="" /> : null}</div>
              <div>{it.brand ? <div className="brand">{it.brand.toUpperCase()}</div> : null}<div className="small">{it.name}</div>{it.details ? <div className="small muted">{it.details}</div> : null}</div>
              <span className="num">{omr(it.price)}</span>
            </div>
          ))}
          <div className="sums">
            {o.delivery_fee > 0 ? <div><span>{tr('التوصيل', 'Delivery')}</span><span className="num">{omr(o.delivery_fee)}</span></div> : null}
            {(o.discount ?? 0) > 0 ? <div className="green"><span>{o.discount_label || tr('خصم', 'Discount')}</span><span className="num">-{omr(o.discount)}</span></div> : null}
            <div className="total"><span>{tr('الإجمالي', 'Total')}</span><span className="num">{omr(o.total)}</span></div>
            {o.remaining > 0.0005 ? <div className="red"><span>{tr('المتبقي', 'Balance due')}</span><span className="num">{omr(o.remaining)}</span></div> : <div className="green"><span>{tr('مدفوع', 'Paid')}</span><span /></div>}
          </div>
          {o.tracking_token ? <a className="link small" href={`/track/?t=${o.tracking_token}`}>{tr('صفحة تتبع الطلب', 'Tracking page')}</a> : null}
        </div>
      ) : null}
    </article>
  );
}

export default function Account() {
  const { tr, pick } = usePrefs();
  const { user, logout, ready } = useAuth();
  useTitle(user ? tr('حسابي', 'My account') : tr('تسجيل الدخول', 'Sign in'));
  const orders = useLoad(async () => (user ? await api.get<MyOrdersResponse>('/ps/my-orders') : null), [user?.id]);
  const loyalty = useLoad(async () => (user ? await api.get<{ balance?: number; conversion_rate?: number; tier_points?: number; to_next?: number; next_tier_id?: number | null; tier_id?: number | null }>('/customer/loyalty/balance') : null), [user?.id]);
  const tiers = useLoad(async () => (user ? (await api.get<{ data?: { id: number; name: string; name_ar?: string | null }[] }>('/customer/loyalty/tiers')).data ?? [] : []), [user?.id]);
  useEffect(() => undefined, []);
  if (!ready) return <div className="container page"><div className="skeleton" /></div>;
  if (!user) return <div className="container page"><SignIn /></div>;
  const tierName = (id?: number | null) => {
    const t = (tiers.data ?? []).find((x) => x.id === id);
    return t ? pick(t, 'name') : user.loyalty_tier ?? '';
  };
  const bal = loyalty.data;
  return (
    <div className="container page account">
      <header className="acc-head">
        <div>
          <span className="kicker">MY ACCOUNT</span>
          <h1>{tr(`أهلاً، ${user.name.split(' ')[0]}`, `Hi, ${user.name.split(' ')[0]}`)}</h1>
        </div>
        <button className="btn outline" onClick={logout}>{tr('تسجيل الخروج', 'Sign out')}</button>
      </header>
      <div className="acc-grid">
        <aside>
          <div className="member">
            <span className="kicker gold">GH MEMBER{bal?.tier_id ? ` · ${tierName(bal.tier_id).toUpperCase()}` : ''}</span>
            <b>{user.name}</b>
            <span className="l small">{user.email}</span>
            <div className="member-pts"><span className="l">{num(bal?.balance ?? user.loyalty_points).toLocaleString('en-US')}</span><small>{tr('نقطة', 'points')}</small></div>
            {bal?.next_tier_id ? <small>{tr(`باقي ${num(bal.to_next).toLocaleString('en-US')} نقطة لمستوى ${tierName(bal.next_tier_id)}`, `${num(bal.to_next).toLocaleString('en-US')} points to ${tierName(bal.next_tier_id)}`)}</small> : null}
          </div>
          <nav className="acc-links">
            <Link to="/wishlist"><Icon name="heart" />{tr('المفضلة', 'Wishlist')}</Link>
            <Link to="/request"><Icon name="camera" />{tr('اطلب قطعة', 'Request a piece')}</Link>
            {orders.data?.portal_url ? <a href={orders.data.portal_url}><Icon name="doc" />{tr('فواتيري وإيصالاتي', 'Invoices & receipts')}</a> : null}
            <a href="https://wa.me/96877246972" target="_blank" rel="noreferrer"><Icon name="whatsapp" />{tr('تواصل معنا', 'Contact us')}</a>
          </nav>
        </aside>
        <section>
          <h2>{tr('طلباتي', 'My orders')}</h2>
          {orders.loading ? <div className="skeleton" /> : (orders.data?.orders ?? []).length ? (
            <div className="ord-list">{(orders.data?.orders ?? []).map((o) => <OrderCard key={o.id} o={o} />)}</div>
          ) : (
            <div className="empty"><Icon name="box" size={34} stroke={1.1} /><p>{tr('ما عندك طلبات للحين', 'No orders yet')}</p><Link to="/shop" className="btn outline">{tr('تسوّق الآن', 'Shop now')}</Link></div>
          )}
        </section>
      </div>
    </div>
  );
}

