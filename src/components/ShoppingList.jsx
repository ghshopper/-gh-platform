import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RiPrinterLine, RiCloseLine, RiCheckLine, RiPencilLine, RiStore2Line } from 'react-icons/ri'
import api from '../services/api'

const API = import.meta.env.VITE_API_URL
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
const PLACES = { boutique_eu: 'بوتيك أوروبا', dubai: 'دبي', airport: 'المطار', other: 'مكان ثاني' }
const CURRENCIES = ['EUR', 'AED', 'GBP', 'USD', 'CHF', 'SAR', 'OMR']
const NO_STORE = 'بدون مكان محدد'

/**
 * The buying list of a trip: every piece still to buy, with where it will be
 * bought and roughly for how much (the plan), so the total to pay is known
 * before the trip. Grouped by shop or by brand. Print it, or tick pieces off
 * as you buy them; the real price is recorded at purchase in the admin app.
 */
export default function ShoppingList({ tripId, onClose }) {
  const [d, setD] = useState(null)
  const [done, setDone] = useState({})
  const [by, setBy] = useState('store')
  const [edit, setEdit] = useState(null) // item id
  const load = () => api.get('/admin/trips-report/shopping', { params: { trip_id: tripId || 'all' } }).then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { load() }, [tripId]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => (d ? d.groups.flatMap((g) => g.items) : []), [d])
  const stores = useMemo(() => [...new Set(items.map((i) => i.plan_store).filter(Boolean))], [items])
  const groups = useMemo(() => {
    if (!d) return []
    if (by === 'brand') return d.groups.map((g) => ({ key: g.brand, title: g.brand, items: g.items }))
    const m = new Map()
    for (const i of items) {
      const k = i.plan_store || NO_STORE
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(i)
    }
    return [...m.entries()].sort((a, b) => (a[0] === NO_STORE) - (b[0] === NO_STORE) || b[1].length - a[1].length)
      .map(([k, v]) => ({ key: k, title: k, place: v.find((i) => i.plan_place)?.plan_place, items: v, none: k === NO_STORE }))
  }, [d, by, items])

  const save = async (rows, msg = 'انحفظ') => {
    try {
      await api.post('/ps/items/plan', { items: rows })
      toast.success(msg)
      setEdit(null)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'تعذر الحفظ') }
  }
  const storeForAll = (g) => {
    const name = window.prompt(`وين بتشتري قطع «${g.title}»؟ (اسم المحل أو المول)`, g.items.find((i) => i.plan_store)?.plan_store || '')
    if (name == null) return
    save(g.items.map((i) => ({ id: i.id, store: name })), 'تحدد المكان')
  }

  const tick = async (i) => {
    if (done[i.id]) return
    setDone((x) => ({ ...x, [i.id]: 'busy' }))
    try {
      const r = await fetch(`${API}/ps/items/status`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token'), Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [i.id], status: 'purchased' }),
      })
      if (!r.ok) throw new Error()
      setDone((x) => ({ ...x, [i.id]: true }))
      toast.success('تم الشراء ✓ (أكّد السعر الفعلي من تطبيق الإدارة)')
    } catch {
      setDone((x) => { const y = { ...x }; delete y[i.id]; return y })
      toast.error('تعذر')
    }
  }

  const t = d?.totals
  const sub = (list) => list.reduce((s, i) => s + (i.est?.omr || 0), 0)

  return (
    <div className="sl-back" onMouseDown={onClose}>
      <div className="sl-sheet" onMouseDown={(e) => e.stopPropagation()} dir="rtl">
        <div className="sl-bar no-print">
          <b>قائمة التسوق</b>
          <div className="gh-seg" style={{ marginInlineStart: 8 }}>
            <button className={by === 'store' ? 'on' : ''} onClick={() => setBy('store')}>حسب المحل</button>
            <button className={by === 'brand' ? 'on' : ''} onClick={() => setBy('brand')}>حسب البراند</button>
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}><RiPrinterLine /> طباعة / PDF</button>
          <button className="icon-btn" onClick={onClose}><RiCloseLine size={22} /></button>
        </div>
        {!d ? <div className="gh-skel" style={{ height: 300, margin: 20 }} /> : (
          <div className="sl-page">
            <div className="sl-head">
              <h2>{d.trip?.name}</h2>
              <span>{[d.trip?.destination, d.trip?.starts_on].filter(Boolean).join(' · ')} · {d.count} قطعة</span>
            </div>

            {d.count > 0 && t && (
              <div className="sl-sum">
                <div className="sl-sum-main">
                  <small>تقريباً بتدفع</small>
                  <b>{money(t.omr)} <i>ر.ع</i></b>
                  <div className="sl-cur">{t.by_currency.map((c) => <span key={c.currency} dir="ltr">{num(c.amount)} {c.currency}</span>)}</div>
                </div>
                <div><small>تاكس فري متوقع</small><b className="green">− {money(t.tax_free)}</b></div>
                <div><small>الصافي بعد التاكس فري</small><b>{money(t.net)}</b></div>
                <div><small>بيعها للعملاء</small><b>{money(t.sales_estimated)}</b></div>
                <div><small>ربح تقريبي</small><b className={t.profit < 0 ? 'red' : 'green'}>{money(t.profit)}</b>{t.margin != null && <em>هامش {t.margin}%</em>}</div>
                {t.missing > 0 && <p className="sl-miss">{t.missing} قطعة ما لها سعر تقريبي — ما داخلة في المجموع. اضغط ✎ عندها وحط وين وبكم.</p>}
                <p className="sl-note">تقريبي: من السعر اللي حطيته لكل قطعة، أو سعر البوتيك في الطلب. السعر الفعلي يتأكد وقت الشراء.</p>
              </div>
            )}

            {d.count === 0 ? <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>ما فيه قطع تنتظر الشراء 👌</p> : groups.map((g) => (
              <div key={g.key} className="sl-group">
                <h3 className={g.none ? 'none' : ''}>
                  <span>{g.title} <small>{g.items.length} قطعة{g.place ? ' · ' + PLACES[g.place] : ''}</small></span>
                  <span className="sl-sub">{sub(g.items) > 0 ? `≈ ${money(sub(g.items))} ر.ع` : ''}</span>
                  {by === 'brand' && <button className="sl-hbtn no-print" onClick={() => storeForAll(g)} title="مكان واحد لكل قطع البراند"><RiStore2Line /> المكان للكل</button>}
                </h3>
                {g.items.map((i) => (
                  <div key={i.id}>
                    <div className={`sl-item ${done[i.id] === true ? 'done' : ''}`}>
                      <button className="sl-check" onClick={() => tick(i)} title="اشتريتها">{done[i.id] === true ? <RiCheckLine /> : null}</button>
                      <div className="sl-img">{i.image ? <img src={i.image} alt="" /> : null}</div>
                      <div className="sl-info">
                        <b>{by === 'store' && i.brand ? <em>{i.brand} · </em> : null}{i.name}</b>
                        {i.details && <span>{i.details}</span>}
                        {i.sku && <span dir="ltr">{i.sku}</span>}
                        {by === 'brand' && i.plan_store && <span className="sl-store"><RiStore2Line /> {i.plan_store}{i.plan_place ? ' · ' + PLACES[i.plan_place] : ''}</span>}
                        <span className="sl-meta">#{i.ref} · {i.customer || '—'}{i.ordered_at ? ' · طلب ' + i.ordered_at : ''}</span>
                      </div>
                      <div className="sl-price">
                        {i.est ? (
                          <>
                            <b dir="ltr">{num(i.est.amount)} {i.est.currency}</b>
                            <span>≈ {money(i.est.omr)} ر.ع{i.est.source === 'list' ? ' · سعر البوتيك' : ''}</span>
                          </>
                        ) : <b className="sl-none">بدون سعر</b>}
                        <span>{money(i.price)} ر.ع للعميل</span>
                      </div>
                      <button className="icon-btn no-print" onClick={() => setEdit(edit === i.id ? null : i.id)} title="وين وبكم"><RiPencilLine /></button>
                    </div>
                    {edit === i.id && <PlanForm item={i} stores={stores} onCancel={() => setEdit(null)} onSave={(row) => save([{ id: i.id, ...row }])} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
.sl-back{position:fixed;inset:0;z-index:500;background:rgba(17,17,17,.4);display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:30px 12px}
.sl-sheet{background:#fff;width:100%;max-width:900px;border-radius:14px;overflow:hidden}
.sl-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:#fff;z-index:2;flex-wrap:wrap}
.sl-page{padding:20px 24px}
.sl-head h2{margin:0;font-size:22px}
.sl-head span{font-size:13px;color:#777}
.sl-sum{margin-top:16px;display:grid;grid-template-columns:1.6fr repeat(4,1fr);gap:8px;break-inside:avoid}
.sl-sum>div{background:#F7F5F2;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.sl-sum small{font-size:11.5px;color:#777}
.sl-sum b{font-size:15px;direction:ltr;unicode-bidi:isolate;text-align:right;white-space:nowrap}
.sl-sum em{font-style:normal;font-size:11px;color:#999}
.sl-sum-main{background:#4A0A12!important;color:#F2E3C8}
.sl-sum-main small{color:#E9D5B5!important}
.sl-sum-main b{font-size:24px}
.sl-sum-main i{font-style:normal;font-size:12px;opacity:.8}
.sl-cur{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.sl-cur span{font-size:11.5px;background:rgba(255,255,255,.14);border-radius:99px;padding:1px 8px}
.sl-sum .green{color:#047857}.sl-sum .red{color:#B42318}
.sl-miss{grid-column:1/-1;margin:0;font-size:12.5px;color:#B45309}
.sl-note{grid-column:1/-1;margin:0;font-size:11.5px;color:#999}
.sl-group{margin-top:20px;break-inside:avoid-page}
.sl-group h3{margin:0 0 8px;font-size:16px;background:#4A0A12;color:#F2E3C8;padding:8px 12px;border-radius:8px;display:flex;align-items:center;gap:10px}
.sl-group h3>span:first-child{flex:1}
.sl-group h3.none{background:#EDE9E4;color:#555}
.sl-group h3 small{font-weight:400;opacity:.8;font-size:12px}
.sl-sub{font-size:13px;font-weight:600;direction:ltr;unicode-bidi:isolate}
.sl-hbtn{border:0;background:rgba(255,255,255,.15);color:inherit;border-radius:6px;padding:3px 8px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit}
.sl-item{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid #eee;break-inside:avoid}
.sl-item.done{opacity:.45}
.sl-item.done b{text-decoration:line-through}
.sl-check{width:26px;height:26px;border:1.5px solid #111;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.sl-item.done .sl-check{background:#111;color:#fff}
.sl-img{width:64px;height:64px;border-radius:8px;background:#F4F3F1;overflow:hidden;flex-shrink:0}
.sl-img img{width:100%;height:100%;object-fit:cover}
.sl-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13px}
.sl-info b{font-size:14px}
.sl-info b em{font-style:normal;color:#7A1A26}
.sl-info span{color:#555}
.sl-store{display:flex;align-items:center;gap:4px;color:#7A1A26!important;font-size:12px}
.sl-meta{font-size:12px;color:#999!important}
.sl-info span[dir=ltr]{align-self:flex-start}
.sl-price{text-align:left;display:flex;flex-direction:column;gap:2px;font-size:12.5px;white-space:nowrap}
.sl-price span{color:#777}
.sl-none{color:#B45309;font-weight:600}
.sl-form{display:grid;grid-template-columns:1.6fr 1fr 1fr .8fr auto;gap:8px;align-items:end;background:#F7F5F2;border-radius:10px;padding:10px 12px;margin:6px 0 10px}
.sl-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#555}
.sl-form .input{height:36px;padding:0 10px}
.sl-form-btns{display:flex;gap:6px}
@media(max-width:600px){.sl-item{flex-wrap:wrap}.sl-info{flex-basis:calc(100% - 120px)}.sl-price{flex:1;flex-direction:row;flex-wrap:wrap;gap:4px 12px;padding-inline-start:38px;white-space:normal}.sl-img{width:52px;height:52px}}
@media(max-width:760px){.sl-sum{grid-template-columns:1fr 1fr}.sl-sum-main{grid-column:1/-1}.sl-form{grid-template-columns:1fr 1fr}.sl-form label:first-child{grid-column:1/-1}.sl-form-btns{grid-column:1/-1}}
@media print{
  body *{visibility:hidden}
  .sl-back,.sl-back *{visibility:visible}
  .sl-back{position:absolute;inset:0;background:#fff;padding:0;overflow:visible;display:block}
  .sl-sheet{max-width:none;border-radius:0}
  .no-print{display:none!important}
  .sl-group h3,.sl-sum>div{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`}</style>
    </div>
  )
}

/** Where and roughly how much: shop name, place (for the tax-free), price and currency. */
function PlanForm({ item, stores, onSave, onCancel }) {
  const [f, setF] = useState({
    store: item.plan_store || '',
    place: item.plan_place || '',
    cost: item.est_cost ?? (item.list_price || ''),
    currency: item.est_currency || item.list_currency || 'EUR',
  })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    onSave({ store: f.store, place: f.place || null, cost: f.cost === '' ? null : Number(f.cost), currency: f.cost === '' ? null : f.currency })
  }
  const listId = 'sl-stores-' + item.id
  return (
    <form className="sl-form no-print" onSubmit={submit}>
      <label>وين بتشتريها
        <input className="input" list={listId} value={f.store} onChange={set('store')} placeholder="مثلاً: Dior Champs-Élysées" autoFocus />
        <datalist id={listId}>{stores.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <label>المكان
        <select className="input" value={f.place} onChange={set('place')}>
          <option value="">—</option>
          {Object.entries(PLACES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>بكم تقريباً<input className="input" type="number" min="0" step="any" dir="ltr" value={f.cost} onChange={set('cost')} /></label>
      <label>العملة
        <select className="input" value={f.currency} onChange={set('currency')}>
          {[...new Set([f.currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="sl-form-btns">
        <button className="btn btn-primary btn-sm" type="submit">حفظ</button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>إلغاء</button>
      </div>
    </form>
  )
}
