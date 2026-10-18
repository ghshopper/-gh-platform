import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../services/adminApi'
import toast from 'react-hot-toast'
import {
  RiTruckLine, RiSearchLine, RiDownloadCloud2Line, RiEyeLine, RiEditLine,
  RiPrinterLine, RiCheckLine, RiTimeLine, RiMapPinLine, RiBox3Line,
  RiCloseLine, RiUserLine, RiPhoneLine, RiRefreshLine, RiAddLine,
  RiArrowRightLine, RiCheckboxCircleLine, RiCloseCircleLine, RiSendPlaneLine,
  RiBuilding4Line, RiGlobalLine, RiExchangeLine, RiShieldCheckLine, RiBarcodeLine,
} from 'react-icons/ri'

const PRIMARY      = '#4A0D17'
const PRIMARY_DARK = '#2A080D'
const PRIMARY_LIGHT= '#6B1A2A'
const GOLD         = '#B5915F'
const GOLD_DARK    = '#8B6B3D'

const STATUS_CONFIG = {
  pending:          { label: 'بانتظار التجهيز',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', dot: '#F59E0B', icon: RiTimeLine },
  picked_up:        { label: 'تم الاستلام',      color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)',  dot: '#3B82F6', icon: RiBox3Line },
  in_transit:       { label: 'في الطريق',        color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', dot: '#8B5CF6', icon: RiTruckLine },
  out_for_delivery: { label: 'جاري التوصيل',    color: '#06B6D4', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.25)',  dot: '#06B6D4', icon: RiMapPinLine },
  delivered:        { label: 'تم التسليم بنجاح', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', dot: '#10B981', icon: RiCheckboxCircleLine },
  failed:           { label: 'تعذر التسليم',     color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',  dot: '#EF4444', icon: RiCloseCircleLine },
  returned:         { label: 'مرتجع للمتجر',     color: '#6B7280', bg: 'rgba(107,114,128,0.12)',border: 'rgba(107,114,128,0.25)',dot: '#6B7280', icon: RiExchangeLine },
}

export default function Shipping() {
  const [activeTab, setActiveTab] = useState('shipments') // 'shipments' | 'carriers' | 'zones'
  const [shipments, setShipments] = useState([])
  const [carriersData, setCarriersData] = useState({ carriers: [], zones: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [carrierFilter, setCarrierFilter] = useState('all')

  // Modals / Drawers
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [editingShipment, setEditingShipment] = useState(null)
  const [waybillShipment, setWaybillShipment] = useState(null)

  // Edit form state
  const [editCarrier, setEditCarrier] = useState('')
  const [editTrackingNum, setEditTrackingNum] = useState('')
  const [editStatus, setEditStatus] = useState('in_transit')
  const [editLocation, setEditLocation] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminApi.getShipments()
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || [])
      setShipments(Array.isArray(raw) ? raw : [])
    } catch (err) {
      console.error('Error fetching shipments:', err)
      toast.error('تعذر جلب بيانات الشحن')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCarriers = useCallback(async () => {
    try {
      const res = await adminApi.getShippingCarriers()
      setCarriersData(res.data || { carriers: [], zones: [] })
    } catch (err) {
      console.error('Error fetching carriers:', err)
    }
  }, [])

  useEffect(() => {
    fetchShipments()
    fetchCarriers()
  }, [fetchShipments, fetchCarriers])

  const filtered = shipments.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = (s.tracking_number || '').toLowerCase().includes(q)
      || (s.carrier || '').toLowerCase().includes(q)
      || (s.order?.order_number || '').toLowerCase().includes(q)
      || (s.order?.guest_name || s.order?.customer?.name || '').toLowerCase().includes(q)
      || (s.order?.guest_phone || '').includes(q)
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    const matchCarrier = carrierFilter === 'all' || (s.carrier || '').includes(carrierFilter)
    return matchSearch && matchStatus && matchCarrier
  })

  // Stats
  const totalShipments = shipments.length
  const inTransitCount = shipments.filter(s => ['in_transit', 'out_for_delivery', 'picked_up'].includes(s.status)).length
  const deliveredCount = shipments.filter(s => s.status === 'delivered').length
  const pendingCount   = shipments.filter(s => s.status === 'pending').length

  const handleOpenEdit = (s) => {
    setEditingShipment(s)
    setEditCarrier(s.carrier || 'مندوب التوصيل السريع (GH Express)')
    setEditTrackingNum(s.tracking_number || '')
    setEditStatus(s.status || 'in_transit')
    setEditLocation('مسقط، سلطنة عُمان')
    setEditNotes('')
  }

  const handleSaveTracking = async () => {
    if (!editingShipment) return
    try {
      setSaving(true)
      await adminApi.updateShipment(editingShipment.id, {
        carrier: editCarrier,
        tracking_number: editTrackingNum,
        status: editStatus,
        event_location: editLocation,
        notes: editNotes || undefined,
      })
      toast.success('تم تحديث حالة وتتبع الشحنة بنجاح')
      setEditingShipment(null)
      await fetchShipments()
    } catch (err) {
      toast.error('فشل تحديث الشحنة: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  const exportCSV = () => {
    if (shipments.length === 0) return toast.error('لا توجد شحنات للتصدير')
    const headers = ['رقم التتبع', 'رقم الطلب', 'العميل', 'الهاتف', 'شركة الشحن', 'الحالة', 'الوجهة', 'تاريخ الإنشاء']
    const rows = shipments.map(s => [
      s.tracking_number || '-',
      s.order?.order_number || '-',
      s.order?.guest_name || s.order?.customer?.name || 'ضيف',
      s.order?.guest_phone || '-',
      s.carrier || '-',
      (STATUS_CONFIG[s.status] || {}).label || s.status,
      s.order?.guest_wilayat || s.shipping_address?.city || 'عُمان',
      s.created_at ? s.created_at.slice(0, 10) : '-'
    ])
    const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shipments-export-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير ملف الشحنات بنجاح')
  }

  const printWaybill = () => {
    window.print()
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
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', flexWrap:'wrap', gap:14 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ color:'#fff', fontSize:26, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>الشحن واللوجستيات</h1>
              <span style={{ background:'rgba(181,145,95,0.2)', border:`1px solid ${GOLD}`, color:GOLD, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                GH Logistics
              </span>
            </div>
            <p style={{ color:`rgba(255,255,255,0.6)`, fontSize:13, margin:'6px 0 0' }}>
              إدارة أسطول التوصيل، متابعة مسارات الشحن المباشرة، بوالص الشحن، وشركات النقل
            </p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={fetchShipments} style={{
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
              <RiDownloadCloud2Line size={16}/>تصدير الشحنات
            </button>
          </div>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'إجمالي الشحنات',    value: totalShipments, color:PRIMARY,  bg:'rgba(74,13,23,0.08)',  border:'rgba(74,13,23,0.2)',   icon: RiBox3Line,          sub:'كافة الطلبات المشحونة' },
          { label:'في الطريق للتوصيل',  value: inTransitCount, color:'#8B5CF6', bg:'rgba(139,92,246,0.1)', border:'rgba(139,92,246,0.2)', icon: RiTruckLine,        sub:'شحنات نشطة حالياً' },
          { label:'تم التوصيل بنجاح',   value: deliveredCount, color:'#10B981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.2)', icon: RiCheckboxCircleLine, sub:`نسبة الإنجاز ${totalShipments ? Math.round(deliveredCount/totalShipments*100) : 0}%` },
          { label:'بانتظار الاستلام',   value: pendingCount,   color:'#F59E0B', bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.2)', icon: RiTimeLine,          sub:'تتطلب معالجة المستودع' },
        ].map(({ label, value, color, bg, border, icon: Icon, sub }) => (
          <div key={label} style={{
            background:'#fff', borderRadius:14, padding:'20px 22px',
            border:`1px solid ${border}`, boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:11.5, color:'#9CA3AF', marginBottom:8, fontWeight:600 }}>{label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:'#1A1A2E', lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:6 }}>{sub}</div>
              </div>
              <div style={{ width:42, height:42, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={20} style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div style={{
        display:'flex', gap:8, borderBottom:'2px solid rgba(74,13,23,0.08)',
        marginBottom:20, paddingBottom:2,
      }}>
        {[
          { key:'shipments', label:'شحنات الطلبات والتتبع المباشر', icon: RiTruckLine, count: shipments.length },
          { key:'carriers',  label:'شركات الشحن ومناطق التغطية', icon: RiBuilding4Line, count: carriersData.carriers.length },
        ].map(t => {
          const active = activeTab === t.key
          const TabIcon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display:'flex', alignItems:'center', gap:8, padding:'12px 20px',
                borderRadius:'10px 10px 0 0', border:'none', background: active ? '#fff' : 'transparent',
                borderBottom: active ? `3px solid ${PRIMARY}` : '3px solid transparent',
                color: active ? PRIMARY : '#6B7280', fontWeight: active ? 800 : 600,
                fontSize:14, cursor:'pointer', transition:'all 0.2s',
                boxShadow: active ? '0 -2px 10px rgba(0,0,0,0.03)' : 'none',
              }}
            >
              <TabIcon size={18} />
              {t.label}
              <span style={{
                background: active ? `rgba(74,13,23,0.1)` : '#F3F4F6',
                color: active ? PRIMARY : '#9CA3AF',
                padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:700,
              }}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* ─── TAB 1: SHIPMENTS LIST & TRACKING ─── */}
      {activeTab === 'shipments' && (
        <>
          {/* Filters Bar */}
          <div style={{
            background:'#fff', borderRadius:14, padding:'16px 20px', marginBottom:20,
            border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 8px rgba(0,0,0,0.04)',
            display:'flex', gap:12, alignItems:'center', flexWrap:'wrap',
          }}>
            <div style={{
              display:'flex', alignItems:'center', gap:8, flex:1, minWidth:240,
              background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:10, padding:'8px 14px',
            }}>
              <RiSearchLine size={16} color="#9CA3AF" />
              <input
                placeholder="بحث برقم التتبع، رقم الطلب، العميل، أو الهاتف..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ border:'none', background:'transparent', outline:'none', fontSize:13, width:'100%', direction:'rtl' }}
              />
            </div>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding:'8px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                fontSize:13, background:'#F9FAFB', outline:'none', cursor:'pointer', direction:'rtl',
              }}
            >
              <option value="all">كل حالات الشحن</option>
              <option value="pending">بانتظار التجهيز</option>
              <option value="picked_up">تم الاستلام من المستودع</option>
              <option value="in_transit">في الطريق</option>
              <option value="out_for_delivery">جاري التوصيل</option>
              <option value="delivered">تم التسليم بنجاح</option>
              <option value="failed">تعذر التسليم</option>
              <option value="returned">مرتجع</option>
            </select>
            <select
              value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}
              style={{
                padding:'8px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                fontSize:13, background:'#F9FAFB', outline:'none', cursor:'pointer', direction:'rtl',
              }}
            >
              <option value="all">كل شركات الشحن</option>
              <option value="GH Express">مندوب GH Express</option>
              <option value="Aramex">أرامكس (Aramex)</option>
              <option value="DHL">DHL Express</option>
              <option value="Oman Post">بريد عُمان</option>
              <option value="SMSA">سمسا إكسبريس</option>
            </select>
          </div>

          {/* Table */}
          <div style={{
            background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.06)',
            boxShadow:'0 2px 12px rgba(0,0,0,0.04)', overflow:'hidden',
          }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', direction:'rtl' }}>
                <thead>
                  <tr style={{ background:`linear-gradient(135deg, rgba(74,13,23,0.04), rgba(181,145,95,0.06))` }}>
                    {['رقم التتبع','رقم الطلب','العميل والوجهة','شركة الشحن','الحالة','الموعد المتوقع','الإجراءات'].map(h => (
                      <th key={h} style={{
                        padding:'14px 16px', fontSize:12, fontWeight:700, color:'#6B7280',
                        textAlign:'right', borderBottom:'2px solid rgba(74,13,23,0.08)', whiteSpace:'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign:'center', padding:56 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid rgba(74,13,23,0.1)`, borderTop:`2px solid ${PRIMARY}`, animation:'spin 1s linear infinite', margin:'0 auto 12px' }} />
                      <p style={{ color:'#9CA3AF', fontSize:13 }}>جاري تحميل بيانات الشحن...</p>
                    </td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign:'center', padding:56 }}>
                      <RiBox3Line size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }} />
                      <p style={{ color:'#9CA3AF', fontSize:13 }}>لا توجد شحنات مطابقة</p>
                    </td></tr>
                  ) : filtered.map(ship => {
                    const st = STATUS_CONFIG[ship.status] || STATUS_CONFIG.pending
                    const StatusIcon = st.icon
                    const customerName = ship.order?.guest_name || ship.order?.customer?.name || 'ضيف'
                    const customerPhone = ship.order?.guest_phone || ship.order?.customer?.phone || '-'
                    const destination = ship.order?.guest_wilayat || ship.shipping_address?.city || ship.shipping_address?.wilayat || 'سلطنة عُمان'
                    const trackingNo = ship.tracking_number || `SHP-${ship.id}`
                    const estDate = ship.estimated_delivery ? (ship.estimated_delivery.slice(0, 10)) : '-'

                    return (
                      <tr key={ship.id}
                        style={{ cursor:'pointer', transition:'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(74,13,23,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background=''}
                        onClick={() => setSelectedShipment(ship)}
                      >
                        <td style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <RiBarcodeLine size={16} color={GOLD} />
                            <span style={{ fontWeight:800, color:PRIMARY, fontSize:13 }}>{trackingNo}</span>
                          </div>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <span style={{ background:'rgba(74,13,23,0.06)', padding:'3px 8px', borderRadius:6, fontSize:12, color:'#374151', fontWeight:600 }}>
                            {ship.order?.order_number || '-'}
                          </span>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{
                              width:32, height:32, borderRadius:8, flexShrink:0,
                              background:`linear-gradient(135deg, ${PRIMARY}, ${GOLD})`,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              color:'#fff', fontSize:12, fontWeight:700,
                            }}>{(customerName || 'ز').charAt(0)}</div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:'#1A1A2E' }}>{customerName}</div>
                              <div style={{ fontSize:11, color:'#9CA3AF', display:'flex', alignItems:'center', gap:4 }}>
                                <RiMapPinLine size={12}/>{destination} • {customerPhone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:PRIMARY }} />
                            <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{ship.carrier || 'مندوب GH Express'}</span>
                          </div>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:5,
                            padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                            background:st.bg, color:st.color, border:`1px solid ${st.border}`,
                          }}>
                            <StatusIcon size={13} />
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding:'14px 16px', fontSize:12.5, color:'#6B7280' }}>
                          {estDate}
                        </td>
                        <td style={{ padding:'14px 16px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display:'flex', gap:6, justifyContent:'flex-start' }}>
                            <button title="مسار التتبع والتفاصيل" onClick={() => setSelectedShipment(ship)} style={{
                              width:32, height:32, borderRadius:8, border:`1px solid rgba(74,13,23,0.15)`,
                              background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:PRIMARY,
                            }}><RiEyeLine size={15}/></button>

                            <button title="تحديث حالة التتبع" onClick={() => handleOpenEdit(ship)} style={{
                              width:32, height:32, borderRadius:8, border:`1px solid rgba(181,145,95,0.3)`,
                              background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:GOLD_DARK,
                            }}><RiEditLine size={15}/></button>

                            <button title="طباعة بوليصة الشحن (Waybill)" onClick={() => setWaybillShipment(ship)} style={{
                              width:32, height:32, borderRadius:8, border:`1px solid rgba(59,130,246,0.3)`,
                              background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563EB',
                            }}><RiPrinterLine size={15}/></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(0,0,0,0.06)', fontSize:13, color:'#9CA3AF' }}>
              عرض {filtered.length} من أصل {shipments.length} شحنة
            </div>
          </div>
        </>
      )}

      {/* ─── TAB 2: CARRIERS & ZONES ─── */}
      {activeTab === 'carriers' && (
        <div>
          {/* Carrier Cards Grid */}
          <h2 style={{ fontSize:18, fontWeight:800, color:PRIMARY, marginBottom:16 }}>شركات الشحن المعتمدة في المتجر</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16, marginBottom:32 }}>
            {carriersData.carriers.map(c => (
              <div key={c.id} style={{
                background:'#fff', borderRadius:14, padding:20,
                border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 12px rgba(0,0,0,0.04)',
                position:'relative', overflow:'hidden',
              }}>
                <div style={{ position:'absolute', top:0, right:0, left:0, height:4, background: c.logo_color || PRIMARY }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginTop:6 }}>
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', letterSpacing:'0.5px' }}>{c.code}</span>
                    <h3 style={{ fontSize:15, fontWeight:800, color:'#1A1A2E', margin:'4px 0 8px' }}>{c.name}</h3>
                  </div>
                  <span style={{
                    padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                    background:'rgba(16,185,129,0.1)', color:'#10B981', border:'1px solid rgba(16,185,129,0.2)',
                  }}>نشط</span>
                </div>
                <div style={{ fontSize:12.5, color:'#6B7280', margin:'8px 0 14px', lineHeight:1.5 }}>{c.coverage}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:12, borderTop:'1px solid #F3F4F6' }}>
                  <div style={{ fontSize:12, color:'#9CA3AF' }}>مدة التوصيل: <strong style={{ color:'#374151' }}>{c.delivery_time}</strong></div>
                  <div style={{ fontSize:14, fontWeight:800, color:PRIMARY }}>{parseFloat(c.cost).toFixed(3)} ر.ع</div>
                </div>
              </div>
            ))}
          </div>

          {/* Zones & Rates Table */}
          <h2 style={{ fontSize:18, fontWeight:800, color:PRIMARY, marginBottom:16 }}>مناطق التغطية وتسعير الشحن للمحافظات</h2>
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 2px 12px rgba(0,0,0,0.04)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', direction:'rtl' }}>
              <thead>
                <tr style={{ background:`linear-gradient(135deg, rgba(74,13,23,0.04), rgba(181,145,95,0.06))` }}>
                  {['المنطقة / المحافظة', 'الولايات المشمولة', 'الشحن العادي', 'الشحن السريع (Express)', 'الشحن المجاني', 'المدة المتوقعة'].map(h => (
                    <th key={h} style={{ padding:'14px 16px', fontSize:12, fontWeight:700, color:'#6B7280', textAlign:'right', borderBottom:'2px solid rgba(74,13,23,0.08)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carriersData.zones.map(z => (
                  <tr key={z.id} style={{ borderBottom:'1px solid #F3F4F6' }}>
                    <td style={{ padding:'14px 16px', fontWeight:800, color:PRIMARY, fontSize:14 }}>{z.name}</td>
                    <td style={{ padding:'14px 16px', fontSize:12.5, color:'#4B5563' }}>
                      {z.wilayats.join('، ')}
                    </td>
                    <td style={{ padding:'14px 16px', fontWeight:700, color:'#1A1A2E' }}>{parseFloat(z.standard_fee).toFixed(3)} ر.ع</td>
                    <td style={{ padding:'14px 16px', fontWeight:700, color:GOLD_DARK }}>{parseFloat(z.express_fee).toFixed(3)} ر.ع</td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ background:'rgba(16,185,129,0.1)', color:'#10B981', padding:'3px 8px', borderRadius:6, fontSize:11.5, fontWeight:700 }}>
                        للطلبات فوق {parseFloat(z.free_shipping_threshold).toFixed(3)} ر.ع
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:'#6B7280' }}>{z.estimated_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Shipment Timeline Drawer ─── */}
      {selectedShipment && (() => {
        const s = selectedShipment
        const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending
        const customerName = s.order?.guest_name || s.order?.customer?.name || 'ضيف'
        const customerPhone = s.order?.guest_phone || s.order?.customer?.phone || '-'
        const destination = s.order?.guest_address || s.order?.guest_wilayat || s.shipping_address?.address || 'سلطنة عُمان'

        return (
          <div style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(15,5,10,0.6)', backdropFilter:'blur(8px)',
            display:'flex', justifyContent:'flex-start',
          }} onClick={() => setSelectedShipment(null)}>
            <div style={{
              width:480, background:'#fff', height:'100vh', overflowY:'auto',
              direction:'rtl', boxShadow:`-8px 0 48px rgba(74,13,23,0.25)`,
              animation:'slideInRight 0.25s ease-out',
            }} onClick={e => e.stopPropagation()}>

              {/* Drawer Header */}
              <div style={{
                background:`linear-gradient(135deg, ${PRIMARY_DARK}, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                padding:'28px 24px 24px', position:'sticky', top:0, zIndex:1,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <p style={{ color:GOLD, fontSize:11, fontWeight:600, margin:'0 0 4px', letterSpacing:'0.5px' }}>مسار الشحنة والتتبع المباشر</p>
                    <h2 style={{ color:'#fff', margin:0, fontSize:19, fontWeight:800 }}>{s.tracking_number || `SHP-${s.id}`}</h2>
                    <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:5,
                        padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                        background:st.bg, color:st.color,
                      }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:st.dot }} />{st.label}
                      </span>
                      <span style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>الطلب: {s.order?.order_number}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedShipment(null)} style={{
                    width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.12)',
                    border:'1px solid rgba(255,255,255,0.2)', color:'#fff', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                  }}>×</button>
                </div>
              </div>

              {/* Drawer Body */}
              <div style={{ padding:24 }}>
                {/* Recipient Card */}
                <div style={{
                  background:`linear-gradient(135deg, rgba(74,13,23,0.04), rgba(181,145,95,0.06))`,
                  border:`1px solid rgba(74,13,23,0.1)`, borderRadius:14,
                  padding:'18px 20px', marginBottom:18,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <RiUserLine size={16} color={PRIMARY} />
                    <span style={{ fontWeight:700, fontSize:14, color:PRIMARY }}>بيانات المستلم والوجهة</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#1A1A2E', marginBottom:4 }}>{customerName}</div>
                  <div style={{ fontSize:12.5, color:'#4B5563', marginBottom:4 }}><RiPhoneLine size={13} style={{ marginLeft:4 }} />{customerPhone}</div>
                  <div style={{ fontSize:12.5, color:'#6B7280' }}><RiMapPinLine size={13} style={{ marginLeft:4 }} />{destination}</div>
                </div>

                {/* Carrier & Estimated Date */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                  <div style={{ background:'#F9FAFB', borderRadius:12, padding:'12px 14px', border:'1px solid #E5E7EB' }}>
                    <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:600, marginBottom:4 }}>شركة الشحن</div>
                    <div style={{ fontSize:13, fontWeight:700, color:PRIMARY }}>{s.carrier || 'GH Express'}</div>
                  </div>
                  <div style={{ background:'#F9FAFB', borderRadius:12, padding:'12px 14px', border:'1px solid #E5E7EB' }}>
                    <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:600, marginBottom:4 }}>الموعد المتوقع</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1A1A2E' }}>{s.estimated_delivery ? s.estimated_delivery.slice(0, 10) : 'خلال 24 - 48 ساعة'}</div>
                  </div>
                </div>

                {/* Tracking Milestones Timeline */}
                <div style={{ marginBottom:24 }}>
                  <h3 style={{ fontSize:15, fontWeight:800, color:'#1A1A2E', marginBottom:14 }}>المسار الزمني للشحنة</h3>
                  <div style={{ position:'relative', paddingRight:20 }}>
                    <div style={{ position:'absolute', top:8, bottom:8, right:6, width:2, background:'rgba(74,13,23,0.12)' }} />
                    {(s.events && s.events.length > 0 ? s.events : [
                      { id: 1, status: s.status, description_ar: 'تم تجهيز الشحنة وجاري المتابعة مع المندوب', location: 'المستودع الرئيسي - مسقط', occurred_at: s.created_at }
                    ]).map((ev, idx) => (
                      <div key={ev.id || idx} style={{ position:'relative', marginBottom:20 }}>
                        <div style={{
                          position:'absolute', top:3, right:-20, width:14, height:14, borderRadius:'50%',
                          background: idx === 0 ? PRIMARY : '#D1D5DB', border:'2px solid #fff',
                          boxShadow:'0 0 0 2px rgba(74,13,23,0.2)',
                        }} />
                        <div style={{ background:'#FAFAFA', borderRadius:10, padding:'10px 14px', border:'1px solid #E5E7EB' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                            <span style={{ fontSize:13, fontWeight:700, color: idx === 0 ? PRIMARY : '#374151' }}>{ev.description_ar}</span>
                            <span style={{ fontSize:11, color:'#9CA3AF' }}>{ev.occurred_at ? new Date(ev.occurred_at).toLocaleTimeString('ar-OM', { hour:'2-digit', minute:'2-digit' }) : ''}</span>
                          </div>
                          {ev.location && (
                            <div style={{ fontSize:11.5, color:'#6B7280', display:'flex', alignItems:'center', gap:4 }}>
                              <RiMapPinLine size={12}/>{ev.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:10 }}>
                  <button
                    onClick={() => { setSelectedShipment(null); handleOpenEdit(s); }}
                    style={{
                      flex:1, padding:'12px', borderRadius:12, border:`1px solid ${PRIMARY}`,
                      background:'#fff', color:PRIMARY, cursor:'pointer', fontSize:13, fontWeight:700,
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    }}
                  >
                    <RiEditLine size={16}/>تحديث التتبع
                  </button>
                  <button
                    onClick={() => { setSelectedShipment(null); setWaybillShipment(s); }}
                    style={{
                      flex:1, padding:'12px', borderRadius:12, border:'none',
                      background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700,
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                      boxShadow:'0 4px 14px rgba(74,13,23,0.35)',
                    }}
                  >
                    <RiPrinterLine size={16}/>طباعة البوليصة
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Update Tracking Modal ─── */}
      {editingShipment && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(15,5,10,0.6)', backdropFilter:'blur(8px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:24,
        }} onClick={() => setEditingShipment(null)}>
          <div style={{
            background:'#fff', borderRadius:20, width:'100%', maxWidth:480,
            boxShadow:'0 25px 60px rgba(0,0,0,0.2)', animation:'fadeScaleIn 0.2s ease-out',
            direction:'rtl',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              background:`linear-gradient(135deg, ${PRIMARY_DARK}, ${PRIMARY})`,
              borderRadius:'20px 20px 0 0', padding:'20px 24px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:4 }}>تحديث لوجستي</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>تحديث بيانات الشحنة والتتبع</div>
              </div>
              <button onClick={() => setEditingShipment(null)} style={{
                width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.12)',
                border:'1px solid rgba(255,255,255,0.2)', cursor:'pointer', color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><RiCloseLine size={18}/></button>
            </div>
            <div style={{ padding:24 }}>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:700, color:'#374151', marginBottom:6 }}>شركة الشحن / المندوب</label>
                <select value={editCarrier} onChange={e => setEditCarrier(e.target.value)} style={{
                  width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                  fontSize:13, outline:'none', cursor:'pointer', background:'#F9FAFB', direction:'rtl',
                }}>
                  <option value="مندوب التوصيل السريع (GH Express)">مندوب التوصيل السريع (GH Express)</option>
                  <option value="أرامكس (Aramex)">أرامكس (Aramex)</option>
                  <option value="دي إتش إل إكسبريس (DHL Express)">دي إتش إل إكسبريس (DHL Express)</option>
                  <option value="بريد عُمان (Oman Post)">بريد عُمان (Oman Post)</option>
                  <option value="سمسا إكسبريس (SMSA Express)">سمسا إكسبريس (SMSA Express)</option>
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:700, color:'#374151', marginBottom:6 }}>رقم التتبع (Tracking Number)</label>
                <input
                  value={editTrackingNum} onChange={e => setEditTrackingNum(e.target.value)}
                  placeholder="مثال: SHP-84A7C92"
                  style={{
                    width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                    fontSize:13, outline:'none', background:'#F9FAFB', direction:'ltr', textAlign:'right',
                  }}
                />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:700, color:'#374151', marginBottom:6 }}>حالة الشحنة الحالية</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{
                  width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                  fontSize:13, outline:'none', cursor:'pointer', background:'#F9FAFB', direction:'rtl',
                }}>
                  <option value="pending">بانتظار التجهيز والاستلام</option>
                  <option value="picked_up">تم استلام الشحنة من المستودع</option>
                  <option value="in_transit">الشحنة في الطريق بين المراكز</option>
                  <option value="out_for_delivery">الشحنة مع مندوب التوصيل للتسليم</option>
                  <option value="delivered">تم تسليم الشحنة للعميل بنجاح</option>
                  <option value="failed">تعذر التسليم (إعادة جدولة)</option>
                  <option value="returned">مرتجع إلى المتجر</option>
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:700, color:'#374151', marginBottom:6 }}>الموقع الحالي للحدث</label>
                <input
                  value={editLocation} onChange={e => setEditLocation(e.target.value)}
                  placeholder="مثال: مركز التوزيع - السيب / مسقط"
                  style={{
                    width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                    fontSize:13, outline:'none', background:'#F9FAFB', direction:'rtl',
                  }}
                />
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:700, color:'#374151', marginBottom:6 }}>ملاحظة إضافية تظهر للعميل (اختياري)</label>
                <input
                  value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="مثال: الشحنة في سيارة التوصيل وسيصلك اتصال من المندوب"
                  style={{
                    width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                    fontSize:13, outline:'none', background:'#F9FAFB', direction:'rtl',
                  }}
                />
              </div>

              <button onClick={handleSaveTracking} disabled={saving} style={{
                width:'100%', padding:'12px', borderRadius:12, border:'none',
                background: saving ? '#9CA3AF' : `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                color:'#fff', fontSize:14, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: saving ? 'none' : `0 4px 16px rgba(74,13,23,0.35)`,
              }}>
                {saving ? 'جاري الحفظ...' : <><RiCheckLine size={18}/>حفظ وتحديث التتبع</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Printable Waybill Modal ─── */}
      {waybillShipment && (() => {
        const s = waybillShipment
        const customerName = s.order?.guest_name || s.order?.customer?.name || 'ضيف'
        const customerPhone = s.order?.guest_phone || s.order?.customer?.phone || '-'
        const destination = s.order?.guest_address || s.order?.guest_wilayat || s.shipping_address?.address || 'سلطنة عُمان'
        const orderNum = s.order?.order_number || '-'
        const trackingNum = s.tracking_number || `SHP-${s.id}`
        const isCOD = s.order?.payment_method === 'cod' || s.order?.payment_method === 'cash_on_delivery' || s.order?.payment_status === 'pending'
        const amount = parseFloat(s.order?.total_amount || 0).toFixed(3)

        return (
          <div style={{
            position:'fixed', inset:0, zIndex:1100,
            background:'rgba(15,5,10,0.7)', backdropFilter:'blur(8px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          }} onClick={() => setWaybillShipment(null)}>
            <div style={{
              background:'#fff', borderRadius:16, width:'100%', maxWidth:540,
              boxShadow:'0 25px 60px rgba(0,0,0,0.3)', animation:'fadeScaleIn 0.2s ease-out',
              direction:'rtl', overflow:'hidden',
            }} onClick={e => e.stopPropagation()}>
              
              {/* Top Action Bar */}
              <div style={{
                background:'#1A1A2E', padding:'12px 20px', display:'flex',
                justifyContent:'space-between', alignItems:'center', color:'#fff',
              }}>
                <span style={{ fontSize:13, fontWeight:700 }}>معاينة بوليصة الشحن الرسمية (Waybill)</span>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={printWaybill} style={{
                    padding:'6px 14px', borderRadius:8, background:PRIMARY, border:'none',
                    color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5,
                  }}>
                    <RiPrinterLine size={14}/>طباعة
                  </button>
                  <button onClick={() => setWaybillShipment(null)} style={{
                    padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.1)',
                    border:'none', color:'#fff', cursor:'pointer', fontSize:12,
                  }}>إغلاق</button>
                </div>
              </div>

              {/* Waybill Printable Document */}
              <div id="printable-waybill" style={{ padding:28, background:'#fff', border:'2px dashed #D1D5DB', margin:16, borderRadius:12 }}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'2px solid #1A1A2E', paddingBottom:16, marginBottom:16 }}>
                  <div>
                    <h2 style={{ margin:0, fontSize:22, fontWeight:900, color:PRIMARY }}>GH SHOPPER</h2>
                    <div style={{ fontSize:11, color:GOLD_DARK, fontWeight:700, letterSpacing:'1px' }}>LUXURY BOUTIQUE & PERFUMES</div>
                    <div style={{ fontSize:11, color:'#6B7280', marginTop:4 }}>مسقط، سلطنة عُمان • هاتف: +968 9000 0000</div>
                  </div>
                  <div style={{ textAlign:'left', direction:'ltr' }}>
                    <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:700 }}>TRACKING / WAYBILL</div>
                    <div style={{ fontSize:16, fontWeight:900, color:'#1A1A2E' }}>{trackingNum}</div>
                    <div style={{ fontSize:11, color:'#6B7280' }}>ORDER: {orderNum}</div>
                  </div>
                </div>

                {/* Routing & Carrier */}
                <div style={{ display:'flex', justifyContent:'space-between', background:'#F9FAFB', padding:'10px 14px', borderRadius:8, marginBottom:16, border:'1px solid #E5E7EB' }}>
                  <div>
                    <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:700 }}>الناقل / CARRIER</div>
                    <div style={{ fontSize:13, fontWeight:800, color:PRIMARY }}>{s.carrier || 'GH Express'}</div>
                  </div>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:700 }}>نوع الخدمة / SERVICE</div>
                    <div style={{ fontSize:13, fontWeight:800, color:'#1A1A2E' }}>Door to Door (توصيل مباشر)</div>
                  </div>
                </div>

                {/* Recipient Details */}
                <div style={{ border:'1px solid #1A1A2E', borderRadius:8, padding:14, marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#fff', background:'#1A1A2E', padding:'2px 8px', borderRadius:4, display:'inline-block', marginBottom:8 }}>
                    بيانات المستلم (CONSIGNEE)
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#1A1A2E' }}>{customerName}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginTop:4 }}>الهاتف: {customerPhone}</div>
                  <div style={{ fontSize:12.5, color:'#6B7280', marginTop:4 }}>العنوان والمدينة: {destination}</div>
                </div>

                {/* COD & Package Summary */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background: isCOD ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', border:`1.5px solid ${isCOD ? '#EF4444' : '#10B981'}`, padding:'12px 16px', borderRadius:8, marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color: isCOD ? '#EF4444' : '#10B981' }}>
                      {isCOD ? 'مبلغ التحصيل عند الاستلام (COD AMOUNT)' : 'تم الدفع مسبقاً (PREPAID - DO NOT COLLECT)'}
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, color: isCOD ? '#EF4444' : '#10B981' }}>
                      {isCOD ? `${amount} ر.ع` : '0.000 ر.ع'}
                    </div>
                  </div>
                  <div style={{ textAlign:'left', fontSize:11, color:'#6B7280' }}>
                    عدد القطع: {s.order?.items?.length || 1}<br/>
                    الوزن التقريبي: 0.8 كجم
                  </div>
                </div>

                {/* Barcode Mock */}
                <div style={{ textAlign:'center', paddingTop:10, borderTop:'1px solid #E5E7EB' }}>
                  <div style={{ fontFamily:'monospace', letterSpacing:'6px', fontSize:18, fontWeight:900 }}>
                    ||||| | |||| || |||||| | ||||| ||| ||||
                  </div>
                  <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>{trackingNum}</div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes fadeScaleIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(-30px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body * { visibility: hidden; }
          #printable-waybill, #printable-waybill * { visibility: visible; }
          #printable-waybill { position: absolute; left: 0; top: 0; width: 100%; margin: 0; border: none; }
        }
      `}</style>
    </div>
  )
}
