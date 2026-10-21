import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  RiHome4Line, RiImageLine, RiPhoneLine, RiFileList3Line, RiArrowUpLine, RiArrowDownLine, RiAddLine,
  RiEditLine, RiDeleteBinLine, RiCloseLine, RiLoader4Line, RiExternalLinkLine, RiSmartphoneLine, RiComputerLine,
  RiUploadCloud2Line, RiMegaphoneLine, RiArrowDownSLine,
} from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'

/**
 * The website's and the app's look, from one place: the announcement bar,
 * the big slides, the home sections (order, show/hide, titles, how many),
 * the logo and opening screen, contact details and the policy pages.
 * Every setting here is read by the website and/or the app.
 */
const TABS = [
  ['home', 'الصفحة الرئيسية', RiHome4Line],
  ['brand', 'الشعار وشاشة البداية', RiImageLine],
  ['contact', 'التواصل والفوتر', RiPhoneLine],
  ['policies', 'السياسات', RiFileList3Line],
]

// Every home section: its name here, and where it shows (w = website, a = app).
const SECTIONS = {
  categories: { label: 'الأقسام', hint: 'صور الأقسام للتسوّق حسب الفئة', where: 'wa', count: 8, action: true },
  new_in: { label: 'وصل حديثاً', hint: 'آخر القطع المضافة', where: 'w', count: 12 },
  fast_delivery: { label: 'توصيل سريع', hint: 'قطع موجودة في عُمان تنسلّم بسرعة', where: 'w', count: 12 },
  personal_shopping: { label: 'اطلب قطعة', hint: '«ما لقيت القطعة؟ نجيبها لك»', where: 'wa', action: true },
  featured_products: { label: 'منتجات مميزة', hint: 'القطع اللي معلّم عليها «مميز»', where: 'wa', count: 12, action: true },
  flash_sales: { label: 'العروض', hint: 'القطع اللي عليها خصم', where: 'wa', count: 12, action: true },
  brands: { label: 'البراندات', hint: 'أسماء البراندات', where: 'wa', count: 18, action: true },
  features_banner: { label: 'مميزاتنا', hint: 'أصلية ١٠٠٪، توصيل، دفع آمن…', where: 'a', features: true },
  luxury_collections: { label: 'مجموعات فاخرة', hint: 'بطاقات أقسام تختارها', where: 'a', count: 3, pickCats: true },
  loyalty_program: { label: 'برنامج الولاء', hint: 'دعوة للانضمام وجمع النقاط', where: 'wa', action: true, subtitle: true },
}
const LINKS = [['none', 'بدون رابط'], ['category', 'قسم'], ['brand', 'براند'], ['product', 'منتج'], ['url', 'رابط']]
const POLICIES = [['about', 'من نحن'], ['terms', 'الشروط والأحكام'], ['privacy', 'سياسة الخصوصية'], ['return', 'الاستبدال والاسترجاع']]
const SITE = 'https://ghshopper.com'

const on = (v) => v === true || v === 1 || v === '1'
function Switch({ value, onChange, disabled }) {
  return (
    <button type="button" className={`ca-sw ${value ? 'on' : ''}`} onClick={() => onChange(!value)} disabled={disabled} aria-pressed={!!value}>
      <i />
    </button>
  )
}
function Where({ where }) {
  return (
    <span className="ca-where">
      {where.includes('w') && <span title="يظهر في الموقع"><RiComputerLine /> الموقع</span>}
      {where.includes('a') && <span title="يظهر في التطبيق"><RiSmartphoneLine /> التطبيق</span>}
    </span>
  )
}

export default function CustomizeApp() {
  const [tab, setTab] = useState('home')
  return (
    <div className="page ca" dir="rtl">
      <div className="ca-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>واجهة الموقع والتطبيق</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>اللي يشوفه العميل أول ما يفتح: الشريط، الصور الكبيرة، ترتيب الأقسام، الشعار، التواصل والسياسات.</p>
        </div>
        <a className="btn btn-ghost" href={SITE} target="_blank" rel="noreferrer"><RiExternalLinkLine /> شوف الموقع</a>
      </div>
      <div className="gh-seg ca-tabs">
        {TABS.map(([k, l, I]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><I /> {l}</button>)}
      </div>
      {tab === 'home' && <HomeTab />}
      {tab === 'brand' && <BrandTab />}
      {tab === 'contact' && <ContactTab />}
      {tab === 'policies' && <PoliciesTab />}
      <style>{CSS}</style>
    </div>
  )
}

// ───────────────────────── Home ─────────────────────────

function HomeTab() {
  const [sections, setSections] = useState(null)
  const [order, setOrder] = useState([])
  const [open, setOpen] = useState(null)
  const [cats, setCats] = useState([])
  const [brands, setBrands] = useState([])
  const load = async () => {
    try {
      const r = await api.get('/admin/home-customize/sections')
      const data = r.data.data || {}
      setSections(data)
      const keys = Object.values(data).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((s) => s.section_key).filter((k) => SECTIONS[k])
      for (const k of Object.keys(SECTIONS)) if (!keys.includes(k)) keys.push(k)
      setOrder(keys)
    } catch { toast.error('تعذر التحميل') }
  }
  useEffect(() => {
    load()
    api.get('/admin/categories').then((r) => setCats(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => {})
    api.get('/admin/brands', { params: { per_page: 500 } }).then((r) => setBrands(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => {})
  }, [])

  const save = async (key, patch, msg = 'انحفظ') => {
    const cur = sections[key] || { section_key: key }
    const body = {
      title_ar: cur.title_ar ?? null, title_en: cur.title_en ?? null, action_text_ar: cur.action_text_ar ?? null, action_text_en: cur.action_text_en ?? null,
      items_count: cur.items_count ?? 0, is_active: on(cur.is_active ?? true), card_settings: cur.card_settings || {}, ...patch,
    }
    setSections((s) => ({ ...s, [key]: { ...cur, ...body } }))
    try { await api.put(`/admin/home-customize/sections/${key}`, body); toast.success(msg) } catch (e) { toast.error(e.response?.data?.message || 'ما انحفظ'); load() }
  }
  const move = async (key, dir) => {
    const i = order.indexOf(key), j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
    try { await api.put('/admin/home-customize/sections-order', { order: ['announcement', ...next] }) } catch { toast.error('ما انحفظ الترتيب'); load() }
  }

  if (!sections) return <div className="gh-skel" style={{ height: 400 }} />
  return (
    <div className="ca-col">
      <Announcement sec={sections.announcement} save={(p, m) => save('announcement', p, m)} />
      <Slides cats={cats} brands={brands} />
      <div className="card ca-box">
        <div className="ca-box-head">
          <div><h3>أقسام الصفحة الرئيسية</h3><p>رتّبها بالأسهم، وشغّل أو وقّف أي قسم، وغيّر عنوانه. التغيير يطلع في الموقع على طول، وفي التطبيق مع التحديث الجاي.</p></div>
        </div>
        <div className="ca-secs">
          {order.map((key, idx) => {
            const meta = SECTIONS[key]
            const s = sections[key] || {}
            const active = on(s.is_active ?? true)
            return (
              <div key={key} className={`ca-sec ${active ? '' : 'off'} ${open === key ? 'open' : ''}`}>
                <div className="ca-sec-row">
                  <div className="ca-arrows">
                    <button className="icon-btn" disabled={idx === 0} onClick={() => move(key, -1)} title="فوق"><RiArrowUpLine /></button>
                    <button className="icon-btn" disabled={idx === order.length - 1} onClick={() => move(key, 1)} title="تحت"><RiArrowDownLine /></button>
                  </div>
                  <span className="ca-num">{idx + 1}</span>
                  <button className="ca-sec-main" onClick={() => setOpen(open === key ? null : key)}>
                    <b>{s.title_ar || meta.label}</b>
                    <small>{meta.label !== s.title_ar && s.title_ar ? meta.label + ' · ' : ''}{meta.hint}</small>
                  </button>
                  <Where where={meta.where} />
                  <Switch value={active} onChange={(v) => save(key, { is_active: v }, v ? 'القسم يظهر' : 'القسم مخفي')} />
                  <button className="icon-btn" onClick={() => setOpen(open === key ? null : key)} title="تعديل"><RiArrowDownSLine className={open === key ? 'rot' : ''} /></button>
                </div>
                {open === key && <SectionForm meta={meta} sec={s} cats={cats} onSave={(p) => save(key, p)} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Announcement({ sec, save }) {
  const [f, setF] = useState({ ar: sec?.title_ar || '', en: sec?.title_en || '', link: sec?.card_settings?.link || '' })
  const active = on(sec?.is_active ?? false)
  return (
    <div className="card ca-box">
      <div className="ca-box-head">
        <RiMegaphoneLine size={22} className="ca-ic" />
        <div style={{ flex: 1 }}><h3>شريط الإعلان</h3><p>السطر الصغير اللي فوق الموقع. مثلاً: «شحن مجاني فوق ١٠٠ ر.ع» أو «عروض اليوم الوطني».</p></div>
        <Where where="w" />
        <Switch value={active} onChange={(v) => save({ is_active: v }, v ? 'الشريط يظهر' : 'الشريط مخفي')} />
      </div>
      <div className="ca-grid2">
        <label>النص بالعربي<input className="input" value={f.ar} onChange={(e) => setF({ ...f, ar: e.target.value })} maxLength={160} /></label>
        <label>English<input className="input" dir="ltr" value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} maxLength={160} /></label>
        <label>يفتح (اختياري)<input className="input" dir="ltr" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="/shop?points_boost=1 أو https://…" /></label>
        <div className="ca-save"><button className="btn btn-primary" onClick={() => save({ title_ar: f.ar, title_en: f.en, card_settings: { link: f.link.trim() } })}>حفظ الشريط</button></div>
      </div>
      {active && f.ar && <div className="ca-ann-preview">{f.ar}</div>}
    </div>
  )
}

function SectionForm({ meta, sec, cats, onSave }) {
  const cs = sec.card_settings || {}
  const [f, setF] = useState({
    title_ar: sec.title_ar || '', title_en: sec.title_en || '', action_text_ar: sec.action_text_ar || '', action_text_en: sec.action_text_en || '',
    items_count: sec.items_count || meta.count || 0,
    subtitle_ar: cs.subtitle_ar || '', subtitle_en: cs.subtitle_en || '',
    features: Array.isArray(cs.features) && cs.features.length ? cs.features : [
      { title_ar: 'أصلية ١٠٠٪', title_en: '100% authentic', sub_ar: 'مع الفاتورة', sub_en: 'With receipt' },
      { title_ar: 'توصيل لكل عُمان', title_en: 'Delivery across Oman', sub_ar: 'لباب البيت', sub_en: 'To your door' },
      { title_ar: 'دفع آمن', title_en: 'Secure payment', sub_ar: 'بطاقة أو Apple Pay', sub_en: 'Card or Apple Pay' },
    ],
    categories: Array.isArray(cs.categories) ? cs.categories.map(Number) : [],
  })
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const setFeat = (i, k, v) => set({ features: f.features.map((y, j) => (j === i ? { ...y, [k]: v } : y)) })
  const submit = () => {
    const card = { ...cs }
    if (meta.subtitle) Object.assign(card, { subtitle_ar: f.subtitle_ar, subtitle_en: f.subtitle_en })
    if (meta.features) card.features = f.features
    if (meta.pickCats) card.categories = f.categories
    onSave({ title_ar: f.title_ar, title_en: f.title_en, action_text_ar: f.action_text_ar, action_text_en: f.action_text_en, items_count: Number(f.items_count) || 0, card_settings: card })
  }
  return (
    <div className="ca-form">
      <div className="ca-grid2">
        <label>العنوان بالعربي<input className="input" value={f.title_ar} onChange={(e) => set({ title_ar: e.target.value })} placeholder={meta.label} /></label>
        <label>English<input className="input" dir="ltr" value={f.title_en} onChange={(e) => set({ title_en: e.target.value })} /></label>
        {meta.action && <>
          <label>نص الزر/الرابط<input className="input" value={f.action_text_ar} onChange={(e) => set({ action_text_ar: e.target.value })} placeholder="مثلاً: شوف الكل" /></label>
          <label>Button (English)<input className="input" dir="ltr" value={f.action_text_en} onChange={(e) => set({ action_text_en: e.target.value })} placeholder="See all" /></label>
        </>}
        {meta.subtitle && <>
          <label>الوصف بالعربي<input className="input" value={f.subtitle_ar} onChange={(e) => set({ subtitle_ar: e.target.value })} /></label>
          <label>Description (English)<input className="input" dir="ltr" value={f.subtitle_en} onChange={(e) => set({ subtitle_en: e.target.value })} /></label>
        </>}
        {meta.count ? <label>كم قطعة يعرض<input className="input" type="number" min="1" max="50" value={f.items_count} onChange={(e) => set({ items_count: e.target.value })} /></label> : null}
      </div>
      {meta.features && (
        <div className="ca-feats">
          {f.features.map((x, i) => (
            <div key={i} className="ca-feat">
              <b>{i + 1}</b>
              <input className="input" value={x.title_ar || ''} onChange={(e) => setFeat(i, 'title_ar', e.target.value)} placeholder="العنوان" />
              <input className="input" value={x.sub_ar || ''} onChange={(e) => setFeat(i, 'sub_ar', e.target.value)} placeholder="سطر تحته" />
              <input className="input" dir="ltr" value={x.title_en || ''} onChange={(e) => setFeat(i, 'title_en', e.target.value)} placeholder="Title" />
              <input className="input" dir="ltr" value={x.sub_en || ''} onChange={(e) => setFeat(i, 'sub_en', e.target.value)} placeholder="Line" />
            </div>
          ))}
        </div>
      )}
      {meta.pickCats && (
        <div className="ca-chips">
          <small>اختر الأقسام اللي تطلع كبطاقات (فاضي = أول الأقسام):</small>
          <div>
            {cats.slice(0, 80).map((c) => {
              const sel = f.categories.includes(Number(c.id))
              return <button type="button" key={c.id} className={sel ? 'on' : ''} onClick={() => set({ categories: sel ? f.categories.filter((x) => x !== Number(c.id)) : [...f.categories, Number(c.id)] })}>{c.name_ar}</button>
            })}
          </div>
        </div>
      )}
      <div className="ca-save"><button className="btn btn-primary" onClick={submit}>حفظ القسم</button></div>
    </div>
  )
}

// ───────────────────────── Slides ─────────────────────────

function Slides({ cats, brands }) {
  const [rows, setRows] = useState(null)
  const [edit, setEdit] = useState(null)
  const load = () => api.get('/admin/home-customize/hero-slides').then((r) => setRows(r.data.data || [])).catch(() => setRows([]))
  useEffect(() => { load() }, [])
  const move = async (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]]
    setRows(next)
    try { await api.put('/admin/home-customize/hero-slides/reorder', { order: next.map((r) => r.id) }) } catch { toast.error('ما انحفظ الترتيب'); load() }
  }
  const remove = async (s) => {
    if (!window.confirm('نحذف هالصورة؟')) return
    try { await api.delete(`/admin/home-customize/hero-slides/${s.id}`); toast.success('انحذفت'); load() } catch { toast.error('ما انحذفت') }
  }
  const toggle = async (s) => {
    const fd = new FormData(); fd.append('is_active', on(s.is_active) ? '0' : '1')
    try { await api.post(`/admin/home-customize/hero-slides/${s.id}`, fd); load() } catch { toast.error('تعذر') }
  }
  return (
    <div className="card ca-box">
      <div className="ca-box-head">
        <div style={{ flex: 1 }}><h3>الصور الكبيرة (السلايدر)</h3><p>أول شي يشوفه العميل. صورة عرضية (مثلاً ١٦٠٠×٩٠٠)، وتقدر تخليها تفتح قسم أو براند أو منتج.</p></div>
        <Where where="wa" />
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({})}><RiAddLine /> صورة جديدة</button>
      </div>
      {rows === null ? <div className="gh-skel" style={{ height: 120 }} /> : rows.length === 0 ? (
        <p className="ca-empty">ما فيه صور، يطلع للعميل صورة GH الافتراضية. ضيف أول صورة.</p>
      ) : (
        <div className="ca-slides">
          {rows.map((s, i) => (
            <div key={s.id} className={`ca-slide ${on(s.is_active) ? '' : 'off'}`}>
              <div className="ca-slide-img">{s.full_image_url || s.image_path ? <img src={s.full_image_url || getImageUrl(s.image_path)} alt="" /> : null}
                <div className="ca-slide-txt"><b>{s.title_ar}</b><small>{s.subtitle_ar}</small></div>
              </div>
              <div className="ca-slide-bar">
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="قبل"><RiArrowUpLine style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="icon-btn" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="بعد"><RiArrowDownLine style={{ transform: 'rotate(90deg)' }} /></button>
                <span style={{ flex: 1 }} />
                <Switch value={on(s.is_active)} onChange={() => toggle(s)} />
                <button className="icon-btn" onClick={() => setEdit(s)} title="تعديل"><RiEditLine /></button>
                <button className="icon-btn" style={{ color: '#B42318' }} onClick={() => remove(s)} title="حذف"><RiDeleteBinLine /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <SlideForm slide={edit} cats={cats} brands={brands} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

function SlideForm({ slide, cats, brands, onClose, onSaved }) {
  const [f, setF] = useState({
    title_ar: slide.title_ar || '', title_en: slide.title_en || '', subtitle_ar: slide.subtitle_ar || '', subtitle_en: slide.subtitle_en || '',
    button_text_ar: slide.button_text_ar || '', button_text_en: slide.button_text_en || '',
    link_type: slide.link_type || 'none', link_value: slide.link_value || '', is_active: slide.id ? on(slide.is_active) : true,
  })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(slide.full_image_url || (slide.image_path ? getImageUrl(slide.image_path) : ''))
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState([])
  const set = (p) => setF((x) => ({ ...x, ...p }))
  useEffect(() => {
    if (f.link_type !== 'product' || q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => api.get('/admin/products', { params: { search: q, per_page: 8 } }).then((r) => setFound(r.data?.data || [])).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [q, f.link_type])

  const submit = async (e) => {
    e.preventDefault()
    if (!slide.id && !file) return toast.error('اختر صورة')
    setBusy(true)
    const fd = new FormData()
    fd.append('slide_type', 'custom')
    Object.entries(f).forEach(([k, v]) => fd.append(k, k === 'is_active' ? (v ? '1' : '0') : (v ?? '')))
    if (file) fd.append('image', file)
    try {
      if (slide.id) await api.post(`/admin/home-customize/hero-slides/${slide.id}`, fd)
      else await api.post('/admin/home-customize/hero-slides', fd)
      toast.success('انحفظت')
      onSaved()
    } catch (err) { toast.error(err.response?.data?.message || 'ما انحفظت') } finally { setBusy(false) }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal-content" style={{ maxWidth: 640, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <h3 className="modal-title">{slide.id ? 'تعديل الصورة' : 'صورة جديدة'}</h3>
          <button type="button" className="close-btn" onClick={onClose}><RiCloseLine size={24} /></button>
        </div>
        <div className="modal-body ca-mform">
          <label className="ca-drop">
            {preview ? <img src={preview} alt="" /> : <span><RiUploadCloud2Line size={28} /> اختر صورة (عرضية، حتى ١٠ ميغا)</span>}
            <input type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) { setFile(x); setPreview(URL.createObjectURL(x)) } }} />
          </label>
          <div className="ca-grid2">
            <label>العنوان<input className="input" value={f.title_ar} onChange={(e) => set({ title_ar: e.target.value })} placeholder="اختياري" /></label>
            <label>Title<input className="input" dir="ltr" value={f.title_en} onChange={(e) => set({ title_en: e.target.value })} /></label>
            <label>سطر تحته<input className="input" value={f.subtitle_ar} onChange={(e) => set({ subtitle_ar: e.target.value })} /></label>
            <label>Subtitle<input className="input" dir="ltr" value={f.subtitle_en} onChange={(e) => set({ subtitle_en: e.target.value })} /></label>
            <label>نص الزر<input className="input" value={f.button_text_ar} onChange={(e) => set({ button_text_ar: e.target.value })} placeholder="مثلاً: تسوّق الآن" /></label>
            <label>Button<input className="input" dir="ltr" value={f.button_text_en} onChange={(e) => set({ button_text_en: e.target.value })} placeholder="Shop now" /></label>
          </div>
          <label>لما العميل يضغط عليها
            <div className="gh-seg" style={{ width: '100%' }}>{LINKS.map(([k, l]) => <button type="button" key={k} className={f.link_type === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => set({ link_type: k, link_value: '' })}>{l}</button>)}</div>
          </label>
          {f.link_type === 'category' && (
            <select className="input" value={f.link_value} onChange={(e) => set({ link_value: e.target.value })}>
              <option value="">اختر القسم…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name_ar}</option>)}
            </select>
          )}
          {f.link_type === 'brand' && (
            <select className="input" value={f.link_value} onChange={(e) => set({ link_value: e.target.value })}>
              <option value="">اختر البراند…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name_en || b.name_ar}</option>)}
            </select>
          )}
          {f.link_type === 'product' && (
            <div>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={f.link_value ? `المنتج #${f.link_value} · دوّر لتغييره` : 'دوّر باسم المنتج'} />
              {found.length > 0 && <div className="ca-found">{found.map((p) => <button type="button" key={p.id} onClick={() => { set({ link_value: String(p.id) }); setQ(p.name_ar || p.name_en); setFound([]) }}>{p.name_ar || p.name_en} <small>#{p.id}</small></button>)}</div>}
            </div>
          )}
          {f.link_type === 'url' && <input className="input" dir="ltr" value={f.link_value} onChange={(e) => set({ link_value: e.target.value })} placeholder="https://… أو /shop?fast=1" />}
          <label className="ca-check"><input type="checkbox" checked={f.is_active} onChange={(e) => set({ is_active: e.target.checked })} /> تظهر للعملاء</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>إلغاء</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy}>{busy ? <RiLoader4Line className="spin" /> : null} حفظ</button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ───────────────────────── Logo & opening screen ─────────────────────────

function BrandTab() {
  const [s, setS] = useState(null)
  const [busy, setBusy] = useState(null)
  const logoRef = useRef(null)
  const mediaRef = useRef(null)
  const load = () => api.get('/admin/app-customize/splash').then((r) => setS(r.data.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { load() }, [])
  const upLogo = async (file) => {
    if (!file) return
    setBusy('logo')
    const fd = new FormData(); fd.append('logo', file)
    try { await api.post('/admin/app-customize/logo/upload', fd); toast.success('تغيّر الشعار'); load() } catch (e) { toast.error(e.response?.data?.message || 'ما ارتفع') } finally { setBusy(null) }
  }
  const delLogo = async () => {
    if (!window.confirm('نرجع للشعار الأصلي؟')) return
    try { await api.delete('/admin/app-customize/logo'); toast.success('رجع الشعار الأصلي'); load() } catch { toast.error('تعذر') }
  }
  const upMedia = async (file) => {
    if (!file) return
    const type = file.type.startsWith('video') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image'
    setBusy('media')
    const fd = new FormData(); fd.append('media', file); fd.append('media_type', type)
    try { await api.post('/admin/app-customize/splash/upload', fd, { timeout: 300000 }); toast.success('ارتفعت'); load() } catch (e) { toast.error(e.response?.data?.message || 'ما ارتفعت') } finally { setBusy(null) }
  }
  const saveSplash = async (patch) => {
    setS((x) => ({ ...x, ...patch }))
    try { await api.put('/admin/app-customize/splash', patch); toast.success('انحفظ') } catch { toast.error('ما انحفظ'); load() }
  }
  if (!s) return <div className="gh-skel" style={{ height: 300 }} />
  const isVideo = s.media_type === 'video'
  return (
    <div className="ca-grid-cards">
      <div className="card ca-box">
        <div className="ca-box-head"><div style={{ flex: 1 }}><h3>الشعار</h3><p>يطلع فوق في الموقع وفي التطبيق. الأفضل PNG بخلفية شفافة.</p></div><Where where="wa" /></div>
        <div className="ca-logo">
          <div className="ca-logo-box">{s.full_logo_url ? <img src={s.full_logo_url} alt="" /> : <span>الشعار الأصلي</span>}</div>
          <div className="ca-logo-act">
            <button className="btn btn-primary btn-sm" disabled={busy === 'logo'} onClick={() => logoRef.current?.click()}>{busy === 'logo' ? <RiLoader4Line className="spin" /> : <RiUploadCloud2Line />} شعار جديد</button>
            {s.full_logo_url && <button className="btn btn-ghost btn-sm" onClick={delLogo}>رجّع الأصلي</button>}
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => upLogo(e.target.files?.[0])} />
          </div>
        </div>
      </div>
      <div className="card ca-box">
        <div className="ca-box-head">
          <div style={{ flex: 1 }}><h3>شاشة البداية</h3><p>تطلع ثواني لما يفتح التطبيق: صورة أو فيديو قصير.</p></div>
          <Where where="a" />
          <Switch value={on(s.is_active)} onChange={(v) => saveSplash({ is_active: v })} />
        </div>
        <div className="ca-splash">
          <div className="ca-phone">{s.full_media_url ? (isVideo ? <video src={s.full_media_url} muted autoPlay loop playsInline /> : <img src={s.full_media_url} alt="" />) : <span>GH</span>}</div>
          <div className="ca-splash-act">
            <button className="btn btn-primary btn-sm" disabled={busy === 'media'} onClick={() => mediaRef.current?.click()}>{busy === 'media' ? <RiLoader4Line className="spin" /> : <RiUploadCloud2Line />} صورة أو فيديو</button>
            <input ref={mediaRef} type="file" accept="image/*,video/mp4,video/quicktime" hidden onChange={(e) => upMedia(e.target.files?.[0])} />
            <label>المدة
              <div className="gh-seg">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={Number(s.duration_seconds) === n ? 'on' : ''} onClick={() => saveSplash({ duration_seconds: n })}>{n} ث</button>)}</div>
            </label>
            <small>فيديو حتى ٥٠ ميغا. الأفضل عمودي (٩:١٦).</small>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Contact & footer ─────────────────────────

function ContactTab() {
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.get('/admin/app-customize/footer').then((r) => {
      const d = r.data || {}
      setF({
        description_ar: d.description_ar || '', description_en: d.description_en || '', phone: d.phone || '', email: d.email || '',
        address_ar: d.address_ar || '', address_en: d.address_en || '', instagram: d.instagram || '', tiktok: d.tiktok || '', snapchat: d.snapchat || '',
      })
    }).catch(() => toast.error('تعذر التحميل'))
  }, [])
  if (!f) return <div className="gh-skel" style={{ height: 300 }} />
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await api.post('/admin/app-customize/footer', f); toast.success('انحفظ') } catch (err) { toast.error(err.response?.data?.message || 'ما انحفظ') } finally { setBusy(false) }
  }
  return (
    <form className="card ca-box" onSubmit={save}>
      <div className="ca-box-head"><div style={{ flex: 1 }}><h3>التواصل وأسفل الموقع</h3><p>رقم الواتساب وحسابات التواصل والنبذة اللي تطلع تحت في الموقع. فاضي = يبقى الحالي.</p></div><Where where="w" /></div>
      <div className="ca-grid2">
        <label>رقم الواتساب<input className="input" dir="ltr" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="96877246972" /></label>
        <label>الإيميل<input className="input" dir="ltr" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="info@ghshopper.com" /></label>
        <label>إنستقرام<input className="input" dir="ltr" value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="shopper.gh" /></label>
        <label>تيك توك<input className="input" dir="ltr" value={f.tiktok} onChange={(e) => set({ tiktok: e.target.value })} placeholder="اسم الحساب" /></label>
        <label>سناب شات<input className="input" dir="ltr" value={f.snapchat} onChange={(e) => set({ snapchat: e.target.value })} placeholder="اسم الحساب" /></label>
        <label>العنوان<input className="input" value={f.address_ar} onChange={(e) => set({ address_ar: e.target.value })} placeholder="مسقط، عُمان" /></label>
        <label className="ca-span">النبذة بالعربي<textarea className="input" rows={2} value={f.description_ar} onChange={(e) => set({ description_ar: e.target.value })} placeholder="عالم من الفخامة في مكان واحد…" /></label>
        <label className="ca-span">About (English)<textarea className="input" rows={2} dir="ltr" value={f.description_en} onChange={(e) => set({ description_en: e.target.value })} /></label>
      </div>
      <div className="ca-save"><button className="btn btn-primary" disabled={busy}>{busy ? <RiLoader4Line className="spin" /> : null} حفظ</button></div>
    </form>
  )
}

// ───────────────────────── Policies ─────────────────────────

function PoliciesTab() {
  const [list, setList] = useState(null)
  const [type, setType] = useState('about')
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/admin/app-customize/policies').then((r) => setList(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => setList([])) }, [])
  const current = useMemo(() => (list || []).find((p) => p.type === type), [list, type])
  useEffect(() => {
    if (!list) return
    const p = current || {}
    setF({ title_ar: p.title_ar || POLICIES.find((x) => x[0] === type)?.[1] || '', title_en: p.title_en || '', content_ar: p.content_ar || '', content_en: p.content_en || '', is_active: p.id ? on(p.is_active) : true })
  }, [type, list, current])
  if (!list || !f) return <div className="gh-skel" style={{ height: 300 }} />
  const save = async () => {
    setBusy(true)
    try {
      const r = await api.post('/admin/app-customize/policies', { type, ...f })
      setList((l) => [...l.filter((p) => p.type !== type), r.data.data])
      toast.success('انحفظت')
    } catch (e) { toast.error(e.response?.data?.message || 'ما انحفظت') } finally { setBusy(false) }
  }
  return (
    <div className="card ca-box">
      <div className="ca-box-head"><div style={{ flex: 1 }}><h3>صفحات السياسات</h3><p>تطلع في أسفل الموقع وفي حساب العميل في التطبيق.</p></div><Where where="wa" /></div>
      <div className="gh-seg" style={{ flexWrap: 'wrap' }}>{POLICIES.map(([k, l]) => <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}{!(list || []).some((p) => p.type === k && p.content_ar) ? ' ·' : ''}</button>)}</div>
      <div className="ca-grid2">
        <label>العنوان<input className="input" value={f.title_ar} onChange={(e) => setF({ ...f, title_ar: e.target.value })} /></label>
        <label>Title<input className="input" dir="ltr" value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></label>
        <label className="ca-span">المحتوى بالعربي<textarea className="input" rows={12} value={f.content_ar} onChange={(e) => setF({ ...f, content_ar: e.target.value })} /></label>
        <label className="ca-span">Content (English)<textarea className="input" rows={8} dir="ltr" value={f.content_en} onChange={(e) => setF({ ...f, content_en: e.target.value })} /></label>
      </div>
      <div className="ca-save" style={{ justifyContent: 'space-between' }}>
        <label className="ca-check"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> تظهر للعملاء</label>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <RiLoader4Line className="spin" /> : null} حفظ</button>
      </div>
    </div>
  )
}

const CSS = `
.ca-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.ca-tabs{margin-bottom:16px;flex-wrap:wrap}
.ca-tabs button{display:inline-flex;align-items:center;gap:6px}
.ca-col{display:flex;flex-direction:column;gap:16px}
.ca-box{padding:18px 20px;margin:0;display:flex;flex-direction:column;gap:14px}
.ca-box-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.ca-box-head h3{margin:0;font-size:16px;font-weight:700}
.ca-box-head p{margin:3px 0 0;font-size:12.5px;color:var(--text-secondary)}
.ca-ic{color:var(--accent);margin-top:2px}
.ca-where{display:inline-flex;gap:6px;align-items:center}
.ca-where span{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--text-secondary);background:var(--bg-body);border-radius:99px;padding:3px 8px;white-space:nowrap}
.ca-sw{width:46px;height:26px;border-radius:99px;border:0;background:#D9D5CF;position:relative;cursor:pointer;flex-shrink:0;transition:background .2s}
.ca-sw i{position:absolute;top:3px;inset-inline-start:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:inset-inline-start .2s}
.ca-sw.on{background:#5C0B16}.ca-sw.on i{inset-inline-start:23px}
.ca-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ca-grid2 label,.ca-mform>label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}
.ca-span{grid-column:1/-1}
.ca-box .input,.ca-mform .input{min-height:40px;padding:8px 12px}
.ca-save{display:flex;justify-content:flex-end;align-items:center;gap:10px;grid-column:1/-1}
.ca-ann-preview{background:#111;color:#fff;text-align:center;font-size:12.5px;padding:8px;border-radius:8px}
.ca-secs{display:flex;flex-direction:column;gap:6px}
.ca-sec{border:1px solid var(--border);border-radius:12px;background:var(--bg-card)}
.ca-sec.off .ca-sec-main b,.ca-sec.off .ca-num{opacity:.45}
.ca-sec.open{border-color:#CFCAC3}
.ca-sec-row{display:flex;align-items:center;gap:10px;padding:8px 10px}
.ca-arrows{display:flex;flex-direction:column}
.ca-arrows .icon-btn{width:26px;height:22px;padding:0}
.ca-num{width:24px;height:24px;border-radius:50%;background:var(--bg-body);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.ca-sec-main{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;background:none;border:0;cursor:pointer;font-family:inherit;text-align:start;color:inherit;padding:0}
.ca-sec-main b{font-size:14.5px}
.ca-sec-main small{font-size:12px;color:var(--text-secondary)}
.rot{transform:rotate(180deg)}
.ca-form{border-top:1px solid var(--divider);padding:14px;display:flex;flex-direction:column;gap:12px}
.ca-feats{display:flex;flex-direction:column;gap:8px}
.ca-feat{display:grid;grid-template-columns:24px repeat(4,1fr);gap:8px;align-items:center}
.ca-chips{display:flex;flex-direction:column;gap:8px}
.ca-chips small{color:var(--text-secondary)}
.ca-chips>div{display:flex;flex-wrap:wrap;gap:6px}
.ca-chips button{border:1px solid var(--border);background:var(--bg-card);color:inherit;border-radius:99px;padding:5px 12px;font-size:12.5px;cursor:pointer;font-family:inherit}
.ca-chips button.on{background:#5C0B16;border-color:#5C0B16;color:#fff}
.ca-empty{margin:0;color:var(--text-secondary);font-size:13px;background:var(--bg-body);border-radius:10px;padding:16px;text-align:center}
.ca-slides{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.ca-slide{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--bg-card)}
.ca-slide.off{opacity:.55}
.ca-slide-img{aspect-ratio:16/9;background:#1A1A1A;position:relative}
.ca-slide-img img{width:100%;height:100%;object-fit:cover}
.ca-slide-txt{position:absolute;inset-inline:0;bottom:0;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,.65));color:#fff;display:flex;flex-direction:column}
.ca-slide-txt b{font-size:14px}.ca-slide-txt small{font-size:11.5px;opacity:.85}
.ca-slide-bar{display:flex;align-items:center;gap:4px;padding:6px 8px}
.ca-mform{display:flex;flex-direction:column;gap:14px}
.ca-drop{aspect-ratio:16/7;border:1.5px dashed var(--border);border-radius:12px;display:flex !important;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;background:var(--bg-body);color:var(--text-secondary)}
.ca-drop img{width:100%;height:100%;object-fit:cover}
.ca-drop span{display:flex;flex-direction:column;align-items:center;gap:6px;font-weight:500}
.ca-found{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:10px;margin-top:6px;overflow:hidden}
.ca-found button{border:0;border-bottom:1px solid var(--divider);background:var(--bg-card);color:inherit;padding:8px 12px;text-align:start;cursor:pointer;font-family:inherit}
.ca-found small{color:var(--text-light)}
.ca-check{flex-direction:row !important;align-items:center;gap:8px !important;font-weight:500 !important;cursor:pointer}
.ca-grid-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ca-logo{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.ca-logo-box{width:140px;height:140px;border-radius:14px;background:#0D0D0D;display:flex;align-items:center;justify-content:center;padding:14px;color:#C9A465}
.ca-logo-box img{max-width:100%;max-height:100%;object-fit:contain}
.ca-logo-act{display:flex;flex-direction:column;gap:8px}
.ca-splash{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.ca-phone{width:130px;aspect-ratio:9/19;border-radius:22px;border:5px solid #1A1A1A;background:#350304;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#C9A465;font-size:26px;font-weight:700}
.ca-phone img,.ca-phone video{width:100%;height:100%;object-fit:cover}
.ca-splash-act{display:flex;flex-direction:column;gap:12px;font-size:13px;font-weight:600}
.ca-splash-act label{display:flex;flex-direction:column;gap:6px}
.ca-splash-act small{color:var(--text-secondary);font-weight:400}
@media(max-width:900px){.ca-grid2,.ca-grid-cards{grid-template-columns:1fr}.ca-feat{grid-template-columns:24px 1fr 1fr}.ca-where{display:none}}
`
