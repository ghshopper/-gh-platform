import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { RiDownload2Line, RiArrowUpLine, RiArrowDownLine, RiRefreshLine, RiBarChartBoxLine, RiLoader4Line } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'

// Sales reports from every order (app, website and the ones added by hand):
// the period against the one before it, by brand, by category, best customers,
// and the whole period as an Excel file.
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const PRESETS = [
  { k: '7', label: '7 أيام' },
  { k: '30', label: '30 يوم' },
  { k: '90', label: '3 شهور' },
  { k: 'month', label: 'هذا الشهر' },
  { k: 'year', label: 'هذي السنة' },
  { k: 'custom', label: 'تاريخ محدد' },
]
function rangeOf(k) {
  const to = new Date()
  const from = new Date()
  if (k === 'month') from.setDate(1)
  else if (k === 'year') { from.setMonth(0); from.setDate(1) } else from.setDate(to.getDate() - (Number(k) - 1))
  return { from: iso(from), to: iso(to) }
}

function Change({ now, prev, money: isMoney }) {
  if (!prev) return <span className="rp-chg flat">{now ? 'جديد' : '—'}</span>
  const pct = ((now - prev) / Math.abs(prev)) * 100
  const up = pct >= 0
  return (
    <span className={`rp-chg ${up ? 'up' : 'down'}`} title={`الفترة اللي قبلها: ${isMoney ? money(prev) + ' ر.ع' : prev}`}>
      {up ? <RiArrowUpLine /> : <RiArrowDownLine />}{Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function Bars({ rows, valueKey = 'sales', labelKey = 'name', sub }) {
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1)
  return (
    <div className="rp-bars">
      {rows.map((r, i) => (
        <div key={i} className="rp-bar">
          <div className="rp-bar-top"><b>{r[labelKey]}</b><span>{money(r[valueKey])} ر.ع{sub ? ` · ${sub(r)}` : ''}</span></div>
          <div className="rp-bar-track"><i style={{ width: `${Math.max(2, (r[valueKey] / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function Daily({ rows, from, to }) {
  // every day in the period, empty days included
  const days = useMemo(() => {
    const map = Object.fromEntries(rows.map((r) => [r.date, r.sales]))
    const out = []
    const d = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    while (d <= end && out.length < 400) { const k = iso(d); out.push({ date: k, sales: map[k] || 0 }); d.setDate(d.getDate() + 1) }
    return out
  }, [rows, from, to])
  const max = Math.max(...days.map((d) => d.sales), 1)
  if (!days.length) return null
  return (
    <div className="rp-daily">
      {days.map((d) => (
        <div key={d.date} className="rp-day" title={`${d.date}: ${money(d.sales)} ر.ع`}>
          <i style={{ height: `${d.sales ? Math.max(3, (d.sales / max) * 100) : 0}%` }} />
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const nav = useNavigate()
  const [preset, setPreset] = useState('30')
  const [range, setRange] = useState(rangeOf('30'))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/insights', { params: range })
      setData(r.data)
    } catch {
      toast.error('تعذر تحميل التقارير')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (k) => { setPreset(k); if (k !== 'custom') setRange(rangeOf(k)) }

  const exportExcel = async () => {
    setExporting(true)
    try {
      const r = await api.get('/admin/insights/export', { params: range, responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url; a.download = `GH-orders-${range.from}_${range.to}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('تعذر التصدير')
    } finally {
      setExporting(false)
    }
  }

  const n = data?.now || {}
  const p = data?.prev || {}
  const cards = [
    { label: 'المبيعات', v: `${money(n.sales)}`, unit: 'ر.ع', now: n.sales, prev: p.sales, m: true },
    { label: 'الطلبات', v: n.orders ?? 0, now: n.orders, prev: p.orders },
    { label: 'متوسط الطلب', v: money(n.average), unit: 'ر.ع', now: n.average, prev: p.average, m: true },
    { label: 'عملاء اشتروا', v: n.customers ?? 0, now: n.customers, prev: p.customers },
    { label: 'المحصّل', v: money(n.collected), unit: 'ر.ع', now: n.collected, prev: p.collected, m: true },
    { label: 'الربح', v: n.profit == null ? '—' : money(n.profit), unit: n.profit == null ? '' : 'ر.ع', hint: n.profit == null ? 'سجّل سعر الشراء في القطع ليظهر الربح' : `من ${n.profit_pieces} قطعة مسجّل سعر شرائها`, now: n.profit, prev: p.profit, m: true },
  ]
  const empty = data && !n.orders

  return (
    <div className="page rp" dir="rtl">
      <div className="rp-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>التقارير</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>كل الطلبات (التطبيق، الموقع، واللي تضيفها بيدك) مقارنة بالفترة اللي قبلها.</p>
        </div>
        <div className="rp-actions">
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}><RiRefreshLine className={loading ? 'spin' : ''} /> تحديث</button>
          <button className="btn btn-primary btn-sm" onClick={exportExcel} disabled={exporting || empty}>{exporting ? <RiLoader4Line className="spin" /> : <RiDownload2Line />} تصدير Excel</button>
        </div>
      </div>

      <div className="rp-range">
        <div className="gh-seg">
          {PRESETS.map((x) => <button key={x.k} className={preset === x.k ? 'on' : ''} onClick={() => pick(x.k)}>{x.label}</button>)}
        </div>
        {preset === 'custom' && (
          <div className="rp-dates">
            <input type="date" className="input" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <span>إلى</span>
            <input type="date" className="input" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
        )}
      </div>

      {!data ? <div className="gh-skel" style={{ height: 420 }} /> : (
        <>
          <div className="rp-cards">
            {cards.map((c) => (
              <div key={c.label} className="rp-card" title={c.hint || ''}>
                <small>{c.label}</small>
                <b>{c.v} {c.unit && <i>{c.unit}</i>}</b>
                {c.now != null && <Change now={c.now || 0} prev={c.prev || 0} money={c.m} />}
                {c.hint && <em>{c.hint}</em>}
              </div>
            ))}
          </div>

          {empty ? (
            <div className="card"><Empty icon={RiBarChartBoxLine} title="ما فيه طلبات في هذي الفترة" hint="اختر فترة أطول من فوق." /></div>
          ) : (
            <>
              <div className="card rp-panel">
                <div className="rp-panel-head"><h3>المبيعات اليومية</h3><span>{data.from} — {data.to}</span></div>
                <Daily rows={data.daily || []} from={data.from} to={data.to} />
              </div>
              <div className="rp-grid">
                <div className="card rp-panel">
                  <div className="rp-panel-head"><h3>حسب البراند</h3></div>
                  {data.by_brand?.length ? <Bars rows={data.by_brand} sub={(r) => `${r.pieces} قطعة`} /> : <Empty compact title="ما فيه بيانات" />}
                </div>
                <div className="card rp-panel">
                  <div className="rp-panel-head"><h3>حسب التصنيف</h3><span>طلبات المتجر</span></div>
                  {data.by_category?.length ? <Bars rows={data.by_category} sub={(r) => `${r.pieces} قطعة`} /> : <Empty compact title="ما فيه طلبات من المتجر في هذي الفترة" />}
                </div>
              </div>
              <div className="card rp-panel">
                <div className="rp-panel-head"><h3>أفضل العملاء</h3></div>
                <div className="table-wrap" style={{ border: 'none' }}>
                  <table>
                    <thead><tr><th>#</th><th>العميل</th><th>الهاتف</th><th>الطلبات</th><th>المشتريات</th></tr></thead>
                    <tbody>
                      {data.top_customers.map((c, i) => (
                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/admin/customers?open=${c.id}`)}>
                          <td>{i + 1}</td><td><b>{c.name}</b></td><td dir="ltr" style={{ textAlign: 'right' }}>{c.phone || '—'}</td><td>{c.orders}</td><td><b>{money(c.spent)}</b> ر.ع</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.rp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.rp-actions{display:flex;gap:8px}
.rp-range{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px}
.rp-dates{display:flex;gap:8px;align-items:center}
.rp-dates .input{height:38px;padding:0 10px}
.rp-cards{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:16px}
.rp-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
.rp-card small{color:var(--text-secondary);font-size:12px}
.rp-card b{font-size:21px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-card b i{font-style:normal;font-size:12px;color:var(--text-secondary);font-weight:500}
.rp-card em{font-style:normal;font-size:11px;color:var(--text-light)}
.rp-chg{display:inline-flex;align-items:center;gap:2px;font-size:12px;font-weight:600;width:max-content;padding:2px 8px;border-radius:999px}
.rp-chg.up{color:#047857;background:#ECFDF5}.rp-chg.down{color:#B42318;background:#FEF3F2}.rp-chg.flat{color:var(--text-secondary);background:var(--bg-body)}
.rp-panel{padding:18px 20px;margin-bottom:16px}
.rp-panel-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
.rp-panel-head h3{margin:0;font-size:15px;font-weight:700}
.rp-panel-head span{font-size:12px;color:var(--text-secondary)}
.rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.rp-grid .rp-panel{margin-bottom:0}
.rp-grid + .rp-panel{margin-top:16px}
.rp-bars{display:flex;flex-direction:column;gap:12px}
.rp-bar-top{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:5px}
.rp-bar-top span{color:var(--text-secondary);white-space:nowrap}
.rp-bar-track{height:8px;background:var(--bg-body);border-radius:99px;overflow:hidden}
.rp-bar-track i{display:block;height:100%;background:#5C0B16;border-radius:99px}
.rp-daily{display:flex;align-items:flex-end;gap:2px;height:160px;padding-top:6px;border-bottom:1px solid var(--border)}
.rp-day{flex:1;height:100%;display:flex;align-items:flex-end;min-width:2px}
.rp-day i{display:block;width:100%;background:#111;border-radius:3px 3px 0 0;opacity:.85}
.rp-day:hover i{background:#5C0B16;opacity:1}
@media(max-width:1200px){.rp-cards{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.rp-cards{grid-template-columns:1fr 1fr}.rp-grid{grid-template-columns:1fr!important}.rp-card b{font-size:18px}}
`
