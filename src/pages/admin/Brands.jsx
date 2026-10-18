import { useState, useEffect, useRef } from 'react'
import { RiAddLine, RiSearchLine, RiPencilLine, RiDeleteBinLine, RiCloseLine, RiImageAddLine, RiUpload2Line } from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import toast from 'react-hot-toast'

export default function Brands() {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBrand, setEditingBrand] = useState(null)
  const [search, setSearch] = useState('')
  const [activeLang, setActiveLang] = useState('ar')
  const [logoPreview, setLogoPreview] = useState('')
  const [bannerPreview, setBannerPreview] = useState('')
  const fileRef = useRef(null)
  const bannerRef = useRef(null)

  const [formData, setFormData] = useState({ name_ar: '', name_en: '', logo: '', banner: '' })

  const fetchBrands = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/brands')
      setBrands(res.data.data || res.data || [])
    } catch (err) {
      toast.error('خطأ في تحميل الماركات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBrands() }, [])

  const openAdd = () => {
    setEditingBrand(null)
    setFormData({ name_ar: '', name_en: '', logo: '', banner: '' })
    setLogoPreview('')
    setBannerPreview('')
    setActiveLang('ar')
    setShowModal(true)
  }

  const openEdit = (brand) => {
    setEditingBrand(brand)
    setFormData({ name_ar: brand.name_ar || '', name_en: brand.name_en || '', logo: brand.logo || '', banner: brand.banner || '' })
    setLogoPreview(brand.logo || '')
    setBannerPreview(brand.banner || '')
    setActiveLang('ar')
    setShowModal(true)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result
      setLogoPreview(base64)
      setFormData(f => ({ ...f, logo: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleBannerChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result
      setBannerPreview(base64)
      setFormData(f => ({ ...f, banner: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const promise = editingBrand
        ? api.put(`/admin/brands/${editingBrand.id}`, formData)
        : api.post('/admin/brands', formData)
      await toast.promise(promise, {
        loading: 'جاري الحفظ...',
        success: editingBrand ? 'تم التعديل بنجاح!' : 'تمت الإضافة بنجاح!',
        error: 'حدث خطأ في الحفظ'
      })
      setShowModal(false)
      fetchBrands()
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذه الماركة؟')) return
    try {
      await api.delete(`/admin/brands/${id}`)
      toast.success('تم الحذف')
      fetchBrands()
    } catch { toast.error('خطأ في الحذف') }
  }

  const filtered = brands.filter(b =>
    (b.name_ar || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.name_en || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>الماركات</h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 4 }}>{brands.length} ماركة مضافة في المتجر</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(74,13,23,0.25)' }}>
          <RiAddLine size={18} /> إضافة ماركة
        </button>
      </div>

      {/* Search */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #F3F4F6' }}>
        <RiSearchLine size={20} color="#9CA3AF" />
        <input
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', background: 'transparent' }}
          placeholder="ابحث عن ماركة بالعربي أو الإنجليزي..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Brands Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9CA3AF', fontSize: 16 }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
          <p style={{ color: '#9CA3AF', fontSize: 16 }}>لا توجد ماركات. أضف ماركة جديدة!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
          {filtered.map(brand => (
            <div key={brand.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6', transition: 'all 0.2s', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'}
            >
              {/* Logo Area */}
              <div style={{ height: 130, background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #F3F4F6', position: 'relative' }}>
                {brand.logo ? (
                  <img src={getImageUrl(brand.logo)} alt={brand.name_ar} style={{ maxWidth: '75%', maxHeight: '75%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{(brand.name_ar || 'B').charAt(0)}</span>
                  </div>
                )}
                {/* Actions on hover */}
                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, opacity: 0, transition: '0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                >
                  <button onClick={() => openEdit(brand)} style={{ width: 30, height: 30, borderRadius: 8, background: '#fff', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
                    <RiPencilLine size={14} color="#666" />
                  </button>
                  <button onClick={() => handleDelete(brand.id)} style={{ width: 30, height: 30, borderRadius: 8, background: '#fff', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
                    <RiDeleteBinLine size={14} color="#EF4444" />
                  </button>
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: '14px 16px', textAlign: 'right' }}>
                <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>{brand.name_ar || '-'}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{brand.name_en || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 800, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {editingBrand ? 'تعديل الماركة' : 'إضافة ماركة جديدة'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <RiCloseLine size={20} color="#666" />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: Text Fields with Language Tabs */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #F3F4F6' }}>
                {/* Language Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', padding: '0 28px' }}>
                  {[{ key: 'ar', label: 'العربية', flag: '🇸🇦' }, { key: 'en', label: 'English', flag: '🇬🇧' }].map(lang => (
                    <button key={lang.key} type="button" onClick={() => setActiveLang(lang.key)}
                      style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: activeLang === lang.key ? '2px solid var(--color-gold)' : '2px solid transparent', color: activeLang === lang.key ? 'var(--color-gold)' : '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{lang.flag}</span> {lang.label}
                    </button>
                  ))}
                </div>

                {/* Fields */}
                <div style={{ padding: 28, flex: 1 }}>
                  {activeLang === 'ar' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>اسم الماركة بالعربية *</label>
                      <input required value={formData.name_ar} onChange={e => setFormData(f => ({...f, name_ar: e.target.value}))}
                        style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', background: '#FAFAFA', transition: 'border 0.2s' }}
                        placeholder="مثال: أبل، كارتييه، غوتشي..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Brand Name in English *</label>
                      <input required value={formData.name_en} onChange={e => setFormData(f => ({...f, name_en: e.target.value}))}
                        style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', background: '#FAFAFA', direction: 'ltr', transition: 'border 0.2s' }}
                        placeholder="Ex: Apple, Cartier, Gucci..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Media Upload */}
              <div style={{ width: 300, padding: 24, background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>شعار الماركة</p>
                
                {/* Upload Box */}
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed #D1D5DB', borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: '#fff', transition: 'all 0.2s', minHeight: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.background = '#FBF5EE' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#fff' }}
                >
                  {logoPreview ? (
                    <img src={getImageUrl(logoPreview)} alt="preview" style={{ maxWidth: '80%', maxHeight: 100, objectFit: 'contain' }} />
                  ) : (
                    <>
                      <RiUpload2Line size={32} color="#D1D5DB" style={{ marginBottom: 10 }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', margin: 0 }}>ارفع الشعار هنا</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>PNG, JPG, SVG</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

                {/* Banner Upload */}
                <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '8px 0 0' }}>البانر (الغلاف)</p>
                <div
                  onClick={() => bannerRef.current?.click()}
                  style={{ border: '2px dashed #D1D5DB', borderRadius: 12, padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#fff', transition: 'all 0.2s', minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.background = '#FBF5EE' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#fff' }}
                >
                  {bannerPreview ? (
                    <img src={getImageUrl(bannerPreview)} alt="banner" style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    <>
                      <RiImageAddLine size={28} color="#D1D5DB" style={{ marginBottom: 6 }} />
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: 0 }}>ارفع البانر</p>
                    </>
                  )}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerChange} />

                {/* OR URL */}
                <div>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6, textAlign: 'center' }}>أو أدخل رابط الصورة</p>
                  <input
                    value={formData.logo} onChange={e => { setFormData(f => ({...f, logo: e.target.value})); setLogoPreview(e.target.value) }}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', direction: 'ltr' }}
                    placeholder="https://..."
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
                  <button type="submit" style={{ width: '100%', padding: '13px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {editingBrand ? 'حفظ التعديلات' : 'إضافة الماركة'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} style={{ width: '100%', padding: '13px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    إلغاء
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
