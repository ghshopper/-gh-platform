import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../services/adminApi'
import toast from 'react-hot-toast'
import {
  RiSearchLine, RiDownloadCloud2Line, RiEyeLine, RiBox3Line, RiCloseLine,
  RiBankCardLine, RiSmartphoneLine, RiMoneyDollarCircleLine, RiCheckboxCircleLine,
  RiCloseCircleLine, RiRefund2Line, RiTimeLine, RiUserLine, RiCalendarLine,
  RiArrowUpLine, RiArrowDownLine, RiRefreshLine,
} from 'react-icons/ri'

const PRIMARY      = '#4A0D17'
const PRIMARY_DARK = '#2A080D'
const PRIMARY_LIGHT= '#6B1A2A'
const GOLD         = '#B5915F'
const GOLD_DARK    = '#8B6B3D'

import GHPagination from '../../components/GHPagination'

const METHOD_CONFIG = {
  card:            { label: 'بطاقة ائتمانية', icon: RiBankCardLine,          color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
  cash:            { label: 'نقداً',           icon: RiMoneyDollarCircleLine, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  apple_pay:       { label: 'Apple Pay',        icon: RiSmartphoneLine,        color: '#1A1A2E', bg: 'rgba(26,26,46,0.1)'   },
  google_pay:      { label: 'Google Pay',       icon: RiSmartphoneLine,        color: '#4285F4', bg: 'rgba(66,133,244,0.1)' },
  bank_transfer:   { label: 'تحويل بنكي',      icon: RiBankCardLine,          color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  loyalty_points:  { label: 'نقاط الولاء',     icon: RiArrowUpLine,           color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  cod:             { label: 'الدفع عند الاستلام', icon: RiMoneyDollarCircleLine, color: '#059669', bg: 'rgba(5,150,105,0.1)'  },
  cash_on_delivery:{ label: 'الدفع عند الاستلام', icon: RiMoneyDollarCircleLine, color: '#059669', bg: 'rgba(5,150,105,0.1)'  },
  amwalpay:        { label: 'Amwal Pay (بطاقة)', icon: RiBankCardLine,          color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
}

const STATUS_CONFIG = {
  completed: { label: 'مكتملة', color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border:'rgba(16,185,129,0.25)', dot:'#10B981', icon: RiCheckboxCircleLine },
  pending:   { label: 'معلقة',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.25)', dot:'#F59E0B', icon: RiTimeLine },
  failed:    { label: 'فاشلة',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border:'rgba(239,68,68,0.25)',  dot:'#EF4444', icon: RiCloseCircleLine },
  refunded:  { label: 'مستردة', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border:'rgba(139,92,246,0.25)', dot:'#8B5CF6', icon: RiRefund2Line },
}

const formatAmount = (amount) => parseFloat(amount || 0).toFixed(3)

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminApi.getPayments()
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || [])
      setPayments(Array.isArray(raw) ? raw : [])
    } catch (err) {
      console.error('Error fetching payments:', err)
      toast.error('تعذر جلب بيانات المدفوعات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const totalRefunded = payments.filter(p => p.status === 'refunded').reduce((s, p) => s + parseFloat(p.amount || 0), 0)

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = (p.reference_number || p.ref || '').toLowerCase().includes(q)
      || (p.customer?.name || '').toLowerCase().includes(q)
      || (p.order?.guest_name || '').toLowerCase().includes(q)
      || (p.order?.order_number || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchMethod = methodFilter === 'all' || p.method === methodFilter || (methodFilter === 'cod' && (p.method === 'cash_on_delivery' || p.method === 'cash'))
    return matchSearch && matchStatus && matchMethod
  })

  const itemsPerPage = 10
  const lastPage = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const paginatedPayments = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, methodFilter])

  const handleUpdateStatus = async (paymentId, newStatus) => {
    try {
      setUpdating(true)
      const res = await adminApi.updatePaymentStatus(paymentId, newStatus)
      toast.success('تم تحديث حالة الدفعة بنجاح')
      
      const updatedPayment = res.data?.data || res.data
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...updatedPayment, status: newStatus } : p))
      if (selected && selected.id === paymentId) {
        setSelected(prev => ({ ...prev, ...updatedPayment, status: newStatus }))
      }
    } catch (err) {
      toast.error('فشل تحديث حالة الدفعة: ' + (err.response?.data?.message || err.message))
    } finally {
      setUpdating(false)
    }
  }

  const exportCSV = () => {
    if (payments.length === 0) return toast.error('لا توجد بيانات للتصدير')
    const headers = ['رقم المعاملة', 'رقم الطلب', 'العميل', 'طريقة الدفع', 'المبلغ', 'الحالة', 'تاريخ المعاملة']
    const rows = payments.map(p => [
      p.reference_number || `TXN-${p.id}`,
      p.order?.order_number || '-',
      p.customer?.name || p.order?.guest_name || 'ضيف',
      (METHOD_CONFIG[p.method] || {}).label || p.method,
      formatAmount(p.amount),
      (STATUS_CONFIG[p.status] || {}).label || p.status,
      p.created_at || '-'
    ])
    const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-export-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير ملف المدفوعات بنجاح')
  }

  return (
    <div className="page-container" style={{ direction: 'rtl' }}>

      {/* ─── Header ─── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 50%, ${PRIMARY_LIGHT} 100%)`,
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(74,13,23,0.35)`,
      }}>
        <div style={{ position:'absolute', top:-60, left:-60, width:200, height:200, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.15)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-30, left:-30, width:140, height:140, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.1)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-50, right:60, width:160, height:160, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.08)`, pointerEvents:'none' }} />
        <div className="flex-mobile-col" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
          <div>
            <h1 style={{ color:'#fff', fontSize:26, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>المدفوعات</h1>
            <p style={{ color:`rgba(255,255,255,0.6)`, fontSize:13, margin:'6px 0 0' }}>
              {loading ? 'جاري التحميل...' : `${payments.length} معاملة إجمالاً`}
            </p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={fetchPayments} style={{
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
              <RiDownloadCloud2Line size={16}/>تصدير Excel
            </button>
          </div>
        </div>
      </div>

      {/* ─── Stats ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'إجمالي الإيرادات', value: formatAmount(totalRevenue), color:'#10B981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.2)', icon: RiArrowUpLine,       sub:`${payments.filter(p=>p.status==='completed').length} معاملة` },
          { label:'معلقة (بانتظار التحصيل)', value: formatAmount(totalPending),  color:'#F59E0B', bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.2)', icon: RiTimeLine,          sub:`${payments.filter(p=>p.status==='pending').length} معاملة` },
          { label:'مستردة',           value: formatAmount(totalRefunded), color:'#8B5CF6', bg:'rgba(139,92,246,0.1)', border:'rgba(139,92,246,0.2)', icon: RiRefund2Line,       sub:`${payments.filter(p=>p.status==='refunded').length} معاملة` },
          { label:'نسبة النجاح',      value: `${payments.length ? Math.round(payments.filter(p=>p.status==='completed').length/payments.length*100) : 0}%`, color:'#3B82F6', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.2)', icon: RiCheckboxCircleLine, sub:'من إجمالي المعاملات' },
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
              <div style={{ width:40, height:40, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={20} style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Filters ─── */}
      <div style={{
        background:'#fff', borderRadius:14, padding:'16px 20px', marginBottom:20,
        border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 8px rgba(0,0,0,0.04)',
        display:'flex', gap:12, alignItems:'center', flexWrap:'wrap',
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap:8, flex:1, minWidth:220,
          background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:10, padding:'8px 14px',
        }}>
          <RiSearchLine size={16} color="#9CA3AF" />
          <input
            placeholder="بحث برقم المعاملة، الطلب، أو العميل..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ border:'none', background:'transparent', outline:'none', fontSize:13, width:'100%', direction:'rtl' }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
          padding:'8px 14px', borderRadius:10, border:'1px solid #E5E7EB',
          fontSize:13, background:'#F9FAFB', outline:'none', cursor:'pointer', direction:'rtl',
        }}>
          <option value="all">كل الحالات</option>
          <option value="completed">مكتملة</option>
          <option value="pending">معلقة</option>
          <option value="failed">فاشلة</option>
          <option value="refunded">مستردة</option>
        </select>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{
          padding:'8px 14px', borderRadius:10, border:'1px solid #E5E7EB',
          fontSize:13, background:'#F9FAFB', outline:'none', cursor:'pointer', direction:'rtl',
        }}>
          <option value="all">كل طرق الدفع</option>
          <option value="cod">عند الاستلام (COD)</option>
          <option value="card">بطاقة ائتمانية</option>
          <option value="amwalpay">Amwal Pay</option>
          <option value="apple_pay">Apple Pay</option>
          <option value="bank_transfer">تحويل بنكي</option>
          <option value="cash">نقداً</option>
        </select>
      </div>

      {/* ─── Table ─── */}
      <div style={{
        background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.06)',
        boxShadow:'0 2px 12px rgba(0,0,0,0.04)', overflow:'hidden',
      }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', direction:'rtl' }}>
            <thead>
              <tr style={{ background:`linear-gradient(135deg, rgba(74,13,23,0.04), rgba(181,145,95,0.06))` }}>
                {['رقم المعاملة','رقم الطلب','العميل','طريقة الدفع','التاريخ','المبلغ','الحالة','تفاصيل'].map(h => (
                  <th key={h} style={{
                    padding:'14px 16px', fontSize:12, fontWeight:700, color:'#6B7280',
                    textAlign:'right', borderBottom:'2px solid rgba(74,13,23,0.08)', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:56 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid rgba(74,13,23,0.1)`, borderTop:`2px solid ${PRIMARY}`, animation:'spin 1s linear infinite', margin:'0 auto 12px' }} />
                  <p style={{ color:'#9CA3AF', fontSize:13 }}>جاري التحميل...</p>
                </td></tr>
              ) : paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
                    <div style={{ background:'rgba(74,13,23,0.04)', width:80, height:80, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                      <RiMoneyDollarCircleLine size={32} color="#B5915F" />
                    </div>
                    <div style={{ fontSize:15, fontWeight:600, color:'#4B5563', marginBottom:4 }}>لا توجد مدفوعات</div>
                    <div style={{ fontSize:13 }}>جرب تغيير حالة الفلتر أو مصطلح البحث</div>
                  </td>
                </tr>
              ) : paginatedPayments.map(pay => {
                const st = STATUS_CONFIG[pay.status] || STATUS_CONFIG.pending
                const mt = METHOD_CONFIG[pay.method || pay.payment_method] || METHOD_CONFIG.cod
                const MethodIcon = mt.icon
                const refNum = pay.reference_number || pay.ref || `TXN-${pay.id}`
                const orderNum = pay.order?.order_number || pay.order_number || '-'
                const customerName = pay.customer?.name || pay.order?.guest_name || pay.customer_name || 'ضيف'
                const payDate = pay.created_at ? new Date(pay.created_at).toLocaleDateString('ar-OM', { year:'numeric', month:'short', day:'numeric' }) : '-'
                return (
                  <tr key={pay.id}
                    style={{ cursor:'pointer', transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(74,13,23,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background=''}
                    onClick={() => setSelected(pay)}
                  >
                    <td style={{ padding:'14px 16px', fontWeight:700, color:PRIMARY, fontSize:13 }}>{refNum}</td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ background:'rgba(74,13,23,0.06)', padding:'3px 8px', borderRadius:6, fontSize:12, color:'#374151', fontWeight:600 }}>{orderNum}</span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{
                          width:30, height:30, borderRadius:8, flexShrink:0,
                          background:`linear-gradient(135deg, ${PRIMARY}, ${GOLD})`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'#fff', fontSize:12, fontWeight:700,
                        }}>{(customerName || 'ز').charAt(0)}</div>
                        <span style={{ fontSize:13, fontWeight:500 }}>{customerName}</span>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:5,
                        padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:600,
                        background:mt.bg, color:mt.color,
                      }}>
                        <MethodIcon size={12} />{mt.label}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:12.5, color:'#6B7280' }}>{payDate}</td>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ fontWeight:800, fontSize:14, color:'#1A1A2E' }}>
                        {formatAmount(pay.amount)}
                        <span style={{ fontSize:10, fontWeight:600, marginRight:3, color:'#9CA3AF' }}>ر.ع</span>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:5,
                        padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                        background:st.bg, color:st.color, border:`1px solid ${st.border}`,
                      }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:st.dot }} />
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelected(pay)} style={{
                        width:32, height:32, borderRadius:8, border:`1px solid rgba(74,13,23,0.15)`,
                        background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:PRIMARY,
                      }}><RiEyeLine size={15}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(0,0,0,0.06)', background: '#FAFAFA' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px' }}>
            <span style={{ fontSize:13, color:'#9CA3AF' }}>عرض {paginatedPayments.length} معاملة في هذه الصفحة</span>
            <span style={{ fontSize:13, color: PRIMARY, fontWeight:600 }}>إجمالي المعاملات: {filtered.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GHPagination 
              currentPage={currentPage} 
              lastPage={lastPage} 
              total={filtered.length} 
              onPageChange={setCurrentPage} 
            />
          </div>
        </div>
      </div>

      {/* ─── Payment Detail Drawer ─── */}
      {selected && (() => {
        const st = STATUS_CONFIG[selected.status] || STATUS_CONFIG.pending
        const mt = METHOD_CONFIG[selected.method || selected.payment_method] || METHOD_CONFIG.cod
        const MethodIcon = mt.icon
        const refNum = selected.reference_number || selected.ref || `TXN-${selected.id}`
        const customerName = selected.customer?.name || selected.order?.guest_name || 'ضيف'
        const orderNum = selected.order?.order_number || '-'
        const payDate = selected.created_at ? new Date(selected.created_at).toLocaleDateString('ar-OM', { year:'numeric', month:'short', day:'numeric' }) : '-'
        return (
          <div style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(15,5,10,0.6)', backdropFilter:'blur(8px)',
            display:'flex', justifyContent:'flex-start',
          }} onClick={() => setSelected(null)}>
            <div style={{
              width:460, background:'#fff', height:'100vh', overflowY:'auto',
              direction:'rtl', boxShadow:`-8px 0 48px rgba(74,13,23,0.25)`,
              animation:'slideInRight 0.25s ease-out',
            }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{
                background:`linear-gradient(135deg, ${PRIMARY_DARK}, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                padding:'28px 24px 24px', position:'sticky', top:0, zIndex:1,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <p style={{ color:GOLD, fontSize:11, fontWeight:600, margin:'0 0 4px', letterSpacing:'0.5px' }}>تفاصيل المعاملة</p>
                    <h2 style={{ color:'#fff', margin:0, fontSize:18, fontWeight:800 }}>{refNum}</h2>
                    <div style={{ marginTop:8, display:'flex', alignItems:'baseline', gap:6 }}>
                      <span style={{ fontSize:30, fontWeight:900, color:'#fff' }}>{formatAmount(selected.amount)}</span>
                      <span style={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>ر.ع</span>
                    </div>
                    <div style={{ marginTop:10 }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:5,
                        padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                        background:st.bg, color:st.color,
                      }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:st.dot }} />{st.label}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{
                    width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.12)',
                    border:'1px solid rgba(255,255,255,0.2)', color:'#fff', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                  }}>×</button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding:24 }}>
                {/* Customer Card */}
                <div style={{
                  background:`linear-gradient(135deg, rgba(74,13,23,0.04), rgba(181,145,95,0.06))`,
                  border:`1px solid rgba(74,13,23,0.1)`, borderRadius:14,
                  padding:'18px 20px', marginBottom:16,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <RiUserLine size={14} color="#fff" />
                    </div>
                    <span style={{ fontWeight:700, fontSize:14, color:PRIMARY }}>العميل</span>
                  </div>
                  <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{
                      width:44, height:44, borderRadius:12, flexShrink:0,
                      background:`linear-gradient(135deg, ${PRIMARY}, ${GOLD})`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#fff', fontSize:18, fontWeight:800,
                    }}>{(customerName || 'ز').charAt(0)}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{customerName}</div>
                      <div style={{ fontSize:12, color:'#9CA3AF' }}>الطلب: {orderNum}</div>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                  {[
                    { label:'رقم الطلب', val: orderNum },
                    { label:'التاريخ', val: payDate },
                    { label:'المرجع الخارجي', val: selected.reference_number || selected.transaction_id || '—' },
                    { label:'حالة الطلب', val: selected.order?.status || '—' },
                  ].map(({ label, val }) => (
                    <div key={label} style={{
                      background:'#F9FAFB', borderRadius:12, padding:'12px 14px',
                      border:'1px solid rgba(0,0,0,0.05)',
                    }}>
                      <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:600, marginBottom:6 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1A1A2E' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Payment Method */}
                <div style={{
                  display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                  borderRadius:12, background:mt.bg, border:`1px solid ${mt.color}22`, marginBottom:20,
                }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <MethodIcon size={20} style={{ color:mt.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:mt.color, fontWeight:600, opacity:0.7 }}>طريقة الدفع</div>
                    <div style={{ fontSize:15, fontWeight:700, color:mt.color }}>{mt.label}</div>
                  </div>
                </div>

                {/* Actions */}
                {selected.status === 'pending' && (
                  <div style={{ display:'flex', gap:10 }}>
                    <button
                      onClick={() => handleUpdateStatus(selected.id, 'failed')}
                      disabled={updating}
                      style={{
                        flex:1, padding:'12px', borderRadius:12, border:'1px solid rgba(239,68,68,0.3)',
                        background:'rgba(239,68,68,0.08)', color:'#EF4444', cursor: updating ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600,
                        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                      }}
                    >
                      <RiCloseCircleLine size={15}/> رفض
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selected.id, 'completed')}
                      disabled={updating}
                      style={{
                        flex:2, padding:'12px', borderRadius:12, border:'none',
                        background:`linear-gradient(135deg, #10B981, #059669)`, color:'#fff', cursor: updating ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:700,
                        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                        boxShadow:'0 4px 14px rgba(16,185,129,0.35)',
                      }}
                    >
                      <RiCheckboxCircleLine size={15}/> {updating ? 'جاري التأكيد...' : 'تأكيد الدفعة (تم الاستلام)'}
                    </button>
                  </div>
                )}
                {selected.status === 'completed' && (
                  <button
                    onClick={() => handleUpdateStatus(selected.id, 'refunded')}
                    disabled={updating}
                    style={{
                      width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(139,92,246,0.3)',
                      background:'rgba(139,92,246,0.08)', color:'#7C3AED', cursor: updating ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600,
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    }}
                  >
                    <RiRefund2Line size={15}/> {updating ? 'جاري المعالجة...' : 'استرداد المبلغ'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes slideInRight { from { opacity:0; transform:translateX(-30px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
