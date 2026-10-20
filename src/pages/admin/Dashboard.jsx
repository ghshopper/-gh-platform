import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  RiTimeLine,
  RiBankCardLine,
  RiShoppingBag3Line,
  RiGroupLine,
  RiLineChartLine,
  RiTimerLine,
  RiStarSmileLine,
  RiSettings3Line,
  RiTruckLine,
  RiMapPinLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiAddLine,
  RiBillLine,
  RiUserAddLine,
  RiBarChartGroupedLine,
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiRefreshLine,
  RiSearchLine,
  RiDownloadCloud2Line,
  RiGiftLine,
  RiArrowLeftLine,
} from 'react-icons/ri'
import OmrSymbol from '../../components/OmrSymbol'
import { adminApi } from '../../services/adminApi'

// ---- Custom Tooltip ----
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 6, fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#111', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: 11, fontWeight: 700 }}>OMR</span>
          {payload[0].value.toLocaleString()}
        </p>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [loading, setLoading] = useState(true)

  // Real Dashboard Data State
  const [stats, setStats] = useState({
    total_revenue: 0,
    total_orders: 0,
    total_customers: 0,
    avg_order_value: 0,
    pending_orders: 0,
    total_loyalty_points: 0,
  })

  // real changes come from the server; nothing made up while loading
  const [changes, setChanges] = useState({ revenue: 0, orders: 0, customers: 0, avg: 0, pending: 0, loyalty: 0 })

  const [salesChart, setSalesChart] = useState([])
  const [categorySales, setCategorySales] = useState([])
  const [orderStatuses, setOrderStatuses] = useState({
    pending: 0,
    processing: 0,
    shipped: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
  })
  const [recentOrders, setRecentOrders] = useState([])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const res = await adminApi.getDashboardStats()
      const json = res.data
      if (json.success && json.data) {
        const d = json.data
        if (d.stats) setStats(d.stats)
        if (d.changes) setChanges(d.changes)
        if (d.sales_chart) setSalesChart(d.sales_chart)
        if (d.category_sales) setCategorySales(d.category_sales)
        if (d.order_statuses) setOrderStatuses(d.order_statuses)
        if (d.recent_orders) setRecentOrders(d.recent_orders)
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  // Things that wait for you (each one links to its page).
  const [todo, setTodo] = useState({ requests: 0, imports: 0, gifts: 0, toBuy: 0, unpaid: 0, ready: 0, onWay: 0, carts: 0, today: 0, todaySales: 0 })
  const fetchTodo = async () => {
    const [r, i, g, b, c, so, np] = await Promise.allSettled([
      api.get('/admin/product-requests/stats'),
      api.get('/admin/import-items'),
      api.get('/admin/gift-cards'),
      api.get('/ps/bootstrap'),
      api.get('/admin/abandoned-carts'),
      api.get('/admin/products', { params: { stock: 'out', per_page: 1 } }),
      api.get('/admin/products', { params: { photo: 'missing', per_page: 1 } }),
    ])
    // the day's work from the orders themselves
    const orders = b.status === 'fulfilled' ? (b.value.data?.orders || []) : []
    const live = (o) => o.items.filter((x) => x.status !== 'cancelled')
    const remaining = (o) => live(o).reduce((a, x) => a + Number(x.price || 0), 0) + Number(o.delivery_fee || 0) + Number(o.tax || 0) - Number(o.discount || 0) - o.payments.reduce((a, p) => a + Number(p.amount || 0), 0)
    const todayKey = new Date().toDateString()
    const todays = orders.filter((o) => new Date(o.created_at).toDateString() === todayKey)
    const cartsList = c.status === 'fulfilled' ? (c.value.data?.data || c.value.data || []) : []
    setTodo({
      requests: r.status === 'fulfilled' ? (r.value.data?.data?.pending || 0) : 0,
      imports: i.status === 'fulfilled' ? (i.value.data?.counts?.pending || 0) : 0,
      gifts: g.status === 'fulfilled' ? (g.value.data?.totals?.pending || 0) : 0,
      toBuy: orders.filter((o) => live(o).some((x) => x.status === 'requested')).length,
      unpaid: orders.filter((o) => live(o).length && remaining(o) > 0.0005).length,
      ready: orders.filter((o) => live(o).some((x) => x.status === 'arrived')).length,
      onWay: orders.filter((o) => live(o).some((x) => x.status === 'out_for_delivery')).length,
      carts: Array.isArray(cartsList) ? cartsList.length : 0,
      soldOut: so.status === 'fulfilled' ? (so.value.data?.total || 0) : 0,
      noPhoto: np.status === 'fulfilled' ? (np.value.data?.total || 0) : 0,
      late: orders.filter((o) => {
        const lv = live(o)
        return lv.some((x) => (x.status === 'requested' && Date.now() - new Date(o.created_at) > 14 * 86400000)
          || (x.status === 'arrived' && Date.now() - new Date(x.arrived_at || o.created_at) > 3 * 86400000))
      }).length,
      gulf: orders.filter((o) => String(o.delivery_method || '').startsWith('gcc_') && live(o).length && live(o).some((x) => x.status !== 'delivered')).length,
      today: todays.length,
      todaySales: todays.reduce((a, o) => a + live(o).reduce((s2, x) => s2 + Number(x.price || 0), 0), 0),
    })
  }

  useEffect(() => {
    fetchDashboardStats()
    fetchTodo()
  }, [])

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      const maxScroll = scrollWidth - clientWidth
      setCanScrollLeft(Math.abs(scrollLeft) < maxScroll - 1)
      setCanScrollRight(Math.abs(scrollLeft) > 0)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [])

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' })
    }
  }

  // Cards Configuration
  const statsCards = [
    {
      label: 'إجمالي المبيعات',
      value: parseFloat(stats.total_revenue).toFixed(3),
      currency: 'OMR',
      change: `${changes.revenue > 0 ? '+' : ''}${changes.revenue}%`,
      dir: changes.revenue >= 0 ? 'up' : 'down',
      icon: RiBankCardLine,
      iconClass: 'icon-gold'
    },
    {
      label: 'إجمالي الطلبات',
      value: stats.total_orders.toLocaleString(),
      currency: '',
      change: `${changes.orders > 0 ? '+' : ''}${changes.orders}%`,
      dir: changes.orders >= 0 ? 'up' : 'down',
      icon: RiShoppingBag3Line,
      iconClass: 'icon-primary'
    },
    {
      label: 'إجمالي العملاء',
      value: stats.total_customers.toLocaleString(),
      currency: '',
      change: `${changes.customers > 0 ? '+' : ''}${changes.customers}%`,
      dir: changes.customers >= 0 ? 'up' : 'down',
      icon: RiGroupLine,
      iconClass: 'icon-blue'
    },
    {
      label: 'متوسط قيمة الطلب',
      value: parseFloat(stats.avg_order_value).toFixed(3),
      currency: 'OMR',
      change: `${changes.avg > 0 ? '+' : ''}${changes.avg}%`,
      dir: changes.avg >= 0 ? 'up' : 'down',
      icon: RiLineChartLine,
      iconClass: 'icon-green'
    },
    {
      label: 'طلبات قيد التنفيذ',
      value: stats.pending_orders.toLocaleString(),
      currency: '',
      change: `${changes.pending > 0 ? '+' : ''}${changes.pending}%`,
      dir: changes.pending <= 0 ? 'up' : 'down',
      icon: RiTimerLine,
      iconClass: 'icon-orange'
    },
    {
      label: 'نقاط الولاء الممنوحة',
      value: (stats.total_loyalty_points || 0).toLocaleString(),
      currency: '',
      change: `${changes.loyalty > 0 ? '+' : ''}${changes.loyalty}%`,
      dir: 'up',
      icon: RiStarSmileLine,
      iconClass: 'icon-purple'
    },
  ]

  // Status breakdown list
  const statusList = [
    { label: 'قيد المعالجة', count: (orderStatuses.pending || 0) + (orderStatuses.processing || 0), color: 'var(--status-processing)', icon: RiSettings3Line },
    { label: 'قيد الشحن',    count: orderStatuses.shipped || 0, color: 'var(--status-shipped)', icon: RiTruckLine },
    { label: 'في الطريق',    count: orderStatuses.out_for_delivery || 0, color: 'var(--color-gold-dark)', icon: RiMapPinLine },
    { label: 'تم التسليم',   count: orderStatuses.delivered || 0, color: 'var(--status-delivered)', icon: RiCheckboxCircleLine },
    { label: 'ملغي / مرتجع', count: (orderStatuses.cancelled || 0) + (orderStatuses.returned || 0), color: 'var(--status-cancelled)', icon: RiCloseCircleLine },
  ]

  const getStatusBadge = (status) => {
    switch (status) {
      case 'processing':
      case 'pending':
        return { label: 'قيد المعالجة', className: 'badge-processing' }
      case 'shipped':
        return { label: 'قيد الشحن', className: 'badge-shipped' }
      case 'out_for_delivery':
        return { label: 'في الطريق', className: 'badge-gold' }
      case 'delivered':
        return { label: 'تم التسليم', className: 'badge-delivered' }
      case 'cancelled':
        return { label: 'ملغي', className: 'badge-cancelled' }
      case 'returned':
        return { label: 'مرتجع', className: 'badge-cancelled' }
      default:
        return { label: status, className: 'badge-processing' }
    }
  }

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
  const first = (user.name || '').trim().split(' ')[0]
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'صباح الخير' : 'مساء الخير'
  const omr3 = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const kpis = statsCards.slice(0, 4)
  const statusTotal = statusList.reduce((a, s) => a + s.count, 0) || 1
  // "what needs doing today": each opens its list
  const todoList = [
    { n: todo.late, label: '⚠️ طلبات متأخرة', to: '/admin/app-orders?filter=late', icon: RiTimeLine },
    { n: todo.toBuy, label: 'طلبات تنتظر الشراء', to: '/admin/app-orders?filter=requested', icon: RiShoppingBag3Line },
    { n: todo.unpaid, label: 'طلبات عليها مبالغ', to: '/admin/app-orders?filter=unpaid', icon: RiBankCardLine },
    { n: todo.ready, label: 'وصلت وجاهزة للتوصيل', to: '/admin/app-orders?filter=arrived', icon: RiTruckLine },
    { n: todo.onWay, label: 'خرجت للتوصيل', to: '/admin/app-orders?filter=out_for_delivery', icon: RiMapPinLine },
    { n: todo.requests, label: 'طلبات قطع جديدة', to: '/admin/product-requests', icon: RiSearchLine },
    { n: todo.imports, label: 'منتجات تنتظر سعر', to: '/admin/import-items', icon: RiDownloadCloud2Line },
    { n: todo.carts, label: 'سلات متروكة', to: '/admin/abandoned-carts', icon: RiShoppingBag3Line },
    { n: todo.gifts, label: 'بطاقات هدايا تنتظر الدفع', to: '/admin/gift-cards', icon: RiGiftLine },
    { n: todo.gulf, label: 'شحنات خليجية مفتوحة', to: '/admin/app-orders?filter=gulf', icon: RiTruckLine },
    { n: todo.soldOut, label: 'منتجات نفدت من عُمان', to: '/admin/products?stock=out', icon: RiShoppingBag3Line },
    { n: todo.noPhoto, label: 'منتجات بدون صورة', to: '/admin/products?photo=missing', icon: RiShoppingBag3Line },
  ]

  return (
    <div className="page-inner dash" dir="rtl">
      <style>{DASH_CSS}</style>
      <div className="dash-head">
        <div>
          <div className="dash-kicker">{new Date().toLocaleDateString('ar-OM-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="page-title-main">{hello}{first ? `، ${first}` : ''}</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>اليوم: <b>{todo.today}</b> طلب · <b>{omr3(todo.todaySales)}</b> ر.ع</div>
        </div>
        <button onClick={() => { fetchDashboardStats(); fetchTodo() }} className="btn btn-ghost btn-sm">
          <RiRefreshLine size={15} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {/* Waiting for you */}
      <div className="dash-todo">
        {todoList.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.label} className={`dash-todo-item${t.n ? ' on' : ''}`} onClick={() => navigate(t.to)}>
              <Icon size={18} />
              <span className="dash-todo-n">{t.n}</span>
              <span className="dash-todo-l">{t.label}</span>
              <RiArrowLeftLine size={15} className="dash-todo-go" />
            </button>
          )
        })}
      </div>

      {/* Key numbers */}
      <div className="dash-kpis">
        {kpis.map((s) => (
          <div key={s.label} className="dash-kpi">
            <div className="dash-kpi-l">{s.label}</div>
            <div className="dash-kpi-v">{s.value}{s.currency ? <small> ر.ع</small> : null}</div>
            <div className={`dash-kpi-c ${s.dir}`}><span dir="ltr">{s.change}</span> عن الشهر الماضي</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card dash-chart">
          <div className="card-header"><span className="card-title">المبيعات · آخر 14 يوم</span></div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesChart.length > 0 ? salesChart : [{ date: 'اليوم', value: Number(stats.total_revenue) || 0 }]} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="ghArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5C0B16" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#5C0B16" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F0EEEA" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9A958F' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9A958F' }} width={56} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E9E6E1' }} />
                <Area type="monotone" dataKey="value" stroke="#5C0B16" strokeWidth={2} fill="url(#ghArea)" dot={false} activeDot={{ r: 5, fill: '#5C0B16', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card dash-status">
          <div className="card-header"><span className="card-title">حالة طلبات المتجر</span></div>
          <div className="card-body">
            {statusList.map((s) => (
              <div key={s.label} className="dash-bar">
                <div className="dash-bar-top"><span>{s.label}</span><b>{s.count}</b></div>
                <div className="dash-bar-track"><i style={{ width: `${Math.round((s.count / statusTotal) * 100)}%`, background: s.color }} /></div>
              </div>
            ))}
            {categorySales.length ? (
              <>
                <div className="dash-sub-title">حسب القسم</div>
                {categorySales.slice(0, 5).map((c) => (
                  <div key={c.name} className="dash-bar">
                    <div className="dash-bar-top"><span>{c.name}</span><b>{c.value}%</b></div>
                    <div className="dash-bar-track"><i style={{ width: `${c.value}%`, background: '#A88443' }} /></div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card mb-0">
          <div className="card-header">
            <span className="card-title">آخر طلبات المتجر</span>
            <button onClick={() => navigate('/admin/app-orders')} className="btn btn-ghost btn-sm">كل الطلبات</button>
          </div>
          <div className="dash-table">
            <table>
              <thead><tr><th>الطلب</th><th>العميل</th><th>المبلغ</th><th>الحالة</th></tr></thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-light)', padding: 28 }}>ما في طلبات للحين</td></tr>
                ) : recentOrders.map((o) => {
                  const badge = getStatusBadge(o.status)
                  return (
                    <tr key={o.id} onClick={() => navigate('/admin/app-orders')} style={{ cursor: 'pointer' }}>
                      <td className="dash-mono">{o.order_number}</td>
                      <td>{o.customer ? o.customer.name : (o.shipping_address?.name || o.guest_name || 'زائر')}</td>
                      <td className="dash-mono">{omr3(o.total_amount)}</td>
                      <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card mb-0 dash-quick">
          <div className="card-header"><span className="card-title">اختصارات</span></div>
          <div className="card-body">
            {[
              { label: 'إضافة منتج', to: '/admin/products', icon: RiAddLine },
              { label: 'منتجات من مواقع البراندات', to: '/admin/import-items', icon: RiDownloadCloud2Line },
              { label: 'إصدار بطاقة هدية', to: '/admin/gift-cards', icon: RiGiftLine },
              { label: 'العملاء', to: '/admin/customers', icon: RiUserAddLine },
              { label: 'الفواتير', to: '/admin/invoices', icon: RiBillLine },
              { label: 'التقارير', to: '/admin/reports', icon: RiBarChartGroupedLine },
            ].map((q) => {
              const Icon = q.icon
              return (
                <button key={q.label} onClick={() => navigate(q.to)} className="dash-quick-item">
                  <Icon size={18} /><span>{q.label}</span><RiArrowLeftLine size={14} className="dash-todo-go" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const DASH_CSS = `
.dash-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:18px}
.dash-kicker{font-size:13px;color:var(--text-secondary);margin-bottom:4px}
.dash .btn{display:inline-flex;align-items:center;gap:6px}
.dash-todo{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.dash-todo-item{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px 14px;color:var(--text-secondary);text-align:start;font:inherit;cursor:pointer;transition:border-color .15s}
.dash-todo-item:hover{border-color:#CFCAC3}
.dash-todo-item.on{color:var(--ink);border-color:#E6D3B0;background:#FFFCF6}
.dash-todo-item.on svg:first-child{color:var(--accent)}
.dash-todo-n{font-size:20px;font-weight:700;min-width:22px}
.dash-todo-l{flex:1;font-size:13px}
.dash-todo-go{opacity:.4}
.dash-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.dash-kpi{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px}
.dash-kpi-l{font-size:12.5px;color:var(--text-secondary)}
.dash-kpi-v{font-size:26px;font-weight:700;margin-top:6px;letter-spacing:-.3px}
.dash-kpi-v small{font-size:13px;font-weight:500;color:var(--text-secondary)}
.dash-kpi-c{font-size:12px;color:var(--text-secondary);margin-top:4px}
.dash-kpi-c span{font-weight:600}
.dash-kpi-c.up span{color:#15803D}
.dash-kpi-c.down span{color:#B42318}
.dash-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:14px;margin-bottom:14px}
.dash-grid .card{margin-bottom:0}
.dash-bar{margin-bottom:12px}
.dash-bar-top{display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);margin-bottom:6px}
.dash-bar-top b{color:var(--ink)}
.dash-bar-track{height:6px;border-radius:6px;background:#F0EEEA;overflow:hidden}
.dash-bar-track i{display:block;height:100%;border-radius:6px;min-width:2px}
.dash-sub-title{font-size:12px;font-weight:600;color:var(--text-light);margin:18px 0 10px}
.dash-table{overflow-x:auto}
.dash-table table{width:100%}
.dash-mono{font-variant-numeric:tabular-nums;direction:ltr;text-align:right;white-space:nowrap;font-size:13px}
.dash-quick .card-body{display:flex;flex-direction:column;gap:6px}
.dash-quick-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:10px;border:1px solid var(--border);background:#fff;font:inherit;font-size:14px;color:var(--ink);cursor:pointer;text-align:start}
.dash-quick-item span{flex:1}
.dash-quick-item:hover{background:var(--bg-body)}
@media (max-width:1100px){.dash-todo,.dash-kpis{grid-template-columns:repeat(2,1fr)}.dash-grid{grid-template-columns:1fr}}
@media (max-width:560px){.dash-todo,.dash-kpis{grid-template-columns:1fr 1fr}.dash-kpi-v{font-size:21px}}
`
