import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiCheckLine, RiCloseLine, RiFileCopyLine, RiGiftLine, RiLoader4Line, RiMailSendLine, RiSearchLine } from 'react-icons/ri'
import api from '../../services/api'

const STATUS = {
  pending: { label: 'تنتظر الدفع', color: '#B45309', bg: 'rgba(180,83,9,.1)' },
  active: { label: 'فعّالة', color: '#15803D', bg: 'rgba(21,128,61,.1)' },
  cancelled: { label: 'ملغية', color: '#6B7280', bg: 'rgba(107,114,128,.12)' },
}
const omr = (v) => `${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ر.ع`
const day = (v) => (v ? new Date(v).toLocaleDateString('ar-OM-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/** Gift cards: sold on the website or issued here; used at checkout as a code. */
export default function GiftCards() {
  const [rows, setRows] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(null)
  const [issuing, setIssuing] = useState(false)
  const [busy, setBusy] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/gift-cards')
      setRows(Array.isArray(r.data.data) ? r.data.data : [])
      setTotals(r.data.totals || {})
    } catch {
      toast.error('تعذر تحميل البطاقات')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((g) => (!status || g.status === status) && (!s || [g.code, g.recipient_name, g.recipient_email, g.buyer_name, g.buyer_phone].some((x) => (x || '').toLowerCase().includes(s))))
  }, [rows, q, status])

  const act = async (g, path, ok) => {
    setBusy((b) => ({ ...b, [g.id]: true }))
    try {
      await api.post(`/admin/gift-cards/${g.id}/${path}`)
      toast.success(ok)
      await load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'ما تم')
    } finally {
      setBusy((b) => ({ ...b, [g.id]: false }))
    }
  }

  const copy = (code) => {
    navigator.clipboard?.writeText(code).then(() => toast.success('انسخ الكود')).catch(() => undefined)
  }

  return (
    <div className="page-inner gc" style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      <style>{CSS}</style>
      <div className="gc-head">
        <div>
          <h1 className="page-title-main" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>بطاقات الهدايا</h1>
          <p className="gc-sub">العميل يشتريها من الموقع، أو تصدرها أنت. المستلم يستخدم الكود في الدفع مثل كود الخصم.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIssuing(true)}><RiAddLine /> إصدار بطاقة</button>
      </div>

      <div className="gc-stats">
        <div><span>المبيعات</span><b>{omr(totals.sold)}</b></div>
        <div><span>رصيد لم يُستخدم</span><b>{omr(totals.outstanding)}</b></div>
        <div><span>تنتظر الدفع</span><b>{totals.pending || 0}</b></div>
      </div>

      <div className="card gc-bar">
        <label className="gc-search"><RiSearchLine /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالكود أو الاسم أو الإيميل…" /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">فعّالة</option>
          <option value="pending">تنتظر الدفع</option>
          <option value="cancelled">ملغية</option>
        </select>
      </div>

      {loading ? (
        <div className="gc-empty"><RiLoader4Line className="spin" size={26} /></div>
      ) : !shown.length ? (
        <div className="gc-empty"><RiGiftLine size={34} /><p>ما في بطاقات{q || status ? ' مطابقة' : ' للحين'}.</p></div>
      ) : (
        <div className="card gc-table">
          <table>
            <thead>
              <tr><th>الكود</th><th>المستلم</th><th>من</th><th>القيمة</th><th>الرصيد</th><th>الحالة</th><th>التاريخ</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((g) => {
                const st = STATUS[g.status] || STATUS.pending
                const used = Number(g.amount) - Number(g.balance)
                return (
                  <tr key={g.id} onClick={() => setOpen(open === g.id ? null : g.id)} className={open === g.id ? 'on' : ''}>
                    <td><button className="gc-code" onClick={(e) => { e.stopPropagation(); copy(g.code) }} title="نسخ">{g.code} <RiFileCopyLine /></button></td>
                    <td><b>{g.recipient_name || '—'}</b><small>{g.recipient_email || g.recipient_phone || ''}</small></td>
                    <td>{g.buyer_name || '—'}<small dir="ltr">{g.buyer_phone || ''}</small></td>
                    <td className="num">{omr(g.amount)}</td>
                    <td className="num">{omr(g.balance)}{used > 0.0005 ? <small>استُخدم {omr(used)}</small> : null}</td>
                    <td><span className="gc-pill" style={{ color: st.color, background: st.bg }}>{st.label}</span>{g.status === 'active' ? <small>{g.sent_at ? 'انرسلت بالإيميل' : 'ما انرسلت'}</small> : null}</td>
                    <td>{day(g.created_at)}{g.expires_at ? <small>تنتهي {day(g.expires_at)}</small> : null}</td>
                    <td className="gc-actions" onClick={(e) => e.stopPropagation()}>
                      {g.status === 'pending' && (
                        <button className="btn btn-sm btn-primary" disabled={busy[g.id]} onClick={() => window.confirm('تأكدت إن البطاقة مدفوعة؟ بتتفعّل وتنرسل للمستلم.') && act(g, 'activate', 'تفعّلت وانرسلت')}><RiCheckLine /> مدفوعة</button>
                      )}
                      {g.status === 'active' && (g.recipient_email || g.buyer_email) && (
                        <button className="btn btn-sm btn-ghost" disabled={busy[g.id]} onClick={() => act(g, 'resend', 'انرسلت مرة ثانية')}><RiMailSendLine /> إرسال</button>
                      )}
                      {g.status !== 'cancelled' && (
                        <button className="btn btn-sm btn-ghost gc-danger" disabled={busy[g.id]} onClick={() => window.confirm(`تلغي البطاقة ${g.code}؟ الرصيد الباقي ما يقدر يُستخدم.`) && act(g, 'cancel', 'انلغت')}><RiCloseLine /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {open && (() => {
            const g = rows.find((x) => x.id === open)
            if (!g) return null
            return (
              <div className="gc-detail">
                {g.message ? <p className="gc-msg">«{g.message}»</p> : null}
                <div className="gc-uses">
                  <b>الاستخدام</b>
                  {(g.uses || []).length ? (g.uses || []).map((u) => (
                    <div key={u.id}><span>طلب #{u.order_id || '—'}</span><span>{day(u.created_at)}</span><span className="num">− {omr(u.amount)}</span></div>
                  )) : <span className="muted">ما انستخدمت للحين</span>}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {issuing && <IssueForm onClose={() => setIssuing(false)} onDone={() => { setIssuing(false); load() }} />}
    </div>
  )
}

function IssueForm({ onClose, onDone }) {
  const [f, setF] = useState({ amount: '', recipient_name: '', recipient_email: '', recipient_phone: '', message: '', from_name: 'GH Shopper', send: true })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    if (!(Number(f.amount) > 0)) return toast.error('اكتب القيمة')
    setSaving(true)
    try {
      const r = await api.post('/admin/gift-cards', { ...f, amount: Number(f.amount), recipient_email: f.recipient_email || null })
      const code = r.data?.data?.code
      toast.success(code ? `تم إصدار ${code}` : 'تم الإصدار')
      if (code) navigator.clipboard?.writeText(code).catch(() => undefined)
      onDone()
    } catch (x) {
      toast.error(x.response?.data?.message || 'ما تم الإصدار')
      setSaving(false)
    }
  }
  return (
    <div className="gc-modal" onClick={onClose}>
      <form className="card gc-form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h3>إصدار بطاقة هدية</h3>
        <p className="gc-sub">هدية لعميل، تعويض، أو بطاقة مدفوعة كاش. تتفعّل على طول.</p>
        <div className="gc-amounts">
          {[10, 25, 50, 100, 200].map((a) => (
            <button type="button" key={a} className={Number(f.amount) === a ? 'on' : ''} onClick={() => setF((x) => ({ ...x, amount: String(a) }))}>{a}</button>
          ))}
          <input type="number" min="1" step="0.001" placeholder="مبلغ آخر" value={f.amount} onChange={set('amount')} />
        </div>
        <label>اسم المستلم<input required value={f.recipient_name} onChange={set('recipient_name')} /></label>
        <div className="gc-two">
          <label>إيميل المستلم<input type="email" dir="ltr" value={f.recipient_email} onChange={set('recipient_email')} placeholder="اختياري" /></label>
          <label>جواله<input dir="ltr" value={f.recipient_phone} onChange={set('recipient_phone')} placeholder="اختياري" /></label>
        </div>
        <label>من<input value={f.from_name} onChange={set('from_name')} /></label>
        <label>رسالة<textarea rows={3} value={f.message} onChange={set('message')} placeholder="تطلع في الإيميل" /></label>
        <label className="gc-check"><input type="checkbox" checked={f.send} onChange={set('send')} /> أرسلها للمستلم بالإيميل</label>
        <div className="gc-form-actions">
          <button className="btn btn-primary" disabled={saving}>{saving ? <RiLoader4Line className="spin" /> : <RiGiftLine />} إصدار</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </div>
  )
}

const CSS = `
.gc .btn{display:inline-flex;align-items:center;gap:6px}
.gc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.gc-sub{color:var(--text-secondary);font-size:14px;margin:6px 0 0}
.gc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.gc-stats div{background:var(--bg-card,#fff);border:1px solid var(--border);border-radius:14px;padding:16px 18px}
.gc-stats span{display:block;font-size:12.5px;color:var(--text-secondary)}
.gc-stats b{display:block;font-size:22px;margin-top:6px;direction:ltr;text-align:right}
.gc-bar{display:flex;gap:10px;padding:12px 14px;margin-bottom:14px;flex-wrap:wrap}
.gc-search{flex:1;min-width:220px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:10px;padding:0 12px;color:var(--text-secondary)}
.gc-search input{border:none;outline:none;flex:1;padding:9px 0;font:inherit;background:transparent;color:var(--text-primary)}
.gc select,.gc-form input,.gc-form textarea{border:1px solid var(--border);border-radius:10px;padding:9px 12px;font:inherit;font-size:14px;background:var(--bg-card,#fff);color:var(--text-primary)}
.gc-empty{padding:60px 20px;text-align:center;color:var(--text-secondary)}
.gc-table{overflow-x:auto;padding:0}
.gc-table table{width:100%;border-collapse:collapse;font-size:13.5px}
.gc-table th{text-align:start;font-weight:600;font-size:12px;color:var(--text-secondary);padding:12px 14px;border-bottom:1px solid var(--border);white-space:nowrap}
.gc-table td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:top}
.gc-table tr{cursor:pointer}
.gc-table tr.on td{background:rgba(201,162,92,.06)}
.gc-table small{display:block;font-size:11.5px;color:var(--text-secondary);margin-top:3px}
.gc-table .num{direction:ltr;text-align:right;white-space:nowrap}
.gc-code{display:inline-flex;align-items:center;gap:6px;border:1px dashed var(--border);background:transparent;border-radius:8px;padding:5px 9px;font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.5px;cursor:pointer;color:var(--text-primary);direction:ltr}
.gc-pill{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.gc-actions{white-space:nowrap;text-align:end}
.gc-actions .btn{margin-inline-start:4px}
.gc-danger{color:#B42318 !important}
.gc-detail{padding:14px 18px;border-top:1px solid var(--border);display:flex;gap:30px;flex-wrap:wrap;background:rgba(201,162,92,.04)}
.gc-msg{margin:0;font-size:14px;max-width:420px;line-height:1.8}
.gc-uses{display:flex;flex-direction:column;gap:6px;font-size:13px;min-width:260px}
.gc-uses div{display:flex;gap:16px;justify-content:space-between}
.gc-modal{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
.gc-form{width:100%;max-width:520px;padding:24px;display:flex;flex-direction:column;gap:12px;max-height:90vh;overflow:auto}
.gc-form h3{margin:0;font-size:20px}
.gc-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--text-secondary)}
.gc-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gc-amounts{display:flex;gap:8px;flex-wrap:wrap}
.gc-amounts button{border:1px solid var(--border);background:transparent;border-radius:10px;padding:8px 14px;font:inherit;font-weight:700;cursor:pointer;color:var(--text-primary)}
.gc-amounts button.on{background:var(--color-primary);color:#fff;border-color:var(--color-primary)}
.gc-amounts input{width:120px}
.gc-check{flex-direction:row !important;align-items:center;gap:8px !important}
.gc-form-actions{display:flex;gap:8px;margin-top:6px}
.gc .spin{animation:gcspin 1s linear infinite}
@keyframes gcspin{to{transform:rotate(360deg)}}
@media (max-width:700px){.gc-stats{grid-template-columns:1fr}.gc-two{grid-template-columns:1fr}}
`
