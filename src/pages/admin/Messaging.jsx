import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiMessage2Line, RiLoader4Line, RiCheckLine, RiCloseLine, RiWallet3Line } from 'react-icons/ri'
import api from '../../services/api'

// SMS (and WhatsApp) through Infobip: the keys, which messages go by SMS, and a test.
const MODES = [
  ['fallback', 'إذا ما وصل واتساب', 'يرسل SMS بس لما الواتساب ما يشتغل أو ما يوصل (الأوفر)'],
  ['always', 'دايماً', 'SMS مع كل رسالة، حتى لو وصل الواتساب'],
  ['off', 'موقف', 'ما يرسل SMS'],
]

export default function Messaging() {
  const [d, setD] = useState(null)
  const [f, setF] = useState(null)
  const [saving, setSaving] = useState(false)
  const [bal, setBal] = useState(null)
  const [phone, setPhone] = useState('')
  const [testing, setTesting] = useState(false)

  const load = () => api.get('/admin/messaging').then((r) => { setD(r.data); setF(r.data.settings) }).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!d?.connected) return
    api.get('/admin/messaging/balance').then((r) => setBal(r.data)).catch((e) => setBal({ ok: false, error: e.response?.data?.error }))
  }, [d?.connected])

  const set = (p) => setF((x) => ({ ...x, ...p }))
  const save = async (e) => {
    e?.preventDefault()
    setSaving(true)
    try {
      const r = await api.post('/admin/messaging', f)
      toast.success(r.data.connected ? 'انحفظ وانربط' : 'انحفظ')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'ما انحفظ')
    } finally { setSaving(false) }
  }
  const test = async () => {
    if (!phone.trim()) return toast.error('اكتب رقم')
    setTesting(true)
    try {
      await api.post('/admin/messaging/test', { phone })
      toast.success('انرسلت، شوف جوالك')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'ما انرسلت')
    } finally { setTesting(false) }
  }

  const testWa = async () => {
    if (!phone.trim()) return toast.error('اكتب رقم')
    setTesting(true)
    try {
      await api.post('/admin/messaging/test-whatsapp', { phone })
      toast.success('انرسل، شوف الواتساب')
    } catch (e) {
      toast.error(e.response?.data?.error || 'ما انرسل')
    } finally { setTesting(false) }
  }

  if (!d || !f) return <div className="page"><div className="gh-skel" style={{ height: 400 }} /></div>
  const ev = f.sms_events || []

  return (
    <div className="page ms" dir="rtl">
      <div className="ms-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>الرسائل النصية (SMS)</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>رسائل SMS باسم المتجر للعملاء: تأكيد الطلب وتحديثاته وبطاقات الهدايا.</p>
        </div>
        <span className={`ms-pill ${d.sms_connected ? 'on' : ''}`}>{d.sms_connected ? <><RiCheckLine /> مربوط</> : <><RiCloseLine /> غير مربوط</>}</span>
      </div>

      <div className="gh-seg ms-prov">
        <button type="button" className={f.provider === 'android' ? 'on' : ''} onClick={() => set({ provider: 'android' })}>📱 من جوال أندرويد</button>
        <button type="button" className={f.provider !== 'android' ? 'on' : ''} onClick={() => set({ provider: 'infobip' })}>Infobip</button>
      </div>

      <form className="ms-grid" onSubmit={save}>
        {f.provider === 'android' ? (
        <div className="card ms-box">
          <h3>جوال أندرويد</h3>
          <ol className="ms-steps">
            <li>نزّل تطبيق <b>SMS Gateway for Android</b> على الجوال من Google Play (أو من sms-gate.app).</li>
            <li>افتح التطبيق، فعّل <b>Cloud server</b> واضغط <b>Online</b>، وعطه صلاحية الرسائل.</li>
            <li>بيطلع لك <b>Username</b> و <b>Password</b>، اكتبهم هنا واحفظ.</li>
            <li>خلّ الجوال شغّال ومتصل بالإنترنت وعلى الشاحن، وطلّع التطبيق من «توفير البطارية».</li>
          </ol>
          <label>Username<input className="input" dir="ltr" value={f.android_user || ''} onChange={(e) => set({ android_user: e.target.value })} autoComplete="off" /></label>
          <label>Password<input className="input" dir="ltr" value={f.android_pass || ''} onChange={(e) => set({ android_pass: e.target.value })} autoComplete="off" /></label>
          <p className="ms-hint">الرسائل تطلع من رقم الشريحة اللي في الجوال (مب باسم GH Shopper). خذ باقة رسائل كثيرة من شركة الاتصالات.</p>
        </div>
        ) : (
        <div className="card ms-box">
          <h3>الربط</h3>
          <p className="ms-hint">من حسابك في Infobip: الصفحة الرئيسية فيها <b>API Base URL</b>، والمفتاح من <b>Developer Tools ← API Keys</b> (سوّ مفتاح جديد).</p>
          <label>API Base URL<input className="input" dir="ltr" value={f.base_url} onChange={(e) => set({ base_url: e.target.value })} placeholder="xxxxx.api.infobip.com" /></label>
          <label>API Key<input className="input" dir="ltr" value={f.api_key} onChange={(e) => set({ api_key: e.target.value })} placeholder="الصق المفتاح هنا" autoComplete="off" /></label>
          <label>اسم المرسل (SMS)<input className="input" dir="ltr" value={f.sms_sender} maxLength={11} onChange={(e) => set({ sms_sender: e.target.value })} placeholder="GHShopper" /><small>نفس الاسم اللي سجلته عندهم (لين يتسجل ممكن الرسائل ما توصل في عُمان).</small></label>
          {bal && (bal.ok
            ? <div className="ms-bal"><RiWallet3Line /> الرصيد: <b dir="ltr">{Number(bal.balance).toFixed(2)} {bal.currency}</b></div>
            : <div className="ms-bal err">ما قدرنا نقرأ الرصيد: {bal.error || 'تأكد من الرابط والمفتاح'}</div>)}
        </div>
        )}

        <div className="card ms-box">
          <h3>متى يرسل SMS؟</h3>
          <div className="ms-modes">
            {MODES.map(([k, t, h]) => (
              <label key={k} className={`ms-mode ${f.sms_mode === k ? 'on' : ''}`}>
                <input type="radio" name="mode" checked={f.sms_mode === k} onChange={() => set({ sms_mode: k })} />
                <div><b>{t}</b><small>{h}</small></div>
              </label>
            ))}
          </div>
          <h3 style={{ marginTop: 6 }}>أي رسائل؟</h3>
          {Object.entries(d.events).map(([k, t]) => (
            <label key={k} className="ms-check"><input type="checkbox" checked={ev.includes(k)} onChange={(e) => set({ sms_events: e.target.checked ? [...ev, k] : ev.filter((x) => x !== k) })} /> {t}</label>
          ))}
          <p className="ms-hint">كل رسالة فيها رابط تتبّع الطلب. الرسالة العربية تتحسب كل ٧٠ حرف رسالة.</p>
        </div>

        <div className="card ms-box">
          <h3>رسائل الواتساب التلقائية</h3>
          <div className="gh-seg" style={{ width: '100%' }}>
            {[['', 'من صفحة واتساب'], ['greenapi', 'رقم ثاني (Green-API)'], ['infobip', 'Infobip']].map(([k, l]) => (
              <button type="button" key={k} className={(f.wa_via || '') === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => set({ wa_via: k })}>{l}</button>
            ))}
          </div>
          {f.wa_via === 'greenapi' && <>
            <p className="ms-warn">⚠️ هذي طريقة غير رسمية. واتساب ممكن يحظر الرقم، فاستخدم رقم ثاني جديد، <b>مب رقم البزنس</b>.</p>
            <ol className="ms-steps">
              <li>سوّ حساب في <b>green-api.com</b> وسوّ Instance (المجاني يرسل لـ ٣ أرقام بس للتجربة، والمدفوع بدون حد).</li>
              <li>افتح الواتساب في الجوال اللي فيه الرقم الجديد ← الأجهزة المرتبطة ← امسح الـ QR اللي يطلع لك عندهم.</li>
              <li>انسخ من صفحة الـ Instance: <b>apiUrl</b> و <b>idInstance</b> و <b>apiTokenInstance</b> وحطهم هنا.</li>
              <li>خلّ الجوال فيه إنترنت. الرسائل تطلع من الرقم حتى لو التطبيق مقفل.</li>
            </ol>
            <label>apiUrl<input className="input" dir="ltr" value={f.green_url || ''} onChange={(e) => set({ green_url: e.target.value })} placeholder="https://7103.api.greenapi.com" /></label>
            <label>idInstance<input className="input" dir="ltr" value={f.green_id || ''} onChange={(e) => set({ green_id: e.target.value })} placeholder="7103000000" /></label>
            <label>apiTokenInstance<input className="input" dir="ltr" value={f.green_token || ''} onChange={(e) => set({ green_token: e.target.value })} autoComplete="off" /></label>
            {d.green_state && <div className={`ms-bal ${d.green_state === 'authorized' ? '' : 'err'}`}>الحالة: {d.green_state === 'authorized' ? 'مربوط ✅' : d.green_state === 'notAuthorized' ? 'امسح الـ QR من جديد' : d.green_state === 'blocked' ? 'الرقم محظور من واتساب ❌' : d.green_state}</div>}
            {d.green_state === 'authorized' && (
              <div className="ms-row">
                <input className="input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9xxxxxxx" />
                <button type="button" className="btn btn-ghost" disabled={testing} onClick={testWa}>أرسل واتساب تجربة</button>
              </div>
            )}
            <p className="ms-hint">لو الواتساب ما وصل (أو انحظر الرقم) الرسالة تروح SMS إذا شغّلته فوق.</p>
          </>}
          {f.wa_via === 'infobip' && <>
            <p className="ms-hint">إذا ربطت رقم الواتساب حق المتجر في Infobip، اكتبه هنا. رسائل الطلبات تروح واتساب أول، وإذا ما وصلت تروح SMS.</p>
            <label>رقم الواتساب في Infobip<input className="input" dir="ltr" value={f.wa_sender} onChange={(e) => set({ wa_sender: e.target.value })} placeholder="9689xxxxxxx" /></label>
            <p className="ms-hint">بعد الحفظ روح صفحة «واتساب» واضغط «أرسل القوالب للموافقة».</p>
          </>}
          {!f.wa_via && <p className="ms-hint">الواتساب يشتغل من صفحة «واتساب» (الربط الرسمي مع Meta) لما يكتمل.</p>}
        </div>

        <div className="card ms-box">
          <h3>تجربة</h3>
          <div className="ms-row">
            <input className="input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9xxxxxxx" />
            <button type="button" className="btn btn-ghost" disabled={testing || !d.sms_connected} onClick={test}>{testing ? <RiLoader4Line className="spin" /> : <RiMessage2Line />} أرسل رسالة تجربة</button>
          </div>
          {!d.sms_connected && <p className="ms-hint">احفظ بيانات الربط أول.</p>}
          {d.log?.length > 0 && (
            <div className="ms-log">
              {d.log.map((l) => (
                <div key={l.id} className={l.ok ? '' : 'bad'}>
                  <span dir="ltr">{l.phone}</span><span>{(l.template || '').replace('sms:', '')}</span><span>{l.ok ? 'وصل' : (l.error || 'ما وصل').slice(0, 80)}</span><span>{new Date(l.created_at).toLocaleString('ar-OM', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ms-save"><button className="btn btn-primary" disabled={saving}>{saving ? <RiLoader4Line className="spin" /> : null} حفظ</button></div>
      </form>
      <style>{`
.ms-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.ms-prov{margin-bottom:14px}
.ms-prov button{padding:8px 18px}
.ms-steps{margin:0;padding-inline-start:20px;font-size:13px;line-height:1.9;color:var(--text-secondary)}
.ms-warn{margin:0;font-size:12.5px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;border-radius:10px;padding:8px 12px}
.ms-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:99px;background:#F3F1EE;color:#6E6A66;font-size:13px;font-weight:600}
.ms-pill.on{background:#ECFDF5;color:#047857}
.ms-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ms-box{padding:18px 20px;display:flex;flex-direction:column;gap:12px;margin:0}
.ms-box h3{margin:0;font-size:15px;font-weight:700}
.ms-box label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}
.ms-box .input{height:42px;padding:0 12px}
.ms-box small{font-weight:400;color:var(--text-light);font-size:11.5px}
.ms-hint{font-size:12.5px;color:var(--text-secondary);margin:0;font-weight:400}
.ms-check{flex-direction:row!important;align-items:center;gap:8px!important;cursor:pointer;font-weight:500!important}
.ms-modes{display:flex;flex-direction:column;gap:8px}
.ms-mode{flex-direction:row!important;align-items:flex-start;gap:10px!important;border:1px solid var(--border);border-radius:10px;padding:10px 12px;cursor:pointer}
.ms-mode.on{border-color:#5C0B16;background:#FCF8F8}
.ms-mode div{display:flex;flex-direction:column;gap:2px}
.ms-bal{display:flex;align-items:center;gap:6px;font-size:13px;background:var(--bg-body);border-radius:10px;padding:8px 12px}
.ms-bal.err{color:#B42318}
.ms-row{display:flex;gap:8px}.ms-row .input{flex:1}
.ms-log{display:flex;flex-direction:column;border-top:1px solid var(--border);margin-top:4px}
.ms-log>div{display:grid;grid-template-columns:110px 100px 1fr 110px;gap:8px;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border)}
.ms-log>div.bad{color:#B42318}
.ms-save{grid-column:1/-1;display:flex;justify-content:flex-end}
.ms-save .btn{min-width:160px}
@media(max-width:1000px){.ms-grid{grid-template-columns:1fr}.ms-log>div{grid-template-columns:1fr 1fr}}
`}</style>
    </div>
  )
}
