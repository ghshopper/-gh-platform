import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { RiSave3Line, RiStarSmileLine } from 'react-icons/ri'
import OmrSymbol from '../../components/OmrSymbol'

import LoyaltyTiers from './LoyaltyTiers'

export default function Loyalty() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    points_for_registration: 0,
    points_for_first_order: 0,
    points_per_omr: 0,
    omr_per_point: 0.00,
    is_active: true
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/loyalty-settings')
      if (res && res.data && res.data.data) {
        setSettings(res.data.data)
      } else {
        setSettings({
          points_for_registration: 50,
          points_for_first_order: 100,
          points_per_omr: 10,
          omr_per_point: 0.001,
          is_active: true
        })
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء تحميل الإعدادات')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/admin/loyalty-settings', settings)
      toast.success('تم حفظ إعدادات نقاط الولاء بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>جاري التحميل...</div>

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: '1px solid #E5E7EB', fontSize: 14, outline: 'none',
    backgroundColor: '#F9FAFB', fontFamily: 'inherit', color: '#1A1A2E'
  };

  const labelStyle = {
    display: 'block', fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 8
  };

  const helpStyle = {
    fontSize: 12, color: '#6B7280', marginTop: 6, display: 'block'
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ backgroundColor: 'var(--color-primary-bg)', padding: 8, borderRadius: 12, display: 'flex' }}>
              <RiStarSmileLine color="var(--color-primary)" size={24} />
            </div>
            نظام الولاء
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 6 }}>التحكم في نقاط الولاء والمكافآت للعملاء بسهولة</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            background: 'var(--color-primary)', color: 'white', 
            border: 'none', borderRadius: 10, padding: '12px 24px', 
            fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(74, 13, 23, 0.2)'
          }}
        >
          <RiSave3Line size={18} />
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>

      <div style={{ 
        backgroundColor: '#FFFFFF', borderRadius: 20, 
        boxShadow: '0 8px 24px rgba(0,0,0,0.04)', padding: 32, 
        border: '1px solid #F3F4F6' 
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E', marginBottom: 24, borderBottom: '1px solid #F3F4F6', paddingBottom: 16 }}>إعدادات النقاط</h3>
        
        <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} onSubmit={handleSave}>
          
          <div>
            <label style={labelStyle}>نقاط تسجيل حساب جديد</label>
            <input 
              type="number"
              value={settings.points_for_registration}
              onChange={e => setSettings({...settings, points_for_registration: parseInt(e.target.value) || 0})}
              style={inputStyle}
            />
            <span style={helpStyle}>النقاط التي يحصل عليها العميل فور تسجيله لحساب جديد</span>
          </div>

          <div>
            <label style={labelStyle}>نقاط أول عملية شراء</label>
            <input 
              type="number"
              value={settings.points_for_first_order}
              onChange={e => setSettings({...settings, points_for_first_order: parseInt(e.target.value) || 0})}
              style={inputStyle}
            />
            <span style={helpStyle}>مكافأة إضافية عند إتمام أول طلب</span>
          </div>

          <div>
            <label style={labelStyle}>النقاط لكل 1 ريال عماني</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number"
                value={settings.points_per_omr}
                onChange={e => setSettings({...settings, points_per_omr: parseInt(e.target.value) || 0})}
                style={{ ...inputStyle, paddingRight: 45 }}
              />
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>OMR</span>
              </div>
            </div>
            <span style={helpStyle}>مثال: إذا كان 10، فإن طلب بـ 100 ريال يمنح 1000 نقطة</span>
          </div>

          <div>
            <label style={labelStyle}>قيمة النقطة الواحدة (بالريال)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                step="0.001"
                value={settings.omr_per_point}
                onChange={e => setSettings({...settings, omr_per_point: parseFloat(e.target.value) || 0})}
                style={{ ...inputStyle, paddingRight: 45 }}
              />
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14 }}>
                 <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>OMR</span>
              </div>
            </div>
            <span style={helpStyle}>مثال: إذا كان 0.01، فإن 1000 نقطة تساوي 10 ريالات</span>
          </div>

          <div style={{ gridColumn: '1 / -1', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #F3F4F6' }}>
            <input 
              type="checkbox" 
              id="isActive"
              checked={settings.is_active}
              onChange={e => setSettings({...settings, is_active: e.target.checked})}
              style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="isActive" style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', cursor: 'pointer' }}>
              تفعيل نظام الولاء للعملاء
            </label>
          </div>

        </form>
      </div>

      <LoyaltyTiers />
    </div>
  )
}
