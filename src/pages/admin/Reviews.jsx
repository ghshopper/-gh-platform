import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RiStarFill, RiCheckLine, RiCloseLine, RiDeleteBin7Line, RiEyeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { useFeatures } from '../../lib/features'
import FeatureOff from '../../components/FeatureOff'

const listOf = (d) => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.data) ? d.data.data : [])

export default function Reviews() {
  const feats = useFeatures()
  const [tab, setTab] = useState('product')
  if (!feats) return <div className="gh-skel" style={{ height: 360 }} />
  if (!feats.reviews?.on) return <FeatureOff k="reviews" />
  const serviceOn = feats.reviews?.service !== false
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>التقييمات</h1>
        <p style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>راجع تقييمات العملاء: المقبول بس يظهر في الموقع والتطبيق</p>
      </div>
      {serviceOn && (
        <div className="gh-seg" style={{ marginBottom: 16 }}>
          <button className={tab === 'product' ? 'on' : ''} onClick={() => setTab('product')}>تقييم المنتجات</button>
          <button className={tab === 'service' ? 'on' : ''} onClick={() => setTab('service')}>تقييم الخدمة</button>
        </div>
      )}
      {tab === 'service' && serviceOn ? <ServiceReviews /> : <ProductReviews />}
    </div>
  )
}

const Stars = ({ n }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[...Array(5)].map((_, i) => <RiStarFill key={i} color={i < n ? '#FBBF24' : '#E5E7EB'} />)}
  </div>
)
const StatusPill = ({ s }) => (
  <span style={{
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    background: s === 'approved' ? '#DEF7EC' : s === 'rejected' ? '#FDE8E8' : '#FEF3C7',
    color: s === 'approved' ? '#03543F' : s === 'rejected' ? '#9B1C1C' : '#92400E',
  }}>{s === 'approved' ? 'مقبول' : s === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}</span>
)
const th = { padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280' }
const tdc = { padding: '16px 24px', fontSize: 13 }

/** تقييم الخدمة: GET /admin/service-reviews · PUT /admin/service-reviews/{id}/status · DELETE /admin/service-reviews/{id} */
function ServiceReviews() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')
  const load = () => api.get('/admin/service-reviews', { params: filter ? { status: filter } : {} })
    .then((r) => setRows(listOf(r.data)))
    .catch((e) => { toast.error(e.response?.data?.message || 'فشل جلب تقييمات الخدمة'); setRows([]) })
  useEffect(() => { load() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps
  const setStatus = async (id, status) => {
    try { await api.put(`/admin/service-reviews/${id}/status`, { status }); toast.success('تم التحديث بنجاح'); load() } catch (e) { toast.error(e.response?.data?.message || 'خطأ في التحديث') }
  }
  const remove = async (id) => {
    if (!confirm('حذف هذا التقييم نهائياً؟')) return
    try { await api.delete(`/admin/service-reviews/${id}`); toast.success('تم الحذف'); load() } catch { toast.error('خطأ في الحذف') }
  }
  const list = (rows || []).filter((r) => !filter || r.status === filter)
  const approved = (rows || []).filter((r) => r.status === 'approved')
  const avg = approved.length ? approved.reduce((a, r) => a + Number(r.rating || 0), 0) / approved.length : 0
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="gh-seg">
          {[['', 'الكل'], ['pending', 'قيد المراجعة'], ['approved', 'مقبول'], ['rejected', 'مرفوض']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        {!filter && approved.length > 0 && (
          <span style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RiStarFill color="#FBBF24" /> <b style={{ color: 'var(--text-primary)' }}>{avg.toFixed(1)}</b> من {approved.length} تقييم مقبول
          </span>
        )}
      </div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {rows === null ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>جاري التحميل...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>ما فيه تقييمات للخدمة{filter ? ' بهذي الحالة' : ' للحين'}. نطلب من العميل يقيّم بعد يومين من تسليم طلبه.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                  {['العميل', 'الطلب', 'التقييم', 'التعليق', 'الحالة', 'إجراءات'].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const orderId = r.ps_order_id || r.order_id
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ ...tdc, fontWeight: 600 }}>{r.customer_name || r.user_name || '—'}<div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 400 }}>{r.created_at ? new Date(String(r.created_at).replace(' ', 'T')).toLocaleDateString('ar-OM') : ''}</div></td>
                      <td style={tdc}>{r.ps_order_id ? <Link to={`/admin/app-orders?order=${r.ps_order_id}`} style={{ color: 'var(--accent, #A8833F)', fontWeight: 600 }} dir="ltr">{r.invoice_no || '#' + orderId}</Link> : <span dir="ltr">{r.invoice_no || (orderId ? '#' + orderId : '—')}</span>}</td>
                      <td style={tdc}><Stars n={Number(r.rating) || 0} /></td>
                      <td style={{ ...tdc, maxWidth: 340, whiteSpace: 'pre-wrap' }}>{r.comment || '-'}</td>
                      <td style={tdc}><StatusPill s={r.status} /></td>
                      <td style={{ ...tdc, display: 'flex', gap: 8 }}>
                        {r.status !== 'approved' && <button title="قبول" onClick={() => setStatus(r.id, 'approved')} style={{ background: '#DEF7EC', color: '#03543F', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer' }}><RiCheckLine size={16} /></button>}
                        {r.status !== 'rejected' && <button title="رفض" onClick={() => setStatus(r.id, 'rejected')} style={{ background: '#FDE8E8', color: '#9B1C1C', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer' }}><RiCloseLine size={16} /></button>}
                        <button title="حذف" onClick={() => remove(r.id)} style={{ background: 'transparent', color: '#9CA3AF', border: 'none', padding: 8, cursor: 'pointer' }}><RiDeleteBin7Line size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function ProductReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReviews = async () => {
    try {
      const { data } = await api.get('/admin/reviews')
      setReviews(listOf(data))
    } catch (e) {
      toast.error('فشل جلب التقييمات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/reviews/${id}/status`, { status })
      toast.success('تم التحديث بنجاح')
      fetchReviews()
    } catch (e) {
      toast.error('خطأ في التحديث')
    }
  }

  const deleteReview = async (id) => {
    if (!confirm('حذف هذا التقييم نهائياً؟')) return
    try {
      await api.delete(`/admin/reviews/${id}`)
      toast.success('تم الحذف')
      fetchReviews()
    } catch (e) {
      toast.error('خطأ في الحذف')
    }
  }

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>جاري التحميل...</div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>لا توجد تقييمات حالياً</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>المنتج</th>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>العميل</th>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>التقييم</th>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>التعليق</th>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>الحالة</th>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600 }}>{r.product_name}</td>
                  <td style={{ padding: '16px 24px', fontSize: 13 }}>{r.user_name}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: 2, color: '#FBBF24' }}>
                      {[...Array(5)].map((_, i) => (
                        <RiStarFill key={i} color={i < r.rating ? '#FBBF24' : '#E5E7EB'} />
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, maxWidth: 300 }}>{r.comment || '-'}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: r.status === 'approved' ? '#DEF7EC' : r.status === 'rejected' ? '#FDE8E8' : '#FEF3C7',
                      color: r.status === 'approved' ? '#03543F' : r.status === 'rejected' ? '#9B1C1C' : '#92400E'
                    }}>
                      {r.status === 'approved' ? 'مقبول' : r.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', display: 'flex', gap: 8 }}>
                    {r.status !== 'approved' && (
                      <button onClick={() => updateStatus(r.id, 'approved')} style={{ background: '#DEF7EC', color: '#03543F', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
                        <RiCheckLine size={16} />
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button onClick={() => updateStatus(r.id, 'rejected')} style={{ background: '#FDE8E8', color: '#9B1C1C', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
                        <RiCloseLine size={16} />
                      </button>
                    )}
                    <button onClick={() => deleteReview(r.id)} style={{ background: 'transparent', color: '#9CA3AF', border: 'none', padding: 8, cursor: 'pointer' }}>
                      <RiDeleteBin7Line size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
