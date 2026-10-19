import { useState } from 'react';
import { api } from '../lib/api';
import { omrReal } from '../lib/format';
import { useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth } from '../lib/store';
import { Icon } from '../components/Icon';

const AMOUNTS = [25, 50, 100, 200];

/** Buy a gift card (paid on the pay page, then e-mailed to the recipient) and check a balance. */
export default function GiftCard() {
  const { tr } = usePrefs();
  useTitle(tr('بطاقة هدية', 'Gift card'));
  const { user } = useAuth();
  const [amount, setAmount] = useState('50');
  const [toName, setToName] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [bal, setBal] = useState<{ balance: number; amount: number; usable: boolean; expires_at?: string | null } | null>(null);
  const [balErr, setBalErr] = useState<string | null>(null);

  const value = Number(amount) || 0;

  const buy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value < 10) return setErr(tr('أقل مبلغ 10 ر.ع', 'Minimum 10 OMR'));
    if (phone.replace(/\D/g, '').length < 8) return setErr(tr('اكتب رقم هاتفك صح', 'Enter a valid phone number'));
    if (toPhone.replace(/\D/g, '').length < 8) return setErr(tr('اكتب رقم جوال المستلم صح', "Enter the recipient's phone number"));
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ pay_url?: string; message?: string }>('/gift-cards/buy', {
        amount: value,
        recipient_name: toName.trim(),
        recipient_phone: toPhone.trim(),
        message: message.trim() || null,
        buyer_name: name.trim(),
        buyer_phone: phone.trim(),
        buyer_email: email.trim() || null,
      });
      if (!r?.pay_url) throw new Error(r?.message || tr('حدث خطأ', 'Something went wrong'));
      window.location.href = r.pay_url;
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('حدث خطأ', 'Something went wrong'));
      setBusy(false);
    }
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setBal(null);
    setBalErr(null);
    try {
      const r = await api.get<{ balance: number; amount: number; usable: boolean; expires_at?: string | null }>('/gift-cards/balance', { code: code.trim() });
      setBal(r);
    } catch (x) {
      setBalErr(x instanceof Error ? x.message : tr('الكود غير صحيح', 'Invalid code'));
    }
  };

  return (
    <div className="container page">
      <div className="request gift">
        <div className="req-art gift-art">
          <span className="kicker gold">GH GIFT CARD</span>
          <h1>{tr('أهدِ اللي تحبهم حرية الاختيار', 'Give them the freedom to choose')}</h1>
          <p>{tr('بطاقة هدية من GH Shopper يختار فيها اللي يحبه من أرقى البراندات. توصله على جواله مع رسالتك، ويستخدمها في الدفع.', 'A GH Shopper gift card to choose from the finest designers. Sent to their phone with your message, used at checkout.')}</p>
          <div className="gift-card-visual">
            <span className="kicker">GH SHOPPER</span>
            <b className="num">{omrReal(value || 0)}</b>
            <span>{toName ? tr(`إلى ${toName}`, `To ${toName}`) : tr('بطاقة هدية', 'Gift card')}</span>
          </div>
          <ul className="gift-points">
            <li><Icon name="gift" size={16} />{tr('تُرسل بعد الدفع على طول', 'Sent as soon as it is paid')}</li>
            <li><Icon name="shield" size={16} />{tr('صالحة سنة، وتُستخدم على أكثر من طلب', 'Valid for a year, use it over several orders')}</li>
          </ul>
        </div>

        <form className="req-form" onSubmit={buy}>
          <h3 className="gift-h">{tr('القيمة', 'Amount')}</h3>
          <div className="opt-values">
            {AMOUNTS.map((a) => (
              <button type="button" key={a} className={`chip${value === a ? ' on' : ''}`} onClick={() => setAmount(String(a))}>{omrReal(a)}</button>
            ))}
            <input className="gift-other" inputMode="decimal" placeholder={tr('مبلغ آخر', 'Other')} value={AMOUNTS.includes(value) ? '' : amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>

          <h3 className="gift-h">{tr('إلى', 'To')}</h3>
          <div className="fields">
            <label className="field"><span>{tr('اسم المستلم', 'Recipient name')}</span><input value={toName} onChange={(e) => setToName(e.target.value)} required /></label>
            <label className="field"><span>{tr('جوال المستلم (توصله البطاقة عليه)', 'Recipient phone (the card is sent to it)')}</span><input type="tel" dir="ltr" value={toPhone} onChange={(e) => setToPhone(e.target.value)} required placeholder="9XXXXXXX" /></label>
            <label className="field wide"><span>{tr('رسالتك (اختياري)', 'Your message (optional)')}</span><textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          </div>

          <h3 className="gift-h">{tr('من', 'From')}</h3>
          <div className="fields">
            <label className="field"><span>{tr('اسمك', 'Your name')}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label className="field"><span>{tr('جوالك', 'Your phone')}</span><input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
            <label className="field wide"><span>{tr('إيميلك (يوصلك الإيصال)', 'Your email (for the receipt)')}</span><input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          </div>

          {err ? <p className="err">{err}</p> : null}
          <button className="btn wide" disabled={busy}>{busy ? '…' : tr(`ادفع ${omrReal(value || 0)}`, `Pay ${omrReal(value || 0)}`)}</button>
          <p className="small muted center">{tr('الدفع بالبطاقة أو Apple Pay أو تحويل بنكي. البطاقة تنرسل للمستلم أول ما يتأكد الدفع.', 'Pay by card, Apple Pay or bank transfer. The card goes out once payment is confirmed.')}</p>
        </form>
      </div>

      <form className="gift-balance" onSubmit={check}>
        <h3>{tr('عندك بطاقة؟ شوف رصيدك', 'Have a card? Check your balance')}</h3>
        <div className="gift-balance-row">
          <input className="field-line" dir="ltr" placeholder="GH-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          <button className="btn outline">{tr('تحقق', 'Check')}</button>
        </div>
        {bal ? (
          <p className="gift-bal-result">
            {tr('الرصيد', 'Balance')}: <b className="num">{omrReal(bal.balance)}</b> {tr(`من ${omrReal(bal.amount)}`, `of ${omrReal(bal.amount)}`)}
            {bal.expires_at ? <span className="muted"> · {tr('صالحة إلى', 'valid until')} {bal.expires_at}</span> : null}
            {!bal.usable ? <span className="err"> · {tr('ما تقدر تستخدمها', 'not usable')}</span> : null}
          </p>
        ) : null}
        {balErr ? <p className="err">{balErr}</p> : null}
        <p className="small muted">{tr('تستخدمها في صفحة الدفع: اكتب الكود في خانة «كود الخصم».', 'Use it at checkout: enter the code in the discount code box.')}</p>
      </form>
    </div>
  );
}
