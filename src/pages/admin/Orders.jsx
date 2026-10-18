import { useState, useEffect, useCallback } from 'react'
import {
  RiShoppingBag3Line,
  RiSearchLine,
  RiFilter3Line,
  RiCheckboxCircleLine,
  RiTimeLine,
  RiTruckLine,
  RiCloseCircleLine,
  RiRefreshLine,
  RiBox3Line,
  RiEyeLine,
  RiPencilLine,
  RiUser3Line,
  RiDownloadCloud2Line,
  RiMapPinLine,
  RiShoppingBagLine,
  RiMoneyDollarCircleLine,
  RiDeleteBinLine,
} from 'react-icons/ri'
import { adminApi } from '../../services/adminApi'
import GHPagination from '../../components/GHPagination'

const PRIMARY = '#4A0D17'
const PRIMARY_DARK = '#2A080D'
const PRIMARY_LIGHT = '#6B1A2A'
const GOLD = '#B5915F'
const GOLD_LIGHT = '#D4AF80'
const GOLD_DARK = '#8B6B3D'

const STATUS_CONFIG = {
  pending:          { label: 'قيد الانتظار',  color: '#92400E', bg: 'rgba(245,158,11,0.12)', border: '#F59E0B', dot: '#F59E0B' },
  confirmed:        { label: 'مؤكد',          color: '#1E40AF', bg: 'rgba(59,130,246,0.12)', border: '#3B82F6', dot: '#3B82F6' },
  processing:       { label: 'قيد المعالجة', color: '#5B21B6', bg: 'rgba(139,92,246,0.12)', border: '#8B5CF6', dot: '#8B5CF6' },
  shipped:          { label: 'قيد الشحن',     color: '#0E7490', bg: 'rgba(6,182,212,0.12)', border: '#06B6D4', dot: '#06B6D4' },
  out_for_delivery: { label: 'في الطريق',     color: '#065F46', bg: 'rgba(16,185,129,0.12)', border: '#10B981', dot: '#10B981' },
  delivered:        { label: 'مكتمل',         color: '#047857', bg: 'rgba(5,150,105,0.12)', border: '#059669', dot: '#059669' },
  cancelled:        { label: 'ملغي',          color: '#991B1B', bg: 'rgba(239,68,68,0.12)', border: '#EF4444', dot: '#EF4444' },
  returned:         { label: 'مسترجع',        color: '#9A3412', bg: 'rgba(249,115,22,0.12)', border: '#F97316', dot: '#F97316' },
}

const PAYMENT_LABELS = {
  cod: 'الدفع عند الاستلام',
  cash_on_delivery: 'الدفع عند الاستلام',
  amwalpay: 'بطاقة ائتمانية',
  amwal_apple: 'Apple Pay',
  amwal_google: 'Google Pay',
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])
  const [selected, setSelected] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCompany, setShippingCompany] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')

  const mapOrder = (order) => {
    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
    let address = {}
    try {
      address = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address || '{}')
        : (order.shipping_address || {})
    } catch {}
    return {
      _raw: order,
      id: order.order_number,
      dbId: order.id,
      customer: order.customer?.name || order.guest_name || 'زائر',
      customerEmail: order.customer?.email || order.guest_email || '',
      phone: order.customer?.phone || order.guest_phone || '-',
      isGuest: !order.customer_id,
      date: new Date(order.created_at).toLocaleDateString('ar-OM', { year: 'numeric', month: 'short', day: 'numeric' }),
      total: parseFloat(order.total_amount || 0).toFixed(3),
      subtotal: parseFloat(order.subtotal || 0).toFixed(3),
      shipping: parseFloat(order.shipping_cost || 0).toFixed(3),
      discount: parseFloat(order.discount_amount || 0).toFixed(3),
      tax: parseFloat(order.tax_amount || 0).toFixed(3),
      items: order.items?.length || 0,
      itemsList: order.items || [],
      status: order.status,
      statusConfig: st,
      address: address.text || address.address_text || address.city || '-',
      lat: address.lat || address.latitude,
      lng: address.lng || address.longitude,
      paymentMethod: PAYMENT_LABELS[order.payment_method] || order.payment_method || 'cod',
      notes: order.notes,
    }
  }

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const params = { page, per_page: 10 }
      if (statusFilter !== 'all') params.status = statusFilter
      if (search) params.search = search
      const res = await adminApi.getOrders(params)
      const paged = res.data?.data && res.data?.current_page !== undefined ? res.data : (res.data?.data?.current_page !== undefined ? res.data.data : null);
      const raw = paged ? paged.data : (res.data?.data?.data || res.data?.data || res.data || []);
      setOrders(Array.isArray(raw) ? raw.map(mapOrder) : [])
      setCurrentPage(paged ? paged.current_page : 1)
      setLastPage(paged ? paged.last_page : 1)
      setTotalItems(paged ? paged.total : (raw.length || 0))
      setSelectedIds([])
    } catch (err) {
      console.error('Failed to fetch orders', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchOrders(1) }, [fetchOrders])

  const handleUpdateStatus = async () => {
    if (updating || !newStatus) return
    try {
      setUpdating(true)
      const data = {
        status: newStatus,
        tracking_number: trackingNumber || null,
        shipping_company: shippingCompany || null,
        tracking_url: trackingUrl || null,
      }
      const res = await adminApi.updateOrderState(selected.dbId, data)
      console.log('Update response:', res.data)
      await fetchOrders(currentPage)
      setEditMode(false)
      setSelected(null)
    } catch (err) {
      console.error('Update failed:', err.response?.data || err)
      alert('فشل الحفظ: ' + (err.response?.data?.message || err.message))
    } finally {
      setUpdating(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} طلبات؟`)) return;
    try {
      setLoading(true);
      const res = await adminApi.bulkDeleteOrders(selectedIds);
      setSelectedIds([]);
      await fetchOrders(currentPage);
      alert(res.data?.message || 'تم الحذف بنجاح');
    } catch (err) {
      console.error('Bulk delete failed:', err);
      alert('فشل الحذف: ' + (err.response?.data?.message || err.message));
      setLoading(false);
    }
  }

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key] = orders.filter(o => o.status === key).length
    return acc
  }, {})

  return (
    <div className="page-container" style={{ direction: 'rtl' }}>
      {/* ─── Header ─── */}
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 50%, ${PRIMARY_LIGHT} 100%)`,
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(74,13,23,0.35)`,
      }}>
        <div style={{ position:'absolute', top:-60, left:-60, width:200, height:200, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.15)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-30, left:-30, width:140, height:140, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.1)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-50, right:60, width:160, height:160, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.08)`, pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
          <div>
            <h1 style={{ color:'#fff', fontSize:26, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>
              إدارة الطلبات
            </h1>
            <p style={{ color:`rgba(255,255,255,0.6)`, fontSize:13, margin:'6px 0 0', fontWeight:400 }}>
              {loading ? 'جاري التحميل...' : `${totalItems} طلب إجمالاً`}
            </p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button
              onClick={() => fetchOrders(currentPage)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'10px 18px', borderRadius:10,
                background:'rgba(255,255,255,0.1)',
                border:'1px solid rgba(255,255,255,0.15)',
                color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600,
                backdropFilter:'blur(4px)', transition:'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
            >
              <RiRefreshLine size={16} />
              تحديث
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 18px', borderRadius:10,
                  background:'#DC2626',
                  border:'none',
                  color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600,
                  boxShadow:`0 4px 14px rgba(220,38,38,0.3)`,
                  transition:'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity='0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}
              >
                <RiDeleteBinLine size={16} />
                حذف المحدد ({selectedIds.length})
              </button>
            )}
            <button
              style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'10px 18px', borderRadius:10,
                background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                border:'none',
                color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600,
                boxShadow:`0 4px 14px rgba(181,145,95,0.4)`,
                transition:'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity='0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity='1'}
            >
              <RiDownloadCloud2Line size={16} />
              تصدير Excel
            </button>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:20, flexWrap:'wrap' }}>
          {[
            { label:'انتظار', key:'pending', icon:<RiTimeLine size={14}/> },
            { label:'مؤكدة', key:'confirmed', icon:<RiCheckboxCircleLine size={14}/> },
            { label:'شحن', key:'shipped', icon:<RiTruckLine size={14}/> },
            { label:'مكتملة', key:'delivered', icon:<RiCheckboxCircleLine size={14}/> },
            { label:'ملغاة', key:'cancelled', icon:<RiCloseCircleLine size={14}/> },
          ].map(item => (
            <div key={item.key} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'6px 14px', borderRadius:20,
              background:'rgba(255,255,255,0.08)',
              border:'1px solid rgba(255,255,255,0.12)',
              color:'#fff', fontSize:12, fontWeight:600,
              backdropFilter:'blur(4px)',
            }}>
              {item.icon}
              {item.label}
              <span style={{
                background: GOLD,
                color:'#fff',
                borderRadius:10,
                padding:'1px 7px',
                fontSize:11,
                fontWeight:700,
              }}>{statusCounts[item.key] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background:'#fff',
        borderRadius:12,
        padding:'14px 20px',
        marginBottom:20,
        display:'flex',
        gap:12,
        alignItems:'center',
        flexWrap:'wrap',
        boxShadow:'0 2px 12px rgba(74,13,23,0.07)',
        border:'1px solid rgba(74,13,23,0.08)',
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          border:`1.5px solid #E5E7EB`, borderRadius:10,
          padding:'9px 14px', background:'#FAFAFA', flex:1, maxWidth:300,
          transition:'border-color 0.2s',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = PRIMARY}
          onBlurCapture={e => e.currentTarget.style.borderColor = '#E5E7EB'}
        >
          <RiSearchLine size={17} color="#9CA3AF" />
          <input
            placeholder="بحث بالاسم أو رقم الطلب..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border:'none', background:'transparent', outline:'none', fontSize:13, color:'#374151', width:'100%' }}
          />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <RiFilter3Line size={16} color={PRIMARY} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              border:`1.5px solid #E5E7EB`, borderRadius:10,
              padding:'9px 14px', fontSize:13, color:'#374151',
              outline:'none', cursor:'pointer', background:'#FAFAFA',
              fontFamily:'inherit',
            }}
          >
            <option value="all">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="confirmed">مؤكد</option>
            <option value="processing">قيد المعالجة</option>
            <option value="shipped">قيد الشحن</option>
            <option value="out_for_delivery">في الطريق</option>
            <option value="delivered">مكتمل</option>
            <option value="cancelled">ملغي</option>
            <option value="returned">مسترجع</option>
          </select>
        </div>
      </div>

      <div style={{
        background:'#fff',
        borderRadius:14,
        overflow:'hidden',
        boxShadow:'0 4px 24px rgba(74,13,23,0.1)',
        border:`1px solid rgba(74,13,23,0.08)`,
      }}>
        <table style={{ width:'100%', borderCollapse:'collapse', direction:'rtl' }}>
          <thead>
            <tr style={{
              background:`linear-gradient(90deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 100%)`,
            }}>
              <th style={{ width: 40, textAlign: 'center', padding: '16px 10px', border: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={orders.length > 0 && selectedIds.length === orders.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(orders.map(o => o.dbId));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  style={{ cursor: 'pointer', width: 16, height: 16, accentColor: GOLD }}
                />
              </th>
              {['رقم الطلب','العميل','التاريخ','المنتجات','المبلغ','الحالة','طريقة الدفع','الإجراءات'].map((col, i) => (
                <th key={col} style={{
                  padding:'16px 18px',
                  color: GOLD_LIGHT,
                  fontWeight:700,
                  fontSize:13,
                  textAlign: i === 3 || i === 7 ? 'center' : 'right',
                  whiteSpace:'nowrap',
                  border:'none',
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
                  <div style={{
                    display:'inline-block',
                    width:40, height:40,
                    border:`3px solid rgba(74,13,23,0.1)`,
                    borderTopColor: PRIMARY,
                    borderRadius:'50%',
                    animation:'spin 0.8s linear infinite',
                  }} />
                  <p style={{ marginTop:12, fontSize:14 }}>جاري تحميل الطلبات...</p>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
                  <RiBox3Line size={48} style={{ opacity:0.25, marginBottom:12, display:'block', margin:'0 auto 12px' }} />
                  <p style={{ margin:0, fontSize:15 }}>لا توجد طلبات</p>
                </td>
              </tr>
            ) : orders.map((order, idx) => (
              <tr
                key={order.id}
                style={{
                  borderBottom:`1px solid rgba(74,13,23,0.05)`,
                  background: idx % 2 === 0 ? '#fff' : '#FDFBFB',
                  transition:'background 0.15s',
                  cursor:'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = `rgba(74,13,23,0.04)`}
                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FDFBFB'}
                onClick={() => { 
                  setSelected(order); 
                  setEditMode(false); 
                  setNewStatus(order.status);
                  setTrackingNumber(order._raw.tracking_number || '');
                  setShippingCompany(order._raw.shipping_company || '');
                  setTrackingUrl(order._raw.tracking_url || '');
                }}
              >
                <td style={{ padding: '14px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(order.dbId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(prev => [...prev, order.dbId]);
                      } else {
                        setSelectedIds(prev => prev.filter(id => id !== order.dbId));
                      }
                    }}
                    style={{ cursor: 'pointer', width: 16, height: 16, accentColor: GOLD }}
                  />
                </td>
                <td style={{ padding:'14px 18px' }}>
                  <span style={{ fontWeight:700, fontSize:12.5, color: PRIMARY, fontFamily:'monospace', letterSpacing:'-0.3px' }}>{order.id}</span>
                </td>
                <td style={{ padding:'14px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:36, height:36, borderRadius:'50%',
                      background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#fff', fontSize:14, fontWeight:700, flexShrink:0,
                    }}>
                      {order.customer.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13.5, color:'#1F2937' }}>{order.customer}</div>
                      <div style={{ fontSize:11.5, color:'#9CA3AF', direction:'ltr', textAlign:'right' }}>{order.phone}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'14px 18px', fontSize:13, color:'#6B7280', whiteSpace:'nowrap' }}>{order.date}</td>
                <td style={{ padding:'14px 18px', textAlign:'center' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:`rgba(74,13,23,0.08)`, color: PRIMARY, fontSize:12, fontWeight:700 }}>
                    {order.items}
                  </span>
                </td>
                <td style={{ padding:'14px 18px' }}>
                  <span style={{ fontWeight:800, fontFamily:'monospace', fontSize:14, color:'#111827' }}>{order.total}</span>
                  <span style={{ fontSize:10, color:'#9CA3AF', marginRight:3 }}>OMR</span>
                </td>
                <td style={{ padding:'14px 18px' }}>
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:5,
                    padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                    background: order.statusConfig.bg,
                    color: order.statusConfig.color,
                    border:`1px solid ${order.statusConfig.border}30`,
                    whiteSpace:'nowrap',
                  }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background: order.statusConfig.dot, display:'inline-block', flexShrink:0 }} />
                    {order.statusConfig.label}
                  </span>
                </td>
                <td style={{ padding:'14px 18px', fontSize:12, color:'#6B7280', whiteSpace:'nowrap' }}>{order.paymentMethod}</td>
                <td style={{ padding:'14px 18px', textAlign:'center' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                    <button
                      title="عرض التفاصيل"
                      onClick={() => { 
                        setSelected(order); 
                        setEditMode(false); 
                        setNewStatus(order.status);
                        setTrackingNumber(order._raw.tracking_number || '');
                        setShippingCompany(order._raw.shipping_company || '');
                        setTrackingUrl(order._raw.tracking_url || '');
                      }}
                      style={{
                        width:34, height:34, borderRadius:9,
                        border:`1.5px solid #E5E7EB`,
                        background:'#fff', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'#3B82F6', transition:'all 0.15s',
                        boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
                      }}
                    >
                      <RiEyeLine size={16} />
                    </button>
                    <button
                      title="تعديل الحالة"
                      onClick={() => { 
                        setSelected(order); 
                        setEditMode(true); 
                        setNewStatus(order.status);
                        setTrackingNumber(order._raw.tracking_number || '');
                        setShippingCompany(order._raw.shipping_company || '');
                        setTrackingUrl(order._raw.tracking_url || '');
                      }}
                      style={{
                        width:34, height:34, borderRadius:9,
                        border:`1.5px solid #E5E7EB`,
                        background:'#fff', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color: GOLD_DARK, transition:'all 0.15s',
                        boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
                      }}
                    >
                      <RiPencilLine size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        {!loading && orders.length > 0 && (
          <div style={{
            padding:'14px 20px',
            borderTop:`1px solid rgba(74,13,23,0.06)`,
            background:'#FAFAFA',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px' }}>
              <span style={{ fontSize:13, color:'#9CA3AF' }}>عرض {orders.length} طلب في هذه الصفحة</span>
              <span style={{ fontSize:13, color: PRIMARY, fontWeight:600 }}>إجمالي الطلبات: {totalItems}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GHPagination 
                currentPage={currentPage} 
                lastPage={lastPage} 
                total={totalItems} 
                onPageChange={(p) => fetchOrders(p)} 
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Drawer ─── */}
      {selected && (
        <div
          style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(15,5,10,0.6)',
            display:'flex', justifyContent:'flex-start',
            backdropFilter:'blur(8px)',
          }}
          onClick={() => { setSelected(null); setEditMode(false) }}
        >
          <div
            style={{
              width:500, background:'#fff', height:'100vh',
              overflowY:'auto', direction:'rtl',
              boxShadow:`-8px 0 48px rgba(74,13,23,0.25)`,
              animation:'slideInRight 0.25s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{
              background:`linear-gradient(135deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 60%, ${PRIMARY_LIGHT} 100%)`,
              padding:'28px 24px 24px',
              position:'sticky', top:0, zIndex:1,
            }}>
              {/* Decorative circles */}
              <div style={{ position:'absolute', top:-40, right:-40, width:120, height:120, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.2)`, pointerEvents:'none' }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative' }}>
                <div>
                  <p style={{ color:GOLD_LIGHT, fontSize:12, fontWeight:600, margin:'0 0 4px', letterSpacing:'0.5px', textTransform:'uppercase' }}>تفاصيل الطلب</p>
                  <h2 style={{ color:'#fff', margin:0, fontSize:20, fontWeight:800, letterSpacing:'-0.5px' }}>
                    {selected.id}
                  </h2>
                  <div style={{ marginTop:10 }}>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                      background: selected.statusConfig.bg,
                      color: selected.statusConfig.color,
                      border:`1px solid ${selected.statusConfig.border}40`,
                    }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:selected.statusConfig.dot, display:'inline-block' }} />
                      {selected.statusConfig.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelected(null); setEditMode(false) }}
                  style={{
                    width:36, height:36, borderRadius:'50%',
                    background:'rgba(255,255,255,0.12)',
                    border:'1px solid rgba(255,255,255,0.2)',
                    color:'#fff', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:20, lineHeight:1, transition:'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                >×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding:'24px' }}>
              {/* Customer Info - Premium Card */}
              <div style={{
                background: `linear-gradient(135deg, rgba(74,13,23,0.04) 0%, rgba(181,145,95,0.06) 100%)`,
                border: `1px solid rgba(74,13,23,0.1)`,
                borderRadius: 14,
                padding: '18px 20px',
                marginBottom: 16,
              }}>
                {/* Section Label */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <RiUser3Line size={14} color="#fff" />
                  </div>
                  <span style={{ fontWeight:700, fontSize:14, color:PRIMARY }}>معلومات العميل</span>
                  {/* Guest / Registered Badge */}
                  <span style={{
                    marginRight:'auto', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                    background: selected.isGuest ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                    color: selected.isGuest ? '#92400E' : '#047857',
                    border: `1px solid ${selected.isGuest ? '#F59E0B40' : '#10B98140'}`,
                  }}>
                    {selected.isGuest ? '🔑 ضيف' : '✅ عميل مسجّل'}
                  </span>
                </div>

                {/* Avatar + Name/Email/Phone */}
                <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:14 }}>
                  {/* Avatar */}
                  <div style={{
                    width:50, height:50, borderRadius:14, flexShrink:0,
                    background:`linear-gradient(135deg, ${PRIMARY}, ${GOLD})`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontSize:20, fontWeight:800, letterSpacing:-1,
                    boxShadow:`0 4px 12px rgba(74,13,23,0.3)`,
                  }}>
                    {(selected.customer || 'ز').charAt(0)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:15, color:'#1A1A2E', marginBottom:4 }}>{selected.customer}</div>
                    {selected.customerEmail && (
                      <a href={`mailto:${selected.customerEmail}`} style={{ display:'block', fontSize:12.5, color:GOLD, textDecoration:'none', marginBottom:3, direction:'ltr', textAlign:'right' }}>
                        ✉️ {selected.customerEmail}
                      </a>
                    )}
                    {selected.phone && selected.phone !== '-' && (
                      <a href={`tel:${selected.phone}`} style={{ display:'block', fontSize:12.5, color:'#374151', textDecoration:'none', direction:'ltr', textAlign:'right' }}>
                        📞 {selected.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Address Card */}
                {selected.address && selected.address !== '-' && (
                  <div style={{
                    background:'#fff',
                    border:`1px solid rgba(74,13,23,0.08)`,
                    borderRadius:10,
                    padding:'12px 14px',
                    display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10,
                  }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:600, marginBottom:4 }}>📍 عنوان التوصيل</div>
                      <div style={{ fontSize:13, fontWeight:600, color:PRIMARY, lineHeight:1.5 }}>{selected.address}</div>
                    </div>
                    {selected.lat && selected.lng && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          flexShrink:0,
                          display:'inline-flex', alignItems:'center', gap:4,
                          padding:'6px 12px', borderRadius:20,
                          background:'#E8F5E9', color:'#2E7D32', fontSize:11, fontWeight:700,
                          textDecoration:'none', whiteSpace:'nowrap',
                        }}
                      >
                        <RiMapPinLine size={13} />
                        الخريطة
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Order Info */}
              <Section icon={<RiShoppingBagLine size={16} />} title="تفاصيل الطلب">
                <InfoRow label="تاريخ الطلب" value={selected.date} />
                <InfoRow label="طريقة الدفع" value={selected.paymentMethod} />
                {selected.notes && <InfoRow label="ملاحظات" value={selected.notes} />}
              </Section>

              {/* Items */}
              {selected.itemsList.length > 0 && (
                <Section icon={<RiBox3Line size={16} />} title="المنتجات">
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {selected.itemsList.map((item, i) => {
                      let snap = {}
                      try { snap = JSON.parse(item.product_snapshot || '{}') } catch {}
                      const productName = snap.name || item.product?.name_ar || 'منتج'
                      const productImg = item.product?.primary_image || snap.image
                      const imgUrl = productImg
                        ? (productImg.startsWith('http') ? productImg : `https://ghshopper.com${productImg.startsWith('/') ? '' : '/'}${productImg}`)
                        : null
                      return (
                        <div key={i} style={{
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          padding:'10px 14px', borderRadius:12,
                          background:'rgba(74,13,23,0.03)',
                          border:`1px solid rgba(74,13,23,0.08)`,
                          gap:12,
                        }}>
                          {/* Product Image */}
                          <div style={{
                            width:50, height:50, borderRadius:10, flexShrink:0,
                            background: imgUrl ? 'transparent' : `linear-gradient(135deg, rgba(74,13,23,0.08), rgba(181,145,95,0.1))`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            overflow:'hidden',
                            border:`1.5px solid rgba(74,13,23,0.08)`,
                          }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={productName} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            ) : (
                              <RiBox3Line size={22} color={PRIMARY} />
                            )}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:13.5, color:'#1F2937' }}>
                              {productName}
                            </div>
                            <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>
                              الكمية: {item.quantity}
                              {snap.unit_price && <span> • {parseFloat(snap.unit_price).toFixed(3)} OMR/قطعة</span>}
                            </div>
                          </div>
                          <div style={{ fontWeight:700, fontFamily:'monospace', fontSize:14, color: PRIMARY, textAlign:'left', flexShrink:0 }}>
                            {parseFloat(item.total_price || 0).toFixed(3)} OMR
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Pricing */}
              <Section icon={<RiMoneyDollarCircleLine size={16} />} title="الملخص المالي">
                <InfoRow label="المجموع الفرعي" value={`${selected.subtotal} OMR`} />
                <InfoRow label="الشحن" value={`${selected.shipping} OMR`} />
                {parseFloat(selected.discount) > 0 && <InfoRow label="الخصم" value={`- ${selected.discount} OMR`} color="#059669" />}
                <InfoRow label="الضريبة" value={`${selected.tax} OMR`} />
                <div style={{ height:1, background:'rgba(74,13,23,0.08)', margin:'10px 0' }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:15, color:'#111827' }}>الإجمالي</span>
                  <span style={{ fontWeight:800, fontFamily:'monospace', fontSize:18, color: PRIMARY }}>
                    {selected.total} OMR
                  </span>
                </div>
              </Section>

              {/* Status Update */}
              {editMode ? (
                <div style={{
                  background:`rgba(74,13,23,0.03)`,
                  border:`1.5px solid rgba(74,13,23,0.12)`,
                  borderRadius:12, padding:18,
                }}>
                  <p style={{ fontWeight:700, fontSize:14, color:PRIMARY, margin:'0 0 12px' }}>تغيير حالة الطلب</p>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    style={{
                      width:'100%', padding:'10px 14px', borderRadius:10,
                      border:`1.5px solid rgba(74,13,23,0.2)`,
                      fontSize:13, color:'#374151', outline:'none',
                      marginBottom:12, fontFamily:'inherit',
                    }}
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>

                  {/* Tracking Fields - always visible */}
                  <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select
                      value={shippingCompany}
                      onChange={e => setShippingCompany(e.target.value)}
                      style={{
                        width:'100%', padding:'10px 14px', borderRadius:10,
                        border:`1.5px solid rgba(74,13,23,0.2)`, fontSize:13, outline:'none',
                        fontFamily: 'inherit', color: shippingCompany ? '#374151' : '#9CA3AF',
                        background: '#fff',
                      }}
                    >
                      <option value="">اختر شركة الشحن... (اختياري)</option>
                      <option value="Aramex">Aramex - أرامكس</option>
                      <option value="DHL">DHL - دي إتش إل</option>
                      <option value="FedEx">FedEx - فيديكس</option>
                      <option value="Oman Post">Oman Post - بريد عُمان</option>
                      <option value="Mandoob">مندوب توصيل المتجر</option>
                    </select>
                    <input
                      placeholder="رقم التتبع (اختياري)"
                      value={trackingNumber}
                      onChange={e => setTrackingNumber(e.target.value)}
                      style={{
                        width:'100%', padding:'10px 14px', borderRadius:10,
                        border:`1.5px solid rgba(74,13,23,0.2)`, fontSize:13, outline:'none',
                        fontFamily: 'monospace', direction: 'ltr',
                      }}
                    />
                    <input
                      placeholder="رابط التتبع (اختياري)"
                      value={trackingUrl}
                      onChange={e => setTrackingUrl(e.target.value)}
                      style={{
                        width:'100%', padding:'10px 14px', borderRadius:10,
                        border:`1.5px solid rgba(74,13,23,0.2)`, fontSize:13, outline:'none',
                        direction: 'ltr',
                      }}
                    />
                  </div>

                  <div style={{ display:'flex', gap:10 }}>
                    <button
                      onClick={handleUpdateStatus}
                      disabled={updating}
                      style={{
                        flex:1, padding:'11px 0', borderRadius:10,
                        background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                        border:'none', color:'#fff', fontWeight:700, fontSize:14,
                        cursor: updating ? 'not-allowed' : 'pointer',
                        boxShadow:`0 4px 14px rgba(74,13,23,0.3)`,
                        transition:'opacity 0.2s',
                        opacity: updating ? 0.7 : 1,
                      }}
                    >
                      {updating ? 'جاري الحفظ...' : 'حفظ التغيير'}
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      style={{
                        padding:'11px 20px', borderRadius:10,
                        border:`1.5px solid #E5E7EB`,
                        background:'#fff', color:'#6B7280',
                        fontWeight:600, fontSize:14, cursor:'pointer',
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    width:'100%', padding:'13px 0', borderRadius:12,
                    background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                    border:'none', color:'#fff', fontWeight:700, fontSize:14.5,
                    cursor:'pointer',
                    boxShadow:`0 4px 18px rgba(74,13,23,0.3)`,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    transition:'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}
                >
                  <RiPencilLine size={17} />
                  تعديل حالة الطلب
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  )
}

function Section({ icon, title, children, gold }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        marginBottom:12,
        paddingBottom:8,
        borderBottom:`1.5px solid rgba(74,13,23,0.08)`,
      }}>
        <span style={{ color: gold ? GOLD_DARK : PRIMARY }}>{icon}</span>
        <span style={{ fontWeight:700, fontSize:14, color:'#1F2937' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
      <span style={{ fontSize:13, color:'#9CA3AF', fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color: color || '#374151', textAlign:'left', maxWidth:'65%', wordBreak:'break-word' }}>{value}</span>
    </div>
  )
}
