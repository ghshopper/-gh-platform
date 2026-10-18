import React, { useState, useEffect } from 'react'
import { RiStarFill, RiCheckLine, RiCloseLine, RiDeleteBin7Line, RiEyeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function Reviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchReviews = async () => {
    try {
      const { data } = await api.get('/admin/reviews')
      setReviews(data)
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
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>تقييمات المنتجات</h1>
        <p style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>إدارة ومراجعة تقييمات العملاء للمنتجات</p>
      </div>

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
