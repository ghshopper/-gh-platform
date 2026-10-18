import { useState, useEffect } from 'react'
import {
  RiShoppingBag3Line,
  RiWhatsappLine,
  RiEyeLine,
  RiDeleteBinLine,
  RiSearchLine,
  RiFilterLine,
  RiCheckLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiImageLine,
  RiTimeLine,
  RiUserLine,
  RiPhoneLine,
  RiLoader4Line,
} from 'react-icons/ri'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL

const STATUS_CONFIG = {
  pending:    { label: 'قيد الانتظار', color: '#F59E0B', bg: '#FEF3C7' },
  reviewing:  { label: 'قيد المراجعة', color: '#3B82F6', bg: '#EFF6FF' },
  found:      { label: 'تم الإيجاد', color: '#10B981', bg: '#ECFDF5' },
  not_found:  { label: 'غير متوفر', color: '#EF4444', bg: '#FEF2F2' },
  ordered:    { label: 'تم الطلب', color: '#8B5CF6', bg: '#F5F3FF' },
  cancelled:  { label: 'ملغي', color: '#6B7280', bg: '#F3F4F6' },
}

export default function ProductRequests() {
  const [requests, setRequests] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const headers = {
    Authorization: 'Bearer ' + localStorage.getItem('token'),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)

      const [reqRes, statsRes] = await Promise.all([
        fetch(`${API}/admin/product-requests?${params}`, { headers }),
        fetch(`${API}/admin/product-requests/stats`, { headers }),
      ])
      const reqJson = await reqRes.json()
      const statsJson = await statsRes.json()

      setRequests(reqJson.data?.data || reqJson.data || [])
      setStats(statsJson.data || {})
    } catch (err) {
      toast.error('فشل تحميل الطلبات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [search, statusFilter])

  const updateStatus = async (id, status) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/admin/product-requests/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم تحديث الحالة بنجاح')
        fetchRequests()
        if (selected?.id === id) {
          setSelected(prev => ({ ...prev, status }))
        }
      }
    } catch { toast.error('فشل تحديث الحالة') }
    finally { setActionLoading(false) }
  }

  const deleteRequest = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return
    try {
      await fetch(`${API}/admin/product-requests/${id}`, { method: 'DELETE', headers })
      toast.success('تم الحذف بنجاح')
      setIsDetailOpen(false)
      fetchRequests()
    } catch { toast.error('فشل الحذف') }
  }

  const openWhatsApp = (phone, name, product) => {
    const msg = encodeURIComponent(
      `السلام عليكم ${name}،\n\nبخصوص طلبكم للمنتج: ${product}\n\nنحن من فريق GH Shopper، وقد وصلنا طلبكم وسنتواصل معكم قريباً بشأن توفر هذا المنتج.\n\nشكراً لثقتكم بنا! 🛍️`
    )
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank')
  }

  const StatCard = ({ label, value, color, bg }) => (
    <div style={{
      background: bg || '#fff',
      borderRadius: 16,
      padding: '20px 24px',
      border: `1.5px solid ${color}30`,
      boxShadow: `0 4px 20px ${color}10`,
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value || 0}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', margin: 0 }}>
          طلبات المنتجات الغير متوفرة
        </h1>
        <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: 14 }}>
          إدارة طلبات العملاء للمنتجات التي لا يمتلكها المتجر حالياً
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="إجمالي الطلبات" value={stats.total} color="#4B1828" bg="#FDF6F0" />
        <StatCard label="قيد الانتظار" value={stats.pending} color="#F59E0B" bg="#FEF3C7" />
        <StatCard label="قيد المراجعة" value={stats.reviewing} color="#3B82F6" bg="#EFF6FF" />
        <StatCard label="تم الإيجاد" value={stats.found} color="#10B981" bg="#ECFDF5" />
        <StatCard label="تم الطلب" value={stats.ordered} color="#8B5CF6" bg="#F5F3FF" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <RiSearchLine style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم المنتج أو العميل..."
            style={{
              width: '100%', padding: '10px 40px 10px 14px', borderRadius: 12,
              border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0',
            fontSize: 14, fontFamily: 'inherit', outline: 'none', backgroundColor: '#fff',
          }}
        >
          <option value="">جميع الحالات</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <RiLoader4Line size={36} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 12 }}>جاري التحميل...</div>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <RiShoppingBag3Line size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>لا توجد طلبات حتى الآن</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                {['المنتج المطلوب', 'العميل', 'الحالة', 'التاريخ', 'الإجراءات'].map(h => (
                  <th key={h} style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map(req => {
                const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                return (
                  <tr
                    key={req.id}
                    style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    onClick={() => { setSelected(req); setIsDetailOpen(true) }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{req.product_name_ar}</div>
                      {req.brand && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{req.brand}</div>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{req.customer_name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{req.customer_phone}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: st.color, backgroundColor: st.bg }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 12, color: '#94a3b8' }}>
                      {new Date(req.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openWhatsApp(req.customer_phone, req.customer_name, req.product_name_ar)}
                          style={{ padding: '6px 12px', borderRadius: 8, background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                          title="فتح واتساب"
                        >
                          <RiWhatsappLine size={14} />
                          واتساب
                        </button>
                        <button
                          onClick={() => deleteRequest(req.id)}
                          style={{ padding: '6px', borderRadius: 8, background: '#FEF2F2', color: '#EF4444', border: '1px solid #FEE2E2', cursor: 'pointer' }}
                          title="حذف"
                        >
                          <RiDeleteBinLine size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailOpen && selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setIsDetailOpen(false)}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: 32, width: '90%', maxWidth: 600,
            maxHeight: '90vh', overflowY: 'auto', direction: 'rtl',
            boxShadow: '0 25px 60px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>تفاصيل طلب المنتج</h2>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>#{selected.id}</div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 12, padding: 8, cursor: 'pointer', color: '#64748b' }}>
                <RiCloseLine size={20} />
              </button>
            </div>

            {/* Product Info */}
            <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b', marginBottom: 8 }}>
                {selected.product_name_ar}
              </div>
              {selected.product_name_en && <div style={{ color: '#64748b', fontSize: 13 }}>{selected.product_name_en}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {selected.brand && (
                  <span style={{ padding: '4px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                    🏷️ {selected.brand}
                  </span>
                )}
                {selected.category && (
                  <span style={{ padding: '4px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                    📂 {selected.category}
                  </span>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 12 }}>بيانات العميل</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <RiUserLine color="#B5915F" size={16} />
                  <span style={{ fontSize: 14, color: '#1e293b', fontWeight: 600 }}>{selected.customer_name}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <RiPhoneLine color="#B5915F" size={16} />
                  <span style={{ fontSize: 14, color: '#1e293b' }}>{selected.customer_phone}</span>
                </div>
                {selected.customer_email && (
                  <div style={{ fontSize: 13, color: '#64748b' }}>📧 {selected.customer_email}</div>
                )}
              </div>
            </div>

            {/* Description */}
            {selected.description && (
              <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 8 }}>وصف المنتج المطلوب</div>
                <p style={{ margin: 0, fontSize: 14, color: '#1e293b', lineHeight: 1.7 }}>{selected.description}</p>
              </div>
            )}

            {/* Attributes */}
            {selected.attributes && Object.keys(selected.attributes).length > 0 && (
              <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 12 }}>المواصفات والخصائص</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(selected.attributes).map(([k, v]) => (
                    <div key={k} style={{ padding: '6px 14px', background: '#fff', borderRadius: 10, border: '1.5px solid #B5915F30', fontSize: 13 }}>
                      <span style={{ color: '#94a3b8' }}>{k}: </span>
                      <span style={{ fontWeight: 700, color: '#4B1828' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product URL */}
            {selected.product_url && (
              <a href={selected.product_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#EFF6FF', borderRadius: 12, color: '#3B82F6', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
                <RiExternalLinkLine size={16} />
                رابط المنتج من المتجر الرسمي
              </a>
            )}

            {/* Image */}
            {selected.image_url && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 8 }}>صورة المنتج</div>
                <img src={selected.image_url} alt="product" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover' }} />
              </div>
            )}

            {/* Status Update */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#475569', marginBottom: 12 }}>تغيير الحالة</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => updateStatus(selected.id, key)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      border: `1.5px solid ${cfg.color}`,
                      background: selected.status === key ? cfg.color : 'transparent',
                      color: selected.status === key ? '#fff' : cfg.color,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => openWhatsApp(selected.customer_phone, selected.customer_name, selected.product_name_ar)}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <RiWhatsappLine size={18} />
                  تواصل عبر واتساب
                </button>
                <button
                  onClick={() => deleteRequest(selected.id)}
                  style={{ padding: '12px 16px', borderRadius: 12, background: '#FEF2F2', color: '#EF4444', border: '1.5px solid #FEE2E2', cursor: 'pointer', fontWeight: 700 }}
                >
                  <RiDeleteBinLine size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
