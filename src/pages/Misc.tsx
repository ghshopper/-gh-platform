import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth, useData, useFeature, useWishlist } from '../lib/store';
import { Icon } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';

export function Wishlist() {
  const { tr } = usePrefs();
  useTitle(tr('المفضلة', 'Wishlist'));
  const { user } = useAuth();
  const wish = useWishlist();
  const alertsOn = !!useFeature('wishlist_alerts');
  return (
    <div className="container page">
      <header className="page-head center"><span className="kicker">WISHLIST</span><h1>{tr('المفضلة', 'Wishlist')}</h1>{user && alertsOn ? <p className="muted small">{tr('بنعلمك إذا نزل سعر قطعة هنا أو رجعت متوفرة', "We'll let you know if a piece here drops in price or is back in stock")} · <Link className="link" to="/account?tab=alerts">{tr('إعدادات التنبيهات', 'Alert settings')}</Link></p> : null}</header>
      {!user ? (
        <div className="empty"><Icon name="heart" size={34} stroke={1.1} /><p>{tr('سجّل دخولك لحفظ القطع', 'Sign in to save pieces')}</p><Link to="/account?next=/wishlist" className="btn">{tr('تسجيل الدخول', 'Sign in')}</Link></div>
      ) : wish.products.length ? (
        <div className="grid">{wish.products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      ) : (
        <div className="empty"><Icon name="heart" size={34} stroke={1.1} /><p>{tr('ما حفظت قطع للحين', 'Nothing saved yet')}</p><Link to="/shop" className="btn outline">{tr('تسوّق', 'Shop')}</Link></div>
      )}
    </div>
  );
}

export function Request() {
  const { tr } = usePrefs();
  useTitle(tr('اطلب قطعة', 'Request a piece'));
  const { user } = useAuth();
  const { categories } = useData();
  const quotesOn = !!useFeature('quotes');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [desc, setDesc] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (done) {
    return (
      <div className="container page done">
        <div className="done-mark"><Icon name="check" size={34} /></div>
        <h1>{tr('وصلنا طلبك', 'We have your request')}</h1>
        <p className="muted">{tr('بنبحث عن القطعة ونرد عليك بالسعر قريب.', 'We will find the piece and get back to you with a price soon.')}</p>
        {user && quotesOn ? <p className="muted small">{tr('أول ما يجهز السعر يوصلك إشعار، وتقدر تأكد وتدفع من «طلباتي الخاصة».', 'When the price is ready you get a notification — accept and pay from "My requests".')}</p> : null}
        <div className="done-actions">
          {user && quotesOn ? <Link to="/account?tab=requests" className="btn">{tr('طلباتي الخاصة', 'My requests')}</Link> : null}
          <Link to="/shop" className="btn outline">{tr('متابعة التسوق', 'Continue shopping')}</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="container page request">
      <div className="req-art">
        <span className="kicker gold">PERSONAL SHOPPING</span>
        <h1>{tr('ما لقيت القطعة؟ نجيبها لك', "Can't find it? We'll get it")}</h1>
        <p>{tr('صوّر القطعة أو الصق رابطها من أي بوتيك في العالم، ونشتريها لك ونوصلها لباب بيتك في عُمان.', 'Send a photo or a link from any boutique in the world. We buy it and bring it to your door in Oman.')}</p>
      </div>
      <form
        className="req-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!desc.trim() && !link.trim() && !file) return setErr(tr('اكتب وصف القطعة أو ارفع صورتها', 'Describe the piece or add a photo'));
          if (phone.replace(/\D/g, '').length < 8) return setErr(tr('اكتب رقم هاتف صحيح', 'Enter a valid phone number'));
          setBusy(true);
          setErr(null);
          const f = new FormData();
          f.append('customer_name', name.trim());
          f.append('customer_phone', phone.trim());
          if (user?.email) f.append('customer_email', user.email);
          f.append('product_name_ar', desc.trim().slice(0, 190) || tr('قطعة من الصورة', 'Piece from the photo'));
          f.append('description', desc.trim());
          f.append('product_url', link.trim());
          f.append('category', category);
          if (file) f.append('image', file);
          try {
            await api.upload('/customer/product-requests', f);
            setDone(true);
          } catch (x) {
            setErr(x instanceof Error ? x.message : tr('تعذّر الإرسال', 'Could not send'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field"><span>{tr('الاسم', 'Name')}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>{tr('رقم الهاتف', 'Phone')}</span><input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
        <label className="field"><span>{tr('القسم', 'Category')}</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.name_ar ?? ''}>{c.name_ar}</option>)}</select></label>
        <label className="field"><span>{tr('وصف القطعة (البراند، الموديل، المقاس، اللون)', 'Describe it (brand, model, size, colour)')}</span><textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="field"><span>{tr('رابط القطعة (اختياري)', 'Link (optional)')}</span><input dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
        <label className="file"><Icon name="camera" /> {file ? file.name : tr('ارفع صورة القطعة', 'Add a photo')}<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        {err ? <p className="err">{err}</p> : null}
        <button className="btn wide" disabled={busy}>{busy ? '…' : tr('أرسل الطلب', 'Send request')}</button>
      </form>
    </div>
  );
}

export function Policies() {
  const { tr, pick } = usePrefs();
  useTitle(tr('السياسات', 'Policies'));
  const { policies } = useData();
  return (
    <div className="container page narrow">
      <header className="page-head center"><span className="kicker">POLICIES</span><h1>{tr('الشروط والسياسات', 'Terms & policies')}</h1></header>
      {policies.map((p) => (
        <section key={p.id} id={p.type} className="policy">
          <h2>{pick(p, 'title')}</h2>
          <div className="policy-body">{pick(p, 'content')}</div>
        </section>
      ))}
    </div>
  );
}

interface FaqTopic { topic_ar: string; topic_en?: string | null; items: { id: number; question_ar: string; question_en?: string | null; answer_ar: string; answer_en?: string | null }[] }

/** Frequently asked questions: topics, each opens its questions. */
export function Faq() {
  const { tr, isAr } = usePrefs();
  useTitle(tr('الأسئلة الشائعة', 'FAQ'));
  const [topics, setTopics] = useState<FaqTopic[] | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const [q, setQ] = useState<number | null>(null);
  useEffect(() => {
    api.get<{ data?: FaqTopic[] }>('/customer/faqs').then((r) => setTopics(r?.data ?? [])).catch(() => setTopics([]));
  }, []);
  const t = (ar: string, en?: string | null) => (isAr ? ar : en || ar);
  return (
    <div className="container page narrow">
      <header className="page-head center"><span className="kicker">FAQ</span><h1>{tr('الأسئلة الشائعة', 'Frequently asked questions')}</h1></header>
      {topics === null ? <p className="muted center">…</p> : null}
      <div className="faq">
        {(topics ?? []).map((tp, i) => (
          <section key={tp.topic_ar} className={`faq-topic${open === i ? ' on' : ''}`}>
            <button className="faq-head" onClick={() => { setOpen(open === i ? null : i); setQ(null); }}>
              <span>{t(tp.topic_ar, tp.topic_en)}</span><Icon name={open === i ? 'minus' : 'plus'} size={18} />
            </button>
            {open === i ? (
              <div className="faq-items">
                {tp.items.map((it) => (
                  <div key={it.id} className={`faq-q${q === it.id ? ' on' : ''}`}>
                    <button onClick={() => setQ(q === it.id ? null : it.id)}><span>{t(it.question_ar, it.question_en)}</span><Icon name="down" size={16} /></button>
                    {q === it.id ? <p>{t(it.answer_ar, it.answer_en)}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <p className="center muted" style={{ marginTop: 28 }}>{tr('ما لقيت جوابك؟', "Didn't find your answer?")} <a href="https://wa.me/96877246972" target="_blank" rel="noreferrer">{tr('كلمنا بالواتساب', 'Message us on WhatsApp')}</a></p>
    </div>
  );
}

export function NotFound() {
  const { tr } = usePrefs();
  useTitle('404');
  return (
    <div className="container page empty">
      <span className="kicker">404</span>
      <h1>{tr('الصفحة غير موجودة', 'Page not found')}</h1>
      <Link to="/" className="btn">{tr('الرئيسية', 'Home')}</Link>
    </div>
  );
}
