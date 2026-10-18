import { useState, useEffect, useRef } from 'react'
import { RiAddLine, RiSearchLine, RiPencilLine, RiDeleteBinLine, RiCloseLine, RiUpload2Line, RiFolderImageLine } from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://127.0.0.1:8000'

// Build full image URL - handles /storage/... paths, full URLs, and base64
const buildImgUrl = (path) => {
  if (!path) return null
  if (path.startsWith('data:')) return path // base64
  if (path.startsWith('http')) return path   // already full URL
  return BASE_URL + path                     // relative like /storage/categories/...
}

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [search, setSearch] = useState('')
  const [activeLang, setActiveLang] = useState('ar')
  const [imgPreview, setImgPreview] = useState(null)
  const [iconPreview, setIconPreview] = useState(null)
  const fileRef = useRef(null)
  const iconRef = useRef(null)

  const [formData, setFormData] = useState({ name_ar: '', name_en: '', slug: '', parent_id: '', image: '', icon: '' })

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/categories')
      setCategories(res.data.data || res.data || [])
    } catch { toast.error('خطأ في تحميل التصنيفات') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchCategories() }, [])

  const openAdd = () => {
    setEditingCat(null)
    setFormData({ name_ar: '', name_en: '', slug: '', parent_id: '', image: '', icon: '' })
    setImgPreview(null)
    setIconPreview(null)
    setActiveLang('ar')
    setShowModal(true)
  }

  const openEdit = (cat) => {
    setEditingCat(cat)
    setFormData({ name_ar: cat.name_ar || '', name_en: cat.name_en || '', slug: cat.slug || '', parent_id: cat.parent_id || '', image: cat.image || '', icon: cat.icon || '' })
    setImgPreview(buildImgUrl(cat.image))
    setIconPreview(buildImgUrl(cat.icon))
    setShowModal(true)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setImgPreview(reader.result)
      setFormData(f => ({ ...f, image: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleIconChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setIconPreview(reader.result)
      setFormData(f => ({ ...f, icon: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const promise = editingCat
        ? api.put(`/admin/categories/${editingCat.id}`, formData)
        : api.post('/admin/categories', formData)
      await toast.promise(promise, {
        loading: 'جاري الحفظ...',
        success: editingCat ? 'تم التعديل!' : 'تمت الإضافة!',
        error: 'خطأ في الحفظ'
      })
      setShowModal(false)
      fetchCategories()
    } catch { }
  }

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا التصنيف؟')) return
    try {
      await api.delete(`/admin/categories/${id}`)
      toast.success('تم الحذف')
      fetchCategories()
    } catch { toast.error('خطأ في الحذف') }
  }

  const filtered = categories.filter(c =>
    (c.name_ar || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.name_en || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>التصنيفات</h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 4 }}>{categories.length} تصنيف في المتجر</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(74,13,23,0.25)' }}>
          <RiAddLine size={18} /> إضافة تصنيف
        </button>
      </div>

      {/* Search */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #F3F4F6' }}>
        <RiSearchLine size={20} color="#9CA3AF" />
        <input style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', background: 'transparent' }} placeholder="ابحث عن تصنيف..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Categories Table */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9CA3AF' }}>جاري التحميل...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                {['الصورة', 'الاسم (عربي)', 'الاسم (إنجليزي)', 'الرابط', 'الحالة', 'الإجراءات'].map(h => (
                  <th key={h} style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#9CA3AF', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 15 }}>لا توجد تصنيفات. أضف تصنيفاً جديداً!</td></tr>
              ) : filtered.map(cat => (
                <tr key={cat.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F3F4F6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="البانر">
                        {cat.image ? <img src={buildImgUrl(cat.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <RiFolderImageLine size={20} color="#D1D5DB" />}
                      </div>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#FAFAFA', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB' }} title="الأيقونة">
                        {cat.icon ? <img src={buildImgUrl(cat.icon)} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} /> : <RiFolderImageLine size={16} color="#D1D5DB" />}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{cat.name_ar || '-'}</td>

                  <td style={{ padding: '14px 20px', color: '#6B7280', fontSize: 13, fontFamily: 'sans-serif' }}>{cat.name_en || '-'}</td>
                  <td style={{ padding: '14px 20px' }}><code style={{ fontSize: 12, background: '#F3F4F6', padding: '3px 8px', borderRadius: 6, color: '#6B7280' }}>{cat.slug || '-'}</code></td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>نشط</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(cat)} style={{ width: 34, height: 34, borderRadius: 8, background: '#F3F4F6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <RiPencilLine size={15} color="#6B7280" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} style={{ width: 34, height: 34, borderRadius: 8, background: '#FEF2F2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <RiDeleteBinLine size={15} color="#EF4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 720, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{editingCat ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</h2>
              <button onClick={() => setShowModal(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiCloseLine size={20} color="#666" />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: Fields */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Language Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', padding: '0 28px' }}>
                  {[{ key: 'ar', label: 'العربية', flag: '🇸🇦' }, { key: 'en', label: 'English', flag: '🇬🇧' }].map(lang => (
                    <button key={lang.key} type="button" onClick={() => setActiveLang(lang.key)}
                      style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: activeLang === lang.key ? '2px solid var(--color-gold)' : '2px solid transparent', color: activeLang === lang.key ? 'var(--color-gold)' : '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{lang.flag}</span> {lang.label}
                    </button>
                  ))}
                </div>

                <div style={{ padding: 28, overflow: 'auto' }}>
                  {/* Language-specific name field */}
                  {activeLang === 'ar' ? (
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>اسم التصنيف بالعربية *</label>
                      <input required value={formData.name_ar} onChange={e => setFormData(f => ({...f, name_ar: e.target.value}))}
                        style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
                        placeholder="مثال: إلكترونيات، ساعات، عطور..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  ) : (
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>Category Name (English) *</label>
                      <input required value={formData.name_en} onChange={e => setFormData(f => ({...f, name_en: e.target.value}))}
                        style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', direction: 'ltr' }}
                        placeholder="Ex: Electronics, Watches, Perfumes..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  )}

                  {/* Slug */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>الرابط (Slug) *</label>
                    <input required value={formData.slug} onChange={e => setFormData(f => ({...f, slug: e.target.value}))}
                      style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'sans-serif', outline: 'none', direction: 'ltr' }}
                      placeholder="electronics, watches, perfumes..."
                      onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>

                  {/* Parent Category */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>تصنيف أب (اختياري)</label>
                    <select value={formData.parent_id} onChange={e => setFormData(f => ({...f, parent_id: e.target.value}))}
                      style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                      <option value="">لا يوجد (تصنيف رئيسي)</option>
                      {categories.filter(c => !editingCat || c.id !== editingCat.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name_ar}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right: Image & Icon Upload */}
              <div style={{ width: 300, padding: 24, background: '#FAFAFA', borderRight: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                {/* Image Banner */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>صورة البانر (كاملة)</p>
                  <div onClick={() => fileRef.current?.click()}
                    style={{ border: '2px dashed #D1D5DB', borderRadius: 12, minHeight: 120, cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'all 0.2s', marginBottom: 10 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.background = '#FBF5EE' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#fff' }}
                  >
                    {imgPreview ? (
                      <img src={imgPreview} alt="preview" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                    ) : (
                      <>
                        <RiUpload2Line size={24} color="#D1D5DB" style={{ marginBottom: 5 }} />
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: 0 }}>اضغط لرفع بانر</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  <input value={formData.image} onChange={e => { setFormData(f => ({...f, image: e.target.value})); setImgPreview(e.target.value) }}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', direction: 'ltr' }}
                    placeholder="أو رابط بانر..." />
                </div>

                <hr style={{ borderTop: '1px solid #E5E7EB', margin: '10px 0' }} />

                {/* Icon PNG */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>أيقونة التصنيف (PNG شفاف)</p>
                  <div onClick={() => iconRef.current?.click()}
                    style={{ border: '2px dashed #D1D5DB', borderRadius: 12, minHeight: 100, cursor: 'pointer', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'all 0.2s', marginBottom: 10 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.background = '#FBF5EE' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#fff' }}
                  >
                    {iconPreview ? (
                      <img src={getImageUrl(iconPreview)} alt="icon preview" style={{ width: 50, height: 50, objectFit: 'contain' }} />
                    ) : (
                      <>
                        <RiUpload2Line size={24} color="#D1D5DB" style={{ marginBottom: 5 }} />
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: 0 }}>اضغط لرفع أيقونة</p>
                      </>
                    )}
                  </div>
                  <input ref={iconRef} type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: 'none' }} onChange={handleIconChange} />
                  <input value={formData.icon} onChange={e => { setFormData(f => ({...f, icon: e.target.value})); setIconPreview(e.target.value) }}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', direction: 'ltr' }}
                    placeholder="أو رابط أيقونة..." />
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
                  <button type="submit" style={{ padding: '13px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>

                    {editingCat ? 'حفظ التعديلات' : 'إضافة التصنيف'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: '13px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
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
