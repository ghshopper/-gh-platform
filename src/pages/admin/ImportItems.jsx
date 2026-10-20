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
import { catTree } from '../../lib/catTree'

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

  // Colours (not makeup shades) become one product each, linked together.
  const colorCount = (it) => {
    const a = (it.attributes || []).find((x) => x.type === 'color' && x.name_en !== 'Shade')
    return a ? (a.values || []).length : 0
  }
  const splitOf = (it) => colorCount(it) >= 2 && (rows[it.id]?.split ?? true)
  const genderOf = (it) => rows[it.id]?.gender ?? it.gender ?? ''
  const originOf = (it) => rows[it.id]?.origin ?? it.origin ?? ''
  const extra = (it) => ({ gender: genderOf(it) || undefined, origin: originOf(it) || undefined })
  const catOf = (id) => rows[id]?.category_id || items.find((x) => x.id === id)?.category_id || defaultCat
  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))

  // Same original price (e.g. all €1,290) → one OMR price for all of them.
  const priceKey = (it) => (it.source_price ? `${it.currency || ''}|${Number(it.source_price)}` : null)
  const priceGroups = useMemo(() => {
    const g = {}
    items.forEach((it) => {
      const k = priceKey(it)
      if (!k) return
      ;(g[k] ||= { key: k, price: it.source_price, currency: it.currency, ids: [] }).ids.push(it.id)
    })
    return Object.values(g).filter((x) => x.ids.length > 1).sort((a, b) => a.price - b.price)
  }, [items])
  const [groupPrice, setGroupPrice] = useState({})
  const applyGroup = (grp, value) => {
    setGroupPrice((g) => ({ ...g, [grp.key]: value }))
    setRows((r) => {
      const n = { ...r }
      grp.ids.forEach((id) => { n[id] = { ...n[id], price: value } })
      return n
    })
  }
  // Typing one price also fills the empty ones with the same original price.
  const setPrice = (it, value) => {
    const k = priceKey(it)
    setRows((r) => {
      const n = { ...r, [it.id]: { ...r[it.id], price: value } }
      if (k && value) items.forEach((x) => { if (x.id !== it.id && priceKey(x) === k && !r[x.id]?.price) n[x.id] = { ...r[x.id], price: value, auto: true } })
      if (k && !value) items.forEach((x) => { if (x.id !== it.id && priceKey(x) === k && r[x.id]?.auto) n[x.id] = { ...r[x.id], price: '', auto: false } })
      return n
    })
  }

  // Options of an item: extra choices (e.g. case) and engraving.
  const [editing, setEditing] = useState(null)
  const saveAttrs = async (it, attributes) => {
    try {
      await api.put(`/admin/import-items/${it.id}`, { attributes })
      setItems((list) => list.map((x) => (x.id === it.id ? { ...x, attributes } : x)))
      setEditing(null)
      toast.success('انحفظت الخيارات')
    } catch {
      toast.error('تعذر الحفظ')
    }
  }
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
      await api.post(`/admin/import-items/${it.id}/publish`, { price, category_id: Number(catOf(it.id)), availability, split: splitOf(it), ...extra(it) })
      toast.success('انضاف للمتجر')
      drop([it.id])
    } catch (e) {
      const d = e.response?.data
      const first = d?.errors ? Object.values(d.errors).flat()[0] : null
      toast.error(first || d?.message || (e.response ? `تعذرت الإضافة (${e.response.status})` : 'السيرفر تأخر، بنحدّث القائمة'))
      if (!e.response || e.response.status >= 500) load()
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

  const changeBrand = async (it) => {
    const b = window.prompt('البراند الصحيح (بالإنجليزي، مثلاً Dior أو Carolina Herrera):', it.brand || '')
    if (b == null || b.trim() === (it.brand || '')) return
    try {
      await api.put(`/admin/import-items/${it.id}`, { brand: b.trim() || null })
      setItems((list) => list.map((x) => (x.id === it.id ? { ...x, brand: b.trim() || null } : x)))
      toast.success('تغيّر البراند')
    } catch { toast.error('ما انحفظ') }
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
  // Priced but no category: they can't be added until a category is chosen.
  const pricedNoCat = items.filter((it) => parseFloat(rows[it.id]?.price) > 0 && !catOf(it.id))
  const unpriced = items.filter((it) => !(parseFloat(rows[it.id]?.price) > 0))
  const [view, setView] = useState('all')
  const shown = view === 'ready' ? ready : view === 'nocat' ? pricedNoCat : view === 'unpriced' ? unpriced : items
  const setCatFor = (list, category_id) => setRows((r) => {
    const n = { ...r }
    list.forEach((it) => { n[it.id] = { ...n[it.id], category_id } })
    return n
  })

  // A few at a time, so a slow brand site never makes the whole batch time out.
  const publishReady = async () => {
    if (!ready.length) return toast.error('اكتب السعر والتصنيف أول')
    setBulkBusy(true)
    const all = ready.map((it) => ({ id: it.id, price: parseFloat(rows[it.id].price), category_id: Number(catOf(it.id)), split: splitOf(it), ...extra(it) }))
    let added = 0
    let failed = 0
    const tid = toast.loading(`يضيف 0 من ${all.length}…`)
    try {
      for (let i = 0; i < all.length; i += 3) {
        const part = all.slice(i, i + 3)
        try {
          const r = await api.post('/admin/import-items/publish', { availability, items: part }, { timeout: 180000 })
          added += r.data.added || 0
          failed += r.data.failed?.length || 0
          drop(Object.keys(r.data.products || {}).map(Number))
        } catch {
          failed += part.length
        }
        toast.loading(`يضيف ${Math.min(i + 3, all.length)} من ${all.length}…`, { id: tid })
      }
      toast.success(`انضاف ${added} منتج للمتجر`, { id: tid })
      if (failed) {
        toast.error(`${failed} ما انضافت، جربها وحدها`)
        load()
      }
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
          <Link to="/admin/import-review" className="btn btn-ghost">مراجعة اللي انضاف</Link>
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
                <li>اضغط الزر من المفضلة. يفتح كل منتج ويجيب الوصف وكل الصور والألوان أو الدرجات (مثل الروج) والمقاسات.</li>
                <li>ترجع هنا وتلقاها بالبراند والتصنيف والاسم العربي، وتكتب السعر بالريال بس.</li>
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
          <span>تصنيف اللي ما تعرّفت عليها</span>
          <select value={defaultCat} onChange={(e) => setDefaultCat(e.target.value)}>
            <option value="">اختر…</option>
            {catTree(categories)}
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
          {items.length > 0 && (
            <button
              className="btn btn-ghost imp-danger"
              onClick={() => {
                const msg = brand ? `تحذف كل منتجات ${brand} من القائمة (${items.length})؟` : `تحذف كل المنتجات من القائمة (${items.length})؟`
                if (window.confirm(msg + '\nالمنتجات اللي انضافت للمتجر ما تتأثر.')) skip(items.map((x) => x.id))
              }}
            >
              <RiCloseLine /> حذف الكل ({items.length})
            </button>
          )}
          {existingCount > 0 && (
            <button className="btn btn-ghost" onClick={() => skip(items.filter((x) => x.existing).map((x) => x.id))}>
              حذف الموجود عندي ({existingCount})
            </button>
          )}
          <button className="btn btn-primary" disabled={bulkBusy || !ready.length} onClick={publishReady}>
            {bulkBusy ? <RiLoader4Line className="spin" /> : <RiCheckLine />} إضافة الجاهزة ({ready.length})
          </button>
        </div>
      </div>

      {priceGroups.length > 0 && (
        <div className="card imp-groups">
          <div className="imp-groups-title">نفس السعر الأصلي؟ اكتب السعر بالريال مرة وحدة لكلها</div>
          <div className="imp-groups-list">
            {priceGroups.map((g) => (
              <label key={g.key} className="imp-group">
                <span className="imp-group-src">{money(g.price)} {CUR_LABEL[g.currency] || g.currency}</span>
                <span className="imp-group-n">{g.ids.length} منتجات</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  placeholder="ر.ع"
                  value={groupPrice[g.key] ?? ''}
                  onChange={(e) => applyGroup(g, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {pricedNoCat.length > 0 && (
        <div className="card imp-warn">
          <b>{pricedNoCat.length} منتج كتبت لها سعر بس ما لها تصنيف، فما تنضاف.</b>
          <span>اختر تصنيفها:</span>
          <select value="" onChange={(e) => e.target.value && setCatFor(pricedNoCat, e.target.value)}>
            <option value="">اختر…</option>
            {catTree(categories)}
          </select>
          <button className="btn btn-ghost" onClick={() => setView('nocat')}>اعرضها</button>
        </div>
      )}

      {items.length > 0 && (
        <div className="imp-tabs">
          {[['all', 'الكل', items.length], ['ready', 'جاهزة للإضافة', ready.length], ['nocat', 'ناقصها تصنيف', pricedNoCat.length], ['unpriced', 'بدون سعر', unpriced.length]].map(([k, l, n]) => (
            <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l} <span>{n}</span></button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="imp-empty"><RiLoader4Line className="spin" size={28} /></div>
      ) : !items.length ? (
        <div className="imp-empty">ما في منتجات تنتظر. استخدم زر الجمع على صفحة البراند.</div>
      ) : (
        <div className="imp-list">
          {shown.map((it) => {
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
                  <button type="button" className={`imp-brand imp-brand-btn${it.brand ? '' : ' none'}`} title="غيّر البراند" onClick={() => changeBrand(it)}>{it.brand || 'بدون براند · اختر'} ✎</button>
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
                      <span key={a.name_en} className="imp-attr">
                        {a.type === 'engraving' ? `✎ ${a.name_ar} (حتى ${a.max_length || 12} حرف)` : <>{a.name_ar}{(a.values || []).length > 1 ? ` (${a.values.length})` : ''}:</>}
                        {a.type === 'color' && (a.values || []).some((v) => v.image || v.color_code) ? (
                          <span className="imp-dots">
                            {(a.values || []).slice(0, 14).map((v) => (
                              <i key={v.id} title={v.value_ar || v.value_en} style={v.color_code ? { background: v.color_code } : undefined}>
                                {v.image ? <img src={v.image} alt="" referrerPolicy="no-referrer" loading="lazy" /> : null}
                              </i>
                            ))}
                            {(a.values || []).length > 14 ? <b>+{a.values.length - 14}</b> : null}
                          </span>
                        ) : null}
                        <span className="imp-vals">{(a.values || []).slice(0, 8).map((v) => {
                          const label = v.value_ar || v.value_en
                          const sp = Number(v.source_price) || 0
                          const base = Number(it.source_price) || 0
                          const omrNow = parseFloat(rows[it.id]?.price) || 0
                          if (!sp || !base || sp <= base) return label
                          const add = omrNow ? ` · +${(Math.round(((sp - base) * omrNow / base) * 10) / 10).toLocaleString('en-US')} ر.ع` : ''
                          return `${label} (${money(sp)}${add})`
                        }).join('، ')}{(a.values || []).length > 8 ? '…' : ''}</span>
                      </span>
                    ))}
                    {it.description_ar || it.description_en ? <span title={it.description_ar || it.description_en}>✓ الوصف</span> : null}
                    {it.source_url && (
                      <a href={it.source_url} target="_blank" rel="noreferrer"><RiExternalLinkLine /> صفحة البراند</a>
                    )}
                    <button type="button" className="imp-link" onClick={() => setEditing(editing === it.id ? null : it.id)}>
                      {editing === it.id ? 'إغلاق الخيارات' : '+ خيارات (كفر، حفر…)'}
                    </button>
                  </div>
                  {editing === it.id && <OptionsEditor item={it} onSave={(a) => saveAttrs(it, a)} onCancel={() => setEditing(null)} />}
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
                      onChange={(e) => setPrice(it, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && publish(it)}
                    />
                    <span>ر.ع</span>
                  </div>
                  {hint ? <small>≈ {money(hint)} ر.ع بدون ربح</small> : <small>&nbsp;</small>}
                  <select
                    className={!catOf(it.id) && parseFloat(rows[it.id]?.price) > 0 ? 'imp-need' : !rows[it.id]?.category_id && it.category_id ? 'imp-auto' : ''}
                    value={rows[it.id]?.category_id || it.category_id || ''}
                    onChange={(e) => setRow(it.id, { category_id: e.target.value })}
                  >
                    <option value="">{defaultCat ? 'التصنيف العام' : 'التصنيف…'}</option>
                    {catTree(categories)}
                  </select>
                  <div className="imp-two">
                    <select value={genderOf(it)} onChange={(e) => setRow(it.id, { gender: e.target.value })} className={!rows[it.id]?.gender && it.gender ? 'imp-auto' : ''}>
                      <option value="">القسم…</option>
                      <option value="women">نسائي</option>
                      <option value="men">رجالي</option>
                      <option value="unisex">للجنسين</option>
                    </select>
                    <select value={originOf(it)} onChange={(e) => setRow(it.id, { origin: e.target.value })} className={!rows[it.id]?.origin && it.origin ? 'imp-auto' : ''}>
                      <option value="">يُشحن من…</option>
                      <option value="dubai">دبي</option>
                      <option value="europe">أوروبا</option>
                      <option value="oman">عُمان</option>
                    </select>
                  </div>
                  {colorCount(it) >= 2 && (
                    <label className="imp-split">
                      <input type="checkbox" checked={splitOf(it)} onChange={(e) => setRow(it.id, { split: e.target.checked })} />
                      كل لون منتج لحاله ({colorCount(it)})، مربوطين
                    </label>
                  )}
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

/** Extra choices for one product: rename/edit groups, add a group, engraving. */
function OptionsEditor({ item, onSave, onCancel }) {
  const toText = (a) => (a.values || []).map((v) => (v.value_ar || v.value_en) + (Number(v.price_add) ? ` +${Number(v.price_add)}` : '')).join('، ')
  const [groups, setGroups] = useState(() =>
    (item.attributes || []).filter((a) => a.type !== 'engraving').map((a) => ({ ...a, text: toText(a) })),
  )
  const old = (item.attributes || []).find((a) => a.type === 'engraving')
  const [engrave, setEngrave] = useState(!!old)
  const [maxLen, setMaxLen] = useState(old?.max_length || 12)

  const update = (i, patch) => setGroups((g) => g.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const save = () => {
    let id = 1
    const out = groups
      .filter((g) => (g.name_ar || '').trim())
      .map((g) => {
        const names = g.text.split(/[,،\n]/).map((t) => t.trim()).filter(Boolean)
        // Keep photos/colours of values that are still there.
        // "ذهبي +5" → the gold case adds 5 OMR.
        const values = names.map((raw) => {
          const m = raw.match(/^(.*?)\s*\+\s*([0-9.]+)\s*$/)
          const n = m ? m[1].trim() : raw
          const prev = (g.values || []).find((v) => (v.value_ar || v.value_en) === n)
          return { ...(prev || {}), id: id++, value_ar: n, value_en: prev?.value_en || n, price_add: m ? Number(m[2]) : null }
        })
        const { text, ...rest } = g // eslint-disable-line no-unused-vars
        return { ...rest, name_en: rest.name_en || rest.name_ar, is_selectable: rest.is_selectable !== false, values }
      })
      .filter((g) => g.values.length)
    if (engrave) out.push({ name_ar: 'الحفر', name_en: 'Engraving', type: 'engraving', is_selectable: true, required: false, max_length: Number(maxLen) || 12, values: [] })
    onSave(out)
  }

  return (
    <div className="imp-opts">
      {groups.map((g, i) => (
        <div key={i} className="imp-opt">
          <input value={g.name_ar || ''} onChange={(e) => update(i, { name_ar: e.target.value })} placeholder="اسم الخيار (مثلاً: الكفر)" />
          <textarea value={g.text} onChange={(e) => update(i, { text: e.target.value })} placeholder="القيم مفصولة بفاصلة: ذهبي +5، أسود، فضي (‎+5 = يزيد 5 ر.ع)" rows={2} />
          <button type="button" className="imp-x" onClick={() => setGroups((x) => x.filter((_, k) => k !== i))} title="حذف"><RiCloseLine /></button>
        </div>
      ))}
      <button type="button" className="imp-link" onClick={() => setGroups((x) => [...x, { name_ar: '', name_en: '', type: 'text', is_selectable: true, values: [], text: '' }])}>
        + خيار جديد (كفر، حجم، …)
      </button>
      <label className="imp-split">
        <input type="checkbox" checked={engrave} onChange={(e) => setEngrave(e.target.checked)} />
        العميل يقدر يطلب حفر (يكتب النص، اختياري)
        {engrave && (
          <>
            · حد الحروف <input type="number" min="1" max="40" value={maxLen} onChange={(e) => setMaxLen(e.target.value)} style={{ width: 60 }} />
          </>
        )}
      </label>
      <div className="imp-opts-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={save}><RiCheckLine /> حفظ الخيارات</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>إلغاء</button>
      </div>
    </div>
  )
}

const CSS = `
.imp-groups{padding:14px 18px;margin-bottom:16px}
.imp-groups-title{font-size:13px;font-weight:700;margin-bottom:10px}
.imp-groups-list{display:flex;flex-wrap:wrap;gap:10px}
.imp-group{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:12px;padding:6px 6px 6px 12px;background:var(--bg-body)}
.imp-group-src{font-weight:800;direction:ltr}
.imp-group-n{font-size:12px;color:var(--text-secondary)}
.imp-group input{width:96px;border:1px solid var(--border);border-radius:8px;padding:6px 8px;font:inherit;font-weight:700;direction:ltr;text-align:left;background:var(--bg-card,#fff);color:var(--text-primary)}
.imp-link{background:none;border:none;padding:0;color:var(--color-primary);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.imp-opts{margin-top:10px;padding:12px;border:1px dashed var(--border);border-radius:12px;display:flex;flex-direction:column;gap:8px;max-width:520px}
.imp-opt{display:grid;grid-template-columns:150px 1fr 28px;gap:8px;align-items:start}
.imp-opt input,.imp-opt textarea,.imp-opts input[type=number]{border:1px solid var(--border);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;background:var(--bg-card,#fff);color:var(--text-primary);resize:vertical}
.imp-x{border:none;background:none;color:#EF4444;cursor:pointer;padding:6px}
.imp-opts-actions{display:flex;gap:8px}
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
.imp-brand-btn{border:0;background:none;padding:0;cursor:pointer;font-family:inherit;text-align:start}.imp-brand-btn.none{color:#B45309!important}
.imp-brand{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-secondary);font-weight:700}
.imp-name{font-weight:700;font-size:14.5px;margin:2px 0 6px;direction:ltr;text-align:right}
.imp-ar{width:100%;max-width:380px}
.imp-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:12px;color:var(--text-secondary)}
.imp-attr{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.imp-dots{display:inline-flex;gap:3px;align-items:center}
.imp-dots i{width:16px;height:16px;border-radius:50%;background:var(--bg-body);border:1px solid var(--border);overflow:hidden;display:inline-block}
.imp-dots i img{width:100%;height:100%;object-fit:cover}
.imp-dots b{font-weight:600;font-size:11px}
.imp-two{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.imp-two select{padding:6px 6px;font-size:12.5px}
.imp-danger{color:#B42318 !important}
.imp-danger:hover{border-color:#B42318 !important}
.imp-split{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer}
.imp select.imp-auto{border-color:#c9a25c;background:rgba(201,162,92,.08)}
.imp-meta a{color:var(--color-primary);display:inline-flex;align-items:center;gap:3px;text-decoration:none}
.imp-exist{margin-top:8px;font-size:12.5px;color:#8a6a2e;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.imp-exist a{color:var(--color-primary);font-weight:700}
.imp-src{text-align:center}
.imp-src-price{font-size:18px;font-weight:800;direction:ltr}
.imp-src-cur{font-size:12px;color:var(--text-secondary)}
.imp-price{display:flex;flex-direction:column;gap:4px}
.imp-omr{display:flex;align-items:center;gap:6px}
.imp-warn{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px;margin-bottom:14px;background:#FFF6E8;border:1px solid #F0D7A8}
.imp-warn b{color:#8A4B00;font-size:14px}
.imp-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.imp-tabs button{border:1px solid var(--border);background:var(--bg-card,#fff);border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer;color:var(--text-primary)}
.imp-tabs button span{opacity:.6;margin-inline-start:4px}
.imp-tabs button.on{background:#1F1915;border-color:#1F1915;color:#fff}
.imp select.imp-need{border-color:#D92D20;background:#FEF3F2;color:#B42318}
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
