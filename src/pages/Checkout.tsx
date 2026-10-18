import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, imageUrl, listOf } from '../lib/api';
import { payOrder } from '../lib/amwal';
import { num, omr } from '../lib/format';
import { useTitle } from '../lib/hooks';
import { deliveryKey, GOVERNORATES, type Carrier } from '../lib/oman';
import { usePrefs } from '../lib/prefs';
import { useAuth, useCart, useData } from '../lib/store';
import type { Address } from '../lib/types';
import { Icon } from '../components/Icon';

function CouponBox() {
  const { tr } = usePrefs();
  const cart = useCart();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (cart.coupon) {
    return (
      <div className="coupon on">
        <Icon name="tag" size={18} />
        <div><b className="l">{cart.coupon.code}</b><span>{tr(`وفّرت ${omr(cart.coupon.discount)}`, `You save ${omr(cart.coupon.discount)}`)}</span></div>
        <button className="link small" onClick={cart.removeCoupon}>{tr('إزالة', 'Remove')}</button>
      </div>
    );
  }
  return (
    <div>
      {cart.couponNote ? <p className="err">{cart.couponNote}</p> : null}
      <form
        className="coupon"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!code.trim()) return;
          setBusy(true);
          setErr(null);
          try {
            await cart.applyCoupon(code);
            setCode('');
          } catch (x) {
            setErr(x instanceof Error ? x.message : tr('كود غير صالح', 'Invalid code'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="tag" size={18} />
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())} placeholder={tr('كود الخصم', 'Discount code')} />
        <button className="btn small-btn" disabled={busy || !code}>{busy ? '…' : tr('تطبيق', 'Apply')}</button>
      </form>
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}

export default function Checkout() {
  const { tr, isAr, lang } = usePrefs();
  useTitle(tr('إتمام الطلب', 'Checkout'));
  const navigate = useNavigate();
  const cart = useCart();
  const app = useData();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [carrier, setCarrier] = useState<Carrier>('own');
  const [branch, setBranch] = useState(false);
  const [saved, setSaved] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | 'new'>('new');
  const [gov, setGov] = useState('مسقط');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [landmark, setLandmark] = useState('');
  const [gift, setGift] = useState(false);
  const [giftName, setGiftName] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [loyalty, setLoyalty] = useState({ balance: 0, rate: 0.01 });
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName((n) => n || user.name || '');
    setPhone((p) => p || user.phone || '');
    setEmail((e) => e || user.email || '');
    api.get<unknown>('/customer/addresses').then((r) => {
      const list = listOf<Address>(r);
      setSaved(list);
      const def = list.find((a) => a.is_default) ?? list[0];
      if (def) setAddressId(def.id);
    }).catch(() => undefined);
    api.get<{ balance?: number | string; conversion_rate?: number | string }>('/customer/loyalty/balance')
      .then((r) => setLoyalty({ balance: num(r?.balance), rate: num(r?.conversion_rate, 0.01) })).catch(() => undefined);
  }, [user]);

  if (!cart.items.length) {
    return (
      <div className="container page empty">
        <Icon name="bag" size={36} stroke={1.1} />
        <p>{tr('السلة فارغة', 'Your bag is empty')}</p>
        <Link to="/shop" className="btn">{tr('تسوّق الآن', 'Shop now')}</Link>
      </div>
    );
  }

  const fee = carrier !== 'own' && branch ? app.delivery.branch_fee : app.delivery.home_fee;
  const service = app.serviceFee;
  const tax = (cart.subtotal * app.taxPercent) / 100;
  const gross = cart.subtotal + fee + service + tax;
  const couponValue = cart.coupon ? Math.min(cart.coupon.discount, gross) : 0;
  const before = gross - couponValue;
  const loyaltyValue = useLoyalty ? Math.min(loyalty.balance * loyalty.rate, before) : 0;
  const total = Math.max(0, before - loyaltyValue);
  const chosen = addressId === 'new' ? null : saved.find((a) => a.id === addressId) ?? null;

  const address = () => {
    const methodText = carrier === 'own' ? 'مندوب GH لباب البيت' : `${carrier === 'nool' ? 'نول' : 'جيناكم'} — ${branch ? 'استلام من الفرع' : 'لباب البيت'}`;
    const parts = chosen ? [chosen.governorate, chosen.city, chosen.street, chosen.building, chosen.details].filter(Boolean) : [gov, city, street, building, landmark].filter(Boolean);
    return {
      delivery_method: deliveryKey(carrier, branch),
      delivery_label: methodText,
      recipient_name: gift ? giftName.trim() : chosen?.recipient_name ?? name.trim(),
      phone: gift && giftPhone.trim() ? giftPhone.trim() : chosen?.phone ?? phone.trim(),
      country: 'عُمان',
      area: chosen?.governorate ?? gov,
      city: chosen?.city ?? city.trim(),
      street: chosen?.street ?? street.trim(),
      building: chosen?.building ?? building.trim(),
      notes: [methodText, chosen?.details ?? landmark.trim()].filter(Boolean).join(' · '),
      text: parts.join('، '),
    };
  };

  const place = async () => {
    setError(null);
    const needAddress = !(carrier !== 'own' && branch) && !chosen;
    if (!name.trim() || phone.replace(/\D/g, '').length < 8 || (needAddress && !city.trim()) || (gift && !giftName.trim())) {
      setError(tr('أكمل الاسم ورقم الهاتف والعنوان', 'Please complete your name, phone and address'));
      return;
    }
    setBusy(true);
    try {
      if (cart.coupon) {
        const fresh = await cart.recheckCoupon(phone.trim());
        if (!fresh || Math.abs(fresh.discount - cart.coupon.discount) > 0.0005) {
          setError(tr('تغيّر كود الخصم، راجع الإجمالي الجديد', 'Your discount changed — check the new total'));
          return;
        }
      }
      const res = await api.post<{ data?: { order_number: string; guest_token?: string } }>('/customer/orders', {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || null,
        is_gift: gift,
        gift_recipient_name: gift ? giftName.trim() : null,
        gift_message: gift ? [giftMessage.trim(), giftPhone.trim() ? `هاتف المستلم: ${giftPhone.trim()}` : ''].filter(Boolean).join('\n') || null : null,
        payment_method: 'amwalpay',
        subtotal: Number(cart.subtotal.toFixed(3)),
        shipping_cost: Number(fee.toFixed(3)),
        service_fee: Number(service.toFixed(3)),
        discount_amount: Number(loyaltyValue.toFixed(3)),
        coupon_code: cart.coupon?.code ?? null,
        tax_amount: Number(tax.toFixed(3)),
        total_amount: Number(total.toFixed(3)),
        notes: ['طلب من الموقع', notes.trim()].filter(Boolean).join('\n'),
        shipping_address: address(),
        items: cart.items.map((i) => ({
          product_id: i.productId,
          name: i.options.length ? `${i.name} — ${i.options.map((o) => `${o.label}: ${o.value}`).join('، ')}` : i.name,
          image: i.image,
          quantity: i.quantity,
          price: i.price,
        })),
      });
      const order = res?.data;
      if (!order?.order_number) throw new Error(tr('تعذّر إنشاء الطلب', 'Could not create the order'));
      try {
        sessionStorage.setItem(`gh_order_${order.order_number}`, order.guest_token ?? '');
      } catch {
        // ignore
      }
      cart.clear();
      let result: 'paid' | 'failed' | 'cancelled' = 'failed';
      try {
        result = await payOrder(order.order_number, order.guest_token, lang);
      } catch {
        result = 'failed';
      }
      navigate(`/order/${encodeURIComponent(order.order_number)}?pay=${result}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('حدث خطأ', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, opts: { type?: string; dir?: 'ltr'; placeholder?: string; wide?: boolean } = {}) => (
    <label className={`field${opts.wide ? ' wide' : ''}`}>
      <span>{label}</span>
      <input type={opts.type ?? 'text'} dir={opts.dir} value={value} onChange={(e) => set(e.target.value)} placeholder={opts.placeholder} />
    </label>
  );

  return (
    <div className="container page checkout">
      <header className="page-head"><span className="kicker">CHECKOUT</span><h1>{tr('إتمام الطلب', 'Checkout')}</h1></header>
      <div className="co-grid">
        <div className="co-main">
          <section className="co-sec">
            <h3><b>01</b>{tr('بياناتك', 'Your details')}</h3>
            {!user ? <p className="small muted">{tr('عندك حساب؟', 'Have an account?')} <Link to="/account?next=/checkout" className="link">{tr('سجّل دخولك', 'Sign in')}</Link> {tr('لتجمع النقاط وتتابع طلباتك.', 'to earn points and follow your orders.')}</p> : null}
            <div className="fields">
              {field(tr('الاسم', 'Name'), name, setName)}
              {field(tr('رقم الهاتف', 'Phone'), phone, setPhone, { type: 'tel', dir: 'ltr', placeholder: '9XXXXXXX' })}
              {field(tr('البريد الإلكتروني (للفاتورة)', 'Email (for the receipt)'), email, setEmail, { type: 'email', dir: 'ltr', wide: true })}
            </div>
          </section>

          <section className="co-sec">
            <h3><b>02</b>{tr('التوصيل', 'Delivery')}</h3>
            <div className="choice-row">
              {(['own', 'nool', 'genacom'] as Carrier[]).map((c) => (
                <button key={c} type="button" className={`choice${carrier === c ? ' on' : ''}`} onClick={() => { setCarrier(c); if (c === 'own') setBranch(false); }}>
                  <b>{c === 'own' ? tr('مندوب GH', 'GH driver') : c === 'nool' ? tr('نول', 'Nool') : tr('جيناكم', 'Genacom')}</b>
                  <span>{c === 'own' ? tr('لباب البيت', 'To your door') : tr('للبيت أو من الفرع', 'Door or branch')}</span>
                </button>
              ))}
            </div>
            {carrier !== 'own' ? (
              <div className="seg">
                <button className={!branch ? 'on' : ''} onClick={() => setBranch(false)}>{tr('لباب البيت', 'To the door')} · {omr(app.delivery.home_fee)}</button>
                <button className={branch ? 'on' : ''} onClick={() => setBranch(true)}>{tr('استلام من الفرع', 'Branch pickup')} · {omr(app.delivery.branch_fee)}</button>
              </div>
            ) : null}
            {!(carrier !== 'own' && branch) ? (
              <>
                {saved.length ? (
                  <div className="addr-list">
                    {saved.map((a) => (
                      <label key={a.id} className={`addr${addressId === a.id ? ' on' : ''}`}>
                        <input type="radio" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                        <div><b>{a.title || a.recipient_name}</b><span>{[a.governorate, a.city, a.street, a.building].filter(Boolean).join('، ')}</span></div>
                      </label>
                    ))}
                    <label className={`addr${addressId === 'new' ? ' on' : ''}`}><input type="radio" checked={addressId === 'new'} onChange={() => setAddressId('new')} /><div><b>{tr('عنوان جديد', 'New address')}</b></div></label>
                  </div>
                ) : null}
                {addressId === 'new' ? (
                  <div className="fields">
                    <label className="field">
                      <span>{tr('المحافظة', 'Governorate')}</span>
                      <select value={gov} onChange={(e) => setGov(e.target.value)}>{GOVERNORATES.map((g) => <option key={g.ar} value={g.ar}>{isAr ? g.ar : g.en}</option>)}</select>
                    </label>
                    {field(tr('الولاية / المنطقة', 'Area'), city, setCity)}
                    {field(tr('الشارع / السكة', 'Street'), street, setStreet)}
                    {field(tr('رقم المنزل / المبنى', 'House / building'), building, setBuilding)}
                    {field(tr('علامة مميزة (اختياري)', 'Landmark (optional)'), landmark, setLandmark, { wide: true })}
                  </div>
                ) : null}
              </>
            ) : <p className="small muted">{tr('بنرسل الطلب لفرع شركة التوصيل الأقرب لك، ونبلغك برقم الشحنة.', 'We send it to the nearest branch and share the shipment number.')}</p>}
          </section>

          <section className="co-sec">
            <h3><b>03</b>{tr('هدية؟', 'A gift?')}</h3>
            <label className="check"><input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} /> {tr('أرسلها هدية مع رسالة باسمك', 'Send it as a gift with your message')}</label>
            {gift ? (
              <div className="fields">
                {field(tr('اسم المستلم', 'Recipient name'), giftName, setGiftName)}
                {field(tr('هاتف المستلم (اختياري)', 'Recipient phone (optional)'), giftPhone, setGiftPhone, { type: 'tel', dir: 'ltr' })}
                <label className="field wide"><span>{tr('رسالة الإهداء', 'Gift message')}</span><textarea rows={3} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} /></label>
              </div>
            ) : null}
          </section>

          <section className="co-sec">
            <h3><b>04</b>{tr('الدفع', 'Payment')}</h3>
            <div className="pay-card">
              <Icon name="lock" size={20} />
              <div><b>{tr('بطاقة بنكية أو Apple Pay', 'Card or Apple Pay')}</b><span>{tr('Visa · Mastercard · Apple Pay — دفع آمن عبر أموال', 'Visa · Mastercard · Apple Pay — secured by Amwal')}</span></div>
            </div>
            {user && loyalty.balance > 0 ? (
              <label className="check"><input type="checkbox" checked={useLoyalty} onChange={(e) => setUseLoyalty(e.target.checked)} /> {tr(`استخدم نقاطي (${loyalty.balance} نقطة = ${omr(loyalty.balance * loyalty.rate)})`, `Use my points (${loyalty.balance} = ${omr(loyalty.balance * loyalty.rate)})`)}</label>
            ) : null}
            <label className="field wide"><span>{tr('ملاحظات (اختياري)', 'Notes (optional)')}</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </section>
        </div>

        <aside className="co-summary">
          <h3>{tr('ملخص الطلب', 'Order summary')}</h3>
          <div className="co-items">
            {cart.items.map((i) => (
              <div key={i.key} className="co-item">
                <div className="co-img">{i.image ? <img src={imageUrl(i.image)} alt="" /> : null}<b>{i.quantity}</b></div>
                <div><div className="brand">{i.brand.toUpperCase()}</div><div className="small">{i.name}</div>{i.options.map((o) => <div key={o.label} className="small muted">{o.label}: {o.value}</div>)}</div>
                <span className="num">{omr(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <CouponBox />
          <div className="sums">
            <div><span>{tr('المجموع', 'Subtotal')}</span><span className="num">{omr(cart.subtotal)}</span></div>
            <div><span>{tr('التوصيل', 'Delivery')}</span><span className="num">{omr(fee)}</span></div>
            {service > 0 ? <div><span>{tr('الخدمة وتغليف الهدايا', 'Service & gift wrap')}</span><span className="num">{omr(service)}</span></div> : null}
            {tax > 0 ? <div><span>{tr('الضريبة', 'Tax')}</span><span className="num">{omr(tax)}</span></div> : null}
            {couponValue > 0 ? <div className="green"><span>{tr('كود الخصم', 'Discount')} ({cart.coupon?.code})</span><span className="num">-{omr(couponValue)}</span></div> : null}
            {loyaltyValue > 0 ? <div className="green"><span>{tr('خصم النقاط', 'Points')}</span><span className="num">-{omr(loyaltyValue)}</span></div> : null}
            <div className="total"><span>{tr('الإجمالي', 'Total')}</span><span className="num">{omr(total)}</span></div>
          </div>
          {error ? <p className="err">{error}</p> : null}
          <button className="btn wide" onClick={place} disabled={busy}>{busy ? tr('لحظات…', 'One moment…') : tr(`ادفع ${omr(total)}`, `Pay ${omr(total)}`)}</button>
          <p className="small muted center"><Icon name="lock" size={13} /> {tr('بياناتك وبطاقتك محمية', 'Your details and card are protected')}</p>
        </aside>
      </div>
    </div>
  );
}
