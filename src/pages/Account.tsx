import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { dateText, num, omrReal } from '../lib/format';
import { useLoad, useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth, useFeature, useFeatures } from '../lib/store';
import type { MyOrder, MyOrdersResponse } from '../lib/types';
import { Icon } from '../components/Icon';
import { currentReferral } from '../lib/track';
import { AskButton, useChat } from '../components/Chat';
import { ServiceReviewPrompt } from '../components/ServiceReviews';
import { AlertPrefsCard, MyRequests, WalletSection } from './AccountFeatures';

const STEPS: [string, string][] = [['استلمناه', 'Received'], ['اشتريناه', 'Bought'], ['وصل عُمان', 'In Oman'], ['في الطريق', 'On the way'], ['تم التسليم', 'Delivered']];
const FLOW = ['requested', 'purchased', 'arrived', 'out_for_delivery', 'delivered'];
// every piece was here when ordered (تسليم فوري): no buying, no shipping to Oman
const QUICK: [string, string][] = [['استلمناه', 'Received'], ['جاهز', 'Ready'], ['في الطريق', 'On the way'], ['تم التسليم', 'Delivered']];
const QUICK_AT: Record<string, number> = { requested: 0, purchased: 1, arrived: 1, out_for_delivery: 2, delivered: 3 };

function SignIn() {
  const { tr } = usePrefs();
  const { login, register, resetPassword } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'in' | 'up' | 'forgot' | 'reset'>('in');
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [refCode, setRefCode] = useState(() => currentReferral());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'forgot') {
        const r = await api.post<{ message?: string }>('/auth/forgot-password', { email: email.trim() });
        setInfo(r?.message ?? tr('أرسلنا رمز على إيميلك', 'We sent a code to your email'));
        setMode('reset');
        setPassword('');
        return;
      }
      if (mode === 'reset') await resetPassword(email, code, password);
      else if (mode === 'in') await login(email, password);
      else await register(name, email, phone, password, refCode);
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
        {mode === 'forgot' || mode === 'reset' ? (
          <div className="auth-reset-head">
            <h3>{tr('نسيت كلمة المرور', 'Forgot password')}</h3>
            <p className="small muted">{mode === 'forgot' ? tr('اكتب إيميلك ونرسل لك رمز من 6 أرقام.', 'Enter your email and we will send you a 6-digit code.') : info}</p>
          </div>
        ) : (
          <div className="seg">
            <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>{tr('تسجيل الدخول', 'Sign in')}</button>
            <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>{tr('حساب جديد', 'Create account')}</button>
          </div>
        )}
        {mode === 'up' ? <label className="field"><span>{tr('الاسم', 'Name')}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label> : null}
        <label className="field"><span>{tr('البريد الإلكتروني', 'Email')}</span><input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        {mode === 'up' ? <label className="field"><span>{tr('رقم الهاتف', 'Phone')}</span><input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></label> : null}
        {mode === 'up' ? <label className="field"><span>{tr('كود الدعوة (اختياري)', 'Invite code (optional)')}</span><input dir="ltr" value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={16} placeholder={tr('من صديقك', 'from a friend')} /></label> : null}
        {mode === 'reset' ? (
          <label className="field"><span>{tr('الرمز', 'Code')}</span><input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))} required minLength={6} className="code-input" /></label>
        ) : null}
        {mode !== 'forgot' ? (
          <label className="field"><span>{mode === 'reset' ? tr('كلمة المرور الجديدة', 'New password') : tr('كلمة المرور', 'Password')}</span><input type="password" dir="ltr" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></label>
        ) : null}
        {err ? <p className="err">{err}</p> : null}
        <button className="btn wide" disabled={busy}>
          {busy ? '…' : mode === 'in' ? tr('دخول', 'Sign in') : mode === 'up' ? tr('إنشاء الحساب', 'Create account') : mode === 'forgot' ? tr('أرسل الرمز', 'Send code') : tr('غيّر كلمة المرور وادخل', 'Change password & sign in')}
        </button>
        {mode === 'in' ? <button type="button" className="link small center" onClick={() => { setMode('forgot'); setErr(null); }}>{tr('نسيت كلمة المرور؟', 'Forgot your password?')}</button> : null}
        {mode === 'reset' ? <button type="button" className="link small center" onClick={() => { setMode('forgot'); setErr(null); setCode(''); }}>{tr('ما وصلك؟ أرسل رمز جديد', "Didn't get it? Send a new code")}</button> : null}
        {mode === 'forgot' || mode === 'reset' ? <button type="button" className="link small center" onClick={() => { setMode('in'); setErr(null); }}>{tr('رجوع لتسجيل الدخول', 'Back to sign in')}</button> : null}
      </form>
    </div>
  );
}

function OrderCard({ o }: { o: MyOrder }) {
  const { tr, isAr } = usePrefs();
  const photosOn = !!useFeature('purchase_photos');
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const steps = o.all_instant ? QUICK : STEPS;
  const step = o.all_instant ? (QUICK_AT[o.status] ?? 0) : FLOW.indexOf(o.status);
  return (
    <article className="ord">
      <button className="ord-head" onClick={() => setOpen(!open)}>
        <div>
          <b className="l">{o.invoice_no}</b>
          <span className="small muted">{dateText(o.created_at, isAr)} · {o.items.length} {tr('قطعة', 'pieces')}</span>
        </div>
        <div className="ord-right">
          <span className="num">{omrReal(o.total)}</span>
          <span className={`pill${o.status === 'delivered' ? ' green' : ''}`}>{tr(steps[Math.max(0, step)][0], steps[Math.max(0, step)][1])}</span>
          <Icon name="down" size={18} />
        </div>
      </button>
      <div className="steps" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>{steps.map((s, i) => <div key={i} className={i <= step ? 'on' : ''}><i /><span>{tr(s[0], s[1])}</span></div>)}</div>
      {open ? (
        <div className="ord-body">
          {o.items.map((it, i) => (
            <div key={i} className="ord-item">
              <div className="co-img">{photosOn && it.photo_url ? <button type="button" className="ord-shot" onClick={() => setZoom(it.photo_url!)}><img src={it.photo_url} alt="" /></button> : null}</div>
              <div>
                {it.brand ? <div className="brand">{it.brand.toUpperCase()}</div> : null}<div className="small">{it.name}</div>{it.details ? <div className="small muted">{it.details}</div> : null}
                {photosOn && (it.photo_url || it.receipt_url) ? (
                  <div className="ord-proofs">
                    {it.photo_url ? <button type="button" className="link small" onClick={() => setZoom(it.photo_url!)}><Icon name="camera" size={14} /> {tr('صورة القطعة من المحل', 'Photo from the boutique')}</button> : null}
                    {it.receipt_url ? <button type="button" className="link small" onClick={() => setZoom(it.receipt_url!)}><Icon name="doc" size={14} /> {tr('إيصال الشراء', 'Purchase receipt')}</button> : null}
                  </div>
                ) : null}
              </div>
              <span className="num">{omrReal(it.price)}</span>
            </div>
          ))}
          <div className="sums">
            {o.delivery_fee > 0 ? <div><span>{tr('التوصيل', 'Delivery')}</span><span className="num">{omrReal(o.delivery_fee)}</span></div> : null}
            {(o.discount ?? 0) > 0 ? <div className="green"><span>{o.discount_label || tr('خصم', 'Discount')}</span><span className="num">-{omrReal(o.discount)}</span></div> : null}
            <div className="total"><span>{tr('الإجمالي', 'Total')}</span><span className="num">{omrReal(o.total)}</span></div>
            {o.remaining > 0.0005 ? <div className="red"><span>{tr('المتبقي', 'Balance due')}</span><span className="num">{omrReal(o.remaining)}</span></div> : <div className="green"><span>{tr('مدفوع', 'Paid')}</span><span /></div>}
            {o.pay_url && o.remaining > 0.0005 ? <a className="btn wide" href={o.pay_url}>{tr('ادفع الآن', 'Pay now')} · <span className="num">{omrReal(o.remaining)}</span></a> : null}
          </div>
          {o.gift ? (
            <div className="ord-gift">
              <Icon name="gift" size={16} />
              <span>{tr('هدية', 'Gift')}{o.gift.to ? tr(` إلى ${o.gift.to}`, ` to ${o.gift.to}`) : ''}{o.gift.wrap ? tr(' · مغلّفة', ' · wrapped') : ''}{o.gift.hide_prices ? tr(' · بدون أسعار', ' · prices hidden') : ''}</span>
              {o.gift.message ? <em>“{o.gift.message}”</em> : null}
            </div>
          ) : null}
          <div className="ord-links">
            {o.tracking_token ? <a className="link small" href={`/track/?t=${o.tracking_token}`}>{tr('صفحة تتبع الطلب', 'Tracking page')}</a> : null}
            <AskButton className="link small ask-link" ctx={{ psOrderId: o.id, invoiceNo: o.invoice_no }} label={tr('اسأل عن طلبك', 'Ask about your order')} />
          </div>
        </div>
      ) : null}
      {zoom ? <div className="lightbox" onClick={() => setZoom(null)}><img src={zoom} alt="" /><button className="icon-btn" aria-label={tr('إغلاق', 'Close')}><Icon name="close" /></button></div> : null}
    </article>
  );
}

type Tab = 'orders' | 'requests' | 'wallet' | 'alerts';

export default function Account() {
  const { tr, pick } = usePrefs();
  const { user, logout, ready } = useAuth();
  const flags = useFeatures();
  const chat = useChat();
  const [sp, setSp] = useSearchParams();
  const tabs: { k: Tab; ar: string; en: string; on: boolean }[] = [
    { k: 'orders', ar: 'طلباتي', en: 'My orders', on: true },
    { k: 'requests', ar: 'طلباتي الخاصة', en: 'My requests', on: flags.quotes.on },
    { k: 'wallet', ar: 'رصيدك', en: 'Balance', on: flags.wallet.on },
    { k: 'alerts', ar: 'التنبيهات', en: 'Alerts', on: flags.wishlist_alerts.on },
  ];
  const visible = tabs.filter((t) => t.on);
  const tab: Tab = visible.find((t) => t.k === sp.get('tab'))?.k ?? 'orders';
  const pickTab = (k: Tab) => setSp(k === 'orders' ? {} : { tab: k }, { replace: true });
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
          <div className={`member ${/beige|بيج/i.test(user.loyalty_tier ?? '') ? 'tier-beige' : /black|أسود/i.test(user.loyalty_tier ?? '') ? 'tier-black' : 'tier-burgundy'}`}>
            <span className="kicker gold">GH MEMBER{bal?.tier_id ? ` · ${tierName(bal.tier_id).toUpperCase()}` : ''}</span>
            <b>{user.name}</b>
            <span className="l small">{user.email}</span>
            <div className="member-pts"><span className="l">{num(bal?.balance ?? user.loyalty_points).toLocaleString('en-US')}</span><small>{tr('نقطة', 'points')}</small></div>
            {bal?.next_tier_id ? (
              <div className="member-progress">
                {flags.vip_progress.on && num(bal.to_next) > 0 ? <i><em style={{ width: `${Math.round(Math.min(1, Math.max(0, num(bal.tier_points) / (num(bal.tier_points) + num(bal.to_next)))) * 100)}%` }} /></i> : null}
                <small>{tr(`باقي ${num(bal.to_next).toLocaleString('en-US')} نقطة لمستوى ${tierName(bal.next_tier_id)}`, `${num(bal.to_next).toLocaleString('en-US')} points to ${tierName(bal.next_tier_id)}`)}</small>
              </div>
            ) : null}
          </div>
          <nav className="acc-links">
            <Link to="/wishlist"><Icon name="heart" />{tr('المفضلة', 'Wishlist')}</Link>
            {chat.enabled ? <button type="button" onClick={() => chat.open()}><Icon name="chat" />{tr('المحادثة المباشرة', 'Live chat')}{chat.unread ? <b className="acc-badge">{chat.unread}</b> : null}</button> : null}
            <Link to="/request"><Icon name="camera" />{tr('اطلب قطعة', 'Request a piece')}</Link>
            {orders.data?.portal_url ? <a href={orders.data.portal_url}><Icon name="doc" />{tr('فواتيري وإيصالاتي', 'Invoices & receipts')}</a> : null}
            <a href="https://wa.me/96877246972" target="_blank" rel="noreferrer"><Icon name="whatsapp" />{tr('تواصل معنا', 'Contact us')}</a>
          </nav>
          <Invite />
          <Birthday />
        </aside>
        <section>
          {visible.length > 1 ? (
            <div className="acc-tabs" role="tablist">
              {visible.map((t) => <button key={t.k} role="tab" aria-selected={tab === t.k} className={tab === t.k ? 'on' : ''} onClick={() => pickTab(t.k)}>{tr(t.ar, t.en)}</button>)}
            </div>
          ) : <h2>{tr('طلباتي', 'My orders')}</h2>}
          {tab === 'orders' ? (
            <>
              <ServiceReviewPrompt />
              {orders.loading ? <div className="skeleton" /> : (orders.data?.orders ?? []).length ? (
                <div className="ord-list">{(orders.data?.orders ?? []).map((o) => <OrderCard key={o.id} o={o} />)}</div>
              ) : (
                <div className="empty"><Icon name="box" size={34} stroke={1.1} /><p>{tr('ما عندك طلبات للحين', 'No orders yet')}</p><Link to="/shop" className="btn outline">{tr('تسوّق الآن', 'Shop now')}</Link></div>
              )}
            </>
          ) : null}
          {tab === 'requests' ? <MyRequests /> : null}
          {tab === 'wallet' ? <WalletSection onPoints={loyalty.reload} /> : null}
          {tab === 'alerts' ? <AlertPrefsCard /> : null}
        </section>
      </div>
    </div>
  );
}


type RefInfo = { enabled: boolean; code: string; link: string; friend_points: number; referrer_points: number; joined: number; ordered: number };

/** Invite a friend: the customer's code and link, the gifts, how many came. */
function Invite() {
  const { tr } = usePrefs();
  const { user } = useAuth();
  const ref = useLoad(async () => (user ? await api.get<RefInfo>('/auth/referral') : null), [user?.id]);
  const [copied, setCopied] = useState(false);
  const r = ref.data;
  if (!r || !r.enabled) return null;
  const text = tr(`تسوّق من GH Shopper بكود الدعوة حقي ${r.code} وخذ ${r.friend_points} نقطة هدية مع أول طلب 🤍\n${r.link}`, `Shop at GH Shopper with my invite code ${r.code} and get ${r.friend_points} gift points on your first order 🤍\n${r.link}`);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // cancelled
    }
  };
  return (
    <div className="invite">
      <span className="kicker gold">{tr('ادعُ صديقك', 'Invite a friend')}</span>
      <p className="small">{tr(`صديقك ياخذ ${r.friend_points} نقطة، وأنت تاخذ ${r.referrer_points} نقطة لما يستلم أول طلب.`, `Your friend gets ${r.friend_points} points and you get ${r.referrer_points} when their first order arrives.`)}</p>
      <div className="invite-code"><b dir="ltr">{r.code}</b><button type="button" className="btn outline small" onClick={share}>{copied ? tr('انسخ ✓', 'Copied ✓') : tr('شارك', 'Share')}</button></div>
      {r.joined ? <small className="muted">{tr(`${r.joined} سجّلوا بدعوتك · ${r.ordered} طلبوا`, `${r.joined} joined · ${r.ordered} ordered`)}</small> : null}
    </div>
  );
}

/** Birthday: a gift of points on the day. */
function Birthday() {
  const { tr } = usePrefs();
  const { user, refresh } = useAuth();
  const [v, setV] = useState(user?.birth_date ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(user?.birth_date ?? ''), [user?.birth_date]);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.put('/auth/profile', { birth_date: v || null });
      await refresh();
      setMsg(tr('انحفظ 🎂', 'Saved 🎂'));
    } catch (x) {
      setMsg(x instanceof Error ? x.message : tr('تعذّر الحفظ', 'Could not save'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="invite">
      <span className="kicker gold">{tr('عيد ميلادك', 'Your birthday')}</span>
      <p className="small">{tr('اكتب تاريخ ميلادك ويوصلك منا هدية نقاط في يومك.', 'Add your birthday and get a gift of points on the day.')}</p>
      <div className="invite-code"><input type="date" dir="ltr" value={v} max={new Date(Date.now() - 10 * 365 * 86400000).toISOString().slice(0, 10)} onChange={(e) => setV(e.target.value)} /><button type="button" className="btn outline small" disabled={busy || v === (user?.birth_date ?? '')} onClick={save}>{tr('حفظ', 'Save')}</button></div>
      {msg ? <small className="muted">{msg}</small> : null}
    </div>
  );
}
