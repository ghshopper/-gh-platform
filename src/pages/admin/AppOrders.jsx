import { useEffect, useMemo, useState } from 'react'
import {
  RiSearchLine, RiRefreshLine, RiPrinterLine, RiWhatsappLine, RiLinksLine,
  RiCloseLine, RiTruckLine, RiShoppingBag3Line, RiTimeLine, RiLoader4Line,
} from 'react-icons/ri'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

const API = import.meta.env.VITE_API_URL || '/api'
const TRACK_BASE = 'https://ghshopper.com/track/?t='

const ITEM_STATUS = {
  requested: { label: 'بانتظار الشراء', color: '#2F7CF6', bg: '#EAF2FE' },
  purchased: { label: 'تم الشراء', color: '#C26A00', bg: '#FFF3E0' },
  arrived:   { label: 'وصل مسقط', color: '#16804A', bg: '#E7F7EE' },
  out_for_delivery: { label: 'خرج للتوصيل', color: '#0E7C7C', bg: '#E3F6F6' },
  delivered: { label: 'تم التسليم', color: '#7A3FC4', bg: '#F3ECFC' },
  cancelled: { label: 'ملغي', color: '#6B7280', bg: '#F3F4F6' },
}
const ORDER_FLOW = ['requested', 'purchased', 'arrived', 'out_for_delivery', 'delivered']
const DRIVER_STATUS = {
  assigned: { label: 'عند المندوب', color: '#2F7CF6' },
  picked:   { label: 'في الطريق', color: '#C26A00' },
  delivered:{ label: 'سلّمها المندوب', color: '#16804A' },
}
const METHOD = { home: 'مندوبنا · للبيت', office: 'إلى المكتب', nool: 'نول · للبيت', nool_office: 'نول · من الفرع', genacom: 'جيناكم · للبيت', genacom_office: 'جيناكم · من الفرع' }
const COURIERS = ['nool', 'nool_office', 'genacom', 'genacom_office']
const EVENT_LABEL = {
  created: 'تم إنشاء الطلب', purchased: 'تم الشراء', arrived: 'وصل مسقط', out_for_delivery: 'خرج للتوصيل',
  label: 'طُبعت البوليصة', assigned: 'سُلّم للمندوب', unassigned: 'سُحب من المندوب',
  picked: 'المندوب استلم', delivered: 'تم التسليم', cancelled: 'إلغاء', requested: 'رجع للانتظار',
}

const omr = (v) => `${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ر.ع`
const pad = (n, l) => String(n).padStart(l, '0')
const invoiceNo = (o) => {
  const d = o.created_at ? new Date(o.created_at) : new Date()
  return `GH-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}-${pad(o.order_no, 3)}`
}
const dateStr = (s) => (s ? new Date(s).toLocaleDateString('en-GB') : '—')
const dateTime = (s) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

/** Least-advanced active item status = what the order still needs. */
function overall(o) {
  const active = o.items.filter((i) => i.status !== 'cancelled')
  if (!active.length) return 'cancelled'
  return ORDER_FLOW[Math.min(...active.map((i) => ORDER_FLOW.indexOf(i.status)))]
}
function totals(o) {
  const items = o.items.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.price, 0)
  // Discount (code / points) and tax are on the order, not item lines.
  const total = items + (o.delivery_fee || 0) + (o.tax || 0) - (o.discount || 0)
  const paid = o.payments.reduce((s, p) => s + p.amount, 0)
  return { items, total, paid, remaining: total - paid }
}

export default function AppOrders() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('open')
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState(false)

  const headers = {
    Authorization: 'Bearer ' + localStorage.getItem('token'),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/ps/bootstrap`, { headers })
      if (!res.ok) throw new Error(res.status)
      setData(await res.json())
    } catch {
      toast.error('ما قدرنا نحمّل طلبات التطبيق')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const customers = useMemo(() => Object.fromEntries((data?.customers || []).map((c) => [c.id, c])), [data])
  const drivers = useMemo(() => Object.fromEntries((data?.drivers || []).map((d) => [d.id, d])), [data])
  const orders = data?.orders || []

  const stats = useMemo(() => {
    const items = orders.flatMap((o) => o.items.filter((i) => i.status !== 'cancelled'))
    return {
      open: orders.filter((o) => overall(o) !== 'delivered' && overall(o) !== 'cancelled').length,
      toBuy: items.filter((i) => i.status === 'requested').length,
      arrived: items.filter((i) => i.status === 'arrived').length,
      withDrivers: orders.filter((o) => o.driver_id && o.driver_status !== 'delivered').length,
      owed: orders.reduce((s, o) => s + Math.max(0, totals(o).remaining), 0),
      monthSales: orders.filter((o) => {
        const d = new Date(o.created_at); const n = new Date()
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
      }).reduce((s, o) => s + totals(o).items, 0),
    }
  }, [orders])

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      const st = overall(o)
      if (filter === 'open' && (st === 'delivered' || st === 'cancelled')) return false
      if (filter === 'website' && o.source !== 'store') return false
      if (!['open', 'all', 'unpaid', 'website'].includes(filter) && st !== filter) return false
      if (filter === 'unpaid' && totals(o).remaining <= 0.0005) return false
      if (!q) return true
      const c = customers[o.customer_id]
      return [invoiceNo(o), o.waybill_no, c?.name, c?.phone, ...o.items.map((i) => `${i.brand || ''} ${i.name}`)]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [orders, filter, search, customers])

  const open = orders.find((o) => o.id === openId)

  const setItemStatus = async (ids, status) => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/ps/items/status`, { method: 'POST', headers, body: JSON.stringify({ ids, status }) })
      if (!res.ok) throw new Error()
      toast.success('تم تحديث الحالة')
      await load()
    } catch { toast.error('ما تحدّثت الحالة') } finally { setBusy(false) }
  }

  const printWaybill = async (o) => {
    try {
      await printLabel(o, customers[o.customer_id], data.settings || {}, drivers[o.driver_id]?.name)
      if (!o.label_printed_at) {
        await fetch(`${API}/ps/orders/${o.id}/label`, { method: 'POST', headers })
        load()
      }
    } catch { toast.error('ما قدرنا نجهز البوليصة') }
  }

  const tabs = [
    ['open', 'المفتوحة'], ['website', 'من الموقع'], ['requested', 'بانتظار الشراء'], ['purchased', 'تم الشراء'],
    ['arrived', 'وصلت'], ['out_for_delivery', 'خرجت للتوصيل'], ['unpaid', 'عليها مبالغ'], ['delivered', 'المسلّمة'], ['all', 'الكل'],
  ]

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', margin: 0 }}>كل الطلبات</h1>
          <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: 14 }}>
            طلبات الموقع وتطبيق العملاء وتطبيق الإدارة في مكان واحد: الشراء، الدفعات والتوصيل
          </p>
        </div>
        <button onClick={load} style={btn('#fff', 'var(--color-primary)', true)}>
          <RiRefreshLine size={18} /> تحديث
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Stat label="مبيعات الشهر" value={omr(stats.monthSales)} color="#4A0D17" hero />
        <Stat label="طلبات مفتوحة" value={stats.open} color="#7A1530" />
        <Stat label="قطع تنتظر الشراء" value={stats.toBuy} color="#2F7CF6" />
        <Stat label="قطع وصلت" value={stats.arrived} color="#16804A" />
        <Stat label="مع المناديب" value={stats.withDrivers} color="#C26A00" />
        <Stat label="مبالغ عند العملاء" value={omr(stats.owed)} color="#E5383B" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <RiSearchLine style={{ position: 'absolute', right: 14, top: 13, color: '#94a3b8' }} size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الرقم، رقم الفاتورة أو القطعة"
            style={{ width: '100%', padding: '11px 42px 11px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1.5px solid ' + (filter === k ? 'var(--color-primary)' : '#e2e8f0'),
              background: filter === k ? 'var(--color-primary)' : '#fff',
              color: filter === k ? '#fff' : '#475569',
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f1e8e0', overflow: 'hidden', boxShadow: '0 8px 30px -20px rgba(74,13,23,.35)' }}>
        {loading && !data ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}><RiLoader4Line className="spin" size={28} /></div>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>ما في طلبات هنا</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#FBF5EE', color: '#8B6B3D', textAlign: 'right' }}>
                  {['الفاتورة', 'العميل', 'القطع', 'الإجمالي', 'المتبقي', 'الحالة', 'التوصيل', ''].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const c = customers[o.customer_id]
                  const t = totals(o)
                  const st = ITEM_STATUS[overall(o)]
                  const ds = DRIVER_STATUS[o.driver_status]
                  return (
                    <tr key={o.id} onClick={() => setOpenId(o.id)} style={{ borderTop: '1px solid #f4efe9', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fffaf6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={td}><div style={{ fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>{invoiceNo(o)}</div>{o.source === 'store' && <div style={{ fontSize: 11, fontWeight: 700, color: '#2F7CF6' }}>🌐 الموقع {o.store_order_number}</div>}<div style={{ color: '#94a3b8', fontSize: 12 }}>{dateStr(o.created_at)}</div></td>
                      <td style={td}><div style={{ fontWeight: 600 }}>{c?.name || '—'}</div><div style={{ color: '#94a3b8', fontSize: 12, direction: 'ltr', textAlign: 'right' }}>{c?.phone || ''}</div></td>
                      <td style={td}>{o.items.filter((i) => i.status !== 'cancelled').length}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{omr(t.total)}</td>
                      <td style={{ ...td, color: t.remaining > 0.0005 ? '#E5383B' : '#16804A', fontWeight: 600 }}>{t.remaining > 0.0005 ? omr(t.remaining) : 'مدفوع'}</td>
                      <td style={td}><Pill {...st} /></td>
                      <td style={td}>{COURIERS.includes(o.delivery_method) ? <span style={{ color: '#A8833F', fontWeight: 600, fontSize: 13 }}>شحن {METHOD[o.delivery_method]}{o.carrier_tracking ? ' · ✓' : ''}</span> : ds ? <span style={{ color: ds.color, fontWeight: 600, fontSize: 13 }}>{ds.label} · {drivers[o.driver_id]?.name || ''}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                      <td style={td} onClick={(e) => e.stopPropagation()}>
                        <button title="طباعة البوليصة" onClick={() => printWaybill(o)} style={iconBtn}><RiPrinterLine size={18} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <Drawer onClose={() => setOpenId(null)}>
          <OrderDetail
            o={open} c={customers[open.customer_id]} driver={drivers[open.driver_id]}
            busy={busy} onStatus={setItemStatus} onPrint={() => printWaybill(open)}
          />
        </Drawer>
      )}
    </div>
  )
}

function OrderDetail({ o, c, driver, busy, onStatus, onPrint }) {
  const t = totals(o)
  const link = o.tracking_token ? TRACK_BASE + o.tracking_token : null
  const phone = (c?.phone || '').replace(/\D/g, '')
  const wa = phone ? `https://wa.me/${phone.length === 8 ? '968' + phone : phone}` : null
  const active = o.items.filter((i) => i.status !== 'cancelled')
  const nextFor = (s) => ORDER_FLOW[ORDER_FLOW.indexOf(s) + 1]

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg,#6b0f19,#350304)', color: '#fff', borderRadius: 18, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, opacity: .75, direction: 'ltr', textAlign: 'right' }}>{invoiceNo(o)} · {o.waybill_no}</div>
        <div style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 2px' }}>{c?.name || '—'}</div>
        <div style={{ fontSize: 13, opacity: .8, direction: 'ltr', textAlign: 'right' }}>{c?.phone || ''}{c?.city ? ` · ${c.city}` : ''}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={onPrint} style={btn('#CEAE6E', '#350304')}><RiPrinterLine /> البوليصة</button>
          {wa && <a href={wa} target="_blank" rel="noreferrer" style={btn('#25D366', '#fff')}><RiWhatsappLine /> واتساب</a>}
          {link && <button onClick={() => { navigator.clipboard.writeText(link); toast.success('نسخت رابط التتبّع') }} style={btn('rgba(255,255,255,.14)', '#fff')}><RiLinksLine /> رابط التتبّع</button>}
        </div>
      </div>

      <Card title="القطع" icon={<RiShoppingBag3Line />} action={active.length > 1 && nextFor(overall(o)) && (
        <button disabled={busy} onClick={() => onStatus(active.filter((i) => i.status === overall(o)).map((i) => i.id), nextFor(overall(o)))} style={btn('#f8fafc', '#334155', true)}>
          الكل ← {ITEM_STATUS[nextFor(overall(o))].label}
        </button>
      )}>
        {o.items.map((i) => {
          const s = ITEM_STATUS[i.status] || ITEM_STATUS.requested
          const next = nextFor(i.status)
          return (
            <div key={i.id} style={{ padding: '12px 0', borderTop: '1px solid #f1f5f9', opacity: i.status === 'cancelled' ? .5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  {i.brand && <div style={{ fontSize: 11, letterSpacing: 1, color: '#A8833F', fontWeight: 700 }}>{i.brand.toUpperCase()}</div>}
                  <div style={{ fontWeight: 700 }}>{i.name}</div>
                  {i.details && <div style={{ color: '#64748b', fontSize: 13 }}>{i.details}</div>}
                </div>
                <div style={{ textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{omr(i.price)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Pill {...s} />
                {i.cost_amount != null && <span style={{ fontSize: 12, color: '#64748b' }}>شراء {i.cost_amount} {i.cost_currency}{i.tax_free_pct ? ` · تاكس فري ${i.tax_free_pct}%${i.tax_free_received ? ' ✓' : ''}` : ''}</span>}
                {next && i.status !== 'cancelled' && (
                  <button disabled={busy} onClick={() => onStatus([i.id], next)} style={{ ...btn('#fff', '#334155', true), padding: '5px 10px', fontSize: 12, marginRight: 'auto' }}>
                    ← {ITEM_STATUS[next].label}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </Card>

      <Card title="المبالغ">
        <Row k="القطع" v={omr(t.items)} />
        <Row k="التوصيل" v={omr(o.delivery_fee)} />
        {o.tax > 0 && <Row k="الضريبة" v={omr(o.tax)} />}
        {o.discount > 0 && <Row k={o.discount_label || 'خصم'} v={'− ' + omr(o.discount)} color="#16804A" />}
        <Row k="الإجمالي" v={omr(t.total)} strong />
        {o.payments.map((p) => <Row key={p.id} k={`${p.note || 'دفعة'} · ${p.paid_on}${p.method ? ' · ' + p.method : ''}`} v={'− ' + omr(p.amount)} color="#16804A" />)}
        <Row k="المتبقي" v={omr(Math.max(0, t.remaining))} strong color={t.remaining > 0.0005 ? '#E5383B' : '#16804A'} />
      </Card>

      <Card title="التوصيل" icon={<RiTruckLine />}>
        {o.delivery_method && <Row k="الطريقة" v={METHOD[o.delivery_method]} />}
        {o.carrier_tracking && (/^https?:\/\//.test(o.carrier_tracking)
          ? <Row k="تتبّع الشحنة" v={<a href={o.carrier_tracking} target="_blank" rel="noreferrer" style={{ color: '#A8833F' }}>فتح الرابط</a>} />
          : <Row k="رقم الشحنة" v={o.carrier_tracking} />)}
        {!COURIERS.includes(o.delivery_method) && <Row k="المندوب" v={driver?.name || 'ما أُسند'} />}
        {o.driver_status && <Row k="الحالة" v={DRIVER_STATUS[o.driver_status]?.label} />}
        <Row k="رسوم التوصيل" v={o.delivery_collect ? `يحصّلها المندوب (${omr(o.delivery_fee)})` : 'مدفوعة مسبقاً'} />
        {o.delivery_address && <Row k="العنوان" v={o.delivery_address} />}
        {o.driver_note && <Row k="ملاحظة" v={o.driver_note} />}
      </Card>

      {o.events?.length > 0 && (
        <Card title="سجل الطلب" icon={<RiTimeLine />}>
          {[...o.events].reverse().map((e, k) => (
            <div key={k} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: k ? '1px solid #f1f5f9' : 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: 9, background: 'var(--color-gold)', marginTop: 6 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{EVENT_LABEL[e.type] || e.type}</div>
                {e.note && <div style={{ fontSize: 12.5, color: '#64748b' }}>{e.note}</div>}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{dateTime(e.at)}</div>
            </div>
          ))}
        </Card>
      )}
      {o.notes && <Card title="ملاحظات"><div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{o.notes}</div></Card>}
    </div>
  )
}

// ───────────── small pieces ─────────────

const td = { padding: '14px 16px', verticalAlign: 'middle' }
const iconBtn = { border: '1.5px solid #eadfd3', background: '#fff', borderRadius: 10, padding: 7, cursor: 'pointer', color: '#4A0D17', display: 'inline-flex' }
const btn = (bg, color, outline) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12,
  background: bg, color, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textDecoration: 'none',
  border: outline ? '1.5px solid #e2e8f0' : 'none',
})

function Stat({ label, value, color, hero }) {
  // Shopify-style tile: white card, label on top, number below; colour only as a small dot.
  return (
    <div style={{ borderRadius: 14, padding: '14px 16px', background: '#fff', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: 7, background: hero ? 'var(--accent)' : color }} />{label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginTop: 6, letterSpacing: '-.3px' }}>{value}</div>
    </div>
  )
}

function Pill({ label, color, bg }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: bg, color, fontWeight: 700, fontSize: 12 }}>
    <span style={{ width: 6, height: 6, borderRadius: 6, background: color }} />{label}
  </span>
}

function Card({ title, icon, action, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #f1e8e0', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-gold-dark)', display: 'inline-flex' }}>{icon}</span>
        <div style={{ fontWeight: 800, color: '#1e293b' }}>{title}</div>
        <div style={{ marginRight: 'auto' }}>{action}</div>
      </div>
      {children}
    </div>
  )
}

function Row({ k, v, strong, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14 }}>
      <span style={{ color: '#64748b' }}>{k}</span>
      <span style={{ fontWeight: strong ? 800 : 600, color: color || '#1e293b', textAlign: 'left' }}>{v}</span>
    </div>
  )
}

function Drawer({ onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,10,.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-start' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', height: '100%', overflowY: 'auto', background: '#F7F2EE', padding: 20, direction: 'rtl', boxShadow: '0 0 40px rgba(0,0,0,.25)' }}>
        <button onClick={onClose} style={{ ...iconBtn, marginBottom: 12 }}><RiCloseLine size={20} /></button>
        {children}
      </div>
    </div>
  )
}

// ───────────── waybill (10 × 15 cm label) ─────────────

async function printLabel(o, c, biz, driverName) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
  const qr = await QRCode.toDataURL(o.tracking_token ? TRACK_BASE + o.tracking_token : 'https://ghshopper.com', { margin: 0, width: 300 })
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, o.waybill_no, { format: 'CODE128', displayValue: false, height: 70, margin: 0, width: 2.4 })
  const barcode = canvas.toDataURL('image/png')
  const codAmount = o.cod_amount != null ? o.cod_amount : (o.delivery_collect && o.delivery_fee > 0 ? o.delivery_fee : 0)
  const collect = codAmount > 0
  const pieces = o.items.filter((i) => i.status !== 'cancelled').length
  const address = o.delivery_address || c?.address || ''
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(o.waybill_no)}</title>
<style>
@page { size: 100mm 150mm; margin: 4mm; }
* { box-sizing: border-box; } body { margin: 0; font-family: -apple-system, "Segoe UI", Tahoma, sans-serif; color: #000; }
.box { border: 1.2px solid #000; padding: 2.5mm; margin-bottom: 2mm; }
.row { display: flex; align-items: center; gap: 2mm; } .sp { flex: 1; }
.lbl { font-size: 8pt; font-weight: 700; } .en { font-size: 6pt; color: #555; }
.big { font-size: 13pt; font-weight: 800; } .num { direction: ltr; unicode-bidi: embed; }
.cod { background: #000; color: #fff; }
</style></head><body>
<div class="row" style="margin-bottom:2mm"><img src="${location.origin}/track/logo.png" style="height:12mm"><div class="sp"></div><div style="text-align:left"><div class="lbl">بوليصة شحن</div><div class="en">WAYBILL</div></div></div>
<div class="box" style="text-align:center"><img src="${barcode}" style="width:100%;height:12mm"><div class="big num">${esc(o.waybill_no)}</div></div>
<div class="box row" style="align-items:flex-start">
  <div class="sp"><div class="lbl">إلى <span class="en">TO</span></div>
    <div class="big">${esc(c?.name || '—')}</div>
    <div class="num" style="font-size:11pt;font-weight:600">${esc(c?.phone || '')}</div>
    <div style="font-size:9pt;font-weight:600">${esc(c?.city || '')}</div>
    <div style="font-size:8pt">${esc(address)}</div></div>
  <div style="text-align:center"><img src="${qr}" style="width:27mm;height:27mm"><div class="en">امسح للتتبّع</div></div>
</div>
<div class="box row ${collect ? 'cod' : ''}"><div><div style="font-size:10pt;font-weight:800">${collect ? 'حصّل عند التسليم' : 'التوصيل مدفوع'}</div><div class="en" style="${collect ? 'color:#fff' : ''}">${collect ? 'CASH ON DELIVERY' : 'PREPAID'}</div></div><div class="sp"></div>${collect ? `<div class="big num">${Number(codAmount).toFixed(3)} OMR</div>` : ''}</div>
${o.delivery_method ? `<div class="box row"><div class="sp" style="font-size:10pt;font-weight:800">التوصيل: ${METHOD[o.delivery_method]}</div>${o.carrier_tracking && !/^https?:/.test(o.carrier_tracking) ? `<div class="num" style="font-size:9pt;font-weight:600">${esc(o.carrier_tracking)}</div>` : ''}</div>` : ''}
<div class="box"><div class="row"><div class="sp lbl">الفاتورة <span class="en num">${esc(invoiceNo(o))}</span></div><div style="font-size:8pt;font-weight:600">${pieces} قطعة</div></div>
<div class="row" style="font-size:7.5pt;color:#555;margin-top:1mm"><div class="sp">التاريخ ${dateStr(o.created_at)}</div>${driverName ? `<div style="color:#000;font-weight:600">المندوب: ${esc(driverName)}</div>` : ''}</div>
${o.driver_note ? `<div style="font-size:8pt;font-weight:600;margin-top:1mm">ملاحظة: ${esc(o.driver_note)}</div>` : ''}</div>
<div style="border-top:1px solid #000;padding-top:1.5mm;font-size:7.5pt"><b>من</b> <span class="en">FROM</span> &nbsp; ${esc([biz.company_name || 'GH Shopper', biz.phone, biz.instagram].filter(Boolean).join('  ·  '))}</div>
<script>window.onload=()=>{setTimeout(()=>{window.print()},250)}</script>
</body></html>`
  const w = window.open('', '_blank', 'width=420,height=640')
  if (!w) throw new Error('popup')
  w.document.open(); w.document.write(html); w.document.close()
}
