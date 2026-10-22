import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiCloseLine, RiDeleteBinLine, RiHistoryLine, RiUserAddLine } from 'react-icons/ri'
import api from '../../services/api'

// Old orders typed in when there's time: on their own date, every piece
// delivered and paid, and nothing is sent to the customer.
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Muscat' })
const day = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-OM', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const keep = {
  get: (k, d) => { try { return localStorage.getItem('past_' + k) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem('past_' + k, v) } catch { /* private window */ } },
}
const METHODS = ['تحويل بنكي', 'نقداً', 'أموال', 'رابط دفع']
const CURRENCIES = [['OMR', 'ريال عماني'], ['AED', 'درهم إماراتي'], ['EUR', 'يورو'], ['USD', 'دولار'], ['SAR', 'ريال سعودي'], ['GBP', 'جنيه إسترليني']]
const emptyItem = () => ({ brand: '', name: '', price: '', cost: '' })

export default function PastOrders() {
  const [date, setDate] = useState(() => keep.get('date', today()))
  const [method, setMethod] = useState(() => keep.get('method', 'تحويل بنكي'))
  const [cust, setCust] = useState(null) // picked customer
  const [isNew, setIsNew] = useState(false)
  const [nc, setNc] = useState({ name: '', phone: '' })
  const [q, setQ] = useState('')
  const [found, setFound] = useState([])
  const [items, setItems] = useState([emptyItem()])
  const [fee, setFee] = useState('')
  const [discount, setDiscount] = useState('')
  const [partial, setPartial] = useState(false)
  const [paid, setPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [opts, setOpts] = useState(null)
  const [cur, setCur] = useState(() => keep.get('cur', 'OMR'))
  const [rate, setRate] = useState('')
  const [points, setPoints] = useState(() => keep.get('points', '0') === '1')
  const [recent, setRecent] = useState(null)
  const firstItem = useRef(null)

  const loadRecent = () => api.get('/ps/past-orders').then((r) => setRecent(r.data.data)).catch(() => setRecent([]))
  useEffect(() => { loadRecent(); api.get('/ps/past-orders/options').then((r) => setOpts(r.data)).catch(() => setOpts({ rates: {}, loyalty: null })) }, [])
  useEffect(() => { if (opts) setRate(cur === 'OMR' ? '1' : String(opts.rates?.[cur] ?? '')) }, [cur, opts])
  useEffect(() => {
    if (cust || isNew || q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => api.get('/ps/past-orders/customers', { params: { q } }).then((r) => setFound(r.data.data)).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [q, cust, isNew])

  const r = cur === 'OMR' ? 1 : Number(rate) || 0
  const omr = (v) => Math.round((Number(v) || 0) * r * 1000) / 1000
  const total = items.reduce((s, i) => s + omr(i.price), 0) + (Number(fee) || 0) - (Number(discount) || 0)
  const estPoints = opts?.loyalty ? Math.floor(Math.max(0, Math.floor(total)) * opts.loyalty.per_omr) : 0
  const setItem = (k, f, v) => setItems((xs) => xs.map((x, i) => (i === k ? { ...x, [f]: v } : x)))
  const onItemKey = (e, k) => {
    if (e.key === 'Enter') { e.preventDefault(); if (k === items.length - 1) setItems((xs) => [...xs, emptyItem()]) }
  }

  const reset = () => {
    setCust(null); setIsNew(false); setNc({ name: '', phone: '' }); setQ(''); setItems([emptyItem()])
    setFee(''); setDiscount(''); setPartial(false); setPaid(''); setNotes('')
  }

  const save = async (e) => {
    e.preventDefault()
    const list = items.filter((i) => i.name.trim())
    if (!cust && !(isNew && nc.name.trim())) return toast.error('اختار العميل أو ضيف عميل جديد')
    if (!list.length) return toast.error('اكتب قطعة وحدة على الأقل')
    if (list.some((i) => i.price === '' || isNaN(Number(i.price)))) return toast.error('اكتب سعر كل قطعة')
    if (cur !== 'OMR' && !(Number(rate) > 0)) return toast.error('اكتب سعر الصرف')
    setBusy(true)
    try {
      const r = await api.post('/ps/past-orders', {
        customer_id: cust?.id || null,
        customer_name: isNew ? nc.name.trim() : null,
        customer_phone: isNew ? nc.phone.trim() || null : null,
        date,
        items: list.map((i) => ({ brand: i.brand.trim() || null, name: i.name.trim(), price: Number(i.price), cost: i.cost === '' ? null : Number(i.cost) })),
        delivery_fee: Number(fee) || 0,
        discount: Number(discount) || 0,
        paid: partial ? Number(paid) || 0 : null,
        method,
        currency: cur,
        rate: cur === 'OMR' ? null : Number(rate),
        points,
        notes: notes.trim() || null,
      })
      keep.set('date', date); keep.set('method', method); keep.set('cur', cur); keep.set('points', points ? '1' : '0')
      toast.success(`انضاف طلب #${r.data.order_no}` + (r.data.points ? ` · ${r.data.points} نقطة للعميل` : ''))
      reset()
      loadRecent()
    } catch (er) { toast.error(er.response?.data?.message || 'ما انحفظ') } finally { setBusy(false) }
  }

  const remove = async (o) => {
    if (!window.confirm(`نحذف طلب #${o.order_no} (${o.customer})؟`)) return
    try { await api.delete(`/ps/past-orders/${o.id}`); toast.success('انحذف'); loadRecent() } catch { toast.error('تعذر') }
  }

  return (
    <div className="page po" dir="rtl">
      <h1 className="page-title-main" style={{ margin: 0 }}>طلبات سابقة</h1>
      <p className="page-subtitle" style={{ margin: '4px 0 16px' }}>ضيف طلبات العملاء القديمة اللي استلموها. تنحفظ بتاريخها، كل قطعها «تم التسليم» ومدفوعة، و<b>ما ينرسل للعميل أي شي</b>.</p>

      <div className="po-grid">
        <form className="card po-form" onSubmit={save}>
          <div className="po-row2">
            <label>تاريخ الطلب<input className="input" type="date" max={today()} required value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>طريقة الدفع<select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
          </div>

          <div className="po-row2">
            <label>عملة الأسعار<select className="input" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map(([c, l]) => <option key={c} value={c}>{l} ({c})</option>)}</select></label>
            {cur !== 'OMR' && <label>١ {cur} = كم ريال<input className="input" type="number" min="0" step="0.0001" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} /></label>}
          </div>

          <div className="po-sec">العميل</div>
          {cust ? (
            <div className="po-chip"><b>{cust.name}</b><span dir="ltr">{cust.phone || ''}</span><button type="button" aria-label="تغيير العميل" onClick={() => { setCust(null); setQ('') }}><RiCloseLine /></button></div>
          ) : isNew ? (
            <div className="po-row2">
              <label>الاسم<input className="input" required value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} autoFocus /></label>
              <label>الجوال<input className="input" dir="ltr" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder="9XXXXXXX" /></label>
              <button type="button" className="po-link" onClick={() => setIsNew(false)}>دوّر على عميل موجود</button>
            </div>
          ) : (
            <div className="po-search">
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اكتب اسم العميل أو رقمه" />
              {found.length > 0 && (
                <div className="po-found">
                  {found.map((c) => <button type="button" key={c.id} onClick={() => { setCust(c); setFound([]); setTimeout(() => firstItem.current?.focus(), 50) }}><b>{c.name}</b><span dir="ltr">{c.phone || ''}</span></button>)}
                </div>
              )}
              <button type="button" className="po-link" onClick={() => { setIsNew(true); setNc({ name: /\d/.test(q) ? '' : q, phone: /\d/.test(q) ? q : '' }) }}><RiUserAddLine /> عميل جديد</button>
            </div>
          )}

          <div className="po-sec">القطع</div>
          <div className="po-items">
            <div className="po-ih"><span>البراند</span><span>القطعة</span><span>سعر البيع ({cur})</span><span>التكلفة ({cur}، اختياري)</span><span /></div>
            {items.map((it, k) => (
              <div className="po-item" key={k}>
                <input className="input" placeholder="Dior" value={it.brand} onChange={(e) => setItem(k, 'brand', e.target.value)} onKeyDown={(e) => onItemKey(e, k)} />
                <input className="input" ref={k === 0 ? firstItem : null} placeholder="اسم القطعة" value={it.name} onChange={(e) => setItem(k, 'name', e.target.value)} onKeyDown={(e) => onItemKey(e, k)} />
                <input className="input" type="number" min="0" step="0.001" dir="ltr" placeholder={cur} value={it.price} onChange={(e) => setItem(k, 'price', e.target.value)} onKeyDown={(e) => onItemKey(e, k)} />
                <input className="input" type="number" min="0" step="0.001" dir="ltr" placeholder={cur} value={it.cost} onChange={(e) => setItem(k, 'cost', e.target.value)} onKeyDown={(e) => onItemKey(e, k)} />
                <button type="button" className="po-x" aria-label="حذف القطعة" disabled={items.length === 1} onClick={() => setItems((xs) => xs.filter((_, i) => i !== k))}><RiDeleteBinLine /></button>
                {cur !== 'OMR' && it.price !== '' ? <span className="po-conv">= {money(omr(it.price))} ر.ع</span> : null}
              </div>
            ))}
            <button type="button" className="po-link" onClick={() => setItems((xs) => [...xs, emptyItem()])}><RiAddLine /> قطعة ثانية</button>
          </div>

          <div className="po-row3">
            <label>التوصيل (ر.ع)<input className="input" type="number" min="0" step="0.001" dir="ltr" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" /></label>
            <label>الخصم (ر.ع)<input className="input" type="number" min="0" step="0.001" dir="ltr" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></label>
            <div className="po-total"><small>الإجمالي</small><b>{money(total)} ر.ع</b></div>
          </div>

          {opts?.loyalty ? (
            <label className="po-check"><input type="checkbox" checked={points} onChange={(e) => setPoints(e.target.checked)} /> أعطه نقاط ولاء على هالطلب{estPoints > 0 ? ` (تقريباً ${estPoints} نقطة، وأكثر حسب مستواه)` : ''}</label>
          ) : null}
          <label className="po-check"><input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> ما دفع المبلغ كامل</label>
          {partial && <label>اللي دفعه<input className="input" type="number" min="0" step="0.001" dir="ltr" value={paid} onChange={(e) => setPaid(e.target.value)} /></label>}
          <label>ملاحظة<input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" /></label>

          <button className="btn btn-primary" disabled={busy}>{busy ? 'يحفظ…' : 'حفظ الطلب'}</button>
          <small className="po-hint">نصيحة: اضغط Enter في آخر قطعة عشان تضيف قطعة ثانية. التاريخ وطريقة الدفع والعملة يبقون للطلب اللي بعده.</small>
        </form>

        <div className="card po-recent">
          <h3><RiHistoryLine /> آخر اللي ضفته</h3>
          {!recent ? <div className="gh-skel" style={{ height: 120 }} /> : recent.length === 0 ? <p className="po-empty">للحين ما ضفت طلبات سابقة.</p> : recent.map((o) => (
            <div className="po-r" key={o.id}>
              <div className="po-r1"><b>#{o.order_no} · {o.customer}</b><span>{day(o.date)}</span></div>
              <div className="po-r2">{o.items.join('، ')}{o.points ? ` · ${o.points} نقطة` : ''}</div>
              <div className="po-r1"><span>{money(o.total)} ر.ع{o.paid + 0.0005 < o.total ? ` · باقي ${money(o.total - o.paid)}` : ''}</span><button className="po-x" aria-label="حذف الطلب" onClick={() => remove(o)}><RiDeleteBinLine /></button></div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
.po-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px;align-items:start}
.po-form{padding:18px;margin:0;display:flex;flex-direction:column;gap:12px}
.po-form label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600;color:var(--text-secondary)}
.po-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end}
.po-row3{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px;align-items:end}
.po-sec{font-size:13px;font-weight:700;margin-top:4px}
.po-search{position:relative;display:flex;flex-direction:column;gap:6px}
.po-found{position:absolute;top:44px;inset-inline:0;z-index:5;background:var(--bg-card,#fff);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.08);overflow:hidden}
.po-found button{display:flex;justify-content:space-between;width:100%;padding:10px 12px;border:0;background:none;font-family:inherit;font-size:13.5px;cursor:pointer;color:inherit;border-bottom:1px solid var(--border)}
.po-found button:hover{background:var(--bg-body)}
.po-found span,.po-chip span{color:var(--text-secondary);font-size:12.5px}
.po-chip{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:10px;padding:8px 12px}
.po-chip b{flex:1}
.po-chip button,.po-x{border:0;background:none;cursor:pointer;color:var(--text-secondary);display:inline-flex;padding:6px;font-size:16px}
.po-x:disabled{opacity:.3;cursor:default}
.po-link{align-self:flex-start;border:0;background:none;color:var(--color-primary,#5C0B16);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:2px 0}
.po-items{display:flex;flex-direction:column;gap:6px}
.po-ih,.po-item{display:grid;grid-template-columns:1fr 2fr 1fr 1fr 32px;gap:6px;align-items:center}
.po-ih span{font-size:11.5px;color:var(--text-secondary);font-weight:600}
.po-item .input{height:38px;padding:0 10px;min-width:0}
.po-conv{grid-column:3/5;font-size:11.5px;color:var(--text-secondary);margin-top:-4px}
.po-total{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.po-total small{font-size:12px;color:var(--text-secondary)}.po-total b{font-size:20px}
.po-check{flex-direction:row!important;align-items:center;gap:8px!important;color:inherit!important}
.po-hint{font-size:12px;color:var(--text-secondary)}
.po-recent{padding:16px;margin:0}
.po-recent h3{margin:0 0 10px;font-size:15px;display:flex;align-items:center;gap:6px}
.po-empty{font-size:13px;color:var(--text-secondary)}
.po-r{border-top:1px solid var(--border);padding:10px 0;display:flex;flex-direction:column;gap:3px}
.po-r1{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}
.po-r1 span{color:var(--text-secondary);font-size:12.5px}
.po-r2{font-size:12.5px;color:var(--text-secondary)}
@media(max-width:900px){.po-grid{grid-template-columns:1fr}.po-ih{display:none}.po-item{grid-template-columns:1fr 1fr;}.po-item .po-x{justify-self:end}}
`}</style>
    </div>
  )
}
