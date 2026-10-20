import React, { useState, useEffect } from 'react'
import { RiSendPlaneFill, RiUserSearchLine, RiNotificationBadgeLine, RiSmartphoneLine, RiImageAddLine, RiLinkM, RiCloseLine } from 'react-icons/ri'
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
    segment: 'tier:Black',
    user_id: '',
    link_type: 'none',
    link_value: ''
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [devices, setDevices] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [pickedUser, setPickedUser] = useState(null)
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState([])
  const [pickedProduct, setPickedProduct] = useState(null)
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
      setDevices(res.data?.devices || null)
    } catch (err) {
      console.error('Failed to load broadcasts', err)
    } finally {
      setLoadingBroadcasts(false)
    }
  }

  // Customers (not staff), searched by name, phone or e-mail.
  useEffect(() => {
    if (formData.audience !== 'specific') return
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/admin/customers', { params: { search: userSearch, per_page: 20 } })
        setUsers(r.data?.data || [])
      } catch { setUsers([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [formData.audience, userSearch])

  // What the tap opens: lists for the pickers.
  useEffect(() => {
    if (formData.link_type === 'brand' && !brands.length) api.get('/admin/brands').then((r) => setBrands(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => {})
    if (formData.link_type === 'category' && !categories.length) api.get('/admin/categories').then((r) => setCategories(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => {})
  }, [formData.link_type])
  useEffect(() => {
    if (formData.link_type !== 'product' || productSearch.trim().length < 2) { setProducts([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/admin/products', { params: { search: productSearch, per_page: 10 } })
        setProducts(r.data?.data || [])
      } catch { setProducts([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [formData.link_type, productSearch])

  const pickImage = (file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('الصورة أكبر من 5 ميغا'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }
  const clearImage = () => { setImageFile(null); setImagePreview('') }

  // a group of customers: tier, brand fans, quiet customers, never ordered, bag waiting
  const [tiers, setTiers] = useState([])
  const [segCount, setSegCount] = useState(null)
  useEffect(() => {
    api.get('/admin/brands').then((r) => setBrands(Array.isArray(r.data) ? r.data : r.data.data || [])).catch(() => {})
    api.get('/admin/loyalty-tiers').then((r) => setTiers((r.data.data || r.data || []).slice().sort((a, b) => a.min_points - b.min_points))).catch(() => {})
  }, [])
  useEffect(() => {
    if (formData.audience !== 'segment' || !formData.segment) return
    setSegCount(null)
    api.get('/admin/notifications/audience', { params: { segment: formData.segment } }).then((r) => setSegCount(r.data)).catch(() => {})
  }, [formData.audience, formData.segment])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.audience === 'segment' && segCount && !segCount.customers) {
      toast.error('ما فيه عملاء في هذي الفئة')
      return
    }
    if (formData.audience === 'specific' && !formData.user_id) {
      toast.error(isAr ? 'يرجى اختيار العميل' : 'Please select a customer')
      return
    }

    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(formData).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) fd.append(k, v) })
      if (imageFile) fd.append('image', imageFile)
      await api.post('/admin/notifications/broadcast', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(isAr ? 'تم إرسال الإشعارات بنجاح' : 'Notifications sent successfully')
      setFormData({
        title_ar: '',
        title_en: '',
        body_ar: '',
        body_en: '',
        audience: 'all',
        segment: 'tier:Black',
        user_id: '',
        link_type: 'none',
        link_value: ''
      })
      clearImage()
      setPickedProduct(null)
      setPickedUser(null)
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
          {devices ? <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>الأجهزة المسجلة: <b>{devices.total}</b> ({devices.customers} عميل مسجّل · {devices.guests} زائر). كل إشعار يوصل للعميل بلغة تطبيقه.</p> : null}
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

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', marginTop: 12, borderRadius: '12px', border: formData.audience === 'segment' ? '2px solid var(--color-gold)' : '2px solid transparent', background: '#FFF', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <input type="radio" name="audience" value="segment" checked={formData.audience === 'segment'} onChange={() => setFormData({ ...formData, audience: 'segment' })} style={{ accentColor: 'var(--color-gold)', width: '18px', height: '18px' }} />
                <span style={{ fontWeight: '600', color: formData.audience === 'segment' ? 'var(--color-gold)' : 'var(--text-primary)' }}>فئة من العملاء</span>
              </label>
              {formData.audience === 'segment' && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select className="input" value={formData.segment} onChange={(e) => setFormData({ ...formData, segment: e.target.value })} style={{ height: 44 }}>
                    <optgroup label="مستوى الولاء">
                      {tiers.map((t) => <option key={t.name} value={`tier:${t.name}`}>مستوى {t.name_ar || t.name}</option>)}
                    </optgroup>
                    <optgroup label="يحبون براند (اشتروا منه أو في مفضلتهم)">
                      {[...brands].sort((a, b) => (a.name_en || '').localeCompare(b.name_en || '')).map((b) => <option key={b.id} value={`brand:${b.id}`}>{b.name_en || b.name_ar}</option>)}
                    </optgroup>
                    <optgroup label="حسب الطلبات">
                      <option value="inactive:60">ما طلبوا من 60 يوم</option>
                      <option value="inactive:120">ما طلبوا من 4 شهور</option>
                      <option value="never">سجّلوا وما طلبوا أبداً</option>
                      <option value="cart">عندهم سلة ما كمّلوها</option>
                    </optgroup>
                  </select>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {segCount ? <>بيوصل لـ <b style={{ color: 'var(--ink)' }}>{segCount.customers}</b> عميل في التطبيق، منهم <b style={{ color: 'var(--ink)' }}>{segCount.with_phone}</b> تطلع لهم على الجوال</> : 'نحسب العدد…'}
                  </div>
                </div>
              )}

              {formData.audience === 'specific' && (
                <div style={{ marginTop: '16px', position: 'relative' }}>
                  <RiUserSearchLine style={{ position: 'absolute', right: isAr ? '16px' : 'auto', left: isAr ? 'auto' : '16px', top: '16px', color: 'var(--color-gold)' }} size={22} />
                  <input
                    style={{ width: '100%', padding: '14px 48px', borderRadius: '12px', border: '1px solid var(--border)', background: '#FFF', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                    placeholder="ابحث بالاسم أو الرقم أو الإيميل"
                    value={pickedUser ? `${pickedUser.name} (${pickedUser.phone || pickedUser.email || ''})` : userSearch}
                    onChange={e => { setPickedUser(null); setFormData({ ...formData, user_id: '' }); setUserSearch(e.target.value) }}
                  />
                  {!pickedUser && users.length > 0 && (
                    <div style={{ marginTop: 6, background: '#FFF', border: '1px solid var(--border)', borderRadius: 12, maxHeight: 240, overflowY: 'auto' }}>
                      {users.map(u => (
                        <div key={u.id} onClick={() => { setPickedUser(u); setFormData({ ...formData, user_id: u.id }) }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', fontSize: 14 }}>
                          <b>{u.name}</b> <span style={{ color: '#9CA3AF' }} dir="ltr">{u.phone || u.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{isAr ? 'عنوان الإشعار (إنجليزي، اختياري)' : 'Notification Title (English)'}</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontSize: '15px', transition: 'all 0.3s', outline: 'none' }}
                  placeholder={isAr ? 'مثال: Special Offer for you!' : 'e.g. Special Offer for you!'}
                  value={formData.title_en}
                  onChange={e => setFormData({...formData, title_en: e.target.value})}
                  onFocus={e => e.target.style.border = '1px solid var(--color-gold)'}
                  onBlur={e => e.target.style.border = '1px solid var(--border)'}
                  
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{isAr ? 'تفاصيل الإشعار (إنجليزي، اختياري)' : 'Notification Body (English)'}</label>
                <textarea 
                  rows="4"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontSize: '15px', resize: 'vertical', transition: 'all 0.3s', outline: 'none' }}
                  placeholder={isAr ? 'Type the message that the user will receive...' : 'Type the message that the user will receive...'}
                  value={formData.body_en}
                  onChange={e => setFormData({...formData, body_en: e.target.value})}
                  onFocus={e => e.target.style.border = '1px solid var(--color-gold)'}
                  onBlur={e => e.target.style.border = '1px solid var(--border)'}
                  
                ></textarea>
              </div>
            </div>

            <div style={{ background: 'var(--bg-body)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600 }}><RiImageAddLine color="var(--color-gold)" /> صورة الإشعار (اختياري)</label>
                {imagePreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={imagePreview} alt="" style={{ width: 240, aspectRatio: '2 / 1', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                    <button type="button" onClick={clearImage} style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}><RiCloseLine /></button>
                  </div>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 16px', border: '1px dashed var(--border)', borderRadius: 12, cursor: 'pointer', background: '#FFF', fontSize: 14 }}>
                    <RiImageAddLine /> اختر صورة (عرضية 2:1 أفضل)
                    <input type="file" accept="image/*" hidden onChange={e => pickImage(e.target.files?.[0])} />
                  </label>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>تظهر تحت النص في أندرويد وفي صفحة الإشعارات داخل التطبيق.</div>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600 }}><RiLinkM color="var(--color-gold)" /> لما يضغط العميل على الإشعار يفتح</label>
                <select value={formData.link_type} onChange={e => { setFormData({ ...formData, link_type: e.target.value, link_value: '' }); setPickedProduct(null); setProductSearch('') }}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: '#FFF', fontSize: 14 }}>
                  <option value="none">صفحة الإشعارات</option>
                  <option value="product">منتج</option>
                  <option value="brand">براند</option>
                  <option value="category">تصنيف</option>
                  <option value="url">رابط</option>
                </select>
                {formData.link_type === 'brand' && (
                  <select value={formData.link_value} onChange={e => setFormData({ ...formData, link_value: e.target.value })} required style={{ width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: '#FFF', fontSize: 14 }}>
                    <option value="">— اختر البراند —</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name_en || b.name_ar}</option>)}
                  </select>
                )}
                {formData.link_type === 'category' && (
                  <select value={formData.link_value} onChange={e => setFormData({ ...formData, link_value: e.target.value })} required style={{ width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: '#FFF', fontSize: 14 }}>
                    <option value="">— اختر التصنيف —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar || c.name_en}</option>)}
                  </select>
                )}
                {formData.link_type === 'product' && (
                  <div style={{ marginTop: 8 }}>
                    <input placeholder="ابحث باسم المنتج أو الكود" value={pickedProduct ? (pickedProduct.name_ar || pickedProduct.name_en || pickedProduct.name) : productSearch}
                      onChange={e => { setPickedProduct(null); setFormData({ ...formData, link_value: '' }); setProductSearch(e.target.value) }}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: '#FFF', fontSize: 14, boxSizing: 'border-box' }} />
                    {!pickedProduct && products.length > 0 && (
                      <div style={{ marginTop: 6, background: '#FFF', border: '1px solid var(--border)', borderRadius: 12, maxHeight: 220, overflowY: 'auto' }}>
                        {products.map(p => (
                          <div key={p.id} onClick={() => { setPickedProduct(p); setFormData({ ...formData, link_value: String(p.id) }) }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', fontSize: 14 }}>
                            {p.name_ar || p.name_en || p.name} <span style={{ color: '#9CA3AF' }}>#{p.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {formData.link_type === 'url' && (
                  <input dir="ltr" type="url" required placeholder="https://" value={formData.link_value} onChange={e => setFormData({ ...formData, link_value: e.target.value })}
                    style={{ width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: '#FFF', fontSize: 14, boxSizing: 'border-box' }} />
                )}
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
                
                {imagePreview ? <img src={imagePreview} alt="" style={{ float: 'left', width: 44, height: 44, objectFit: 'cover', borderRadius: 8, marginInlineStart: 8 }} /> : null}
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
