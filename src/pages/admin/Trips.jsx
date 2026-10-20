import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiPlaneLine, RiCheckLine, RiRefund2Line } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'
import ShoppingList from '../../components/ShoppingList'

// Profit of every buying trip, and the tax-free refunds to follow up.
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const day = (s) => (s ? new Date(s).toLocaleDateString('ar-OM', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function Trips() {
  const [d, setD] = useState(null)
  const [tab, setTab] = useState('trips')
  const [tfFilter, setTfFilter] = useState('due')
  const [list, setList] = useState(null) // trip id, 'none' or 'all'
  const load = () => api.get('/admin/trips-report').then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { load() }, [])

  const toggleTf = async (row) => {
    try {
      await api.put(`/ps/items/${row.item_id}/tax-free`, { received: !row.received })
      toast.success(row.received ? 'رجعت «ما استلمته»' : 'تم: استلمت التاكس فري')
      load()
    } catch { toast.error('تعذر') }
  }

  if (!d) return <div className="page"><div className="gh-skel" style={{ height: 360 }} /></div>
  const tf = d.tax_free.filter((r) => tfFilter === 'all' || (tfFilter === 'due' ? !r.received : r.received))
  const t = d.tax_free_totals

  return (
    <div className="page tr" dir="rtl">
      <div className="tr-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>الرحلات والتاكس فري</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>ربح كل رحلة شراء بعد التكلفة والمصاريف، ومتابعة استرجاع التاكس فري.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setList('all')}>🛍 كل اللي ينتظر الشراء</button>
        <div className="gh-seg">
          <button className={tab === 'trips' ? 'on' : ''} onClick={() => setTab('trips')}>الرحلات</button>
          <button className={tab === 'tf' ? 'on' : ''} onClick={() => setTab('tf')}>التاكس فري {t.pending_count ? `(${t.pending_count})` : ''}</button>
        </div>
      </div>

      {tab === 'trips' ? (
        d.trips.length === 0 ? <div className="card"><Empty icon={RiPlaneLine} title="ما فيه رحلات" hint="سوّ رحلة من تطبيق الإدارة (المزيد ← الرحلات) واربط فيها الطلبات." /></div> : (
          <div className="tr-list">
            {d.trips.map((r) => (
              <div key={r.id || 'none'} className="card tr-card">
                <div className="tr-top">
                  <div>
                    <b>{r.name}</b>
                    <span>{[r.destination, r.starts_on && `${day(r.starts_on)}${r.ends_on ? ' – ' + day(r.ends_on) : ''}`].filter(Boolean).join(' · ')}</span>
                  </div>
                  {r.to_buy > 0 && <button className="btn btn-primary btn-sm" onClick={() => setList(r.id || 'none')}>🛍 قائمة التسوق ({r.to_buy})</button>}
                  <div className={`tr-profit ${r.profit < 0 ? 'neg' : ''}`}>
                    <small>صافي الربح</small>
                    <b>{money(r.profit)} <i>ر.ع</i></b>
                    {r.margin != null && <em>هامش {r.margin}%</em>}
                  </div>
                </div>
                <div className="tr-nums">
                  <div><small>الطلبات</small><b>{r.orders} · {r.pieces} قطعة</b></div>
                  <div><small>مبيعات القطع المشتراة</small><b>{money(r.bought_sales)}</b></div>
                  <div><small>تكلفة الشراء</small><b>− {money(r.cost)}</b></div>
                  <div><small>مصاريف الرحلة</small><b>− {money(r.expenses)}</b></div>
                  <div><small>تاكس فري منتظر</small><b className="green">+ {money(r.tax_free_due)}</b></div>
                  <div><small>الربح مع التاكس فري</small><b>{money(r.profit_with_tax_free)}</b></div>
                </div>
                {(r.to_buy > 0 || r.unpriced > 0) && (
                  <div className="tr-warn">
                    {r.to_buy > 0 && <span>{r.to_buy} قطعة تنتظر الشراء</span>}
                    {r.to_buy > 0 && <span className="tr-est">تقريباً بتدفع فيها <b>{money(r.est_to_pay)} ر.ع</b> (تنباع بـ {money(r.to_buy_sales)}){r.est_missing ? ` · ${r.est_missing} بدون سعر تقريبي` : ''}</span>}
                    {r.unpriced > 0 && <span>{r.unpriced} قطعة ما تسجّل سعر شرائها (ما تدخل في الربح)</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="tr-tf-cards">
            <div className="card"><small>منتظر</small><b>{money(t.due)} <i>ر.ع</i></b><span>{t.pending_count} قطعة</span></div>
            <div className="card"><small>استلمته</small><b>{money(t.received)} <i>ر.ع</i></b></div>
          </div>
          <div className="gh-seg" style={{ marginBottom: 12 }}>
            {[['due', 'المنتظر'], ['got', 'المستلم'], ['all', 'الكل']].map(([k, l]) => <button key={k} className={tfFilter === k ? 'on' : ''} onClick={() => setTfFilter(k)}>{l}</button>)}
          </div>
          {tf.length === 0 ? <div className="card"><Empty icon={RiRefund2Line} title={tfFilter === 'due' ? 'ما فيه تاكس فري منتظر 👌' : 'ما فيه شي هنا'} hint="القطع اللي تنشرى من بوتيكات أوروبا أو دبي تطلع هنا مع المبلغ المتوقع." /></div> : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>القطعة</th><th>الرحلة</th><th>المكان</th><th>المبلغ</th><th>بالريال</th><th></th></tr></thead>
                  <tbody>
                    {tf.map((r) => (
                      <tr key={r.item_id}>
                        <td><b>{r.piece}</b><div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>#{r.ref}{r.customer ? ' · ' + r.customer : ''}{r.purchased_at ? ' · ' + day(r.purchased_at) : ''}</div></td>
                        <td>{r.trip}</td>
                        <td>{r.place} · {r.pct}%</td>
                        <td dir="ltr" style={{ textAlign: 'right' }}>{Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {r.currency}</td>
                        <td>{money(r.omr)}</td>
                        <td>
                          <button className={`btn btn-sm ${r.received ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleTf(r)}>
                            {r.received ? <><RiCheckLine /> مستلم</> : 'استلمته'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      {list && <ShoppingList tripId={list} onClose={() => { setList(null); load() }} />}
      <style>{`
.tr-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.tr-list{display:flex;flex-direction:column;gap:12px}
.tr-card{padding:16px 18px;margin:0}
.tr-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.tr-top>div:first-child{display:flex;flex-direction:column;gap:3px}
.tr-top b{font-size:16px}
.tr-top span{font-size:12.5px;color:var(--text-secondary)}
.tr-profit{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.tr-profit small{font-size:11.5px;color:var(--text-secondary)}
.tr-profit b{font-size:22px;color:#047857}
.tr-profit.neg b{color:#B42318}
.tr-profit i,.tr-tf-cards i{font-style:normal;font-size:12px;color:var(--text-secondary);font-weight:500}
.tr-profit em{font-style:normal;font-size:11.5px;color:var(--text-light)}
.tr-nums{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:14px}
.tr-nums>div{background:var(--bg-body);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tr-nums small{font-size:11.5px;color:var(--text-secondary)}
.tr-nums b{font-size:14px;white-space:nowrap;direction:ltr;unicode-bidi:isolate;text-align:right}
.tr-profit b{direction:ltr;unicode-bidi:isolate}
.tr-nums b.green{color:#047857}
.tr-warn{margin-top:10px;display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#B45309}
.tr-est{color:var(--text-secondary)}.tr-est b{color:var(--text-primary,#111);direction:ltr;unicode-bidi:isolate}
.tr-tf-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.tr-tf-cards .card{padding:14px 16px;margin:0;display:flex;flex-direction:column;gap:2px}
.tr-tf-cards small{font-size:12px;color:var(--text-secondary)}
.tr-tf-cards b{font-size:22px}
.tr-tf-cards span{font-size:12px;color:var(--text-light)}
@media(max-width:1100px){.tr-nums{grid-template-columns:repeat(3,1fr)}}
@media(max-width:600px){.tr-nums{grid-template-columns:1fr 1fr}}
`}</style>
    </div>
  )
}
