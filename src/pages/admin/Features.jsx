import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RiHeart3Line, RiPriceTag3Line, RiNotification3Line, RiWallet3Line, RiGiftLine, RiVipCrownLine,
  RiCameraLine, RiStarSmileLine, RiChat3Line, RiSparklingLine, RiCloseLine, RiLoader4Line, RiArrowLeftSLine,
} from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import { FEATURE_NAMES, setFeatures } from '../../lib/features'

/**
 * المميزات: the owner switches each customer feature on/off and sets its options.
 * GET /admin/features → the full object; PUT /admin/features with a partial object → the full object.
 * A feature that is off disappears from the website and the app.
 */
const FEATURES = [
  { key: 'wishlist_alerts', icon: RiHeart3Line, desc: 'نبلّغ العميل إذا نزل سعر قطعة في مفضلته أو رجعت متوفرة، وزر «نبّهني إذا توفرت» للقطع اللي خلصت.' },
  { key: 'quotes', icon: RiPriceTag3Line, desc: 'لما تلقى قطعة طلبها العميل، ترسل له سعرها في التطبيق والموقع، ويقبل العرض ويدفع بضغطة.', link: ['/admin/product-requests', 'طلبات القطع'],
    fields: [{ k: 'expires_days', l: 'صلاحية العرض (أيام)', t: 'int', min: 1, max: 60 }] },
  { key: 'smart_push', icon: RiNotification3Line, desc: 'إشعارات مراحل الطلب لطلبات تطبيق الإدارة (اشترينا، وصلت عُمان، في الطريق، تم التسليم) وإشعار صورة القطعة.' },
  { key: 'wallet', icon: RiWallet3Line, desc: 'رصيد للعميل يشحنه بالبطاقة أو يحوّل له نقاطه، ويدفع منه في الطلبات وروابط الدفع. تقدر تضيف أو تخصم من ملف العميل.', link: ['/admin/customers', 'العملاء'],
    fields: [
      { k: 'points_convert', l: 'تحويل النقاط لرصيد', t: 'bool' },
      { k: 'topup', l: 'شحن الرصيد بالبطاقة', t: 'bool' },
      { k: 'topup_min', l: 'أقل شحن (ر.ع)', t: 'int', min: 1 },
      { k: 'topup_max', l: 'أعلى شحن (ر.ع)', t: 'int', min: 1 },
    ] },
  { key: 'gifts', icon: RiGiftLine, desc: 'العميل يرسل طلبه هدية: اسم المستلم ورقمه، رسالة، تغليف، وإخفاء الأسعار من الفاتورة.',
    fields: [
      { k: 'wrap', l: 'تغليف الهدية', t: 'bool' },
      { k: 'wrap_fee', l: 'رسوم التغليف (ر.ع)', t: 'money' },
    ] },
  { key: 'vip_progress', icon: RiVipCrownLine, desc: 'بطاقة في الرئيسية وحسابي: مستوى العميل، شريط التقدّم، وكم نقطة باقي له للمستوى اللي بعده.' },
  { key: 'purchase_photos', icon: RiCameraLine, desc: 'العميل يشوف صورة قطعته وفاتورة المحل في طلباته أول ما ترفعها.' },
  { key: 'reviews', icon: RiStarSmileLine, desc: 'تقييم المنتجات بالنجوم، وتقييم الخدمة بعد التسليم مع قسم «آراء عملائنا». التقييمات تنتظر موافقتك قبل ما تظهر.', link: ['/admin/reviews', 'التقييمات'],
    fields: [{ k: 'service', l: 'تقييم الخدمة بعد التسليم', t: 'bool' }] },
  { key: 'chat', icon: RiChat3Line, desc: 'محادثة مباشرة بين العميل والفريق من التطبيق والموقع، مع الصور والسؤال عن طلب أو قطعة.', link: ['/admin/chats', 'المحادثات'],
    fields: [
      { k: 'welcome_ar', l: 'رسالة الترحيب', t: 'text', span: true },
      { k: 'welcome_en', l: 'Welcome message', t: 'text', ltr: true, span: true },
      { k: 'hours_ar', l: 'أوقات الرد', t: 'text' },
      { k: 'hours_en', l: 'Reply hours', t: 'text', ltr: true },
    ] },
  { key: 'weekly_new', icon: RiSparklingLine, desc: 'فقاعات «ستوري» في أعلى الرئيسية بآخر القطع اللي وصلت. القطع المثبّتة تطلع أول.',
    fields: [
      { k: 'title_ar', l: 'العنوان', t: 'text' },
      { k: 'title_en', l: 'Title', t: 'text', ltr: true },
      { k: 'days', l: 'القطع المضافة خلال (أيام)', t: 'int', min: 1, max: 90 },
      { k: 'max', l: 'أكثر عدد قطع', t: 'int', min: 1, max: 60 },
      { k: 'product_ids', l: 'قطع مثبّتة', t: 'products', span: true },
    ] },
]

const unwrap = (d) => (d && d.data && typeof d.data === 'object' && !Array.isArray(d.data) && !('on' in d.data) ? d.data : d)

export default function Features() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    api.get('/admin/features')
      .then((r) => setData(unwrap(r.data) || {}))
      .catch((e) => { toast.error(e.response?.data?.message || 'تعذّر تحميل المميزات'); setData({}) })
  }, [])

  const save = async (key, patch, msg) => {
    setBusy(key)
    try {
      const r = await api.put('/admin/features', { [key]: patch })
      const next = unwrap(r.data) || {}
      setData(next); setFeatures(next)
      toast.success(msg || 'انحفظ')
      return true
    } catch (e) {
      toast.error(e.response?.data?.message || 'ما انحفظ')
      return false
    } finally { setBusy('') }
  }

  const onCount = data ? FEATURES.filter((f) => data[f.key]?.on).length : 0

  return (
    <div className="page ft" dir="rtl">
      <div className="ft-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>المميزات</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>شغّل أو وقّف أي ميزة للعملاء. الميزة الموقّفة تختفي من الموقع والتطبيق خلال دقيقة.</p>
        </div>
        {data && <span className="ft-count">{onCount} من {FEATURES.length} مفعّلة</span>}
      </div>
      {!data ? <div className="gh-skel" style={{ height: 420 }} /> : (
        <div className="ft-grid">
          {FEATURES.map((f) => (
            <FeatureCard key={f.key} meta={f} cfg={data[f.key] || {}} busy={busy === f.key} save={(p, m) => save(f.key, p, m)} />
          ))}
        </div>
      )}
      <style>{CSS}</style>
    </div>
  )
}

function Switch({ value, onChange, disabled, small }) {
  return (
    <button type="button" className={`ft-sw ${value ? 'on' : ''} ${small ? 'sm' : ''}`} onClick={() => onChange(!value)} disabled={disabled} aria-pressed={!!value}>
      <i />
    </button>
  )
}

function FeatureCard({ meta, cfg, busy, save }) {
  const Icon = meta.icon
  const on = !!cfg.on
  const pick = () => Object.fromEntries((meta.fields || []).map((x) => [x.k, cfg[x.k]]))
  const [f, setF] = useState(pick)
  useEffect(() => { setF(pick()) }, [cfg]) // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (v) => (Array.isArray(v) ? JSON.stringify(v) : String(v ?? ''))
  const dirty = (meta.fields || []).some((x) => norm(f[x.k]) !== norm(cfg[x.k]))
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const submit = () => {
    const body = {}
    for (const x of meta.fields) {
      let v = f[x.k]
      if (x.t === 'int') {
        v = parseInt(v, 10)
        if (!Number.isFinite(v)) return toast.error(`اكتب رقم في «${x.l}»`)
        if (x.min != null && v < x.min) return toast.error(`«${x.l}» أقل شي ${x.min}`)
        if (x.max != null && v > x.max) return toast.error(`«${x.l}» أكثر شي ${x.max}`)
      } else if (x.t === 'money') {
        v = Number(v)
        if (!Number.isFinite(v) || v < 0) return toast.error(`اكتب مبلغ صحيح في «${x.l}»`)
      } else if (x.t === 'text') v = String(v ?? '').trim()
      body[x.k] = v
    }
    if (meta.key === 'wallet' && body.topup_max < body.topup_min) return toast.error('أعلى شحن لازم يكون أكبر من أقل شحن')
    save(body, 'انحفظت الإعدادات')
  }

  return (
    <div className={`card ft-card ${on ? 'is-on' : ''}`}>
      <div className="ft-card-head">
        <span className="ft-ic"><Icon size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{FEATURE_NAMES[meta.key]}</h3>
          <p>{meta.desc}</p>
        </div>
        {busy ? <RiLoader4Line className="spin" size={20} style={{ color: 'var(--text-secondary)', marginTop: 3 }} /> : null}
        <Switch value={on} disabled={busy} onChange={(v) => save({ on: v }, v ? `«${FEATURE_NAMES[meta.key]}» تشتغل الحين` : `وقّفنا «${FEATURE_NAMES[meta.key]}»`)} />
      </div>
      {meta.fields && (
        <div className={`ft-fields ${on ? '' : 'dim'}`}>
          {meta.fields.map((x) => (
            <Field key={x.k} x={x} v={f[x.k]} set={(v) => set(x.k, v)} />
          ))}
          <div className="ft-save">
            {dirty && <button className="btn btn-ghost btn-sm" onClick={() => setF(pick())}>تراجع</button>}
            <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={submit}>حفظ الإعدادات</button>
          </div>
        </div>
      )}
      {meta.link && on && (
        <Link to={meta.link[0]} className="ft-link">{meta.link[1]} <RiArrowLeftSLine /></Link>
      )}
    </div>
  )
}

function Field({ x, v, set }) {
  if (x.t === 'bool') {
    return (
      <div className={`ft-bool ${x.span ? 'span' : ''}`}>
        <span>{x.l}</span>
        <Switch small value={!!v} onChange={set} />
      </div>
    )
  }
  if (x.t === 'products') return <div className="span"><ProductPicker label={x.l} ids={Array.isArray(v) ? v : []} onChange={set} /></div>
  return (
    <label className={x.span ? 'span' : ''}>
      {x.l}
      <input
        className="input" dir={x.ltr || x.t !== 'text' ? 'ltr' : 'rtl'}
        type={x.t === 'text' ? 'text' : 'number'} inputMode={x.t === 'money' ? 'decimal' : x.t === 'int' ? 'numeric' : undefined}
        step={x.t === 'money' ? '0.001' : x.t === 'int' ? '1' : undefined} min={x.min} max={x.max}
        maxLength={x.t === 'text' ? 300 : undefined}
        value={v ?? ''} onChange={(e) => set(e.target.value)}
      />
    </label>
  )
}

// Pinned products for "جديدنا هذا الأسبوع": search /admin/products, keep the ids in order.
const names = {}
function ProductPicker({ label, ids, onChange }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState([])
  const [, bump] = useState(0)

  useEffect(() => {
    const missing = ids.filter((id) => !names[id])
    if (!missing.length) return
    Promise.all(missing.map((id) => api.get(`/admin/products/${id}`).then((r) => {
      const p = r.data?.data && r.data.data.id ? r.data.data : r.data
      if (p?.id) names[id] = p
    }).catch(() => { names[id] = { id, missing: true } }))).then(() => bump((n) => n + 1))
  }, [ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => api.get('/admin/products', { params: { search: q.trim(), per_page: 8 } })
      .then((r) => setFound(r.data?.data || [])).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [q])

  const add = (p) => {
    names[p.id] = p
    if (!ids.includes(p.id)) onChange([...ids, p.id])
    setQ(''); setFound([])
  }
  const remove = (id) => onChange(ids.filter((x) => x !== id))
  const title = (p) => [p.brand_name_en || p.brand_name_ar, p.name_ar || p.name_en].filter(Boolean).join(' · ') || `#${p.id}`

  return (
    <div className="ft-picker">
      <span className="ft-picker-l">{label} <small>(تطلع أول بنفس الترتيب)</small></span>
      {ids.length > 0 ? (
        <div className="ft-chips">
          {ids.map((id) => {
            const p = names[id]
            return (
              <span key={id} className={`ft-chip ${p?.missing ? 'bad' : ''}`}>
                {p?.primary_image ? <img src={getImageUrl(p.primary_image)} alt="" /> : null}
                <span>{p ? (p.missing ? `#${id} (محذوف؟)` : title(p)) : `#${id}`}</span>
                <button type="button" onClick={() => remove(id)} title="شيل"><RiCloseLine /></button>
              </span>
            )
          })}
        </div>
      ) : <div className="ft-none">ما فيه قطع مثبّتة. تطلع آخر القطع المضافة تلقائياً.</div>}
      <div style={{ position: 'relative' }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر باسم القطعة أو البراند لتثبيتها…" />
        {found.length > 0 && (
          <div className="ft-found">
            {found.map((p) => (
              <button type="button" key={p.id} onClick={() => add(p)} disabled={ids.includes(p.id)}>
                {p.primary_image ? <img src={getImageUrl(p.primary_image)} alt="" /> : <i />}
                <span>{title(p)}</span>
                <small>{ids.includes(p.id) ? 'مثبّتة' : `#${p.id}`}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const CSS = `
.ft-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.ft-count{font-size:12.5px;font-weight:600;color:var(--text-secondary);background:var(--bg-card);border:1px solid var(--border);border-radius:99px;padding:6px 12px}
.ft-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.ft-card{margin:0;padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.ft-card-head{display:flex;align-items:flex-start;gap:12px}
.ft-card-head h3{margin:0;font-size:16px;font-weight:700;color:var(--text-primary)}
.ft-card-head p{margin:4px 0 0;font-size:12.5px;line-height:1.7;color:var(--text-secondary)}
.ft-ic{width:40px;height:40px;border-radius:12px;background:var(--bg-body);color:var(--text-secondary);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.ft-card.is-on .ft-ic{background:var(--color-gold-bg,#FBF5EA);color:var(--accent,#A8833F)}
.ft-sw{width:46px;height:26px;border-radius:99px;border:0;background:#D9D5CF;position:relative;cursor:pointer;flex-shrink:0;transition:background .2s;margin-top:4px}
.ft-sw i{position:absolute;top:3px;inset-inline-start:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:inset-inline-start .2s}
.ft-sw.on{background:#5C0B16}.ft-sw.on i{inset-inline-start:23px}
.ft-sw.sm{width:38px;height:22px;margin:0}.ft-sw.sm i{width:16px;height:16px}.ft-sw.sm.on i{inset-inline-start:19px}
.ft-sw:disabled{opacity:.6;cursor:wait}
html[data-theme="dark"] .ft-sw{background:#3A3A40}html[data-theme="dark"] .ft-sw.on{background:#C9A465}
.ft-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid var(--divider);padding-top:14px}
.ft-fields.dim{opacity:.6}
.ft-fields label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:600;color:var(--text-secondary)}
.ft-fields .input{min-height:40px;padding:8px 12px;font-size:14px}
.ft-fields .span{grid-column:1/-1}
.ft-bool{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:600;color:var(--text-primary);background:var(--bg-body);border-radius:10px;padding:9px 12px}
.ft-save{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}
.ft-link{align-self:flex-start;display:inline-flex;align-items:center;gap:2px;font-size:12.5px;font-weight:700;color:var(--accent,#A8833F);text-decoration:none}
.ft-picker{display:flex;flex-direction:column;gap:8px}
.ft-picker-l{font-size:12.5px;font-weight:600;color:var(--text-secondary)}
.ft-picker-l small{font-weight:400;color:var(--text-light)}
.ft-chips{display:flex;flex-wrap:wrap;gap:6px}
.ft-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--bg-card);border-radius:99px;padding:3px 4px 3px 10px;font-size:12.5px;max-width:100%}
.ft-chip img{width:22px;height:22px;border-radius:50%;object-fit:cover}
.ft-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
.ft-chip button{border:0;background:var(--bg-body);color:var(--text-secondary);border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.ft-chip.bad{border-color:#FCA5A5;color:#B91C1C}
.ft-none{font-size:12.5px;color:var(--text-secondary);background:var(--bg-body);border-radius:10px;padding:10px 12px}
.ft-found{position:absolute;inset-inline:0;top:calc(100% + 4px);z-index:20;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-card);box-shadow:var(--shadow-lg,0 10px 30px rgba(0,0,0,.12))}
.ft-found button{display:flex;align-items:center;gap:10px;border:0;border-bottom:1px solid var(--divider);background:var(--bg-card);color:inherit;padding:8px 12px;text-align:start;cursor:pointer;font-family:inherit;font-size:13px}
.ft-found button:disabled{opacity:.5;cursor:default}
.ft-found img,.ft-found i{width:32px;height:32px;border-radius:8px;object-fit:cover;background:var(--bg-body);flex-shrink:0}
.ft-found span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ft-found small{color:var(--text-light)}
@media(max-width:1000px){.ft-grid{grid-template-columns:1fr}}
@media(max-width:560px){.ft-fields{grid-template-columns:1fr}.ft-card{padding:16px}}
`
