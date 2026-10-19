import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { RiEdit2Line, RiVipCrownLine } from 'react-icons/ri'

export default function LoyaltyTiers() {
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTier, setEditingTier] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    min_points: 0,
    reward_multiplier: 1.0,
    color: '#000000',
    icon: 'emoji_events'
  })

  useEffect(() => {
    fetchTiers()
  }, [])

  const fetchTiers = async () => {
    try {
      const res = await api.get('/admin/loyalty-tiers')
      if (res && res.data) {
        // Fallback to empty array if res.data.data is undefined to avoid map crash
        setTiers(res.data.data || [])
      }
    } catch (err) {
      toast.error('تعذر جلب مستويات الولاء')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      if (editingTier) {
        await api.put(`/admin/loyalty-tiers/${editingTier.id}`, formData)
        toast.success('تم التحديث بنجاح')
      } else {
        await api.post('/admin/loyalty-tiers', formData)
        toast.success('تمت الإضافة بنجاح')
      }
      setShowModal(false)
      fetchTiers()
    } catch (err) {
      toast.error('حدث خطأ أثناء الحفظ')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستوى؟')) return
    try {
      await api.delete(`/admin/loyalty-tiers/${id}`)
      toast.success('تم الحذف بنجاح')
      fetchTiers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر الحذف')
    }
  }

  const openModal = (tier = null) => {
    if (tier) {
      setEditingTier(tier)
      setFormData(tier)
    } else {
      setEditingTier(null)
      setFormData({ name: '', min_points: 0, reward_multiplier: 1.0, color: '#000000', icon: 'emoji_events' })
    }
    setShowModal(true)
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid #E5E7EB', fontSize: 14, outline: 'none',
    backgroundColor: '#F9FAFB', fontFamily: 'inherit', color: '#1A1A2E'
  };

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 6 };

  if (loading) return <div style={{ padding: 20 }}>جاري تحميل المستويات...</div>

  return (
    <div style={{ 
      backgroundColor: '#FFFFFF', borderRadius: 20, 
      boxShadow: '0 8px 24px rgba(0,0,0,0.04)', padding: 32, 
      border: '1px solid #F3F4F6', marginTop: 32 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #F3F4F6', paddingBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RiVipCrownLine color="var(--color-primary)" />
          مستويات الولاء
        </h3>
        <span style={{ fontSize: 12.5, color: '#6B7280' }}>ثلاث مستويات ثابتة: بيج (0–20 ألف نقطة) · عنابي (20–50 ألف) · أسود (50 ألف وفوق)</span>
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead>
          <tr style={{ backgroundColor: '#F9FAFB', color: '#6B7280', fontSize: 13 }}>
            <th style={{ padding: '12px 16px', borderRadius: '0 8px 8px 0' }}>اسم المستوى</th>
            <th style={{ padding: '12px 16px' }}>النقاط المطلوبة</th>
            <th style={{ padding: '12px 16px' }}>مضاعف النقاط</th>
            <th style={{ padding: '12px 16px' }}>اللون</th>
            <th style={{ padding: '12px 16px', borderRadius: '8px 0 0 8px' }}>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map(tier => (
            <tr key={tier.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '16px', fontWeight: 700, color: tier.color }}>{tier.name}{tier.name_ar ? <span style={{ color: '#6B7280', fontWeight: 500 }}> · {tier.name_ar}</span> : null}</td>
              <td style={{ padding: '16px' }}>{tier.min_points} نقطة</td>
              <td style={{ padding: '16px' }}>x{tier.reward_multiplier}</td>
              <td style={{ padding: '16px' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: tier.color, border: '1px solid #ddd' }}></div>
              </td>
              <td style={{ padding: '16px', display: 'flex', gap: 8 }}>
                <button onClick={() => openModal(tier)} style={{ background: '#F3F4F6', border: 'none', padding: 8, borderRadius: 6, cursor: 'pointer', color: '#4B5563' }}><RiEdit2Line /></button>
              </td>
            </tr>
          ))}
          {tiers.length === 0 && (
             <tr><td colSpan="5" style={{ padding: 20, textAlign: 'center', color: '#6B7280' }}>لا توجد مستويات حالياً</td></tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: 32, borderRadius: 16, width: 460, maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: 24, fontSize: 18, fontWeight: 800 }}>{editingTier ? 'تعديل المستوى' : 'إضافة مستوى جديد'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>اسم المستوى (إنجليزي)</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} placeholder="Privilege" dir="ltr" />
              </div>
              <div>
                <label style={labelStyle}>اسم المستوى (عربي، يظهر في التطبيق)</label>
                <input value={formData.name_ar || ''} onChange={e => setFormData({...formData, name_ar: e.target.value})} style={inputStyle} placeholder="بريفيلج" />
              </div>
              <div>
                <label style={labelStyle}>المزايا بالعربي (كل ميزة في سطر)</label>
                <textarea rows={4} value={formData.benefits_ar || ''} onChange={e => setFormData({...formData, benefits_ar: e.target.value})} style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} placeholder={'نقاط مضاعفة مع كل طلب\nتوصيل مجاني\nأولوية في الطلبات الخاصة'} />
              </div>
              <div>
                <label style={labelStyle}>المزايا بالإنجليزي (كل ميزة في سطر)</label>
                <textarea rows={3} dir="ltr" value={formData.benefits_en || ''} onChange={e => setFormData({...formData, benefits_en: e.target.value})} style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>النقاط المطلوبة</label>
                <input required type="number" value={formData.min_points} onChange={e => setFormData({...formData, min_points: parseInt(e.target.value)||0})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>مضاعف كسب النقاط</label>
                <input required type="number" step="0.01" value={formData.reward_multiplier} onChange={e => setFormData({...formData, reward_multiplier: parseFloat(e.target.value)||1})} style={inputStyle} />
                <span style={{ fontSize: 11, color: '#6B7280', marginTop: 4, display: 'block' }}>1.0 تعني كسب عادي، 1.5 تعني مرة ونصف</span>
              </div>
              <div>
                <label style={labelStyle}>لون المستوى</label>
                <input type="color" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} style={{ width: '100%', height: 40, border: 'none', cursor: 'pointer' }} />
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="submit" style={{ flex: 1, padding: 12, borderRadius: 8, background: 'var(--color-primary)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>حفظ</button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, borderRadius: 8, background: '#F3F4F6', color: '#4B5563', border: 'none', fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
