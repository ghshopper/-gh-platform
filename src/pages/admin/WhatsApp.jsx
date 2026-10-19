import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiCheckboxCircleFill, RiExternalLinkLine, RiSendPlaneLine, RiWhatsappLine } from 'react-icons/ri'
import api from '../../services/api'

const TEMPLATE_LABEL = {
  gh_order_confirmed: 'تأكيد الطلب',
  gh_order_update: 'تحديث حالة الطلب',
  gh_gift_card: 'بطاقة الهدية',
}
const STATUS = {
  APPROVED: ['مقبول', '#067647', '#ECFDF3'],
  PENDING: ['قيد المراجعة عند ميتا', '#B54708', '#FFFAEB'],
  REJECTED: ['مرفوض', '#B42318', '#FEF3F2'],
  missing: ['ما انرفع', '#6B7280', '#F3F4F6'],
  error: ['تعذّر التحقق', '#B42318', '#FEF3F2'],
}

const box = { background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 }
const input = { width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }
const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#6B7280', marginBottom: 6 }

/** Connect the store's WhatsApp number (same number as the WhatsApp Business app) and send order messages from it. */
export default function WhatsApp() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ driver: '360dialog', api_key: '', token: '', phone_id: '', waba_id: '' })
  const [busy, setBusy] = useState('')
  const [testPhone, setTestPhone] = useState('')

  const load = async () => {
    try {
      const r = await api.get('/admin/whatsapp')
      setData(r.data)
      setForm((f) => ({ ...f, ...r.data.settings, driver: r.data.settings.driver || '360dialog' }))
    } catch {
      toast.error('تعذّر التحميل')
    }
  }
  useEffect(() => { load() }, [])

  const run = async (key, fn) => {
    setBusy(key)
    try { await fn() } catch (x) { toast.error(x.response?.data?.error || x.response?.data?.message || 'حدث خطأ') } finally { setBusy('') }
  }

  const save = (e) => {
    e.preventDefault()
    run('save', async () => {
      const r = await api.post('/admin/whatsapp', form)
      toast.success(r.data?.phone ? `انحفظ · الرقم ${r.data.phone}` : 'انحفظ')
      await load()
    })
  }
  const makeTemplates = () => run('tpl', async () => {
    const r = await api.post('/admin/whatsapp/templates')
    const res = r.data.result || {}
    if (res.error) return toast.error('اربط الرقم أول')
    const bad = Object.entries(res).filter(([, v]) => v !== 'sent')
    if (bad.length) toast.error(bad.map(([k, v]) => `${TEMPLATE_LABEL[k] || k}: ${v}`).join('\n'), { duration: 8000 })
    else toast.success('انرسلت القوالب لميتا، القبول عادة خلال دقائق')
    await load()
  })
  const test = () => run('test', async () => {
    await api.post('/admin/whatsapp/test', { phone: testPhone })
    toast.success('انرسلت، شوف الواتساب')
    await load()
  })
  const disconnect = () => {
    if (!window.confirm('تفصل الواتساب عن النظام؟ (الرقم يظل شغال في جوالك)')) return
    run('off', async () => { await api.post('/admin/whatsapp/disconnect'); await load() })
  }

  if (!data) return <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>جاري التحميل…</div>
  const meta = form.driver === 'meta'
  const templates = Object.entries(data.templates || {})

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title-main" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><RiWhatsappLine color="#25D366" /> واتساب</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>رسائل تأكيد الطلب وتحديث الحالة وبطاقات الهدايا تنرسل تلقائيًا من رقم المتجر، وتظل تراسل منه من جوالك عادي.</p>
      </div>

      <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 12, background: data.connected ? '#ECFDF3' : '#FFFAEB', borderColor: data.connected ? '#ABEFC6' : '#FEDF89' }}>
        {data.connected ? <RiCheckboxCircleFill size={26} color="#067647" /> : <RiWhatsappLine size={26} color="#B54708" />}
        <div style={{ flex: 1 }}>
          <b>{data.connected ? 'مربوط' : 'غير مربوط'}</b>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{data.connected ? `عن طريق ${data.settings.driver === 'meta' ? 'Meta مباشرة' : '360dialog'}` : 'الرسائل التلقائية متوقفة لين تربط الرقم'}</div>
        </div>
        {data.connected ? <button className="btn btn-ghost" onClick={disconnect} disabled={!!busy} style={{ color: '#B42318' }}>فصل</button> : null}
      </div>

      {!data.connected ? (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>طريقة الربط (مرة وحدة)</h3>
          <ol style={{ lineHeight: 2, paddingInlineStart: 20, margin: 0, fontSize: 14 }}>
            <li>سجّل في 360dialog واختر ربط رقم موجود على تطبيق واتساب للأعمال. <a href="https://hub.360dialog.com" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>hub.360dialog.com <RiExternalLinkLine /></a></li>
            <li>سجّل دخول فيسبوك واختر حساب «Shopper GH»، وامسح الـ QR من واتساب الأعمال في جوالك.</li>
            <li>من صفحة الرقم في 360dialog اضغط «Generate API Key» وانسخه.</li>
            <li>الصقه تحت واضغط حفظ، وبعدها «إرسال القوالب لميتا».</li>
          </ol>
        </div>
      ) : null}

      <form style={box} onSubmit={save}>
        <h3 style={{ marginTop: 0 }}>الربط</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[['360dialog', '360dialog (أسهل)'], ['meta', 'Meta مباشرة']].map(([k, l]) => (
            <button type="button" key={k} className={`btn ${form.driver === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setForm({ ...form, driver: k })}>{l}</button>
          ))}
        </div>
        {!meta ? (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={lbl}>360dialog API Key</span>
            <input dir="ltr" style={input} value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="الصق المفتاح هنا" autoComplete="off" />
          </label>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={lbl}>Permanent token (System user)</span>
              <input dir="ltr" style={input} value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} autoComplete="off" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'block', marginBottom: 12 }}><span style={lbl}>Phone number ID (اختياري: يتعبّى لحاله)</span><input dir="ltr" style={input} value={form.phone_id} onChange={(e) => setForm({ ...form, phone_id: e.target.value })} placeholder="اتركه فاضي" /></label>
              <label style={{ display: 'block', marginBottom: 12 }}><span style={lbl}>WhatsApp account ID</span><input dir="ltr" style={input} value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} placeholder="391419307394314" /></label>
            </div>
          </>
        )}
        <button className="btn btn-primary" disabled={!!busy}>{busy === 'save' ? 'يحفظ…' : 'حفظ'}</button>
      </form>

      {data.connected ? (
        <>
          <div style={box}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, flex: 1 }}>قوالب الرسائل</h3>
              <button className="btn btn-primary" onClick={makeTemplates} disabled={!!busy}>{busy === 'tpl' ? 'يرسل…' : 'إرسال القوالب لميتا'}</button>
            </div>
            {templates.map(([name, st]) => {
              const [l, c, bg] = STATUS[st] || STATUS.PENDING
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{TEMPLATE_LABEL[name] || name}</b> <span dir="ltr" style={{ color: '#9CA3AF', fontSize: 12 }}>{name}</span></div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c, background: bg, padding: '4px 10px', borderRadius: 20 }}>{l}</span>
                </div>
              )
            })}
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '10px 0 0' }}>الرسائل تشتغل بعد ما تصير القوالب «مقبول».</p>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>رسالة تجربة</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input dir="ltr" style={{ ...input, flex: 1 }} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="9XXXXXXX" />
              <button className="btn btn-primary" onClick={test} disabled={!!busy || testPhone.replace(/\D/g, '').length < 8} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RiSendPlaneLine /> {busy === 'test' ? 'يرسل…' : 'أرسل'}</button>
            </div>
          </div>
        </>
      ) : null}

      {(data.log || []).length ? (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>آخر الرسائل</h3>
          {data.log.map((l) => (
            <div key={l.id} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '8px 0', borderTop: '1px solid #F3F4F6', alignItems: 'flex-start' }}>
              <span style={{ color: Number(l.ok) ? '#067647' : '#B42318', fontWeight: 700, minWidth: 40 }}>{Number(l.ok) ? 'وصلت' : 'فشلت'}</span>
              <span dir="ltr" style={{ minWidth: 110 }}>{l.phone}</span>
              <span style={{ minWidth: 120 }}>{TEMPLATE_LABEL[l.template] || l.template}</span>
              <span style={{ color: '#9CA3AF', flex: 1, wordBreak: 'break-word' }}>{l.error || ''}</span>
              <span dir="ltr" style={{ color: '#9CA3AF' }}>{String(l.created_at).slice(0, 16)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
