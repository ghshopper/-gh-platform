import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, imageUrl, listOf } from '../lib/api';
import { topUpWallet } from '../lib/amwal';
import { dateText, num, omrReal } from '../lib/format';
import { useLoad } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useFeature, useToast } from '../lib/store';
import type { AlertPrefs, PieceRequest, WalletInfo } from '../lib/types';
import { AskButton } from '../components/Chat';
import { Icon } from '../components/Icon';

/* Account sections for the owner-switchable features:
   alert preferences (wishlist_alerts), my piece requests with quotes (quotes),
   and the GH wallet (wallet). */

/* ------------------------------ Alert prefs ------------------------------ */

export function AlertPrefsCard() {
  const flag = useFeature('wishlist_alerts');
  const { tr } = usePrefs();
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!flag) return;
    api.get<Partial<AlertPrefs> & { data?: Partial<AlertPrefs> }>('/customer/alert-prefs').then((r) => {
      const v = r?.data ?? r ?? {};
      setPrefs({ price_drop: v.price_drop !== false, back_in_stock: v.back_in_stock !== false, brand_new: v.brand_new !== false });
    }).catch(() => setPrefs({ price_drop: true, back_in_stock: true, brand_new: true }));
  }, [!!flag]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!flag) return null;
  const rows: { k: keyof AlertPrefs; ar: string; en: string; dar: string; den: string }[] = [
    { k: 'price_drop', ar: 'نزل السعر', en: 'Price drops', dar: 'إذا نزل سعر قطعة في مفضلتك', den: 'When a piece in your wishlist drops in price' },
    { k: 'back_in_stock', ar: 'رجعت متوفرة', en: 'Back in stock', dar: 'إذا رجعت قطعة نفدت (من مفضلتك أو اللي طلبت التنبيه عنها)', den: 'When a sold-out piece is back (wishlist or "notify me")' },
    { k: 'brand_new', ar: 'جديد البراندات اللي تحبها', en: 'New from your designers', dar: 'إذا نزلت قطعة جديدة من براند في مفضلتك', den: 'When a designer you saved adds a new piece' },
  ];
  const toggle = async (k: keyof AlertPrefs) => {
    if (!prefs) return;
    const before = prefs;
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    setErr(null);
    setSaved(false);
    try {
      await api.put('/customer/alert-prefs', next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (x) {
      setPrefs(before);
      setErr(x instanceof Error ? x.message : tr('تعذّر الحفظ', 'Could not save'));
    }
  };
  return (
    <section className="acc-card">
      <header className="acc-card-head">
        <div><span className="kicker gold">ALERTS</span><h3>{tr('تنبيهات المفضلة', 'Wishlist alerts')}</h3></div>
        {saved ? <span className="small green">{tr('انحفظ ✓', 'Saved ✓')}</span> : null}
      </header>
      <p className="small muted">{tr('اختر متى نعلمك بإشعار وعلى الإيميل.', 'Choose when we notify you (push and email).')}</p>
      {!prefs ? <div className="skeleton line-sk" /> : (
        <div className="toggles">
          {rows.map((r) => (
            <label key={r.k} className="toggle-row">
              <div><b>{tr(r.ar, r.en)}</b><span>{tr(r.dar, r.den)}</span></div>
              <input type="checkbox" className="switch" checked={prefs[r.k]} onChange={() => toggle(r.k)} />
            </label>
          ))}
        </div>
      )}
      {err ? <p className="err">{err}</p> : null}
    </section>
  );
}

/* ---------------------------- My piece requests --------------------------- */

const STATUS: Record<string, [string, string]> = {
  pending: ['استلمنا طلبك', 'Received'],
  reviewing: ['نبحث عن القطعة', 'Searching'],
  found: ['لقيناها', 'Found'],
  not_found: ['ما لقيناها', 'Not found'],
  ordered: ['صار طلب', 'Ordered'],
  cancelled: ['ملغي', 'Cancelled'],
};

const METHOD: Record<string, [string, string]> = {
  home: ['مندوبنا لباب البيت', 'Our driver to your door'],
  genacom: ['جيناكم لباب البيت', 'Genacom to your door'],
  genacom_office: ['استلام من مكتب جيناكم', 'Genacom office pick-up'],
};

interface PayInfo {
  remaining?: number;
  total?: number;
  wallet?: { available: boolean; balance: number } | null;
}

/** Pays an accepted quote: GH wallet first (if any balance), the rest on the existing /pay page. */
function QuotePay({ order, onPaid }: { order: NonNullable<PieceRequest['order']>; onPaid: () => void }) {
  const { tr } = usePrefs();
  const walletOn = !!useFeature('wallet');
  const { show } = useToast();
  const token = order.pay_token ?? (order.pay_url ? new URLSearchParams(order.pay_url.split('?')[1] ?? '').get('t') : null);
  const info = useLoad(async () => (token ? await api.get<PayInfo>(`/ps/pay/${token}`) : null), [token]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const due = num(info.data?.remaining, num(order.total));
  const wallet = walletOn && info.data?.wallet?.available ? num(info.data.wallet.balance) : 0;
  const fromWallet = Math.min(wallet, due);
  const payUrl = order.pay_url || (token ? `/pay/?t=${token}` : null);
  if (info.loading && !info.data) return <div className="skeleton line-sk" />;
  if (due <= 0.0005) {
    return <p className="green small"><Icon name="check" size={16} /> {tr('تم الدفع، بنبدأ نشتري قطعتك', 'Paid — we are buying your piece')}</p>;
  }
  const payWallet = async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ paid_amount?: number; due?: number; balance?: number }>(`/ps/pay/${token}/wallet`, {});
      show(tr(`انخصم ${omrReal(r?.paid_amount ?? fromWallet)} من رصيدك`, `${omrReal(r?.paid_amount ?? fromWallet)} paid from your balance`));
      info.reload();
      if (num(r?.due) <= 0.0005) onPaid();
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('تعذّر الدفع', 'Could not pay'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="quote-pay">
      <div className="quote-due"><span>{tr('المطلوب الحين', 'Due now')}</span><b className="num">{omrReal(due)}</b></div>
      {fromWallet > 0.0005 ? (
        <button className="btn wide" disabled={busy} onClick={payWallet}>
          <Icon name="wallet" size={18} /> {busy ? '…' : tr(`ادفع ${omrReal(fromWallet)} من رصيدك`, `Pay ${omrReal(fromWallet)} from your balance`)}
        </button>
      ) : null}
      {payUrl && due - fromWallet > 0.0005 ? (
        <a className={`btn wide${fromWallet > 0.0005 ? ' outline' : ''}`} href={payUrl}>
          <Icon name="lock" size={18} /> {fromWallet > 0.0005 ? tr(`ادفع الباقي ${omrReal(due - fromWallet)} بالبطاقة`, `Pay the rest ${omrReal(due - fromWallet)} by card`) : tr(`ادفع ${omrReal(due)} بالبطاقة`, `Pay ${omrReal(due)} by card`)}
        </a>
      ) : null}
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}

function RequestCard({ r, reload }: { r: PieceRequest; reload: () => void }) {
  const { tr, isAr } = usePrefs();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [accepted, setAccepted] = useState<PieceRequest['order']>(null);
  const q = r.quote;
  const order = accepted ?? r.order;
  const st = STATUS[r.status] ?? [r.status_label_ar ?? r.status, r.status];
  const statusText = isAr && r.status_label_ar ? r.status_label_ar : tr(st[0], st[1]);
  const live = q && q.status === 'sent' && !q.expired;
  const expired = q && (q.expired || q.status === 'expired');

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<{ order?: NonNullable<PieceRequest['order']> & { total?: number } }>(`/customer/product-requests/${r.id}/accept`);
      if (res?.order) setAccepted({ ...res.order, paid: false });
      show(tr('تم تأكيد العرض 🤍 باقي الدفع', 'Offer accepted 🤍 now pay'));
      reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('تعذّر التأكيد', 'Could not accept'));
      if (x instanceof ApiError && x.status === 422) reload();
    } finally {
      setBusy(false);
    }
  };
  const decline = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/customer/product-requests/${r.id}/decline`, { reason: reason.trim() || undefined });
      setDeclining(false);
      show(tr('وصلنا ردك، شكراً لك', 'Got it, thank you'));
      reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('تعذّر الإرسال', 'Could not send'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="preq">
      <div className="preq-head">
        <div className="preq-img">{r.image_url ? <img src={imageUrl(r.image_url)} alt="" loading="lazy" /> : <Icon name="camera" size={22} stroke={1.1} />}</div>
        <div className="preq-info">
          {r.brand ? <div className="brand">{r.brand.toUpperCase()}</div> : null}
          <b>{r.product_name || tr('قطعة من الصورة', 'Piece from the photo')}</b>
          {r.details ? <span className="small muted preq-details">{r.details}</span> : null}
          <span className="small muted">{dateText(r.created_at, isAr)}{r.product_url ? <> · <a className="link" href={r.product_url} target="_blank" rel="noreferrer">{tr('الرابط', 'Link')}</a></> : null}</span>
        </div>
        <span className={`pill${r.status === 'found' || r.status === 'ordered' ? ' green' : ''}`}>{statusText}</span>
      </div>

      {q ? (
        <div className={`quote${live ? ' live' : ''}`}>
          <div className="quote-top">
            <span className="kicker gold">{tr('عرض السعر', 'YOUR QUOTE')}</span>
            {live && q.expires_at ? <span className="small muted">{tr('صالح لين', 'Valid until')} {dateText(q.expires_at, isAr)}</span> : null}
          </div>
          <div className="sums">
            <div><span>{tr('سعر القطعة', 'Piece')}</span><span className="num">{omrReal(q.price)}</span></div>
            {num(q.delivery_fee) > 0 ? <div><span>{tr('التوصيل', 'Delivery')}{q.delivery_method && METHOD[q.delivery_method] ? ` · ${tr(METHOD[q.delivery_method][0], METHOD[q.delivery_method][1])}` : ''}</span><span className="num">{omrReal(q.delivery_fee)}</span></div> : null}
            <div className="total"><span>{tr('الإجمالي', 'Total')}</span><span className="num">{omrReal(q.total)}</span></div>
          </div>
          {q.note ? <p className="quote-note">{q.note}</p> : null}

          {live && !order ? (
            declining ? (
              <div className="quote-decline">
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr('ليش؟ (اختياري) — يساعدنا نخدمك أحسن', 'Why? (optional) — helps us do better')} maxLength={500} />
                <div className="quote-actions">
                  <button className="btn outline small-btn" disabled={busy} onClick={decline}>{busy ? '…' : tr('أكد الرفض', 'Confirm')}</button>
                  <button className="link small" onClick={() => setDeclining(false)}>{tr('رجوع', 'Back')}</button>
                </div>
              </div>
            ) : (
              <div className="quote-actions">
                <button className="btn grow" disabled={busy} onClick={accept}>{busy ? '…' : tr('أكد العرض وادفع', 'Accept & pay')}</button>
                <button className="btn ghost" disabled={busy} onClick={() => setDeclining(true)}>{tr('ما أبيها', 'Decline')}</button>
              </div>
            )
          ) : null}
          {expired && !order ? (
            <div className="quote-off">
              <p className="small red">{tr('انتهت صلاحية العرض', 'This offer has expired')}</p>
              <AskButton className="link small" ctx={{}} label={tr('اطلب عرض جديد', 'Ask for a new offer')} />
            </div>
          ) : null}
          {q.status === 'declined' ? <p className="small muted">{tr('رفضت هذا العرض', 'You declined this offer')}</p> : null}
          {order ? (
            order.paid ? (
              <p className="green small"><Icon name="check" size={16} /> {tr('تم الدفع', 'Paid')}{order.invoice_no ? <> · <b className="l">{order.invoice_no}</b></> : null} · <Link className="link" to="/account">{tr('تابعها في طلباتي', 'Follow it in my orders')}</Link></p>
            ) : (
              <QuotePay order={order} onPaid={reload} />
            )
          ) : null}
        </div>
      ) : r.status === 'pending' || r.status === 'reviewing' ? (
        <p className="small muted preq-wait">{tr('بنرد عليك بالسعر قريب، وبيوصلك إشعار أول ما يجهز العرض.', 'We will get back to you with a price soon — you will get a notification.')}</p>
      ) : null}
      {err ? <p className="err">{err}</p> : null}
    </article>
  );
}

export function MyRequests() {
  const flag = useFeature('quotes');
  const { tr } = usePrefs();
  const list = useLoad(async () => (flag ? listOf<PieceRequest>(await api.get<unknown>('/customer/product-requests')) : []), [!!flag]);
  if (!flag) return null;
  const rows = list.data ?? [];
  return (
    <div className="preq-list">
      {list.loading && !rows.length ? <div className="skeleton line-sk" /> : null}
      {!list.loading && !rows.length ? (
        <div className="empty"><Icon name="camera" size={34} stroke={1.1} /><p>{tr('ما طلبت قطع خاصة للحين', 'No piece requests yet')}</p><Link to="/request" className="btn outline">{tr('اطلب قطعة', 'Request a piece')}</Link></div>
      ) : null}
      {rows.map((r) => <RequestCard key={r.id} r={r} reload={list.reload} />)}
      {rows.length ? <Link to="/request" className="link small">{tr('+ اطلب قطعة ثانية', '+ Request another piece')}</Link> : null}
    </div>
  );
}

/* --------------------------------- Wallet -------------------------------- */

const TX_LABEL: Record<string, [string, string]> = {
  topup: ['شحن رصيد', 'Top-up'],
  points: ['تحويل نقاط', 'Points converted'],
  spend: ['دفع طلب', 'Order payment'],
  refund: ['استرجاع', 'Refund'],
  credit: ['رصيد من GH', 'Credit from GH'],
  debit: ['خصم', 'Debit'],
  gift_card: ['بطاقة هدية', 'Gift card'],
};

export function WalletSection({ onPoints }: { onPoints?: () => void } = {}) {
  const flag = useFeature('wallet');
  const { tr, isAr, lang } = usePrefs();
  const { show } = useToast();
  const w = useLoad(async () => (flag ? await api.get<WalletInfo & { data?: WalletInfo }>('/customer/wallet') : null), [!!flag]);
  const info: WalletInfo | null = w.data ? (w.data.data ?? w.data) : null;
  const [points, setPoints] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<'convert' | 'topup' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!flag) return null;
  if (w.loading && !info) return <div className="skeleton line-sk" />;
  if (!info) return w.error ? <p className="err">{w.error}</p> : null;
  const min = num(info.topup_min, num(flag.topup_min, 5));
  const max = num(info.topup_max, num(flag.topup_max, 1000));
  const presets = [10, 25, 50, 100, 200].filter((v) => v >= min && v <= max).slice(0, 4);
  const pts = Math.floor(num(points));
  const ptsValue = Math.round(pts * num(info.point_value) * 1000) / 1000;
  const amt = num(amount);
  const canConvert = info.points_convert !== false && flag.points_convert !== false && num(info.points) > 0;
  const canTopup = info.topup !== false && flag.topup !== false;

  const convert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pts <= 0 || pts > num(info.points)) return setErr(tr('اكتب عدد نقاط صحيح', 'Enter a valid number of points'));
    setBusy('convert');
    setErr(null);
    try {
      await api.post('/customer/wallet/convert', { points: pts });
      setPoints('');
      show(tr(`انضاف ${omrReal(ptsValue)} لرصيدك`, `${omrReal(ptsValue)} added to your balance`));
      w.reload();
      onPoints?.();
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('تعذّر التحويل', 'Could not convert'));
    } finally {
      setBusy(null);
    }
  };
  const topup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(amt >= min && amt <= max)) return setErr(tr(`المبلغ من ${min} إلى ${max} ر.ع`, `Amount between ${min} and ${max} OMR`));
    setBusy('topup');
    setErr(null);
    try {
      const r = await topUpWallet(Math.round(amt * 1000) / 1000, lang);
      if (r === 'paid') {
        setAmount('');
        show(tr(`انضاف ${omrReal(amt)} لرصيدك ✨`, `${omrReal(amt)} added to your balance ✨`));
      } else if (r === 'failed') setErr(tr('ما قدرنا نتأكد من الدفع. إذا انخصم المبلغ بيوصل رصيدك خلال دقائق.', "We couldn't confirm the payment. If you were charged, it will show in a few minutes."));
      w.reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('الدفع غير متاح حالياً', 'Payment unavailable'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wallet">
      <div className="wallet-card">
        <span className="kicker gold">GH BALANCE</span>
        <div className="wallet-bal"><b className="num">{omrReal(info.balance)}</b><small>{tr('رصيدك', 'Your balance')}</small></div>
        <p className="small">{tr('استخدمه في الدفع عند إتمام الطلب أو لدفع طلباتك الخاصة.', 'Use it at checkout or to pay for your piece requests.')}</p>
      </div>

      <div className="wallet-actions">
        {canTopup ? (
          <form className="acc-card" onSubmit={topup}>
            <h3><Icon name="plus" size={18} /> {tr('اشحن رصيدك', 'Top up')}</h3>
            <div className="opt-values">
              {presets.map((v) => <button type="button" key={v} className={`chip${amt === v ? ' on' : ''}`} onClick={() => setAmount(String(v))}><span className="num">{v} OMR</span></button>)}
            </div>
            <label className="field"><span>{tr(`مبلغ آخر (${min}–${max} ر.ع)`, `Other amount (${min}–${max} OMR)`)}</span><input type="number" inputMode="decimal" dir="ltr" min={min} max={max} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <button className="btn wide" disabled={busy !== null || !amt}>{busy === 'topup' ? tr('لحظات…', 'One moment…') : tr(`اشحن ${amt ? omrReal(amt) : ''}`, `Top up ${amt ? omrReal(amt) : ''}`)}</button>
            <p className="small muted center"><Icon name="lock" size={13} /> {tr('بطاقة أو Apple Pay عبر أموال', 'Card or Apple Pay via Amwal')}</p>
          </form>
        ) : null}
        {canConvert ? (
          <form className="acc-card" onSubmit={convert}>
            <h3><Icon name="star" size={18} /> {tr('حوّل نقاطك لرصيد', 'Turn points into credit')}</h3>
            <p className="small muted">{tr(`عندك ${num(info.points).toLocaleString('en-US')} نقطة · النقطة = ${omrReal(info.point_value)}`, `You have ${num(info.points).toLocaleString('en-US')} points · 1 point = ${omrReal(info.point_value)}`)}</p>
            <div className="invite-code">
              <input type="number" inputMode="numeric" dir="ltr" min={1} max={num(info.points)} value={points} onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ''))} placeholder={String(Math.floor(num(info.points)))} />
              <button type="button" className="btn outline small" onClick={() => setPoints(String(Math.floor(num(info.points))))}>{tr('الكل', 'All')}</button>
            </div>
            <button className="btn outline wide" disabled={busy !== null || pts <= 0}>{busy === 'convert' ? '…' : pts > 0 ? tr(`حوّل واحصل على ${omrReal(ptsValue)}`, `Convert for ${omrReal(ptsValue)}`) : tr('حوّل', 'Convert')}</button>
          </form>
        ) : null}
        <div className="acc-card">
          <h3><Icon name="gift" size={18} /> {tr('استخدم بطاقة هدية', 'Use a gift card')}</h3>
          <p className="small muted">{tr('اكتب كود البطاقة وينضاف كامل رصيدها لرصيدك.', 'Enter the card code and its whole balance moves to your balance.')}</p>
          <RedeemGift onDone={() => w.reload()} />
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}

      <h3 className="wallet-h">{tr('الحركات', 'Activity')}</h3>
      {info.transactions?.length ? (
        <ul className="wallet-tx">
          {info.transactions.map((t) => {
            const lbl = TX_LABEL[t.type];
            const amtTx = num(t.amount);
            return (
              <li key={t.id}>
                <div>
                  <b>{isAr && t.type_label_ar ? t.type_label_ar : lbl ? tr(lbl[0], lbl[1]) : t.type}</b>
                  <span className="small muted">{[t.order_number, t.order_number && t.note?.includes(t.order_number) ? null : t.note].filter(Boolean).join(' · ')}{t.created_at ? `${t.order_number || t.note ? ' · ' : ''}${dateText(t.created_at, isAr)}` : ''}</span>
                </div>
                <div className="wallet-amt">
                  <span className={`num ${amtTx >= 0 ? 'green' : 'red'}`}>{amtTx >= 0 ? '+' : '−'}{omrReal(Math.abs(amtTx))}</span>
                  <small className="num muted">{omrReal(t.balance_after)}</small>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="small muted">{tr('ما فيه حركات للحين', 'No activity yet')}</p>}
    </div>
  );
}

/** Gift card → balance: POST /customer/wallet/redeem-gift {code} → {added, balance}; a 422 shows its message. */
export function RedeemGift({ onDone, compact }: { onDone?: (balance: number, added: number) => void; compact?: boolean }) {
  const { tr } = usePrefs();
  const { show } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ added?: number | string; balance?: number | string }>('/customer/wallet/redeem-gift', { code: code.trim() });
      const added = num(r?.added);
      setCode('');
      show(tr(`انضاف ${omrReal(added)} لرصيدك 🎁`, `${omrReal(added)} added to your balance 🎁`));
      onDone?.(num(r?.balance), added);
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('الكود غير صحيح أو مستخدم', 'Invalid or used code'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={`redeem${compact ? ' compact' : ''}`} onSubmit={submit}>
      <div className="coupon">
        <Icon name="gift" size={18} />
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())} placeholder={tr('كود بطاقة الهدية', 'Gift card code')} dir="ltr" autoComplete="off" />
        <button className="btn small-btn" disabled={busy || !code}>{busy ? '…' : tr('حوّلها لرصيدك', 'Add to balance')}</button>
      </div>
      {err ? <p className="err">{err}</p> : null}
    </form>
  );
}
