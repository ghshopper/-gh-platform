import React, { useState, useEffect } from 'react'
import { RiSendPlaneFill, RiUserSearchLine, RiNotificationBadgeLine, RiSmartphoneLine } from 'react-icons/ri'
import { toast } from 'react-hot-toast'
import api from '../../services/api'
import { useTranslation } from 'react-i18next'

const NotifyUsers = () => {
  const { t, i18n } = useTranslation()
  const isAr = true; // Force Arabic as requested by user
  
  const [formData, setFormData] = useState({
    title_ar: '',
    title_en: '',
    body_ar: '',
    body_en: '',
    audience: 'all',
    user_id: ''
  })
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [broadcasts, setBroadcasts] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false)

  useEffect(() => {
    loadBroadcasts()
  }, [])

  const loadBroadcasts = async () => {
    setLoadingBroadcasts(true)
    try {
      const res = await api.get('/admin/notifications/sent')
      setBroadcasts(res.data?.data || [])
    } catch (err) {
      console.error('Failed to load broadcasts', err)
    } finally {
      setLoadingBroadcasts(false)
    }
  }

  useEffect(() => {
    if (formData.audience === 'specific' && users.length === 0) {
      loadUsers()
    }
  }, [formData.audience])

  const loadUsers = async () => {
    try {
      const response = await api.get('/admin/users')
      setUsers(response.data?.data || [])
    } catch (err) {
      console.error('Failed to load users', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.audience === 'specific' && !formData.user_id) {
      toast.error(isAr ? 'يرجى اختيار العميل' : 'Please select a customer')
      return
    }

    setLoading(true)
    try {
      await api.post('/admin/notifications/broadcast', formData)
      toast.success(isAr ? 'تم إرسال الإشعارات بنجاح' : 'Notifications sent successfully')
      setFormData({
        title_ar: '',
        title_en: '',
        body_ar: '',
        body_en: '',
        audience: 'all',
        user_id: ''
      })
      loadBroadcasts()
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ أثناء الإرسال' : 'Error sending notification'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف الإشعارات المحددة؟' : 'Are you sure you want to delete selected notifications?')) return

    try {
      await api.post('/admin/notifications/delete-multiple', { ids: selectedIds })
      toast.success(isAr ? 'تم الحذف بنجاح' : 'Deleted successfully')
      setSelectedIds([])
      loadBroadcasts()
    } catch (err) {
      toast.error(isAr ? 'حدث خطأ أثناء الحذف' : 'Error deleting notifications')
    }
  }

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(broadcasts.map(b => b.id))
    } else {
      setSelectedIds([])
    }
  }

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  return (
    <div className="page-container" style={{ padding: '30px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--color-gold), var(--color-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(181, 145, 95, 0.2)' }}>
          <RiNotificationBadgeLine size={28} color="#FFF" />
        </div>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            {isAr ? 'إرسال إشعارات (Push Notifications)' : 'Send Push Notifications'}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '15px' }}>
            {isAr ? 'تواصل مع عملائك مباشرة عبر إشعارات الموبايل بطريقة احترافية' : 'Engage with your customers directly via mobile push notifications'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* Form Section */}
        <div className="card" style={{ padding: '32px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', border: '1px solid rgba(181,145,95,0.1)', flex: '2' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ background: 'var(--bg-body)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RiUserSearchLine size={20} color="var(--color-gold)" />
                {isAr ? 'الاستهداف (Audience)' : 'Target Audience'}
              </h3>
              
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', border: formData.audience === 'all' ? '2px solid var(--color-gold)' : '2px solid transparent', background: '#FFF', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <input type="radio" name="audience" value="all" checked={formData.audience === 'all'} onChange={() => setFormData({...formData, audience: 'all'})} style={{ accentColor: 'var(--color-gold)', width: '18px', height: '18px' }} />
                  <span style={{ fontWeight: '600', color: formData.audience === 'all' ? 'var(--color-gold)' : 'var(--text-primary)' }}>{isAr ? 'جميع العملاء (الكل)' : 'All Customers'}</span>
                </label>
                
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', border: formData.audience === 'specific' ? '2px solid var(--color-gold)' : '2px solid transparent', background: '#FFF', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <input type="radio" name="audience" value="specific" checked={formData.audience === 'specific'} onChange={() => setFormData({...formData, audience: 'specific'})} style={{ accentColor: 'var(--color-gold)', width: '18px', height: '18px' }} />
                  <span style={{ fontWeight: '600', color: formData.audience === 'specific' ? 'var(--color-gold)' : 'var(--text-primary)' }}>{isAr ? 'عميل محدد (شخص واحد)' : 'Specific Customer'}</span>
                </label>
              </div>

              {formData.audience === 'specific' && (
                <div style={{ marginTop: '16px', position: 'relative' }}>
                  <RiUserSearchLine style={{ position: 'absolute', right: isAr ? '16px' : 'auto', left: isAr ? 'auto' : '16px', top: '16px', color: 'var(--color-gold)' }} size={22} />
                  <select 
                    style={{ width: '100%', padding: '14px 48px', borderRadius: '12px', border: '1px solid var(--border)', background: '#FFF', fontSize: '15px', color: 'var(--text-primary)', outline: 'none', transition: 'border 0.2s' }}
                    value={formData.user_id}
                    onChange={e => setFormData({...formData, user_id: e.target.value})}
                    required
                  >
                    <option value="">{isAr ? '-- ابحث واختر العميل --' : '-- Search and Select Customer --'}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email || u.phone})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{isAr ? 'عنوان الإشعار (عربي) *' : 'Notification Title (Arabic) *'}</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontSize: '15px', transition: 'all 0.3s', outline: 'none' }}
                  placeholder={isAr ? 'مثال: عرض خاص لك!' : 'e.g. Special Offer!'}
                  value={formData.title_ar}
                  onChange={e => setFormData({...formData, title_ar: e.target.value})}
                  onFocus={e => e.target.style.border = '1px solid var(--color-gold)'}
                  onBlur={e => e.target.style.border = '1px solid var(--border)'}
                  required
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{isAr ? 'عنوان الإشعار (إنجليزي) *' : 'Notification Title (English) *'}</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontSize: '15px', transition: 'all 0.3s', outline: 'none' }}
                  placeholder={isAr ? 'مثال: Special Offer for you!' : 'e.g. Special Offer for you!'}
                  value={formData.title_en}
                  onChange={e => setFormData({...formData, title_en: e.target.value})}
                  onFocus={e => e.target.style.border = '1px solid var(--color-gold)'}
                  onBlur={e => e.target.style.border = '1px solid var(--border)'}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{isAr ? 'تفاصيل الإشعار (عربي) *' : 'Notification Body (Arabic) *'}</label>
                <textarea 
                  rows="4"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontSize: '15px', resize: 'vertical', transition: 'all 0.3s', outline: 'none' }}
                  placeholder={isAr ? 'اكتب الرسالة التي ستصل للعميل هنا...' : 'Type the message here...'}
                  value={formData.body_ar}
                  onChange={e => setFormData({...formData, body_ar: e.target.value})}
                  onFocus={e => e.target.style.border = '1px solid var(--color-gold)'}
                  onBlur={e => e.target.style.border = '1px solid var(--border)'}
                  required
                ></textarea>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{isAr ? 'تفاصيل الإشعار (إنجليزي) *' : 'Notification Body (English) *'}</label>
                <textarea 
                  rows="4"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontSize: '15px', resize: 'vertical', transition: 'all 0.3s', outline: 'none' }}
                  placeholder={isAr ? 'Type the message that the user will receive...' : 'Type the message that the user will receive...'}
                  value={formData.body_en}
                  onChange={e => setFormData({...formData, body_en: e.target.value})}
                  onFocus={e => e.target.style.border = '1px solid var(--color-gold)'}
                  onBlur={e => e.target.style.border = '1px solid var(--border)'}
                  required
                ></textarea>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              style={{ 
                marginTop: '10px',
                padding: '16px', 
                borderRadius: '12px', 
                background: loading ? '#ccc' : 'linear-gradient(90deg, var(--color-primary), var(--color-primary-med))', 
                color: '#FFF', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                border: 'none', 
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '12px',
                boxShadow: loading ? 'none' : '0 8px 20px rgba(74, 13, 23, 0.25)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={e => { if(!loading) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { if(!loading) e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <RiSendPlaneFill size={22} />
              {loading ? (isAr ? 'جاري إرسال الإشعارات...' : 'Sending...') : (isAr ? 'إرسال الإشعار الآن' : 'Send Notification Now')}
            </button>
          </form>
        </div>

        {/* Live Preview Section */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          <div style={{ position: 'sticky', top: '100px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiSmartphoneLine size={24} color="var(--color-gold)" />
              {isAr ? 'معاينة حية (Live Preview)' : 'Live Preview'}
            </h3>
            
            <div style={{ background: '#FFF', borderRadius: '32px', border: '8px solid #333', padding: '16px', height: '450px', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {/* Phone Notch */}
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '24px', background: '#333', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}></div>
              
              {/* Wallpaper */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #F3F4F6, #E5E7EB)', zIndex: 0 }}></div>
              
              {/* Notification Bubble */}
              <div style={{ position: 'relative', zIndex: 1, marginTop: '60px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--color-gold)', fontSize: '12px', fontWeight: 'bold' }}>GH</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>GH Shopper • {isAr ? 'الآن' : 'now'}</span>
                </div>
                
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>
                  {isAr 
                    ? (formData.title_ar || 'عنوان الإشعار سيظهر هنا') 
                    : (formData.title_en || 'Notification title will appear here')}
                </h4>
                
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {isAr 
                    ? (formData.body_ar || 'محتوى الرسالة التي ستصل للعميل ستظهر في هذا المكان بشكل أنيق...') 
                    : (formData.body_en || 'The notification body will appear here gracefully...')}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Sent Notifications History */}
      <div className="card" style={{ marginTop: '40px', padding: '32px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', border: '1px solid rgba(181,145,95,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>
            {isAr ? 'سجل الإشعارات المرسلة' : 'Sent Notifications History'}
          </h2>
          {selectedIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              style={{ background: '#dc3545', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isAr ? `حذف المحدد (${selectedIds.length})` : `Delete Selected (${selectedIds.length})`}
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '16px', width: '50px' }}>
                  <input type="checkbox" checked={broadcasts.length > 0 && selectedIds.length === broadcasts.length} onChange={toggleSelectAll} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                </th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>{isAr ? 'العنوان' : 'Title'}</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>{isAr ? 'الرسالة' : 'Message'}</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>{isAr ? 'المستهدف' : 'Target'}</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>{isAr ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {loadingBroadcasts ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>{isAr ? 'جاري التحميل...' : 'Loading...'}</td></tr>
              ) : broadcasts.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>{isAr ? 'لا توجد إشعارات مرسلة' : 'No sent notifications'}</td></tr>
              ) : (
                broadcasts.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px' }}>
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                    </td>
                    <td style={{ padding: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{isAr ? item.title_ar : item.title_en}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{isAr ? item.body_ar : item.body_en}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      {item.user_id ? (item.user?.name || (isAr ? 'عميل محدد' : 'Specific')) : (isAr ? 'الكل' : 'All')}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '14px', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                      {new Date(item.created_at).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default NotifyUsers
