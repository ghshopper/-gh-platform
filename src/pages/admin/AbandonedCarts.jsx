import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiNotification3Line, RiWhatsappLine, RiDeleteBinLine, RiLoader4Line, RiShoppingBag3Line, RiCheckLine } from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'

const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

function ago(iso) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `قبل ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 48) return `قبل ${h} ساعة`
  return `قبل ${Math.round(h / 24)} يوم`
}

function waPhone(p) {
  let d = String(p || '').replace(/\D/g, '')
  if (d.length === 8) d = '968' + d
  return d.length >= 10 ? d : null
}

/** Bags left without ordering, with a reminder (app + e-mail) or WhatsApp. */
export default function AbandonedCarts() {
  const [rows, setRows] = useState([])
  const [value, setValue] = useState(0)
  const [hours, setHours] = useState(2)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/abandoned-carts', { params: { hours } })
      setRows(Array.isArray(r.data.data) ? r.data.data : [])
      setValue(r.data.total_value || 0)
    } catch {
      toast.error('تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [hours]) // eslint-disable-line react-hooks/exhaustive-deps

  const remind = async (c) => {
    setBusy((b) => ({ ...b, [c.id]: true }))
    try {
      await api.post(`/admin/abandoned-carts/${c.id}/remind`)
      setRows((list) => list.map((x) => (x.id === c.id ? { ...x, reminded_at: new Date().toISOString() } : x)))
      toast.success('انرسل التذكير')
    } catch {
      toast.error('تعذر الإرسال')
    } finally {
      setBusy((b) => ({ ...b, [c.id]: false }))
    }
  }

  const whatsapp = (c) => {
    const phone = waPhone(c.phone)
    if (!phone) return toast.error('ما عنده رقم')
    const first = (c.name || '').split(' ')[0]
    const list = c.items.slice(0, 3).map((i) => `• ${i.brand ? i.brand + ' ' : ''}${i.name}`).join('\n')
    const msg = `هلا ${first} 🤍\nشفنا قطعك في السلة بانتظارك:\n${list}\n\nإذا عندك أي سؤال عن المقاس أو التوصيل احنا هنا، وتقدر تكمل طلبك من هنا: https://ghshopper.com/checkout`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    api.post(`/admin/abandoned-carts/${c.id}/whatsapp`).catch(() => {})
    setRows((list) => list.map((x) => (x.id === c.id ? { ...x, whatsapped_at: new Date().toISOString() } : x)))
  }

  const remove = async (c) => {
    if (!window.confirm('تشيل هذي السلة من القائمة؟')) return
    await api.delete(`/admin/abandoned-carts/${c.id}`).catch(() => {})
    setRows((list) => list.filter((x) => x.id !== c.id))
  }

  return (
    <div className="page-inner ab" style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <style>{CSS}</style>
      <div className="ab-head">
        <div>
          <h1 className="page-title-main" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>سلات متروكة</h1>
          <p className="ab-sub">عملاء حطوا قطع في السلة وما كمّلوا الطلب. ذكّرهم من التطبيق والإيميل أو على واتساب.</p>
        </div>
        <div className="ab-stats">
          <div><b>{rows.length}</b><span>سلة</span></div>
          <div><b>{money(value)}</b><span>ر.ع قيمتها</span></div>
          <label>
            <span>متروكة من</span>
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              <option value={1}>ساعة</option>
              <option value={2}>ساعتين</option>
              <option value={24}>يوم</option>
              <option value={72}>3 أيام</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="ab-empty"><RiLoader4Line className="spin" size={28} /></div>
      ) : !rows.length ? (
        <div className="ab-empty"><RiShoppingBag3Line size={34} /><p>ما في سلات متروكة الحين.</p></div>
      ) : (
        <div className="ab-list">
          {rows.map((c) => (
            <div key={c.id} className="ab-card">
              <div className="ab-top">
                <div>
                  <div className="ab-name">{c.name || 'عميل'}</div>
                  <div className="ab-meta">{[c.phone, c.email].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="ab-right">
                  <div className="ab-total">{money(c.total)} <small>ر.ع</small></div>
                  <div className="ab-meta">{ago(c.updated_at)} · {c.source === 'app' ? 'التطبيق' : c.source === 'web' ? 'الموقع' : ''}</div>
                </div>
              </div>
              <div className="ab-items">
                {c.items.map((i, k) => (
                  <div key={k} className="ab-item">
                    <div className="ab-img">{i.image ? <img src={getImageUrl(i.image)} alt="" /> : null}</div>
                    <div className="ab-iname">
                      {i.brand ? <b>{i.brand}</b> : null}
                      <span>{i.name}</span>
                      {(i.options || []).length ? <small>{i.options.map((o) => `${o.label}: ${o.value}`).join(' · ')}</small> : null}
                    </div>
                    <div className="ab-iprice">{i.quantity > 1 ? `${i.quantity} × ` : ''}{money(i.price)}</div>
                  </div>
                ))}
              </div>
              <div className="ab-actions">
                <button className="btn btn-primary btn-sm" disabled={busy[c.id] || !!c.reminded_at} onClick={() => remind(c)}>
                  {busy[c.id] ? <RiLoader4Line className="spin" /> : c.reminded_at ? <RiCheckLine /> : <RiNotification3Line />}
                  {c.reminded_at ? 'تم التذكير' : 'ذكّره (التطبيق والإيميل)'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => whatsapp(c)}>
                  <RiWhatsappLine /> {c.whatsapped_at ? 'واتساب مرة ثانية' : 'واتساب'}
                </button>
                <button className="btn btn-ghost btn-sm ab-del" onClick={() => remove(c)} title="شيل من القائمة"><RiDeleteBinLine /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CSS = `
.ab .btn{display:inline-flex;align-items:center;gap:6px}
.ab-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.ab-sub{color:var(--text-secondary);font-size:14px;margin:6px 0 0}
.ab-stats{display:flex;gap:18px;align-items:flex-end}
.ab-stats>div{display:flex;flex-direction:column;align-items:center}
.ab-stats b{font-size:22px;font-weight:800}
.ab-stats span{font-size:12px;color:var(--text-secondary)}
.ab-stats label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary)}
.ab-stats select{border:1px solid var(--border);border-radius:10px;padding:7px 10px;font:inherit;background:var(--bg-card,#fff);color:var(--text-primary)}
.ab-empty{padding:70px 20px;text-align:center;color:var(--text-secondary)}
.ab-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px}
.ab-card{background:var(--bg-card,#fff);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}
.ab-top{display:flex;justify-content:space-between;gap:10px}
.ab-name{font-weight:800;font-size:15px}
.ab-meta{font-size:12px;color:var(--text-secondary);direction:ltr;text-align:right}
.ab-right{text-align:left}
.ab-total{font-weight:800;font-size:17px;direction:ltr}
.ab-total small{font-size:11px;color:var(--text-secondary)}
.ab-items{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);padding-top:10px}
.ab-item{display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center}
.ab-img{width:44px;height:54px;border-radius:8px;background:var(--bg-body);overflow:hidden}
.ab-img img{width:100%;height:100%;object-fit:cover}
.ab-iname{display:flex;flex-direction:column;font-size:13px;min-width:0}
.ab-iname b{font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-secondary)}
.ab-iname span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ab-iname small{font-size:11.5px;color:var(--text-secondary)}
.ab-iprice{font-size:13px;font-weight:700;direction:ltr}
.ab-actions{display:flex;gap:8px;flex-wrap:wrap}
.ab-del{margin-inline-start:auto;color:#EF4444}
.ab .spin{animation:abspin 1s linear infinite}
@keyframes abspin{to{transform:rotate(360deg)}}
`
