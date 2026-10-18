import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { payOrder } from '../lib/amwal';
import { useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth } from '../lib/store';
import { Icon } from '../components/Icon';

export default function OrderDone() {
  const { number = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { tr, lang } = usePrefs();
  const { user } = useAuth();
  useTitle(tr('طلبك', 'Your order'));
  const [busy, setBusy] = useState(false);
  const pay = sp.get('pay');
  const paid = pay === 'paid';
  let guest: string | null = null;
  try {
    guest = sessionStorage.getItem(`gh_order_${number}`);
  } catch {
    guest = null;
  }

  const retry = async () => {
    setBusy(true);
    try {
      const r = await payOrder(number, guest, lang);
      setSp({ pay: r }, { replace: true });
    } catch {
      setSp({ pay: 'failed' }, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page done">
      <div className={`done-mark${paid ? '' : ' wait'}`}><Icon name={paid ? 'check' : 'info'} size={34} stroke={1.3} /></div>
      <span className="kicker">{paid ? 'THANK YOU' : 'ORDER SAVED'}</span>
      <h1>{paid ? tr('تم استلام طلبك', 'Your order is confirmed') : tr('طلبك محفوظ، باقي الدفع', 'Your order is saved — payment pending')}</h1>
      <p className="l order-no">{number}</p>
      <p className="muted">
        {paid
          ? tr('وصلنا الدفع، وبنبدأ بتجهيز طلبك. بنرسل لك تحديث مع كل خطوة على الإيميل.', 'Payment received — we are on it. You will get an email at every step.')
          : pay === 'cancelled'
            ? tr('ألغيت الدفع. تقدر تكمل الدفع الحين، أو تواصل معنا.', 'You cancelled the payment. You can pay now or contact us.')
            : tr('ما قدرنا نتأكد من الدفع. إذا انخصم المبلغ بنأكده لك، أو أكمل الدفع من هنا.', "We couldn't confirm the payment. If you were charged we'll confirm it; otherwise pay here.")}
      </p>
      <div className="done-actions">
        {!paid ? <button className="btn" onClick={retry} disabled={busy}>{busy ? '…' : tr('أكمل الدفع', 'Pay now')}</button> : null}
        {user ? <Link to="/account" className="btn outline">{tr('طلباتي', 'My orders')}</Link> : null}
        <Link to="/shop" className="btn outline">{tr('متابعة التسوق', 'Continue shopping')}</Link>
        <a className="btn ghost" href="https://wa.me/96877246972" target="_blank" rel="noreferrer"><Icon name="whatsapp" /> {tr('تواصل معنا', 'Contact us')}</a>
      </div>
    </div>
  );
}
