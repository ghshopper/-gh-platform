import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiFlashlightLine, RiEditLine, RiDeleteBinLine, RiCloseLine, RiLoader4Line, RiSearchLine } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'

// Points boosts: ×2, ×3… points on a brand, a category or hand-picked pieces,
// for every customer whatever their tier, between two dates. A customer whose
// tier already gives more keeps the tier's rate.
const STATE = {
  live: ['شغّال الحين', '#047857', '#ECFDF5'],
  waiting: ['ينتظر موعده', '#B45309', '#FFFBEB'],
  ended: ['انتهى', '#6E6A66', '#F3F1EE'],
  off: ['موقّف', '#6E6A66', '#F3F1EE'],
}
const fmt = (s) => (s ? new Date(s).toLocaleString('ar-OM', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const AR_NUM = ['', '', 'ضعف', '٣ أضعاف', '٤ أضعاف', '٥ أضعاف']
const times = (m) => AR_NUM[m] || `×${m}`

function catOptions(cats) {
  const kids = (id) => cats.filter((c) => Number(c.parent_id) === Number(id))
  const out = []
  const walk = (c, depth) => {
    out.push(<option key={c.id} value={c.id}>{'  '.repeat(depth) + (depth ? '— ' : '') + c.name_ar}</option>)
    if (depth < 3) kids(c.id).forEach((k) => walk(k, depth + 1))
  }
  cats.filter((c) => !c.parent_id).forEach((c) => walk(c, 0))
  return out
}
const blank = { title: '', multiplier: 3, target: 'brand', brand_id: '', category_id: '', products: [], starts_at: '', ends_at: '', is_active: true, notify: true, push_title: '', push_body: '' }

export default function PointsBoosts() {
  const [rows, setRows] = useState(null)
  const [brands, setBrands] = useState([])
  const [cats, setCats] = useState([])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState([])

  const load = () => api.get('/admin/points-boosts').then((r) => setRows(r.data.data || [])).catch(() => { setRows([]); toast.error('تعذر التحميل') })
  useEffect(() => {
    load()
    api.get('/admin/brands', { params: { per_page: 500 } }).then((r) => setBrands(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => {})
    api.get('/admin/categories').then((r) => setCats(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => {})
  }, [])
  useEffect(() => {
    if (!form || form.target !== 'products' || q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => {
      api.get('/admin/products', { params: { search: q, per_page: 12 } }).then((r) => setFound(r.data?.data || [])).catch(() => setFound([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q, form?.target]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setForm((f) => {
    const n = { ...f, ...patch }
    // the notification text follows the boost until it's edited by hand
    if (!f.pushEdited) {
      const what = n.target === 'brand' ? (brands.find((b) => String(b.id) === String(n.brand_id))?.name_en || '')
        : n.target === 'category' ? (cats.find((c) => String(c.id) === String(n.category_id))?.name_ar || '')
          : n.title
      n.push_title = `اكسبوا ${times(Number(n.multiplier))} النقاط ⚡`
      n.push_body = what ? `تسوّقوا من ${what} واكسبوا ${times(Number(n.multiplier))} النقاط مع كل عملية شراء.` : ''
    }
    return n
  })

  const open = (b) => {
    if (!b) { setForm({ ...blank }); setQ(''); setTimeout(() => set({}), 0); return }
    setForm({
      id: b.id, title: b.title, multiplier: b.multiplier,
      target: b.product_ids?.length ? 'products' : b.category_id && !b.brand_id ? 'category' : 'brand',
      brand_id: b.brand_id || '', category_id: b.category_id || '', products: b.products || [],
      starts_at: b.starts_local || '', ends_at: b.ends_local || '', is_active: b.is_active, notify: false, pushEdited: true, push_title: '', push_body: '',
    })
    setQ('')
  }

  const save = async (e) => {
    e.preventDefault()
    const f = form
    if (f.target === 'brand' && !f.brand_id) return toast.error('اختر البراند')
    if (f.target === 'category' && !f.category_id) return toast.error('اختر القسم')
    if (f.target === 'products' && !f.products.length) return toast.error('اختر منتج واحد على الأقل')
    if (f.notify && (!f.push_title.trim() || !f.push_body.trim())) return toast.error('اكتب عنوان ونص الإشعار')
    setSaving(true)
    const body = {
      title: f.title, multiplier: Number(f.multiplier),
      brand_id: f.target === 'brand' ? Number(f.brand_id) : null,
      category_id: f.target === 'category' ? Number(f.category_id) : null,
      product_ids: f.target === 'products' ? f.products.map((p) => p.id) : [],
      starts_at: f.starts_at || null, ends_at: f.ends_at || null, is_active: f.is_active, notified: f.notify,
    }
    try {
      const r = f.id ? await api.put(`/admin/points-boosts/${f.id}`, body) : await api.post('/admin/points-boosts', body)
      if (f.notify) {
        const link = f.target === 'brand' ? { link_type: 'brand', link_value: String(f.brand_id) }
          : f.target === 'category' ? { link_type: 'category', link_value: String(f.category_id) }
            : f.products.length === 1 ? { link_type: 'product', link_value: String(f.products[0].id) } : { link_type: 'url', link_value: 'https://ghshopper.com/shop?points_boost=1' }
        try {
          await api.post('/admin/notifications/broadcast', { title_ar: f.push_title, body_ar: f.push_body, audience: 'all', ...link })
          toast.success('انحفظ وانرسل الإشعار لكل العملاء')
        } catch {
          toast.error('انحفظ، بس الإشعار ما انرسل. أرسله من «إرسال إشعارات»')
        }
      } else {
        toast.success(`انحفظ · ${r.data.pieces} قطعة`)
      }
      setForm(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'ما انحفظ')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (b) => {
    if (!window.confirm('تحذف «' + b.title + '»؟ الطلبات اللي انطلبت خلاله تحتفظ بنقاطها.')) return
    await api.delete(`/admin/points-boosts/${b.id}`).then(() => { toast.success('انحذف'); load() }).catch(() => toast.error('ما انحذف'))
  }
  const toggle = async (b) => {
    await api.put(`/admin/points-boosts/${b.id}`, { title: b.title, multiplier: b.multiplier, brand_id: b.brand_id, category_id: b.category_id, product_ids: b.product_ids, starts_at: b.starts_local, ends_at: b.ends_local, is_active: !b.is_active })
      .then(() => { toast.success(b.is_active ? 'وقّفناه' : 'رجع يشتغل'); load() }).catch((e) => toast.error(e.response?.data?.message || 'تعذر'))
  }

  return (
    <div className="page pb" dir="rtl">
      <div className="pb-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>النقاط المضاعفة</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>ضعف أو ٣ أضعاف النقاط على براند أو قسم أو قطع تختارها، لكل العملاء أيّاً كانت عضويتهم، بين تاريخين.</p>
        </div>
        <button className="btn btn-primary" onClick={() => open(null)}><RiAddLine /> نقاط مضاعفة جديدة</button>
      </div>

      {rows === null ? <div className="gh-skel" style={{ height: 240 }} /> : rows.length === 0 ? (
        <div className="card"><Empty icon={RiFlashlightLine} title="ما فيه نقاط مضاعفة للحين" hint="مثلاً: ٣ أضعاف النقاط على عطور Dior هالأسبوع، أو ضعف النقاط على الشنط في الويكند." action="أضف أول واحدة" onAction={() => open(null)} /></div>
      ) : (
        <div className="pb-list">
          {rows.map((b) => {
            const st = STATE[b.state] || STATE.waiting
            return (
              <div key={b.id} className="card pb-card">
                <div className="pb-x">×{b.multiplier}</div>
                <div className="pb-main">
                  <div className="pb-title"><b>{b.title}</b><span className="badge" style={{ color: st[1], background: st[2] }}>{st[0]}</span>{b.notified_at && <span className="pb-sent">انرسل إشعار</span>}</div>
                  <div className="pb-sub">{[b.brand, b.category, b.products?.length ? b.products.slice(0, 3).map((p) => p.name).join('، ') + (b.products.length > 3 ? ` +${b.products.length - 3}` : '') : null].filter(Boolean).join(' · ')} · {b.pieces} قطعة</div>
                  <div className="pb-sub">{b.starts_at ? `من ${fmt(b.starts_local)}` : 'من الحين'}{b.ends_at ? ` إلى ${fmt(b.ends_local)}` : ' · بدون نهاية'}</div>
                  {b.orders > 0 && <div className="pb-sub pb-res">{b.orders} طلب · مبيعات قطعه {money(b.sales)} ر.ع</div>}
                </div>
                <div className="pb-actions">
                  {b.state !== 'ended' && <button className="btn btn-ghost btn-sm" onClick={() => toggle(b)}>{b.is_active ? 'وقّف' : 'شغّل'}</button>}
                  <button className="icon-btn" title="تعديل" onClick={() => open(b)}><RiEditLine size={18} /></button>
                  <button className="icon-btn" title="حذف" style={{ color: '#B42318' }} onClick={() => remove(b)}><RiDeleteBinLine size={18} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <div className="modal-backdrop" onMouseDown={() => setForm(null)}>
          <form className="modal-content" style={{ maxWidth: 560, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
            <div className="modal-header">
              <h3 className="modal-title">{form.id ? 'تعديل النقاط المضاعفة' : 'نقاط مضاعفة جديدة'}</h3>
              <button type="button" className="close-btn" onClick={() => setForm(null)}><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body pb-form">
              <label>الاسم (لك بس)<input className="input" required value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثلاً: عطور Dior ×3" /></label>
              <label>كم ضعف؟
                <div className="gh-seg" style={{ width: '100%' }}>
                  {[2, 3, 4, 5].map((m) => <button type="button" key={m} className={Number(form.multiplier) === m ? 'on' : ''} style={{ flex: 1 }} onClick={() => set({ multiplier: m })}>×{m}</button>)}
                </div>
              </label>
              <label>على ويش؟
                <div className="gh-seg" style={{ width: '100%' }}>
                  {[['brand', 'براند'], ['category', 'قسم'], ['products', 'قطع أختارها']].map(([k, l]) => <button type="button" key={k} className={form.target === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => set({ target: k })}>{l}</button>)}
                </div>
              </label>
              {form.target === 'brand' && (
                <label>البراند
                  <select className="input" value={form.brand_id} onChange={(e) => set({ brand_id: e.target.value })}>
                    <option value="">اختر…</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name_en || b.name_ar}</option>)}
                  </select>
                </label>
              )}
              {form.target === 'category' && (
                <label>القسم (يشمل اللي تحته)
                  <select className="input" value={form.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                    <option value="">اختر…</option>
                    {catOptions(cats)}
                  </select>
                </label>
              )}
              {form.target === 'products' && (
                <div className="pb-pick">
                  <div className="pb-search"><RiSearchLine /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر باسم المنتج، مثلاً Sauvage" /></div>
                  {found.length > 0 && (
                    <div className="pb-found">
                      {found.filter((p) => !form.products.some((x) => x.id === p.id)).map((p) => (
                        <button type="button" key={p.id} onClick={() => set({ products: [...form.products, { id: p.id, name: p.name_ar || p.name_en }] })}>
                          {p.primary_image ? <img src={p.primary_image} alt="" /> : <i />}<span>{p.name_ar || p.name_en}</span><RiAddLine />
                        </button>
                      ))}
                    </div>
                  )}
                  {form.products.length > 0 && (
                    <div className="pb-chips">{form.products.map((p) => <span key={p.id}>{p.name}<button type="button" onClick={() => set({ products: form.products.filter((x) => x.id !== p.id) })}><RiCloseLine /></button></span>)}</div>
                  )}
                </div>
              )}
              <div className="pb-row">
                <label>يبدأ<input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => set({ starts_at: e.target.value })} /><small>فاضي = الحين</small></label>
                <label>ينتهي<input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => set({ ends_at: e.target.value })} /><small>فاضي = لين توقفه</small></label>
              </div>

              <label className="pb-check"><input type="checkbox" checked={form.notify} onChange={(e) => set({ notify: e.target.checked })} /> أرسل إشعار لكل العملاء</label>
              {form.notify && (
                <div className="pb-push">
                  <input className="input" value={form.push_title} onChange={(e) => setForm({ ...form, push_title: e.target.value, pushEdited: true })} placeholder="العنوان" />
                  <textarea className="input" rows={2} value={form.push_body} onChange={(e) => setForm({ ...form, push_body: e.target.value, pushEdited: true })} placeholder="النص" />
                  <small>لما العميل يضغط على الإشعار يفتح {form.target === 'brand' ? 'صفحة البراند' : form.target === 'category' ? 'القسم' : form.products.length === 1 ? 'المنتج' : 'القطع اللي عليها النقاط المضاعفة'}.</small>
                </div>
              )}
              <p className="pb-note">كل العملاء ياخذون ×{form.multiplier} على هالقطع. اللي عضويته تعطيه أكثر يبقى على عضويته، وما تنجمع نقاط مضاعفة فوق بعض. النقاط تنضاف للعميل لما ينسلّم طلبه زي العادة.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setForm(null)}>إلغاء</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? <RiLoader4Line className="spin" /> : null} {form.notify ? 'حفظ وإرسال الإشعار' : 'حفظ'}</button>
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
.pb-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.pb-list{display:flex;flex-direction:column;gap:10px}
.pb-card{display:flex;align-items:center;gap:16px;padding:14px 18px;margin:0}
.pb-x{width:64px;height:64px;border-radius:14px;background:#5C0B16;color:#F2E3C8;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;flex-shrink:0;direction:ltr}
.pb-main{flex:1;min-width:0}
.pb-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pb-title b{font-size:15px}
.pb-sent{font-size:11.5px;color:var(--text-light)}
.pb-sub{font-size:12.5px;color:var(--text-secondary);margin-top:3px}
.pb-res{color:#047857}
.pb-actions{display:flex;gap:6px;align-items:center}
.pb-form{display:flex;flex-direction:column;gap:14px}
.pb-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;flex:1;min-width:0}
.pb-form small{font-weight:400;color:var(--text-light);font-size:11px}
.pb-form .input{height:42px;padding:0 12px}
.pb-form textarea.input{height:auto;padding:8px 12px}
.pb-row{display:flex;gap:12px}
.pb-check{flex-direction:row!important;align-items:center;gap:8px!important;cursor:pointer}
.pb-push{display:flex;flex-direction:column;gap:8px;background:var(--bg-body);border-radius:10px;padding:10px 12px}
.pb-pick{display:flex;flex-direction:column;gap:8px}
.pb-search{position:relative;display:flex;align-items:center}
.pb-search svg{position:absolute;inset-inline-start:12px;color:var(--text-light)}
.pb-search .input{padding-inline-start:34px!important;width:100%}
.pb-found{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:10px;max-height:220px;overflow:auto}
.pb-found button{display:flex;align-items:center;gap:10px;padding:6px 10px;border:0;border-bottom:1px solid var(--border);background:#fff;cursor:pointer;text-align:start;font-family:inherit;font-size:13px}
.pb-found button:hover{background:var(--bg-body)}
.pb-found img,.pb-found i{width:34px;height:34px;border-radius:6px;object-fit:cover;background:#F4F3F1;flex-shrink:0}
.pb-found span{flex:1}
.pb-chips{display:flex;flex-wrap:wrap;gap:6px}
.pb-chips span{display:flex;align-items:center;gap:4px;background:#F7EEEF;color:#5C0B16;border-radius:99px;padding:4px 6px 4px 10px;font-size:12.5px;font-weight:500}
.pb-chips button{border:0;background:none;color:inherit;cursor:pointer;display:flex;padding:0}
.pb-note{font-size:12px;color:var(--text-secondary);background:var(--bg-body);border-radius:10px;padding:10px 12px;margin:0}
@media(max-width:768px){.pb-card{flex-wrap:wrap}.pb-actions{width:100%;justify-content:flex-end}.pb-row{flex-direction:column}}
`
