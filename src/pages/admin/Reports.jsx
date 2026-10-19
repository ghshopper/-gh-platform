import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../services/adminApi'
import toast from 'react-hot-toast'
import {
  RiBarChartBoxLine, RiDownloadCloud2Line, RiCalendarLine, RiRefreshLine,
  RiArrowUpLine, RiArrowDownLine, RiShoppingBag3Line, RiMoneyDollarCircleLine,
  RiCheckboxCircleLine, RiCloseCircleLine, RiBankCardLine, RiTruckLine,
  RiMapPinLine, RiStarLine, RiFireLine, RiPieChartLine, RiLineChartLine,
} from 'react-icons/ri'

const PRIMARY      = '#4A0D17'
const PRIMARY_DARK = '#2A080D'
const PRIMARY_LIGHT= '#6B1A2A'
const GOLD         = '#B5915F'
const GOLD_DARK    = '#8B6B3D'

const formatAmount = (val) => parseFloat(val || 0).toFixed(3)

export default function Reports() {
  const [range, setRange] = useState('30days')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const fetchReports = useCallback(async (selectedRange) => {
    try {
      setLoading(true)
      const res = await adminApi.getReportsOverview({ range: selectedRange || range })
      setData(res.data || null)
    } catch (err) {
      console.error('Error fetching reports:', err)
      toast.error('تعذر جلب بيانات التقارير والتحليلات')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchReports(range)
  }, [range, fetchReports])

  const summary = data?.summary || {}
  const trends = data?.trends || []
  const topProducts = data?.top_products || []
  const paymentMethods = data?.payment_methods || []
  const statusFunnel = data?.status_funnel || []
  const regionalBreakdown = data?.regional_breakdown || []

  // Max sales in trend for SVG chart scaling
  const maxTrendSales = Math.max(...trends.map(t => t.sales || 0), 1)

  const exportCSV = () => {
    if (!data) return toast.error('لا توجد بيانات متاحة للتصدير')
    const headers = ['المؤشر', 'القيمة']
    const rows = [
      ['إجمالي المبيعات', `${formatAmount(summary.total_sales)} ر.ع`],
      ['إجمالي الطلبات', summary.total_orders || 0],
      ['الطلبات المسلمة بنجاح', summary.delivered_orders || 0],
      ['الطلبات الملغاة', summary.cancelled_orders || 0],
      ['متوسط قيمة الطلب (AOV)', `${formatAmount(summary.average_order_value)} ر.ع`],
      ['إجمالي الضرائب المحصلة', `${formatAmount(summary.total_tax)} ر.ع`],
      ['إجمالي رسوم الشحن', `${formatAmount(summary.total_shipping)} ر.ع`],
      ['نسبة الإنجاز والتسليم', `${summary.delivery_rate || 0}%`],
    ]

    const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `executive-report-${range}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير التقرير التنفيذي بنجاح')
  }

  return (
    <div className="page-container" style={{ direction: 'rtl' }}>

      {/* ─── Header ─── */}
      <div className="gh-hero" style={{
        background: `linear-gradient(135deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 50%, ${PRIMARY_LIGHT} 100%)`,
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(74,13,23,0.35)`,
      }}>
        <div style={{ position:'absolute', top:-60, left:-60, width:200, height:200, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.15)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-30, left:-30, width:140, height:140, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.1)`, pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', flexWrap:'wrap', gap:14 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ color:'#fff', fontSize:26, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>التقارير والتحليلات التنفيذية</h1>
              <span style={{ background:'rgba(181,145,95,0.2)', border:`1px solid ${GOLD}`, color:GOLD, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                BI Analytics
              </span>
            </div>
            <p style={{ color:`rgba(255,255,255,0.6)`, fontSize:13, margin:'6px 0 0' }}>
              مؤشرات الأداء المالي، حجم المبيعات، كفاءة الشحن والتوصيل، وسلوك العملاء
            </p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={() => fetchReports(range)} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:10,
              background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)',
              color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, backdropFilter:'blur(4px)',
            }}>
              <RiRefreshLine size={16}/>تحديث
            </button>
            <button onClick={exportCSV} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:10,
              background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`, border:'none',
              color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600,
              boxShadow:`0 4px 14px rgba(181,145,95,0.4)`,
            }}>
              <RiDownloadCloud2Line size={16}/>تصدير التقرير
            </button>
          </div>
        </div>

        {/* Date Filter Pills */}
        <div style={{
          display:'flex', gap:8, marginTop:20, flexWrap:'wrap',
          background:'rgba(0,0,0,0.2)', padding:'6px 10px', borderRadius:12, width:'fit-content',
        }}>
          {[
            { key:'today', label:'اليوم' },
            { key:'7days', label:'آخر 7 أيام' },
            { key:'30days', label:'آخر 30 يوماً' },
            { key:'this_month', label:'هذا الشهر' },
            { key:'this_year', label:'هذا العام' },
            { key:'all', label:'كافة الفترات' },
          ].map(p => {
            const active = range === p.key
            return (
              <button
                key={p.key}
                onClick={() => setRange(p.key)}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'none',
                  background: active ? GOLD : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.8)',
                  fontSize:12.5, fontWeight: active ? 700 : 500, cursor:'pointer',
                  transition:'all 0.15s',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Executive Summary KPI Cards ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'إجمالي المبيعات المحققة', value: `${formatAmount(summary.total_sales)} ر.ع`, color:'#10B981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.2)', icon: RiMoneyDollarCircleLine, sub:`صافي المنتجات: ${formatAmount(summary.total_subtotal)} ر.ع` },
          { label:'متوسط قيمة الطلب (AOV)', value: `${formatAmount(summary.average_order_value)} ر.ع`, color:GOLD_DARK, bg:'rgba(181,145,95,0.12)', border:'rgba(181,145,95,0.25)', icon: RiStarLine, sub:'متوسط سلة العميل' },
          { label:'إجمالي الطلبات', value: summary.total_orders || 0, color:PRIMARY, bg:'rgba(74,13,23,0.08)', border:'rgba(74,13,23,0.2)', icon: RiShoppingBag3Line, sub:`${summary.delivered_orders || 0} طلب تم تسليمه` },
          { label:'نسبة إتمام الطلبات', value: `${summary.delivery_rate || 0}%`, color:'#3B82F6', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.2)', icon: RiCheckboxCircleLine, sub:`نسبة الإلغاء: ${summary.cancellation_rate || 0}%` },
        ].map(({ label, value, color, bg, border, icon: Icon, sub }) => (
          <div key={label} style={{
            background:'#fff', borderRadius:14, padding:'20px 22px',
            border:`1px solid ${border}`, boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:11.5, color:'#9CA3AF', marginBottom:8, fontWeight:600 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#1A1A2E', lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:6 }}>{sub}</div>
              </div>
              <div style={{ width:42, height:42, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={20} style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Sales Trends Chart Section ─── */}
      <div style={{
        background:'#fff', borderRadius:16, padding:24, marginBottom:24,
        border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:800, color:PRIMARY, margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <RiLineChartLine size={20} /> مسار نمو المبيعات والإيرادات اليومية
            </h2>
            <p style={{ fontSize:12.5, color:'#9CA3AF', margin:'4px 0 0' }}>مخطط توضيحي لحجم المبيعات حسب التاريخ</p>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:GOLD_DARK, background:'rgba(181,145,95,0.1)', padding:'6px 14px', borderRadius:20 }}>
            إجمالي الفترة: {formatAmount(summary.total_sales)} ر.ع
          </div>
        </div>

        {/* Visual Bar Graph */}
        <div style={{ height:220, display:'flex', alignItems:'flex-end', gap:8, paddingTop:30, paddingBottom:10, overflowX:'auto' }}>
          {trends.length === 0 ? (
            <div style={{ width:'100%', textAlign:'center', color:'#9CA3AF', padding:40 }}>لا توجد حركات مبيعات في الفترة المحددة</div>
          ) : trends.map((t, idx) => {
            const heightPct = Math.max(Math.round((t.sales / maxTrendSales) * 100), 8)
            return (
              <div key={idx} style={{ flex:1, minWidth:28, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                <div style={{ fontSize:10, fontWeight:700, color: t.sales > 0 ? PRIMARY : '#9CA3AF' }}>
                  {t.sales > 0 ? `${Math.round(t.sales)}` : '0'}
                </div>
                <div
                  title={`${t.label}: ${formatAmount(t.sales)} ر.ع (${t.orders} طلب)`}
                  style={{
                    width:'100%', maxWidth:36, height:`${heightPct}%`,
                    borderRadius:'6px 6px 0 0',
                    background: t.sales > 0 ? `linear-gradient(180deg, ${PRIMARY_LIGHT}, ${PRIMARY})` : '#E5E7EB',
                    transition:'all 0.3s ease', cursor:'pointer',
                    boxShadow: t.sales > 0 ? `0 2px 8px rgba(74,13,23,0.25)` : 'none',
                  }}
                  onMouseEnter={e => { if (t.sales > 0) e.currentTarget.style.background = GOLD }}
                  onMouseLeave={e => { if (t.sales > 0) e.currentTarget.style.background = `linear-gradient(180deg, ${PRIMARY_LIGHT}, ${PRIMARY})` }}
                />
                <div style={{ fontSize:10, color:'#6B7280', whiteSpace:'nowrap', transform:'rotate(-30deg)', marginTop:4 }}>
                  {t.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Two Columns: Top Products & Payment Methods ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20, marginBottom:24 }}>
        
        {/* Top Selling Products */}
        <div style={{
          background:'#fff', borderRadius:16, padding:24,
          border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h2 style={{ fontSize:16, fontWeight:800, color:PRIMARY, margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <RiFireLine size={20} color="#EF4444" /> أكثر المنتجات طلباً ومبيعاً
            </h2>
            <span style={{ fontSize:12, color:'#9CA3AF' }}>مرتبة حسب الإيراد</span>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {topProducts.length === 0 ? (
              <p style={{ color:'#9CA3AF', textAlign:'center', padding:20 }}>لا توجد مبيعات منتجات في هذه الفترة</p>
            ) : topProducts.map((prod, idx) => (
              <div key={prod.product_id || idx} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 14px', borderRadius:12, background:'#F9FAFB', border:'1px solid #E5E7EB',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:28, height:28, borderRadius:'50%', flexShrink:0,
                    background: idx === 0 ? GOLD : (idx === 1 ? '#9CA3AF' : (idx === 2 ? '#D97706' : '#E5E7EB')),
                    color: idx < 3 ? '#fff' : '#6B7280', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:800,
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'#1A1A2E' }}>{prod.name}</div>
                    <div style={{ fontSize:11.5, color:'#9CA3AF' }}>{prod.category} • السعر: {formatAmount(prod.unit_price)} ر.ع</div>
                  </div>
                </div>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:14, fontWeight:800, color:PRIMARY }}>{formatAmount(prod.total_revenue)} <span style={{ fontSize:10, color:'#9CA3AF' }}>ر.ع</span></div>
                  <div style={{ fontSize:11.5, color:'#10B981', fontWeight:600 }}>{prod.units_sold} قطعة مباعة</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div style={{
          background:'#fff', borderRadius:16, padding:24,
          border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h2 style={{ fontSize:16, fontWeight:800, color:PRIMARY, margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <RiBankCardLine size={20} /> توزيع طرق الدفع
            </h2>
            <span style={{ fontSize:12, color:'#9CA3AF' }}>النسبة المئوية</span>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {paymentMethods.length === 0 ? (
              <p style={{ color:'#9CA3AF', textAlign:'center', padding:20 }}>لا توجد معاملات مسجلة</p>
            ) : paymentMethods.map((pm, idx) => (
              <div key={pm.method || idx}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{pm.label}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:PRIMARY }}>{formatAmount(pm.sales)} ر.ع ({pm.percentage}%)</span>
                </div>
                <div style={{ width:'100%', height:8, borderRadius:4, background:'#E5E7EB', overflow:'hidden' }}>
                  <div style={{
                    width:`${pm.percentage}%`, height:'100%', borderRadius:4,
                    background: idx === 0 ? PRIMARY : (idx === 1 ? GOLD : '#3B82F6'),
                  }} />
                </div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:3 }}>{pm.count} معاملة مسجلة</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─── Two Columns: Order Lifecycle Funnel & Regional Distribution ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        
        {/* Order Lifecycle Funnel */}
        <div style={{
          background:'#fff', borderRadius:16, padding:24,
          border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:PRIMARY, margin:'0 0 16px', display:'flex', alignItems:'center', gap:8 }}>
            <RiTruckLine size={20} /> مسار قمع الطلبات (Order Lifecycle)
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {statusFunnel.map((st, idx) => (
              <div key={st.status || idx} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 16px', borderRadius:12, background:'#F9FAFB', border:`1px solid #E5E7EB`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background: st.color }} />
                  <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>{st.label}</span>
                </div>
                <span style={{ fontSize:15, fontWeight:800, color: st.color }}>{st.count} طلب</span>
              </div>
            ))}
          </div>
        </div>

        {/* Regional / Wilayats Breakdown */}
        <div style={{
          background:'#fff', borderRadius:16, padding:24,
          border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:PRIMARY, margin:'0 0 16px', display:'flex', alignItems:'center', gap:8 }}>
            <RiMapPinLine size={20} /> الطلبات حسب الولايات والمحافظات
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {regionalBreakdown.length === 0 ? (
              <p style={{ color:'#9CA3AF', textAlign:'center', padding:20 }}>لا توجد بيانات جغرافية متوفرة</p>
            ) : regionalBreakdown.map((reg, idx) => (
              <div key={reg.region || idx} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 16px', borderRadius:12, background:'#F9FAFB', border:'1px solid #E5E7EB',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <RiMapPinLine size={16} color={GOLD_DARK} />
                  <span style={{ fontSize:13, fontWeight:700, color:'#1A1A2E' }}>{reg.region}</span>
                </div>
                <div style={{ textAlign:'left' }}>
                  <span style={{ fontSize:13, fontWeight:800, color:PRIMARY }}>{formatAmount(reg.sales)} ر.ع</span>
                  <span style={{ fontSize:11.5, color:'#6B7280', marginRight:8 }}>({reg.orders} طلب)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}
