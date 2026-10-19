import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiPercentLine, RiEditLine, RiDeleteBinLine, RiCloseLine, RiLoader4Line } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'

// Automatic offers: a % off a brand or a category between two dates. The
// prices change by themselves when the offer starts and go back when it ends
// (the old price shows crossed out in the app and the website). No code needed.
const STATE = {
  live: ['شغّال الحين', '#047857', '#ECFDF5'],
  waiting: ['ينتظر موعده', '#B45309', '#FFFBEB'],
  ended: ['انتهى', '#6E6A66', '#F3F1EE'],
}
const fmt = (s) => (s ? new Date(s).toLocaleString('ar-OM', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')
// every level can be picked (a section includes everything under it)
function catOptions(cats) {
  const kids = (id) => cats.filter((c) => Number(c.parent_id) === Number(id))
  const out = []
  const walk = (c, depth) => {
    out.push(<option key={c.id} value={c.id}>{'\u00a0\u00a0'.repeat(depth) + (depth ? '— ' : '') + c.name_ar}</option>)
    if (depth < 3) kids(c.id).forEach((k) => walk(k, depth + 1))
  }
  cats.filter((c) => !c.parent_id).forEach((c) => walk(c, 0))
  return out
}
const blank = { name: '', percent: 10, brand_id: '', category_id: '', starts_at: '', ends_at: '', is_active: true }

export default function Offers() {
  const [rows, setRows] = useState(null)
  const [brands, setBrands] = useState([])
  const [cats, setCats] = useState([])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/admin/offers').then((r) => setRows(r.data.data || [])).catch(() => { setRows([]); toast.error('تعذر التحميل') })
  useEffect(() => {
    load()
    api.get('/admin/brands', { params: { per_page: 500 } }).then((r) => setBrands(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => {})
    api.get('/admin/categories').then((r) => setCats(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.brand_id && !form.category_id) return toast.error('اختر براند أو تصنيف')
    setSaving(true)
    const body = { ...form, brand_id: form.brand_id || null, category_id: form.category_id || null, starts_at: form.starts_at || null, ends_at: form.ends_at || null }
    try {
      if (form.id) await api.put(`/admin/offers/${form.id}`, body)
      else await api.post('/admin/offers', body)
      toast.success('انحفظ العرض')
      setForm(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'ما انحفظ')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (o) => {
    if (!window.confirm(o.state === 'live' ? 'العرض شغّال: بنرجّع الأسعار القديمة ونحذفه. أكيد؟' : 'تحذف العرض؟')) return
    await api.delete(`/admin/offers/${o.id}`).then(() => { toast.success('انحذف'); load() }).catch(() => toast.error('ما انحذف'))
  }
  const stop = async (o) => {
    await api.put(`/admin/offers/${o.id}`, { name: o.name, percent: o.percent, brand_id: o.brand_id, category_id: o.category_id, starts_at: o.starts_local, ends_at: o.ends_local, is_active: !o.is_active })
      .then(() => { toast.success(o.is_active ? 'وقّفنا العرض ورجعت الأسعار' : 'العرض رجع'); load() }).catch((e) => toast.error(e.response?.data?.message || 'تعذر'))
  }

  return (
    <div className="page of" dir="rtl">
      <div className="of-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>العروض التلقائية</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>خصم على براند أو تصنيف بين تاريخين. الأسعار تتغير وحدها وترجع لما يخلص العرض، بدون كود.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ ...blank })}><RiAddLine /> عرض جديد</button>
      </div>

      {rows === null ? <div className="gh-skel" style={{ height: 240 }} /> : rows.length === 0 ? (
        <div className="card"><Empty icon={RiPercentLine} title="ما فيه عروض للحين" hint="مثلاً: 15% على كل Cartier من الخميس للأحد، أو 10% على الشنط طول الأسبوع." action="أضف أول عرض" onAction={() => setForm({ ...blank })} /></div>
      ) : (
        <div className="of-list">
          {rows.map((o) => {
            const st = STATE[o.state] || STATE.waiting
            return (
              <div key={o.id} className="card of-card">
                <div className="of-pct">{Number(o.percent)}%</div>
                <div className="of-main">
                  <div className="of-title"><b>{o.name}</b><span className="badge" style={{ color: st[1], background: st[2] }}>{!o.is_active && o.state !== 'ended' ? 'موقّف' : st[0]}</span></div>
                  <div className="of-sub">
                    {[o.brand_name, o.category_name].filter(Boolean).join(' · ')} · {o.products} منتج
                  </div>
                  <div className="of-sub">{o.starts_at ? `من ${fmt(o.starts_local)}` : 'يبدأ فوراً'}{o.ends_at ? ` إلى ${fmt(o.ends_local)}` : ' · بدون نهاية'}</div>
                </div>
                <div className="of-actions">
                  {o.state !== 'ended' && <button className="btn btn-ghost btn-sm" onClick={() => stop(o)}>{o.is_active ? 'وقّف' : 'شغّل'}</button>}
                  <button className="icon-btn" title="تعديل" onClick={() => setForm({ id: o.id, name: o.name, percent: Number(o.percent), brand_id: o.brand_id || '', category_id: o.category_id || '', starts_at: o.starts_local || '', ends_at: o.ends_local || '', is_active: !!o.is_active })}><RiEditLine size={18} /></button>
                  <button className="icon-btn" title="حذف" style={{ color: '#B42318' }} onClick={() => remove(o)}><RiDeleteBinLine size={18} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <div className="modal-backdrop" onMouseDown={() => setForm(null)}>
          <form className="modal-content" style={{ maxWidth: 520, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
            <div className="modal-header">
              <h3 className="modal-title">{form.id ? 'تعديل العرض' : 'عرض جديد'}</h3>
              <button type="button" className="close-btn" onClick={() => setForm(null)}><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body of-form">
              <label>اسم العرض<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: عرض اليوم الوطني" /></label>
              <label>نسبة الخصم %<input className="input" type="number" min="1" max="90" step="0.5" required value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} /></label>
              <div className="of-row">
                <label>البراند
                  <select className="input" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
                    <option value="">كل البراندات</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name_en || b.name_ar}</option>)}
                  </select>
                </label>
                <label>التصنيف
                  <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">كل التصنيفات</option>
                    {catOptions(cats)}
                  </select>
                </label>
              </div>
              <div className="of-row">
                <label>يبدأ<input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /><small>فاضي = الحين</small></label>
                <label>ينتهي<input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /><small>فاضي = لين توقفه</small></label>
              </div>
              <p className="of-note">المنتجات اللي عليها عرض ثاني شغّال ما تدخل. لما يخلص العرض يرجع كل سعر لحاله (إلا إذا غيّرت السعر بيدك أثناء العرض).</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setForm(null)}>إلغاء</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? <RiLoader4Line className="spin" /> : null} حفظ العرض</button>
              </div>
            </div>
          </form>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.of-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.of-list{display:flex;flex-direction:column;gap:10px}
.of-card{display:flex;align-items:center;gap:16px;padding:14px 18px}
.of-pct{width:64px;height:64px;border-radius:14px;background:#5C0B16;color:#F2E3C8;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0}
.of-main{flex:1;min-width:0}
.of-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.of-title b{font-size:15px}
.of-sub{font-size:12.5px;color:var(--text-secondary);margin-top:3px}
.of-actions{display:flex;gap:6px;align-items:center}
.of-form{display:flex;flex-direction:column;gap:14px}
.of-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;flex:1;min-width:0}
.of-form small{font-weight:400;color:var(--text-light);font-size:11px}
.of-form .input{height:42px;padding:0 12px}
.of-row{display:flex;gap:12px}
.of-note{font-size:12px;color:var(--text-secondary);background:var(--bg-body);border-radius:10px;padding:10px 12px;margin:0}
@media(max-width:768px){.of-card{flex-wrap:wrap}.of-actions{width:100%;justify-content:flex-end}.of-row{flex-direction:column}}
`
