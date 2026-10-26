import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiCheckLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiLoader4Line, RiPriceTag3Line, RiSearchLine } from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import Empty from '../../components/Empty'

const omr = (v) => Number(v || 0).toFixed(3)

function Tag({ text, big }) {
  return <span className={`bd-tag ${big ? 'big' : ''}`}>{text}</span>
}

// «الشارات»: the product labels («حصرياً بسعر البوتيك»…), and which products carry each one.
export default function Badges() {
  const [badges, setBadges] = useState(null)
  const [cur, setCur] = useState(null) // the badge open on the left
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(null) // { from?, ar, en }
  const timer = useRef(null)

  const loadBadges = async (keep) => {
    try {
      const r = await api.get('/admin/badges')
      setBadges(r.data.badges)
      const next = r.data.badges.find((b) => b.ar === (keep ?? cur?.ar)) || r.data.badges[0] || null
      setCur(next)
    } catch { toast.error('تعذر التحميل') }
  }
  useEffect(() => { loadBadges() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadItems = async (b) => {
    if (!b) { setItems([]); return }
    setLoadingItems(true)
    try {
      const r = await api.get('/admin/products', { params: { badge: b.ar, per_page: 500 } })
      setItems(r.data.data || [])
    } catch { toast.error('تعذر تحميل المنتجات') } finally { setLoadingItems(false) }
  }
  useEffect(() => { loadItems(cur); setPicked([]) }, [cur?.ar]) // eslint-disable-line react-hooks/exhaustive-deps

  // search the shop to add products
  useEffect(() => {
    clearTimeout(timer.current)
    const s = q.trim()
    if (s.length < 2) { setFound([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      try { const r = await api.get('/admin/products', { params: { search: s, status: 'active', per_page: 60 } }); setFound(r.data.data || []) } catch { /* ignore */ } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [q])

  const assign = async (ids) => {
    if (!ids.length || !cur) return
    setBusy(true)
    try {
      await api.post('/admin/products/bulk-update', { ids, badge: cur.ar, badge_en: cur.en || '' })
      toast.success(`انحطت الشارة على ${ids.length} منتج`)
      setPicked([]); setFound((f) => f.map((p) => (ids.includes(p.id) ? { ...p, badge: cur.ar } : p)))
      await Promise.all([loadItems(cur), loadBadges(cur.ar)])
    } catch { toast.error('ما انحفظت') } finally { setBusy(false) }
  }
  const unassign = async (ids) => {
    setBusy(true)
    try {
      await api.post('/admin/products/bulk-update', { ids, badge: '', badge_en: '' })
      setItems((a) => a.filter((p) => !ids.includes(p.id)))
      setFound((f) => f.map((p) => (ids.includes(p.id) ? { ...p, badge: null } : p)))
      loadBadges(cur.ar)
    } catch { toast.error('ما انشالت') } finally { setBusy(false) }
  }

  const saveBadge = async (e) => {
    e.preventDefault()
    if (!edit.ar.trim()) return toast.error('اكتب الشارة')
    setBusy(true)
    try {
      const r = edit.from ? await api.put('/admin/badges', edit) : await api.post('/admin/badges', edit)
      setBadges(r.data.badges)
      setCur(r.data.badges.find((b) => b.ar === edit.ar.trim()) || cur)
      setEdit(null); toast.success('انحفظت')
    } catch (er) {
      const d = er.response?.data; toast.error(d?.errors ? Object.values(d.errors)[0][0] : 'ما انحفظت')
    } finally { setBusy(false) }
  }
  const removeBadge = async (b) => {
    if (!window.confirm(`تحذف شارة «${b.ar}»؟${b.count ? ` بتنشال من ${b.count} منتج.` : ''}`)) return
    try { const r = await api.post('/admin/badges/delete', { ar: b.ar }); setBadges(r.data.badges); setCur(r.data.badges[0] || null); toast.success('انحذفت') } catch { toast.error('ما انحذفت') }
  }

  if (!badges) return <div className="page"><div className="gh-skel" style={{ height: 300 }} /></div>
  const onIds = new Set(items.map((p) => p.id))

  return (
    <div className="page" dir="rtl">
      <div className="bd-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>الشارات</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>الشريط الأسود اللي يطلع على صورة المنتج في التطبيق والموقع. اختر شارة وحط عليها المنتجات.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit({ ar: '', en: '' })}><RiAddLine /> شارة جديدة</button>
      </div>

      <div className="bd-grid">
        <aside className="card bd-list">
          {badges.length === 0 ? <Empty compact icon={RiPriceTag3Line} title="ما فيه شارات" /> : badges.map((b) => (
            <button key={b.ar} className={`bd-row ${cur?.ar === b.ar ? 'on' : ''}`} onClick={() => setCur(b)}>
              <Tag text={b.ar} />
              <span className="bd-count">{b.count ? `${b.count} منتج` : 'ما عليها منتجات'}</span>
            </button>
          ))}
        </aside>

        {cur && (
          <section className="bd-main">
            <div className="card bd-cur">
              <div className="bd-cur-top">
                <div>
                  <Tag text={cur.ar} big />
                  {cur.en ? <div className="bd-en" dir="ltr">{cur.en}</div> : <div className="bd-en">بدون إنجليزي (تطلع بالعربي في الإنجليزي)</div>}
                </div>
                <div className="bd-cur-btns">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ from: cur.ar, ar: cur.ar, en: cur.en || '' })}><RiEditLine /> تعديل</button>
                  <button className="btn btn-ghost btn-sm bd-red" onClick={() => removeBadge(cur)}><RiDeleteBinLine /> حذف</button>
                </div>
              </div>

              <div className="bd-search">
                <RiSearchLine />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر على منتج أو ماركة عشان تضيفه" />
                {searching && <RiLoader4Line className="spin" />}
              </div>
              {found.length > 0 && (
                <div className="bd-found">
                  <div className="bd-found-bar">
                    <span>{found.length} نتيجة</span>
                    <button className="bd-link" onClick={() => setPicked(found.filter((p) => !onIds.has(p.id)).map((p) => p.id))}>اختر الكل</button>
                    {picked.length > 0 && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => assign(picked)}>{busy ? <RiLoader4Line className="spin" /> : <RiCheckLine />} حط الشارة على {picked.length}</button>}
                    <button className="bd-link" onClick={() => { setQ(''); setPicked([]) }}>إغلاق</button>
                  </div>
                  {found.map((p) => {
                    const on = onIds.has(p.id)
                    const sel = picked.includes(p.id)
                    return (
                      <label key={p.id} className={`bd-item ${on ? 'done' : ''}`}>
                        <input type="checkbox" disabled={on} checked={on || sel} onChange={() => setPicked((a) => (sel ? a.filter((x) => x !== p.id) : [...a, p.id]))} />
                        <img src={getImageUrl(p.primary_image)} alt="" />
                        <span className="bd-item-txt"><b>{p.name_ar}</b><small>{p.brand_name_en || p.brand_name_ar || ''} · {omr(p.price)} ر.ع</small></span>
                        {on ? <span className="bd-has">عليها</span> : p.badge ? <span className="bd-other" title="بتتبدل">{p.badge}</span> : null}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card bd-on">
              <h3>المنتجات اللي عليها الشارة <small>{items.length || ''}</small></h3>
              {loadingItems ? <div className="gh-skel" style={{ height: 120 }} /> : items.length === 0 ? (
                <Empty compact icon={RiPriceTag3Line} title="ما فيه منتجات للحين" hint="دوّر فوق على المنتج واختاره." />
              ) : (
                <div className="bd-cards">
                  {items.map((p) => (
                    <div key={p.id} className="bd-card">
                      <div className="bd-img">
                        <img src={getImageUrl(p.primary_image)} alt="" />
                        <Tag text={cur.ar} />
                        <button className="bd-x" disabled={busy} onClick={() => unassign([p.id])} aria-label="شيل الشارة"><RiCloseLine /></button>
                      </div>
                      <b>{p.name_ar}</b>
                      <small>{p.brand_name_en || p.brand_name_ar || ''}</small>
                    </div>
                  ))}
                </div>
              )}
              {items.length > 1 && <button className="bd-link bd-red" style={{ marginTop: 12 }} onClick={() => window.confirm('تشيل الشارة من كل المنتجات؟') && unassign(items.map((p) => p.id))}>شيلها من الكل</button>}
            </div>
          </section>
        )}
      </div>

      {edit && (
        <div className="modal-backdrop" onMouseDown={() => !busy && setEdit(null)}>
          <form className="modal-content" style={{ maxWidth: 440, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={saveBadge}>
            <div className="modal-header">
              <h3 className="modal-title">{edit.from ? 'تعديل الشارة' : 'شارة جديدة'}</h3>
              <button type="button" className="close-btn" onClick={() => setEdit(null)} aria-label="إغلاق"><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body bd-form">
              <label>الشارة بالعربي<input value={edit.ar} maxLength={40} onChange={(e) => setEdit({ ...edit, ar: e.target.value })} placeholder="مثلاً: حصرياً بسعر البوتيك" autoFocus /></label>
              <label>بالإنجليزي (اختياري)<input value={edit.en} maxLength={40} dir="ltr" onChange={(e) => setEdit({ ...edit, en: e.target.value })} placeholder="Boutique price, exclusively" /></label>
              {edit.ar.trim() && <div className="bd-preview"><span>كذا بتطلع:</span><Tag text={edit.ar.trim()} big /></div>}
              {edit.from && <small style={{ color: 'var(--text-secondary)' }}>التعديل يتغير على كل المنتجات اللي عليها الشارة.</small>}
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <RiLoader4Line className="spin" /> : null} حفظ</button>
            </div>
          </form>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.bd-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.bd-grid{display:grid;grid-template-columns:280px 1fr;gap:14px;align-items:start}
.bd-list{padding:6px;margin:0;display:flex;flex-direction:column;position:sticky;top:80px}
.bd-row{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border:0;background:none;border-radius:8px;cursor:pointer;text-align:inherit;font-family:inherit;color:inherit}
.bd-row:hover{background:var(--bg-hover,rgba(0,0,0,.03))}
.bd-row.on{background:rgba(92,11,22,.07)}
.bd-count{font-size:12px;color:var(--text-secondary)}
.bd-tag{display:inline-block;background:#1A1A1A;color:#fff;font-size:11.5px;line-height:1.2;padding:4px 9px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bd-tag.big{font-size:14px;padding:6px 12px}
.bd-main{display:flex;flex-direction:column;gap:14px;min-width:0}
.bd-cur,.bd-on{margin:0;padding:16px 18px}
.bd-cur-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
.bd-en{font-size:12.5px;color:var(--text-secondary);margin-top:6px}
.bd-cur-btns{display:flex;gap:6px}
.bd-red{color:#B42318 !important}
.bd-search{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:10px;padding:0 12px;background:var(--bg-card,#fff)}
.bd-search input{border:0;outline:0;background:none;padding:11px 0;flex:1;font-family:inherit;font-size:14px;color:inherit}
.bd-found{margin-top:10px;border:1px solid var(--border);border-radius:10px;max-height:420px;overflow:auto}
.bd-found-bar{display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-card,#fff);z-index:1;font-size:13px;color:var(--text-secondary);flex-wrap:wrap}
.bd-link{border:0;background:none;color:#5C0B16;cursor:pointer;font-family:inherit;font-size:13px;padding:0}
.bd-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer}
.bd-item:last-child{border-bottom:0}
.bd-item.done{opacity:.55;cursor:default}
.bd-item img{width:42px;height:52px;object-fit:cover;background:var(--surface,#f3f3f3);flex-shrink:0}
.bd-item-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.bd-item-txt b{font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bd-item-txt small{font-size:12px;color:var(--text-secondary)}
.bd-has{font-size:11.5px;color:#047857}
.bd-other{font-size:11px;color:#B45309;border:1px solid #FDE68A;padding:2px 6px;white-space:nowrap}
.bd-on h3{margin:0 0 12px;font-size:15px}
.bd-on h3 small{color:var(--text-secondary);font-weight:400}
.bd-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px}
.bd-card{display:flex;flex-direction:column;gap:3px;min-width:0}
.bd-card b{font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:6px}
.bd-card small{font-size:11.5px;color:var(--text-secondary)}
.bd-img{position:relative;aspect-ratio:4/5;background:var(--surface,#f3f3f3)}
.bd-img img{width:100%;height:100%;object-fit:cover;display:block}
.bd-img .bd-tag{position:absolute;bottom:0;inset-inline-start:0;font-size:10.5px}
.bd-x{position:absolute;top:6px;inset-inline-end:6px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#B42318}
.bd-form{display:flex;flex-direction:column;gap:12px}
.bd-form label{display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--text-secondary)}
.bd-form input{border:1px solid var(--border);border-radius:8px;padding:10px;font-family:inherit;font-size:14px;background:var(--bg-card,#fff);color:var(--text-primary,inherit)}
.bd-preview{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--text-secondary)}
@media (max-width:860px){.bd-grid{grid-template-columns:1fr}.bd-list{position:static;flex-direction:row;overflow-x:auto}.bd-row{flex-shrink:0}}
`
