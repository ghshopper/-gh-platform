import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiPrinterLine, RiCloseLine, RiCheckLine } from 'react-icons/ri'
import api from '../services/api'

const API = import.meta.env.VITE_API_URL
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/**
 * The buying list of a trip: every piece still to buy, one section per brand
 * (one stop per boutique), with photo and details. Print it, or tick pieces
 * off as you buy them (they move to «تم الشراء»).
 */
export default function ShoppingList({ tripId, onClose }) {
  const [d, setD] = useState(null)
  const [done, setDone] = useState({})
  useEffect(() => {
    api.get('/admin/trips-report/shopping', { params: { trip_id: tripId || 'all' } }).then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  }, [tripId])

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
      toast.success('تم الشراء ✓ (سجّل سعر الشراء من تطبيق الإدارة)')
    } catch {
      setDone((x) => { const y = { ...x }; delete y[i.id]; return y })
      toast.error('تعذر')
    }
  }

  return (
    <div className="sl-back" onMouseDown={onClose}>
      <div className="sl-sheet" onMouseDown={(e) => e.stopPropagation()} dir="rtl">
        <div className="sl-bar no-print">
          <b>قائمة التسوق</b>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}><RiPrinterLine /> طباعة / PDF</button>
          <button className="icon-btn" onClick={onClose}><RiCloseLine size={22} /></button>
        </div>
        {!d ? <div className="gh-skel" style={{ height: 300, margin: 20 }} /> : (
          <div className="sl-page">
            <div className="sl-head">
              <h2>{d.trip?.name}</h2>
              <span>{[d.trip?.destination, d.trip?.starts_on].filter(Boolean).join(' · ')} · {d.count} قطعة · {d.groups.length} براند</span>
            </div>
            {d.count === 0 ? <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>ما فيه قطع تنتظر الشراء 👌</p> : d.groups.map((g) => (
              <div key={g.brand} className="sl-group">
                <h3>{g.brand} <small>{g.count} قطعة</small></h3>
                {g.items.map((i) => (
                  <div key={i.id} className={`sl-item ${done[i.id] === true ? 'done' : ''}`}>
                    <button className="sl-check" onClick={() => tick(i)} title="اشتريتها">{done[i.id] === true ? <RiCheckLine /> : null}</button>
                    <div className="sl-img">{i.image ? <img src={i.image} alt="" /> : null}</div>
                    <div className="sl-info">
                      <b>{i.name}</b>
                      {i.details && <span>{i.details}</span>}
                      {i.sku && <span dir="ltr">{i.sku}</span>}
                      <span className="sl-meta">#{i.ref} · {i.customer || '—'}{i.ordered_at ? ' · طلب ' + i.ordered_at : ''}</span>
                    </div>
                    <div className="sl-price">
                      {i.list_price ? <b dir="ltr">{Number(i.list_price).toLocaleString('en-US')} {i.list_currency}</b> : null}
                      <span>{money(i.price)} ر.ع للعميل</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
.sl-back{position:fixed;inset:0;z-index:500;background:rgba(17,17,17,.4);display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:30px 12px}
.sl-sheet{background:#fff;width:100%;max-width:860px;border-radius:14px;overflow:hidden}
.sl-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:#fff;z-index:2}
.sl-page{padding:20px 24px}
.sl-head h2{margin:0;font-size:22px}
.sl-head span{font-size:13px;color:#777}
.sl-group{margin-top:20px;break-inside:avoid-page}
.sl-group h3{margin:0 0 8px;font-size:16px;background:#4A0A12;color:#F2E3C8;padding:8px 12px;border-radius:8px}
.sl-group h3 small{font-weight:400;opacity:.8;font-size:12px}
.sl-item{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid #eee;break-inside:avoid}
.sl-item.done{opacity:.45}
.sl-item.done b{text-decoration:line-through}
.sl-check{width:26px;height:26px;border:1.5px solid #111;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.sl-item.done .sl-check{background:#111;color:#fff}
.sl-img{width:64px;height:64px;border-radius:8px;background:#F4F3F1;overflow:hidden;flex-shrink:0}
.sl-img img{width:100%;height:100%;object-fit:cover}
.sl-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13px}
.sl-info b{font-size:14px}
.sl-info span{color:#555}
.sl-meta{font-size:12px;color:#999!important}
.sl-price{text-align:left;display:flex;flex-direction:column;gap:2px;font-size:12.5px;white-space:nowrap}
.sl-price span{color:#777}
@media print{
  body *{visibility:hidden}
  .sl-back,.sl-back *{visibility:visible}
  .sl-back{position:absolute;inset:0;background:#fff;padding:0;overflow:visible;display:block}
  .sl-sheet{max-width:none;border-radius:0}
  .no-print{display:none!important}
  .sl-group h3{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`}</style>
    </div>
  )
}
