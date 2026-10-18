import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
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
  RiRefreshLine
} from 'react-icons/ri'
import OmrSymbol from '../../components/OmrSymbol'
import { adminApi } from '../../services/adminApi'

// ---- Custom Tooltip ----
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 6, fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#4A0D17', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

  const [changes, setChanges] = useState({
    revenue: 12.5,
    orders: 8.7,
    customers: 15.2,
    avg: 5.2,
    pending: -9.1,
    loyalty: 19.7,
  })

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

  useEffect(() => {
    fetchDashboardStats()
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

  return (
    <div className="page" dir="rtl">
      {/* Header */}
      <div className="dashboard-header flex flex-mobile-col justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            مرحباً غسان <span className="wave-emoji">👋</span>
          </h1>
          <p className="text-gray-500">إليك نظرة عامة على أداء متجرك اليوم، لنجعل اليوم رائعاً!</p>
        </div>
        <button
          onClick={fetchDashboardStats}
          className="p-2.5 bg-white hover:bg-gray-50 rounded-xl text-gray-600 transition-all border border-gray-200 shadow-sm flex items-center gap-2 text-xs font-bold"
        >
          <RiRefreshLine size={16} className={loading ? 'animate-spin' : ''} />
          تحديث الإحصائيات
        </button>
      </div>

      {/* ====== Stat Cards with Carousel Arrows ====== */}
      <div className="stats-carousel-wrapper" style={{ position: 'relative', marginBottom: '32px' }}>
        {canScrollRight && (
          <button className="carousel-arrow right-arrow" onClick={() => scroll('right')}>
            <RiArrowRightSLine size={24} />
          </button>
        )}
        
        <div className="stats-grid-scrollable" ref={scrollRef} onScroll={checkScroll}>
          {statsCards.map((s, i) => {
            const Icon = s.icon
            return (
              <div className="stat-card-new" key={i}>
                {/* Right Side - Text Content */}
                <div className="stat-content-right">
                  <div className="stat-label-new">{s.label}</div>
                  <div className="stat-value-row">
                    {s.currency && <span className="stat-currency-new">{s.currency}</span>}
                    <span className="stat-number-new font-mono">{s.value}</span>
                  </div>
                  <div className="stat-change-row">
                    <div className="stat-change-text-new">عن الفترة السابقة</div>
                    <div className={`stat-change-badge-new ${s.dir}`}>
                      <span dir="ltr">{s.dir === 'up' ? '+' : '-'}{s.change.replace(/[+-]/g, '')}</span>
                    </div>
                  </div>
                </div>

                {/* Left Side - Icon */}
                <div className={`stat-icon-left ${s.iconClass}`}>
                  <Icon size={20} className="inner-icon" />
                </div>
              </div>
            )
          })}
        </div>

        {canScrollLeft && (
          <button className="carousel-arrow left-arrow" onClick={() => scroll('left')}>
            <RiArrowLeftSLine size={24} />
          </button>
        )}
      </div>

      {/* ====== Charts Row ====== */}
      <div className="charts-grid">
        {/* Line Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">تطور المبيعات</span>
            <select className="input" style={{ width: 130, height: 36, padding: '4px 12px' }}>
              <option>آخر 14 يوم</option>
              <option>هذا الشهر</option>
              <option>هذا العام</option>
            </select>
          </div>
          <div className="card-body" style={{ paddingTop: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={salesChart.length > 0 ? salesChart : [{ date: 'اليوم', value: stats.total_revenue }]} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF', fontFamily: 'Tajawal' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF', fontFamily: 'Tajawal' }} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(74, 13, 23, 0.1)', strokeWidth: 2 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4A0D17"
                  strokeWidth={3}
                  dot={{ fill: '#fff', r: 5, strokeWidth: 2, stroke: '#4A0D17' }}
                  activeDot={{ r: 8, fill: '#B5915F', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">توزيع المبيعات حسب الأقسام</span>
            <button onClick={() => navigate('/admin/reports')} className="btn btn-ghost btn-sm">تقرير</button>
          </div>
          <div className="card-body flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={categorySales.length > 0 ? categorySales : [{ name: 'المنتجات', value: 100, color: '#4A0D17' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {categorySales.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => `${val}%`} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="w-full mt-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
              {categorySales.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{p.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Status */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">حالة الطلبات</span>
          </div>
          <div className="card-body">
            {statusList.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={i} className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                      <Icon size={18} />
                    </div>
                    <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>{s.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ====== Bottom Row ====== */}
      <div className="dashboard-bottom">
        {/* Recent Orders Table */}
        <div className="card mb-0">
          <div className="card-header">
            <span className="card-title">آخر الطلبات المستلمة</span>
            <button onClick={() => navigate('/admin/orders')} className="btn btn-ghost btn-sm">عرض كل الطلبات</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-gray-400">لا توجد طلبات حديثة</td>
                  </tr>
                ) : (
                  recentOrders.map((o) => {
                    const badge = getStatusBadge(o.status)
                    return (
                      <tr key={o.id} onClick={() => navigate('/admin/orders')} className="cursor-pointer hover:bg-amber-50/20">
                        <td style={{ fontWeight: 700, color: 'var(--color-primary)' }} className="font-mono">{o.order_number}</td>
                        <td style={{ fontWeight: 500 }}>{o.customer ? o.customer.name : (o.shipping_address?.name || 'زائر (Guest)')}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'Outfit' }}>
                          <div className="flex items-center gap-1">
                            <OmrSymbol size={13} primaryColor="#4A0D17" secondaryColor="#B5915F" />
                            <span className="font-mono">{parseFloat(o.total_amount).toFixed(3)}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${badge.className}`}>{badge.label}</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card mb-0">
          <div className="card-header">
            <span className="card-title">إجراءات سريعة</span>
          </div>
          <div className="card-body grid-2">
            <button
              onClick={() => navigate('/admin/products')}
              className="btn btn-primary w-full"
              style={{ justifyContent: 'flex-start', height: 48 }}
            >
              <RiAddLine size={20} /> إضافة منتج جديد
            </button>
            <button
              onClick={() => navigate('/admin/invoices')}
              className="btn btn-gold w-full"
              style={{ justifyContent: 'flex-start', height: 48 }}
            >
              <RiBillLine size={20} /> إنشاء فاتورة
            </button>
            <button
              onClick={() => navigate('/admin/customers')}
              className="btn btn-outline w-full"
              style={{ justifyContent: 'flex-start', height: 48 }}
            >
              <RiUserAddLine size={20} /> إدارة العملاء
            </button>
            <button
              onClick={() => navigate('/admin/reports')}
              className="btn btn-ghost w-full"
              style={{ justifyContent: 'flex-start', height: 48 }}
            >
              <RiBarChartGroupedLine size={20} /> تقرير المبيعات التفصيلي
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
