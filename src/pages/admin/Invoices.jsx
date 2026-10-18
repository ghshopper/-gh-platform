import { useState, useEffect, useCallback } from 'react'
import {
  RiSearchLine, RiDownloadCloud2Line, RiEyeLine, RiFilePdfLine,
  RiCheckLine, RiTimeLine, RiSendPlaneLine, RiBox3Line, RiCloseLine,
  RiUserLine, RiCalendarLine, RiMoneyDollarCircleLine, RiFileTextLine,
  RiRefreshLine, RiAddLine, RiShoppingBagLine, RiDeleteBinLine,
} from 'react-icons/ri'
import { adminApi } from '../../services/adminApi'
import toast from 'react-hot-toast'
import GHPagination from '../../components/GHPagination'

const PRIMARY      = '#4A0D17'
const PRIMARY_DARK = '#2A080D'
const PRIMARY_LIGHT= '#6B1A2A'
const GOLD         = '#B5915F'
const GOLD_DARK    = '#8B6B3D'

const STATUS_CONFIG = {
  draft:     { label: 'مسودة',  color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border:'#6B728040', dot:'#9CA3AF' },
  sent:      { label: 'مرسلة', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border:'#3B82F640', dot:'#3B82F6' },
  paid:      { label: 'مدفوعة',color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border:'#10B98140', dot:'#10B981' },
  overdue:   { label: 'متأخرة',color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border:'#EF444440', dot:'#EF4444' },
  cancelled: { label: 'ملغاة', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border:'#9CA3AF40', dot:'#D1D5DB' },
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createOrderId, setCreateOrderId] = useState('')
  const [creating, setCreating] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [sending, setSending] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])

  const fetchInvoices = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const params = { page, per_page: 10 }
      if (statusFilter !== 'all') params.status = statusFilter
      if (search) params.search = search
      const res = await adminApi.getInvoices(params)
      const paged = res.data?.data && res.data?.current_page !== undefined ? res.data : (res.data?.data?.current_page !== undefined ? res.data.data : null);
      const raw = paged ? paged.data : (res.data?.data?.data || res.data?.data || res.data || []);
      setInvoices(Array.isArray(raw) ? raw : [])
      setCurrentPage(paged ? paged.current_page : 1)
      setLastPage(paged ? paged.last_page : 1)
      setTotalItems(paged ? paged.total : (raw.length || 0))
      setSelectedIds([])
    } catch (err) {
      console.error('Error fetching invoices:', err)
      toast.error('تعذر جلب الفواتير')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await adminApi.getOrders()
      const raw = res.data?.data?.data || res.data?.data || []
      setOrders(Array.isArray(raw) ? raw : [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchInvoices(1)
    fetchOrders()
  }, [fetchOrders, search, statusFilter])

  const paginatedInvoices = invoices

  const totalPaid    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
  const totalPending = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)

  const handleCreateInvoice = async () => {
    if (!createOrderId) return toast.error('يرجى اختيار الطلب أولاً')
    try {
      setCreating(true)
      await adminApi.createInvoice({ order_id: parseInt(createOrderId) })
      toast.success('تم إنشاء الفاتورة بنجاح')
      setShowCreate(false)
      setCreateOrderId('')
      await fetchInvoices()
    } catch (err) {
      toast.error('فشل إنشاء الفاتورة: ' + (err.response?.data?.message || err.message))
    } finally {
      setCreating(false)
    }
  }

  const handleDownloadPdf = async (inv, e) => {
    if (e) e.stopPropagation()
    try {
      setDownloading(inv.id)
      const res = await adminApi.downloadInvoicePdf(inv.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${inv.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('تم تحميل الفاتورة PDF بنجاح')
    } catch (err) {
      toast.error('فشل تحميل PDF: ' + (err.response?.data?.message || err.message))
    } finally {
      setDownloading(null)
    }
  }

  const handleSendInvoice = async (inv) => {
    try {
      setSending(inv.id)
      await adminApi.sendInvoice(inv.id)
      toast.success('تم إرسال الفاتورة إلى بريد العميل بنجاح')
    } catch (err) {
      toast.error('فشل إرسال الفاتورة: ' + (err.response?.data?.message || err.message))
    } finally {
      setSending(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} فواتير؟`)) return;
    try {
      setLoading(true);
      const res = await adminApi.bulkDeleteInvoices(selectedIds);
      setSelectedIds([]);
      await fetchInvoices(currentPage);
      toast.success(res.data?.message || 'تم حذف الفواتير بنجاح');
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('فشل الحذف: ' + (err.response?.data?.message || err.message));
      setLoading(false);
    }
  }

  const exportCSV = () => {
    if (invoices.length === 0) return toast.error('لا توجد فواتير للتصدير')
    const headers = ['رقم الفاتورة', 'رقم الطلب', 'العميل', 'تاريخ الإصدار', 'تاريخ الاستحقاق', 'المبلغ', 'الحالة']
    const rows = invoices.map(i => [
      i.invoice_number,
      i.order?.order_number || '-',
      i.customer?.name || i.order?.guest_name || 'ضيف',
      i.issue_date || '-',
      i.due_date || '-',
      parseFloat(i.total_amount || 0).toFixed(3),
      (STATUS_CONFIG[i.status] || {}).label || i.status
    ])
    const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices-export-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير الفواتير بنجاح')
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
        {/* Decorative rings */}
        <div style={{ position:'absolute', top:-60, left:-60, width:200, height:200, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.15)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-30, left:-30, width:140, height:140, borderRadius:'50%', border:`1px solid rgba(181,145,95,0.1)`, pointerEvents:'none' }} />
        <div className="flex-mobile-col" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
          <div>
            <h1 style={{ color:'#fff', fontSize:26, fontWeight:800, margin:0, letterSpacing:'-0.5px' }}>الفواتير</h1>
            <p style={{ color:`rgba(255,255,255,0.6)`, fontSize:13, margin:'6px 0 0' }}>
              {loading ? 'جاري التحميل...' : `${invoices.length} فاتورة إجمالاً`}
            </p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={fetchInvoices} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:10,
              background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)',
              color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, backdropFilter:'blur(4px)',
            }}>
              <RiRefreshLine size={16} />تحديث
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
            <button onClick={() => setShowCreate(true)} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:10,
              background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`, border:'none',
              color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600,
              boxShadow:`0 4px 14px rgba(181,145,95,0.4)`,
            }}>
              <RiAddLine size={16} />إنشاء فاتورة
            </button>
          </div>
        </div>
      </div>

      {/* ─── Stats ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'إجمالي المدفوع',  value: totalPaid.toFixed(3),    color:'#10B981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.2)',  icon: RiCheckLine },
          { label:'قيد الانتظار',    value: totalPending.toFixed(3), color:'#3B82F6', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.2)',  icon: RiTimeLine },
          { label:'متأخرة',          value: totalOverdue.toFixed(3), color:'#EF4444', bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.2)',   icon: RiSendPlaneLine },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div key={label} style={{
            background:'#fff', borderRadius:14, padding:'20px 24px',
            border:`1px solid ${border}`, boxShadow:`0 2px 12px rgba(0,0,0,0.04)`,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:8, fontWeight:600 }}>{label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:'#1A1A2E', lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:6 }}>ر.ع</div>
              </div>
              <div style={{ width:42, height:42, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
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
          display:'flex', alignItems:'center', gap:8, flex:1, minWidth:200,
          background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:10, padding:'8px 14px',
        }}>
          <RiSearchLine size={16} color="#9CA3AF" />
          <input
            placeholder="بحث برقم الفاتورة، الطلب، أو العميل..."
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
          <option value="all">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="sent">مرسلة</option>
          <option value="paid">مدفوعة</option>
          <option value="overdue">متأخرة</option>
          <option value="cancelled">ملغاة</option>
        </select>
        <button onClick={exportCSV} style={{
          display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10,
          background:PRIMARY, border:'none', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600,
        }}>
          <RiDownloadCloud2Line size={15} />تصدير CSV
        </button>
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
                <th style={{ width: 40, textAlign: 'center', padding: '14px 10px', borderBottom: '2px solid rgba(74,13,23,0.08)' }}>
                  <input 
                    type="checkbox" 
                    checked={paginatedInvoices.length > 0 && selectedIds.length === paginatedInvoices.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(paginatedInvoices.map(i => i.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    style={{ cursor: 'pointer', width: 16, height: 16, accentColor: GOLD }}
                  />
                </th>
                {['رقم الفاتورة','رقم الطلب','العميل','تاريخ الإصدار','تاريخ الاستحقاق','المبلغ','الحالة','الإجراءات'].map(h => (
                  <th key={h} style={{
                    padding:'14px 16px', fontSize:12, fontWeight:700, color:'#6B7280',
                    textAlign:'right', borderBottom:'2px solid rgba(74,13,23,0.08)', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:56 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid rgba(74,13,23,0.1)`, borderTop:`2px solid ${PRIMARY}`, animation:'spin 1s linear infinite', margin:'0 auto 12px' }} />
                  <p style={{ color:'#9CA3AF', fontSize:13 }}>جاري التحميل...</p>
                </td></tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
                    <div style={{ background:'rgba(74,13,23,0.04)', width:80, height:80, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                      <RiFileTextLine size={32} color="#B5915F" />
                    </div>
                    <div style={{ fontSize:15, fontWeight:600, color:'#4B5563', marginBottom:4 }}>لا توجد فواتير</div>
                    <div style={{ fontSize:13 }}>جرب تغيير حالة الفلتر أو مصطلح البحث</div>
                  </td>
                </tr>
              ) : paginatedInvoices.map(inv => {
                const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft
                const isOverdue = inv.status === 'overdue'
                const customerName = inv.customer?.name || inv.order?.guest_name || 'ضيف'
                return (
                  <tr key={inv.id}
                    style={{ cursor:'pointer', transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(74,13,23,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background=''}
                    onClick={() => setSelected(inv)}
                  >
                    <td style={{ padding: '14px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(inv.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, inv.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== inv.id));
                          }
                        }}
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: GOLD }}
                      />
                    </td>
                    <td style={{ padding:'14px 16px', fontWeight:700, color:PRIMARY, fontSize:13 }}>{inv.invoice_number}</td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:'#374151' }}>
                      <span style={{ background:'rgba(74,13,23,0.06)', padding:'3px 8px', borderRadius:6, fontSize:12, fontWeight:600 }}>
                        {inv.order?.order_number || '-'}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{
                          width:30, height:30, borderRadius:8, flexShrink:0,
                          background:`linear-gradient(135deg, ${PRIMARY}, ${GOLD})`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'#fff', fontSize:12, fontWeight:700,
                        }}>
                          {(customerName || 'ز').charAt(0)}
                        </div>
                        <span style={{ fontSize:13, fontWeight:500 }}>
                          {customerName}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:13, color:'#6B7280' }}>{(inv.issue_date || '-').slice(0, 10)}</td>
                    <td style={{ padding:'14px 16px', fontSize:13, fontWeight: isOverdue?700:400, color: isOverdue?'#EF4444':'#6B7280' }}>
                      {isOverdue && '⚠️ '}{(inv.due_date || '-').slice(0, 10)}
                    </td>
                    <td style={{ padding:'14px 16px', fontWeight:700, fontSize:14, color:'#1A1A2E' }}>
                      {parseFloat(inv.total_amount||0).toFixed(3)} <span style={{ fontSize:11, color:'#9CA3AF' }}>ر.ع</span>
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
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-start' }}>
                        <button title="عرض التفاصيل" onClick={() => setSelected(inv)} style={{
                          width:32, height:32, borderRadius:8, border:`1px solid rgba(74,13,23,0.15)`,
                          background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:PRIMARY,
                        }}><RiEyeLine size={15} /></button>
                        <button title="تحميل PDF" onClick={e => handleDownloadPdf(inv, e)} style={{
                          width:32, height:32, borderRadius:8, border:'1px solid rgba(239,68,68,0.3)',
                          background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                          color: downloading===inv.id ? '#9CA3AF' : '#EF4444',
                        }}>
                          {downloading===inv.id ? '...' : <RiFilePdfLine size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(0,0,0,0.06)', background: '#FAFAFA' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px' }}>
            <span style={{ fontSize:13, color:'#9CA3AF' }}>عرض {paginatedInvoices.length} فاتورة في هذه الصفحة</span>
            <span style={{ fontSize:13, color: PRIMARY, fontWeight:600 }}>إجمالي الفواتير: {totalItems}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GHPagination 
              currentPage={currentPage} 
              lastPage={lastPage} 
              total={totalItems} 
              onPageChange={(p) => fetchInvoices(p)} 
            />
          </div>
        </div>
      </div>

      {/* ─── Create Invoice Modal ─── */}
      {showCreate && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(15,5,10,0.6)', backdropFilter:'blur(8px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:24,
        }} onClick={() => setShowCreate(false)}>
          <div style={{
            background:'#fff', borderRadius:20, width:'100%', maxWidth:440,
            boxShadow:'0 25px 60px rgba(0,0,0,0.2)', animation:'fadeScaleIn 0.2s ease-out',
            direction:'rtl',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              background:`linear-gradient(135deg, ${PRIMARY_DARK}, ${PRIMARY})`,
              borderRadius:'20px 20px 0 0', padding:'20px 24px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:4 }}>إنشاء يدوي</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>إنشاء فاتورة جديدة</div>
              </div>
              <button onClick={() => setShowCreate(false)} style={{
                width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.12)',
                border:'1px solid rgba(255,255,255,0.2)', cursor:'pointer', color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><RiCloseLine size={18}/></button>
            </div>
            <div style={{ padding:24 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:8 }}>
                اختر الطلب المرتبط
              </label>
              <select
                value={createOrderId} onChange={e => setCreateOrderId(e.target.value)}
                style={{
                  width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid #E5E7EB',
                  fontSize:13, outline:'none', cursor:'pointer', background:'#F9FAFB', direction:'rtl',
                  marginBottom:20,
                }}
              >
                <option value="">-- اختر طلباً --</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} — {o.guest_name || o.customer?.name || 'ضيف'} — {parseFloat(o.total_amount||0).toFixed(3)} ر.ع
                  </option>
                ))}
              </select>
              <button onClick={handleCreateInvoice} disabled={creating} style={{
                width:'100%', padding:'12px', borderRadius:12, border:'none',
                background: creating ? '#9CA3AF' : `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                color:'#fff', fontSize:14, fontWeight:700, cursor: creating?'not-allowed':'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: creating ? 'none' : `0 4px 16px rgba(74,13,23,0.35)`,
              }}>
                {creating ? 'جاري الإنشاء...' : <><RiAddLine size={17}/>إنشاء الفاتورة</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Invoice Detail Drawer ─── */}
      {selected && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(15,5,10,0.6)', backdropFilter:'blur(8px)',
          display:'flex', justifyContent:'flex-start',
        }} onClick={() => setSelected(null)}>
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
                  <p style={{ color:GOLD, fontSize:11, fontWeight:600, margin:'0 0 4px', letterSpacing:'0.5px', textTransform:'uppercase' }}>تفاصيل الفاتورة</p>
                  <h2 style={{ color:'#fff', margin:0, fontSize:20, fontWeight:800 }}>{selected.invoice_number}</h2>
                  <div style={{ marginTop:10 }}>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                      background:(STATUS_CONFIG[selected.status]||STATUS_CONFIG.draft).bg,
                      color:(STATUS_CONFIG[selected.status]||STATUS_CONFIG.draft).color,
                    }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:(STATUS_CONFIG[selected.status]||STATUS_CONFIG.draft).dot }} />
                      {(STATUS_CONFIG[selected.status]||STATUS_CONFIG.draft).label}
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

            {/* Drawer Body */}
            <div style={{ padding:24 }}>
              {/* Customer Info */}
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
                  }}>
                    {(selected.customer?.name || selected.order?.guest_name || 'ز').charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{selected.customer?.name || selected.order?.guest_name || 'ضيف'}</div>
                    {(selected.customer?.email || selected.order?.guest_email) && (
                      <div style={{ fontSize:12, color:GOLD }}>{selected.customer?.email || selected.order?.guest_email}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div style={{
                background:'#fff', border:`1px solid rgba(74,13,23,0.08)`, borderRadius:14,
                padding:'18px 20px', marginBottom:16,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <RiFileTextLine size={14} color="#fff" />
                  </div>
                  <span style={{ fontWeight:700, fontSize:14, color:PRIMARY }}>تفاصيل الفاتورة</span>
                </div>
                {[
                  ['رقم الطلب', selected.order?.order_number || '-'],
                  ['تاريخ الإصدار', (selected.issue_date || '-').slice(0, 10)],
                  ['تاريخ الاستحقاق', (selected.due_date || '-').slice(0, 10)],
                ].map(([label, val]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize:13, color:'#6B7280' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1A1A2E' }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Amounts */}
              <div style={{
                background:`linear-gradient(135deg, rgba(74,13,23,0.03), rgba(181,145,95,0.05))`,
                border:`1px solid rgba(74,13,23,0.08)`, borderRadius:14,
                padding:'18px 20px', marginBottom:24,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <RiMoneyDollarCircleLine size={14} color="#fff" />
                  </div>
                  <span style={{ fontWeight:700, fontSize:14, color:PRIMARY }}>ملخص المبالغ</span>
                </div>
                {[
                  ['المجموع الفرعي', parseFloat(selected.subtotal||0).toFixed(3)],
                  ['الخصم', parseFloat(selected.discount||0).toFixed(3)],
                  ['الضريبة', parseFloat(selected.tax_amount||0).toFixed(3)],
                ].map(([label, val]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize:13, color:'#6B7280' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:600 }}>{val} ر.ع</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 4px', marginTop:4, borderTop:`2px solid rgba(74,13,23,0.1)` }}>
                  <span style={{ fontSize:14, fontWeight:700, color:PRIMARY }}>الإجمالي النهائي</span>
                  <span style={{ fontSize:18, fontWeight:800, color:PRIMARY }}>{parseFloat(selected.total_amount||0).toFixed(3)} ر.ع</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:10 }}>
                <button
                  onClick={e => handleDownloadPdf(selected, e)}
                  disabled={downloading === selected.id}
                  style={{
                    flex:1, padding:'12px', borderRadius:12, border:`1px solid rgba(239,68,68,0.3)`,
                    background:'#fff', cursor: downloading === selected.id ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600, color:'#EF4444',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  }}
                >
                  <RiFilePdfLine size={16} /> {downloading === selected.id ? 'جاري التحميل...' : 'تحميل PDF'}
                </button>
                <button
                  onClick={() => handleSendInvoice(selected)}
                  disabled={sending === selected.id}
                  style={{
                    flex:2, padding:'12px', borderRadius:12, border:'none',
                    background:`linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, cursor: sending === selected.id ? 'not-allowed' : 'pointer',
                    fontSize:13, fontWeight:700, color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    boxShadow:`0 4px 14px rgba(74,13,23,0.35)`,
                  }}
                >
                  <RiSendPlaneLine size={16} /> {sending === selected.id ? 'جاري الإرسال...' : 'إرسال للعميل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeScaleIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(-30px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
