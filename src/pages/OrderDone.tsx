import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { payOrder } from '../lib/amwal';
import { bankDetails, type BankDetails } from '../lib/bank';
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
  const isBank = pay === 'bank';
  const [bank, setBank] = useState<BankDetails | null>(null);
  useEffect(() => { if (isBank) bankDetails().then(setBank); }, [isBank]);
  const receiptLink = `https://wa.me/96877246972?text=${encodeURIComponent(`إيصال التحويل للطلب ${number}`)}`;
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
      <h1>{paid ? tr('تم استلام طلبك', 'Your order is confirmed') : isBank ? tr('طلبك محفوظ، باقي التحويل', 'Your order is saved — transfer pending') : tr('طلبك محفوظ، باقي الدفع', 'Your order is saved — payment pending')}</h1>
      <p className="l order-no">{number}</p>
      {isBank ? (
        <div className="bank-box">
          <p>{tr('حوّل الإجمالي للحساب التالي، واكتب رقم الطلب في وصف التحويل:', 'Transfer the total to this account, with the order number in the reference:')}</p>
          {bank?.bank_name ? <div><span>{tr('البنك', 'Bank')}</span><b>{bank.bank_name}</b></div> : null}
          {bank?.account_name ? <div><span>{tr('اسم الحساب', 'Account name')}</span><b>{bank.account_name}</b></div> : null}
          {bank?.account_number ? <div><span>{tr('رقم الحساب', 'Account number')}</span><b dir="ltr">{bank.account_number}</b><button type="button" onClick={() => navigator.clipboard?.writeText(bank.account_number ?? '')}>{tr('نسخ', 'Copy')}</button></div> : null}
          {bank?.iban ? <div><span>IBAN</span><b dir="ltr">{bank.iban}</b><button type="button" onClick={() => navigator.clipboard?.writeText(bank.iban ?? '')}>{tr('نسخ', 'Copy')}</button></div> : null}
          {bank?.note ? <p className="muted">{bank.note}</p> : null}
          <a className="btn" href={receiptLink} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> {tr('أرسل إيصال التحويل', 'Send the transfer receipt')}</a>
        </div>
      ) : null}
      <p className="muted" style={isBank ? { display: 'none' } : undefined}>
        {paid
          ? tr('وصلنا الدفع، وبنبدأ بتجهيز طلبك. بنرسل لك تحديث مع كل خطوة على الإيميل.', 'Payment received — we are on it. You will get an email at every step.')
          : pay === 'cancelled'
            ? tr('ألغيت الدفع. تقدر تكمل الدفع الحين، أو تواصل معنا.', 'You cancelled the payment. You can pay now or contact us.')
            : tr('ما قدرنا نتأكد من الدفع. إذا انخصم المبلغ بنأكده لك، أو أكمل الدفع من هنا.', "We couldn't confirm the payment. If you were charged we'll confirm it; otherwise pay here.")}
      </p>
      <div className="done-actions">
        {!paid && !isBank ? <button className="btn" onClick={retry} disabled={busy}>{busy ? '…' : tr('أكمل الدفع', 'Pay now')}</button> : null}
        {user ? <Link to="/account" className="btn outline">{tr('طلباتي', 'My orders')}</Link> : null}
        <Link to="/shop" className="btn outline">{tr('متابعة التسوق', 'Continue shopping')}</Link>
        <a className="btn ghost" href="https://wa.me/96877246972" target="_blank" rel="noreferrer"><Icon name="whatsapp" /> {tr('تواصل معنا', 'Contact us')}</a>
      </div>
    </div>
  );
}
