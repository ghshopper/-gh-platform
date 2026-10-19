import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RiDownloadCloud2Line,
  RiExternalLinkLine,
  RiCheckLine,
  RiCloseLine,
  RiUpload2Line,
  RiLoader4Line,
  RiImageLine,
  RiBookmarkLine,
  RiErrorWarningLine,
} from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import { bookmarkletHref } from './importCollector'

// Rough rates only for the hint under the price box; the admin sets the real price.
const HINT_RATES = { EUR: 0.42, AED: 0.105, USD: 0.385, GBP: 0.49, SAR: 0.103, QAR: 0.106, CHF: 0.44, KWD: 1.25, BHD: 1.02, OMR: 1 }
const CUR_LABEL = { EUR: '€', AED: 'درهم', USD: '$', GBP: '£', SAR: 'ريال سعودي', OMR: 'ر.ع' }

const money = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

function apiBase() {
  const b = api.defaults.baseURL || '/api'
  try { return new URL(b, window.location.origin).href.replace(/\/$/, '') } catch { return b }
}

export default function ImportItems() {
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({})
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [brand, setBrand] = useState('')
  const [defaultCat, setDefaultCat] = useState('')
  const [availability, setAvailability] = useState('on_order')
  const [rows, setRows] = useState({}) // id → {price, category_id}
  const [selected, setSelected] = useState({})
  const [busy, setBusy] = useState({})
  const [bulkBusy, setBulkBusy] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const bmRef = useRef(null)
  const fileRef = useRef(null)
  const [params, setParams] = useSearchParams()

  const load = async () => {
    setLoading(true)
    try {
      const [r, c] = await Promise.all([
        api.get('/admin/import-items', { params: brand ? { brand } : {} }),
        categories.length ? Promise.resolve(null) : api.get('/admin/categories'),
      ])
      setItems(Array.isArray(r.data.data) ? r.data.data : [])
      setCounts(r.data.counts || {})
      setBrands(Array.isArray(r.data.brands) ? r.data.brands : [])
      setKey(r.data.collect_key || '')
      if (c) {
        const list = Array.isArray(c.data?.data) ? c.data.data : Array.isArray(c.data) ? c.data : []
        setCategories(list)
      }
    } catch {
      toast.error('تعذر تحميل المنتجات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [brand]) // eslint-disable-line react-hooks/exhaustive-deps

  // Arabic names come from the server's translator, a batch at a time.
  const [translating, setTranslating] = useState(false)
  const needAr = items.some((x) => !x.name_ar)
  useEffect(() => {
    if (loading || translating || !needAr) return
    let stop = false
    ;(async () => {
      setTranslating(true)
      try {
        for (let round = 0; round < 10 && !stop; round++) {
          const r = await api.post('/admin/import-items/translate')
          const got = Array.isArray(r.data.data) ? r.data.data : []
          if (got.length) {
            const byId = Object.fromEntries(got.map((g) => [g.id, g]))
            setItems((list) => list.map((x) => (byId[x.id] ? { ...x, ...byId[x.id] } : x)))
          }
          if (!r.data.left || !got.some((g) => g.name_ar)) break
        }
      } catch { /* names stay English; can be typed by hand */ }
      setTranslating(false)
    })()
    return () => { stop = true }
  }, [loading, needAr]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const added = params.get('added')
    if (added !== null) {
      const skipped = Number(params.get('skipped') || 0)
      toast.success(`تمت إضافة ${added} منتج${skipped ? ` · ${skipped} موجودة من قبل` : ''}`)
      setParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // React blocks javascript: links in JSX, so the bookmark href is set directly.
  useEffect(() => {
    if (bmRef.current && key) bmRef.current.setAttribute('href', bookmarkletHref(apiBase(), key))
  }, [key, showHelp])

  const catOf = (id) => rows[id]?.category_id || defaultCat
  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  const drop = (ids) => {
    setItems((list) => list.filter((x) => !ids.includes(x.id)))
    setSelected((s) => { const n = { ...s }; ids.forEach((i) => delete n[i]); return n })
  }

  const publish = async (it) => {
    const price = parseFloat(rows[it.id]?.price)
    if (!price || price <= 0) return toast.error('اكتب السعر بالريال العماني')
    if (!catOf(it.id)) return toast.error('اختر التصنيف')
    setBusy((b) => ({ ...b, [it.id]: true }))
    try {
      await api.post(`/admin/import-items/${it.id}/publish`, { price, category_id: Number(catOf(it.id)), availability })
      toast.success('انضاف للمتجر')
      drop([it.id])
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذرت الإضافة')
    } finally {
      setBusy((b) => ({ ...b, [it.id]: false }))
    }
  }

  const skip = async (ids) => {
    try {
      await api.post('/admin/import-items/skip', { ids })
      drop(ids)
    } catch {
      toast.error('تعذر الحذف')
    }
  }

  const saveName = async (it, name_ar) => {
    if ((it.name_ar || '') === name_ar) return
    try {
      await api.put(`/admin/import-items/${it.id}`, { name_ar })
      setItems((list) => list.map((x) => (x.id === it.id ? { ...x, name_ar } : x)))
    } catch {
      toast.error('تعذر حفظ الاسم')
    }
  }

  const ready = useMemo(
    () => items.filter((it) => parseFloat(rows[it.id]?.price) > 0 && catOf(it.id)),
    [items, rows, defaultCat], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const selectedIds = Object.keys(selected).filter((k) => selected[k]).map(Number)

  const publishReady = async () => {
    if (!ready.length) return toast.error('اكتب السعر والتصنيف أول')
    setBulkBusy(true)
    try {
      const r = await api.post('/admin/import-items/publish', {
        availability,
        items: ready.map((it) => ({ id: it.id, price: parseFloat(rows[it.id].price), category_id: Number(catOf(it.id)) })),
      })
      toast.success(`انضاف ${r.data.added} منتج للمتجر`)
      drop(Object.keys(r.data.products || {}).map(Number))
      if (r.data.failed?.length) toast.error(`${r.data.failed.length} ما انضافت، جربها وحدها`)
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذرت الإضافة')
    } finally {
      setBulkBusy(false)
    }
  }

  const uploadFile = async (f) => {
    if (!f) return
    try {
      const json = await f.text()
      const r = await api.post('/admin/import-items/upload', { json })
      toast.success(`تمت إضافة ${r.data.added} منتج${r.data.skipped ? ` · ${r.data.skipped} موجودة من قبل` : ''}`)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'الملف غير صالح')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const existingCount = items.filter((x) => x.existing).length

  return (
    <div className="page-inner imp" style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <style>{CSS}</style>

      <div className="imp-head">
        <div>
          <h1 className="page-title-main" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>منتجات للإضافة</h1>
          <p className="imp-sub">
            منتجات من مواقع البراندات بسعرها الأصلي. اكتب السعر بالريال واضغط إضافة.
            {counts.added ? <> · انضاف للمتجر {counts.added}</> : null}
          </p>
        </div>
        <div className="imp-actions">
          <button className="btn btn-ghost" onClick={() => setShowHelp((v) => !v)}>
            <RiBookmarkLine /> زر جمع المنتجات
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <RiUpload2Line /> رفع ملف
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => uploadFile(e.target.files?.[0])} />
        </div>
      </div>

      {(showHelp || (!loading && !items.length)) && (
        <div className="card imp-help">
          <div className="imp-help-body">
            <div>
              <h3>زر «GH جمع المنتجات»</h3>
              <ol>
                <li>اسحب الزر الذهبي إلى شريط المفضلة في متصفحك (مرة وحدة بس).</li>
                <li>افتح صفحة البراند اللي فيها المنتجات (قسم كامل أو منتج واحد).</li>
                <li>انزل لآخر الصفحة عشان تتحمل كل المنتجات والصور.</li>
                <li>اضغط الزر من المفضلة، وبتطلع المنتجات هنا بسعرها الأصلي.</li>
              </ol>
              <p className="imp-note">الزر خاص فيك، لا ترسله لأحد.</p>
            </div>
            <a ref={bmRef} className="imp-bm" href="#" onClick={(e) => { e.preventDefault(); toast('اسحب الزر لشريط المفضلة، لا تضغطه هنا') }} draggable>
              <RiDownloadCloud2Line /> GH جمع المنتجات
            </a>
          </div>
        </div>
      )}

      <div className="card imp-bar">
        <label>
          <span>التصنيف للكل</span>
          <select value={defaultCat} onChange={(e) => setDefaultCat(e.target.value)}>
            <option value="">اختر…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar || c.name_en}</option>)}
          </select>
        </label>
        <label>
          <span>التوفر</span>
          <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="on_order">بالطلب</option>
            <option value="instant">متوفر عندي (توصيل فوري)</option>
          </select>
        </label>
        {brands.length > 1 && (
          <label>
            <span>البراند</span>
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">الكل</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        )}
        <div className="imp-bar-end">
          {selectedIds.length > 0 && (
            <button className="btn btn-ghost" onClick={() => skip(selectedIds)}>
              <RiCloseLine /> حذف المحدد ({selectedIds.length})
            </button>
          )}
          {existingCount > 0 && (
            <button className="btn btn-ghost" onClick={() => skip(items.filter((x) => x.existing).map((x) => x.id))}>
              حذف الموجود عندي ({existingCount})
            </button>
          )}
          <button className="btn btn-primary" disabled={bulkBusy || !ready.length} onClick={publishReady}>
            {bulkBusy ? <RiLoader4Line className="spin" /> : <RiCheckLine />} إضافة اللي لها سعر ({ready.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="imp-empty"><RiLoader4Line className="spin" size={28} /></div>
      ) : !items.length ? (
        <div className="imp-empty">ما في منتجات تنتظر. استخدم زر الجمع على صفحة البراند.</div>
      ) : (
        <div className="imp-list">
          {items.map((it) => {
            const img = (it.images || [])[0]
            const hint = it.source_price && HINT_RATES[it.currency] ? it.source_price * HINT_RATES[it.currency] : null
            return (
              <div key={it.id} className={'imp-row' + (it.existing ? ' has-existing' : '')}>
                <input
                  type="checkbox"
                  className="imp-check"
                  checked={!!selected[it.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [it.id]: e.target.checked }))}
                />
                <div className="imp-img">
                  {img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <RiImageLine size={26} />}
                  {(it.images || []).length > 1 && <span>{it.images.length}</span>}
                </div>
                <div className="imp-info">
                  <div className="imp-brand">{it.brand || '—'}</div>
                  <div className="imp-name">{it.name_en}</div>
                  <input
                    className="imp-ar"
                    key={'ar' + it.id + (it.name_ar || '')}
                    defaultValue={it.name_ar || ''}
                    placeholder={translating && !it.name_ar ? 'يترجم…' : 'الاسم بالعربي'}
                    onBlur={(e) => saveName(it, e.target.value.trim())}
                  />
                  <div className="imp-meta">
                    {(it.attributes || []).map((a) => (
                      <span key={a.name_en}>{a.name_ar}: {(a.values || []).map((v) => v.value_ar || v.value_en).join('، ')}</span>
                    ))}
                    {it.source_url && (
                      <a href={it.source_url} target="_blank" rel="noreferrer"><RiExternalLinkLine /> صفحة البراند</a>
                    )}
                  </div>
                  {it.existing && (
                    <div className="imp-exist">
                      <RiErrorWarningLine />
                      {it.existing.exact ? 'موجود عندك' : 'يشبه منتج عندك'}: {it.existing.name} · {money(it.existing.price)} ر.ع
                      <Link to={`/admin/products?edit=${it.existing.id}`}>فتح</Link>
                    </div>
                  )}
                </div>
                <div className="imp-src">
                  <div className="imp-src-price">{it.source_price ? money(it.source_price) : '—'}</div>
                  <div className="imp-src-cur">{CUR_LABEL[it.currency] || it.currency || ''}</div>
                </div>
                <div className="imp-price">
                  <div className="imp-omr">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      placeholder="السعر"
                      value={rows[it.id]?.price ?? ''}
                      onChange={(e) => setRow(it.id, { price: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && publish(it)}
                    />
                    <span>ر.ع</span>
                  </div>
                  {hint ? <small>≈ {money(hint)} ر.ع بدون ربح</small> : <small>&nbsp;</small>}
                  <select value={rows[it.id]?.category_id ?? ''} onChange={(e) => setRow(it.id, { category_id: e.target.value })}>
                    <option value="">{defaultCat ? 'نفس التصنيف للكل' : 'التصنيف…'}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar || c.name_en}</option>)}
                  </select>
                </div>
                <div className="imp-btns">
                  <button className="btn btn-primary btn-sm" disabled={busy[it.id]} onClick={() => publish(it)}>
                    {busy[it.id] ? <RiLoader4Line className="spin" /> : <RiCheckLine />} إضافة
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => skip([it.id])}>
                    <RiCloseLine /> تخطي
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const CSS = `
.imp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.imp-sub{color:var(--text-secondary);font-size:14px;margin:6px 0 0}
.imp-actions{display:flex;gap:8px;flex-wrap:wrap}
.imp .btn{display:inline-flex;align-items:center;gap:6px}
.imp-help{padding:20px 24px;margin-bottom:16px}
.imp-help-body{display:flex;gap:24px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.imp-help h3{margin:0 0 8px;font-size:16px}
.imp-help ol{margin:0;padding-inline-start:20px;color:var(--text-secondary);font-size:14px;line-height:1.9}
.imp-note{margin:8px 0 0;font-size:12.5px;color:var(--text-secondary)}
.imp-bm{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:999px;background:var(--color-gold);color:#fff;font-weight:700;text-decoration:none;cursor:grab;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.12)}
.imp-bar{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;padding:14px 18px;margin-bottom:16px;position:sticky;top:0;z-index:5}
.imp-bar label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary)}
.imp select,.imp-ar,.imp-omr input{border:1px solid var(--border);border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;background:var(--bg-card,#fff);color:var(--text-primary)}
.imp-bar-end{margin-inline-start:auto;display:flex;gap:8px;flex-wrap:wrap}
.imp-empty{padding:60px 20px;text-align:center;color:var(--text-secondary)}
.imp-list{display:flex;flex-direction:column;gap:10px}
.imp-row{display:grid;grid-template-columns:22px 92px minmax(0,1fr) 110px 190px 104px;gap:16px;align-items:center;background:var(--bg-card,#fff);border:1px solid var(--border);border-radius:16px;padding:12px 16px}
.imp-row.has-existing{border-color:#e6c98a;background:linear-gradient(0deg,rgba(201,162,92,.06),rgba(201,162,92,.06)),var(--bg-card,#fff)}
.imp-check{width:18px;height:18px}
.imp-img{position:relative;width:92px;height:110px;border-radius:12px;background:var(--bg-body);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--text-secondary)}
.imp-img img{width:100%;height:100%;object-fit:cover}
.imp-img span{position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;border-radius:999px;padding:1px 7px}
.imp-brand{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-secondary);font-weight:700}
.imp-name{font-weight:700;font-size:14.5px;margin:2px 0 6px;direction:ltr;text-align:right}
.imp-ar{width:100%;max-width:380px}
.imp-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:12px;color:var(--text-secondary)}
.imp-meta a{color:var(--color-primary);display:inline-flex;align-items:center;gap:3px;text-decoration:none}
.imp-exist{margin-top:8px;font-size:12.5px;color:#8a6a2e;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.imp-exist a{color:var(--color-primary);font-weight:700}
.imp-src{text-align:center}
.imp-src-price{font-size:18px;font-weight:800;direction:ltr}
.imp-src-cur{font-size:12px;color:var(--text-secondary)}
.imp-price{display:flex;flex-direction:column;gap:4px}
.imp-omr{display:flex;align-items:center;gap:6px}
.imp-omr input{width:100%;font-size:16px;font-weight:700;direction:ltr;text-align:left}
.imp-omr span{font-size:12px;color:var(--text-secondary)}
.imp-price small{font-size:11.5px;color:var(--text-secondary)}
.imp-btns{display:flex;flex-direction:column;gap:6px}
.imp .spin{animation:impspin 1s linear infinite}
@keyframes impspin{to{transform:rotate(360deg)}}
@media (max-width:1100px){
 .imp-row{grid-template-columns:22px 80px minmax(0,1fr);grid-template-areas:"c i n" "c i n";}
 .imp-src,.imp-price,.imp-btns{grid-column:2 / -1}
 .imp-src{text-align:start;display:flex;gap:6px;align-items:baseline}
 .imp-btns{flex-direction:row}
 .imp-img{width:80px;height:96px}
}
`
