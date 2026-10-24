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
import { useFeatures } from '../../lib/features'

const API = import.meta.env.VITE_API_URL

const STATUS_CONFIG = {
  pending:    { label: 'قيد الانتظار', color: '#F59E0B', bg: '#FEF3C7' },
  reviewing:  { label: 'قيد المراجعة', color: '#3B82F6', bg: '#EFF6FF' },
  found:      { label: 'تم الإيجاد', color: '#10B981', bg: '#ECFDF5' },
  not_found:  { label: 'غير متوفر', color: '#EF4444', bg: '#FEF2F2' },
  ordered:    { label: 'تم الطلب', color: '#8B5CF6', bg: '#F5F3FF' },
  cancelled:  { label: 'ملغي', color: '#6B7280', bg: '#F3F4F6' },
}

// Quote (عرض سعر) sent to the customer: fields come flat (quote_*) or nested (quote{}).
const QUOTE_STATUS = {
  sent: { label: 'بانتظار رد العميل', color: '#B45309', bg: '#FEF3C7' },
  expired: { label: 'انتهت صلاحيته', color: '#6B7280', bg: '#F3F4F6' },
  accepted: { label: 'قبل العرض', color: '#047857', bg: '#D1FAE5' },
  declined: { label: 'رفض العرض', color: '#B91C1C', bg: '#FEE2E2' },
}
const DELIVERY = { home: 'مندوبنا · للبيت', genacom: 'جيناكم · للبيت', genacom_office: 'جيناكم · من الفرع' }
const quoteOf = (r) => {
  if (!r) return null
  const q = r.quote || {}
  const price = r.quote_price ?? q.price
  const status = r.quote_status ?? q.status
  if (price == null && !status) return null
  const expires = r.quote_expires_at ?? q.expires_at
  const ex = expires ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(expires)) ? expires : String(expires).replace(' ', 'T') + 'Z') : null
  const expired = status === 'sent' && (q.expired === true || (ex && !isNaN(ex) && ex < new Date()))
  return {
    price: Number(price || 0), note: r.quote_note ?? q.note, deposit: r.quote_deposit ?? q.deposit, delivery_fee: r.quote_delivery_fee ?? q.delivery_fee,
    delivery_method: r.quote_delivery_method ?? q.delivery_method, status: expired ? 'expired' : status, expires: ex, decline_reason: r.decline_reason ?? q.decline_reason,
  }
}
const omr3 = (v) => Number(v || 0).toFixed(3)

export default function ProductRequests() {
  const feats = useFeatures()
  const quotesOn = !!feats?.quotes?.on
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

  // ── Turn the request into a real order ──
  const [conv, setConv] = useState(null)
  const [convBusy, setConvBusy] = useState(false)
  const [converted, setConverted] = useState(null)

  const openDetail = async (req) => {
    setSelected(req); setIsDetailOpen(true); setConv(null); setConverted(null); setQf(null)
    try {
      const r = await fetch(`${API}/admin/product-requests/${req.id}`, { headers })
      const j = await r.json()
      if (j?.data) setSelected(j.data)
    } catch { /* list data is enough to show */ }
  }

  const startConvert = () => setConv({
    brand: selected.brand || '', name: selected.product_name_ar || selected.product_name_en || '',
    details: selected.description || '', price: '', delivery_fee: '', deposit: '', deposit_method: 'تحويل بنكي', notify: true,
  })

  const submitConvert = async () => {
    if (!conv.name.trim() || !(Number(conv.price) > 0)) { toast.error('اكتب اسم القطعة وسعرها'); return }
    setConvBusy(true)
    try {
      const body = { ...conv, price: Number(conv.price), delivery_fee: Number(conv.delivery_fee) || 0, deposit: Number(conv.deposit) || 0 }
      const r = await fetch(`${API}/admin/product-requests/${selected.id}/convert`, { method: 'POST', headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.message || 'تعذّر التحويل')
      toast.success(j.message)
      setConverted(j); setConv(null)
      setSelected((s) => ({ ...s, status: 'ordered', order_no: j.order_no, pay_url: j.pay_url }))
      fetchRequests()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setConvBusy(false)
    }
  }

  // ── Quote: send the price to the customer (they accept → order + pay link) ──
  const [qf, setQf] = useState(null)
  const [qBusy, setQBusy] = useState(false)
  const startQuote = () => {
    const q = quoteOf(selected)
    setQf({
      price: q?.price ? String(q.price) : '', deposit: q?.deposit != null ? String(q.deposit) : '', delivery_fee: q?.delivery_fee != null ? String(q.delivery_fee) : '',
      delivery_method: q?.delivery_method || '', note: q?.note || '', expires_days: String(feats?.quotes?.expires_days ?? 3),
    })
  }
  const reloadSelected = async (id) => {
    try {
      const r = await fetch(`${API}/admin/product-requests/${id}`, { headers })
      const j = await r.json()
      if (j?.data) setSelected(j.data)
    } catch { /* keep what we have */ }
    fetchRequests()
  }
  const submitQuote = async () => {
    const price = Number(qf.price)
    if (!(price > 0)) { toast.error('اكتب سعر القطعة'); return }
    const deposit = qf.deposit === '' ? null : Number(qf.deposit)
    if (deposit != null && (!(deposit >= 0) || deposit > price + Number(qf.delivery_fee || 0))) { toast.error('العربون لازم يكون أقل من الإجمالي'); return }
    const days = parseInt(qf.expires_days, 10)
    setQBusy(true)
    try {
      const body = {
        price, note: qf.note.trim() || null, deposit,
        delivery_fee: qf.delivery_fee === '' ? null : Number(qf.delivery_fee),
        delivery_method: qf.delivery_method || null,
        expires_days: days > 0 ? days : null,
      }
      const r = await fetch(`${API}/admin/product-requests/${selected.id}/quote`, { method: 'POST', headers, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || 'ما انرسل العرض')
      toast.success('انرسل العرض للعميل ✨')
      setQf(null)
      if (j?.data?.id) setSelected(j.data)
      reloadSelected(selected.id)
    } catch (e) { toast.error(e.message) } finally { setQBusy(false) }
  }
  const withdrawQuote = async () => {
    if (!confirm('تسحب العرض؟ يرجع الطلب «قيد المراجعة» وما يقدر العميل يقبله.')) return
    setQBusy(true)
    try {
      let r = await fetch(`${API}/admin/product-requests/${selected.id}/quote`, { method: 'DELETE', headers })
      if (r.status === 404 || r.status === 405) r = await fetch(`${API}/ps/requests/${selected.id}/quote`, { method: 'DELETE', headers })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.message || 'ما انسحب العرض')
      toast.success('انسحب العرض')
      reloadSelected(selected.id)
    } catch (e) { toast.error(e.message) } finally { setQBusy(false) }
  }

  const sendPayLink = (msg) => {
    const p = String(selected.customer_phone || '').replace(/\D/g, '')
    const phone = p.length === 8 ? '968' + p : p
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const openWhatsApp = (phone, name, product) => {
    const msg = encodeURIComponent(
      `السلام عليكم ${name}،\n\nبخصوص طلبكم للمنتج: ${product}\n\nنحن من فريق GH Shopper، وقد وصلنا طلبكم وسنتواصل معكم قريباً بشأن توفر هذا المنتج.\n\nشكراً لثقتكم بنا! 🛍️`
    )
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank')
  }

  const StatCard = ({ label, value, color }) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border)', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: 7, background: color }} />{label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginTop: 6 }}>{value || 0}</div>
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
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
                {['المنتج المطلوب', 'العميل', 'الحالة', ...(quotesOn ? ['العرض'] : []), 'التاريخ', 'الإجراءات'].map(h => (
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
                    onClick={() => openDetail(req)}
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
                    {quotesOn && (() => {
                      const q = quoteOf(req)
                      const qs = q && QUOTE_STATUS[q.status]
                      return (
                        <td style={{ padding: '16px 20px' }}>
                          {q ? (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }} dir="ltr">{omr3(q.price)} ر.ع</div>
                              {qs && <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: qs.color, backgroundColor: qs.bg }}>{qs.label}</span>}
                            </div>
                          ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      )
                    })()}
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

            {/* Quote */}
            {quotesOn && !selected.order_no && (() => {
              const q = quoteOf(selected)
              const qs = q && QUOTE_STATUS[q.status]
              const total = q ? q.price + Number(q.delivery_fee || 0) : 0
              const inp = { padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
              const lab = { display: 'grid', gap: 4, fontSize: 12.5, color: '#64748b' }
              return (
                <div style={{ background: '#F6F8FF', border: '1.5px solid #DCE4FB', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                  {qf ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ fontWeight: 800, color: '#1e3a8a' }}>{q ? 'تعديل العرض' : 'إرسال عرض سعر للعميل'}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={lab}>سعر القطعة (ر.ع) *<input autoFocus dir="ltr" inputMode="decimal" type="number" min="0" step="0.001" value={qf.price} onChange={(e) => setQf({ ...qf, price: e.target.value })} style={inp} /></label>
                        <label style={lab}>العربون المطلوب الحين (ر.ع)<input dir="ltr" inputMode="decimal" type="number" min="0" step="0.001" value={qf.deposit} onChange={(e) => setQf({ ...qf, deposit: e.target.value })} placeholder="فاضي = يدفع الكل" style={inp} /></label>
                        <label style={lab}>التوصيل (ر.ع)<input dir="ltr" inputMode="decimal" type="number" min="0" step="0.001" value={qf.delivery_fee} onChange={(e) => setQf({ ...qf, delivery_fee: e.target.value })} style={inp} /></label>
                        <label style={lab}>طريقة التوصيل
                          <select value={qf.delivery_method} onChange={(e) => setQf({ ...qf, delivery_method: e.target.value })} style={{ ...inp, backgroundColor: '#fff' }}>
                            <option value="">—</option>
                            {Object.entries(DELIVERY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </label>
                        <label style={{ ...lab, gridColumn: '1 / -1' }}>ملاحظة للعميل<input value={qf.note} maxLength={500} onChange={(e) => setQf({ ...qf, note: e.target.value })} placeholder="مثلاً: شامل التوصيل، يوصل خلال 10 أيام" style={inp} /></label>
                        <label style={lab}>صلاحية العرض (أيام)<input dir="ltr" type="number" min="1" max="60" value={qf.expires_days} onChange={(e) => setQf({ ...qf, expires_days: e.target.value })} style={inp} /></label>
                        <div style={{ alignSelf: 'end', fontSize: 13, color: '#1e3a8a', fontWeight: 700, paddingBottom: 10 }}>
                          الإجمالي للعميل: <span dir="ltr">{omr3(Number(qf.price || 0) + Number(qf.delivery_fee || 0))}</span> ر.ع
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>يوصل العميل إشعار «سعر القطعة جاهز ✨»، ولما يقبل يتحوّل لطلب مع رابط دفع.</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submitQuote} disabled={qBusy} style={{ flex: 1, padding: 12, borderRadius: 12, background: '#1e3a8a', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>{qBusy ? '...' : 'إرسال العرض'}</button>
                        <button onClick={() => setQf(null)} style={{ padding: '12px 16px', borderRadius: 12, background: '#fff', border: '1.5px solid #e2e8f0', cursor: 'pointer' }}>إلغاء</button>
                      </div>
                    </div>
                  ) : q ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 800, color: '#1e3a8a' }}>عرض السعر</div>
                        {qs && <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: qs.color, backgroundColor: qs.bg }}>{qs.label}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13.5, color: '#1e293b' }}>
                        <span>القطعة: <b dir="ltr">{omr3(q.price)}</b></span>
                        {Number(q.delivery_fee) > 0 && <span>التوصيل: <b dir="ltr">{omr3(q.delivery_fee)}</b></span>}
                        <span>الإجمالي: <b dir="ltr">{omr3(total)}</b> ر.ع</span>
                        {q.deposit != null && Number(q.deposit) > 0 && <span>العربون: <b dir="ltr">{omr3(q.deposit)}</b></span>}
                        {q.delivery_method && <span>{DELIVERY[q.delivery_method] || q.delivery_method}</span>}
                      </div>
                      {q.note && <div style={{ fontSize: 13, color: '#475569' }}>📝 {q.note}</div>}
                      {q.expires && <div style={{ fontSize: 12, color: '#64748b' }}>{q.status === 'expired' ? 'انتهى' : 'ينتهي'} {q.expires.toLocaleString('ar-OM', { timeZone: 'Asia/Muscat', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                      {q.status === 'declined' && q.decline_reason && <div style={{ fontSize: 13, color: '#B91C1C' }}>سبب الرفض: {q.decline_reason}</div>}
                      {q.status !== 'accepted' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          <button onClick={startQuote} disabled={qBusy} style={{ padding: '9px 14px', borderRadius: 10, background: '#1e3a8a', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{q.status === 'sent' ? 'تعديل العرض' : 'عرض جديد'}</button>
                          {q.status === 'sent' && <button onClick={withdrawQuote} disabled={qBusy} style={{ padding: '9px 14px', borderRadius: 10, background: '#fff', color: '#B91C1C', border: '1.5px solid #FECACA', fontWeight: 700, cursor: 'pointer' }}>سحب العرض</button>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#1e3a8a' }}>أرسل السعر للعميل</div>
                        <div style={{ fontSize: 12.5, color: '#64748b' }}>يشوف العرض في التطبيق والموقع، يقبله ويدفع بضغطة، أو يرفضه.</div>
                      </div>
                      <button onClick={startQuote} style={{ padding: '10px 16px', borderRadius: 12, background: '#1e3a8a', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>عرض سعر</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Turn into an order */}
            <div style={{ background: '#FBF7F0', border: '1.5px solid #E9DCC4', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              {selected.order_no ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 800, color: '#4B1828' }}>✓ تحوّل لطلب رقم {selected.order_no}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>الطلب في تطبيق الأدمن وفي «طلباتي» عند العميل{selected.order_remaining > 0 ? ` · المتبقي ${Number(selected.order_remaining).toFixed(3)} ر.ع` : ''}</div>
                  {selected.pay_url ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => sendPayLink(converted?.whatsapp_message || `رابط الدفع لطلبك من GH Shopper:\n${selected.pay_url}`)} style={{ padding: '10px 14px', borderRadius: 10, background: '#25D366', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>أرسل رابط الدفع واتساب</button>
                      <button onClick={() => { navigator.clipboard.writeText(selected.pay_url); toast.success('نسخت الرابط') }} style={{ padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1.5px solid #E9DCC4', fontWeight: 700, cursor: 'pointer' }}>نسخ رابط الدفع</button>
                    </div>
                  ) : null}
                </div>
              ) : conv ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontWeight: 800, color: '#4B1828' }}>تحويل إلى طلب للعميل</div>
                  {[['brand', 'البراند'], ['name', 'اسم القطعة *'], ['details', 'تفاصيل (المقاس، اللون…)']].map(([k, l]) => (
                    <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12.5, color: '#64748b' }}>{l}
                      <input value={conv[k]} onChange={(e) => setConv({ ...conv, [k]: e.target.value })} style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14 }} />
                    </label>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[['price', 'السعر للعميل (ر.ع) *'], ['delivery_fee', 'التوصيل (ر.ع)'], ['deposit', 'عربون مستلم (ر.ع)'], ['deposit_method', 'طريقة العربون']].map(([k, l]) => (
                      <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12.5, color: '#64748b' }}>{l}
                        <input value={conv[k]} inputMode={k === 'deposit_method' ? 'text' : 'decimal'} onChange={(e) => setConv({ ...conv, [k]: e.target.value })} style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, direction: k === 'deposit_method' ? 'rtl' : 'ltr' }} />
                      </label>
                    ))}
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <input type="checkbox" checked={conv.notify} onChange={(e) => setConv({ ...conv, notify: e.target.checked })} /> أرسل إشعار للعميل في التطبيق
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={submitConvert} disabled={convBusy} style={{ flex: 1, padding: 12, borderRadius: 12, background: '#4B1828', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>{convBusy ? '...' : 'إنشاء الطلب'}</button>
                    <button onClick={() => setConv(null)} style={{ padding: '12px 16px', borderRadius: 12, background: '#fff', border: '1.5px solid #e2e8f0', cursor: 'pointer' }}>إلغاء</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#4B1828' }}>لقيت القطعة؟</div>
                    <div style={{ fontSize: 12.5, color: '#64748b' }}>حوّلها لطلب حقيقي بسعرها: تدخل تطبيق الأدمن وتطلع للعميل في طلباته مع رابط دفع.</div>
                  </div>
                  <button onClick={startConvert} style={{ padding: '10px 16px', borderRadius: 12, background: '#4B1828', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>تحويل لطلب</button>
                </div>
              )}
            </div>

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
