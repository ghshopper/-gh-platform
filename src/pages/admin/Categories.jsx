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

  // Tree order: section, its categories, their sub-categories.
  const ordered = (() => {
    const kids = (pid) => categories.filter(c => (c.parent_id || null) === pid)
    const out = []
    const walk = (pid, depth) => kids(pid).forEach(c => { out.push({ ...c, depth }); if (depth < 3) walk(c.id, depth + 1) })
    walk(null, 0)
    categories.forEach(c => { if (!out.find(o => o.id === c.id)) out.push({ ...c, depth: 0 }) })
    return out
  })()
  const filtered = ordered.filter(c =>
    (c.name_ar || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.name_en || '').toLowerCase().includes(search.toLowerCase())
  )
  const [adding, setAdding] = useState(null)
  const [sorting, setSorting] = useState(false)
  // Re-sort every product: first a list of the moves, then only the ticked ones are applied.
  const [plan, setPlan] = useState(null)
  const [tick, setTick] = useState({})
  const autoSort = async () => {
    setSorting(true)
    try {
      const r = await api.post('/admin/categories/auto-sort', { preview: true, all: true })
      const moves = r.data?.moves || []
      if (!moves.length) { toast.success('كل المنتجات في تصنيفها الصحيح'); return }
      setPlan(moves)
      setTick(Object.fromEntries(moves.map((m) => [m.id, true])))
    } catch { toast.error('تعذّر الفحص') } finally { setSorting(false) }
  }
  const applyPlan = async () => {
    const ids = Object.keys(tick).filter((k) => tick[k]).map(Number)
    if (!ids.length) return setPlan(null)
    setSorting(true)
    try {
      const r = await api.post('/admin/categories/auto-sort', { all: true, ids })
      toast.success(`انتقل ${r.data?.moved ?? 0} منتج لتصنيفه الصحيح`)
      setPlan(null)
      fetchCategories()
    } catch { toast.error('تعذّر الترتيب') } finally { setSorting(false) }
  }
  const planGroups = plan ? Object.entries(plan.reduce((g, m) => { (g[m.to_name] = g[m.to_name] || []).push(m); return g }, {})) : []

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>التصنيفات</h1>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 4 }}>{categories.length} تصنيف في المتجر</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={autoSort} disabled={sorting} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sorting ? 'يفحص…' : 'أعد تصنيف كل المنتجات'}
        </button>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(74,13,23,0.25)' }}>
          <RiAddLine size={18} /> إضافة تصنيف
        </button>
        </div>
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
                {['الصورة', 'الاسم (عربي)', 'الاسم (إنجليزي)', 'المنتجات', 'الحالة', 'الإجراءات'].map(h => (
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
                  <td style={{ padding: '14px 20px', paddingInlineStart: 20 + cat.depth * 28, fontWeight: cat.depth ? 600 : 800, color: 'var(--text-primary)', fontSize: cat.depth ? 14 : 15 }}>
                    {cat.depth ? <span style={{ color: '#C9BFB3', marginInlineEnd: 6 }}>└</span> : null}{cat.name_ar || '-'}
                    {cat.smart ? <small style={{ display: 'block', color: '#9CA3AF', fontWeight: 400, fontSize: 11 }}>تتعبّى تلقائياً من {cat.smart === 'men' ? 'الرجالي' : 'النسائي'} + اللي تضيفه</small> : null}
                  </td>

                  <td style={{ padding: '14px 20px', color: '#6B7280', fontSize: 13, fontFamily: 'sans-serif' }}>{cat.name_en || '-'}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, fontFamily: 'sans-serif' }}>{cat.products_count ?? 0}</td>
                  <td style={{ padding: '14px 20px' }}>
                    {Number(cat.is_active) !== 0
                      ? <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>نشط</span>
                      : <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#F3F4F6', color: '#6B7280' }}>مخفي</span>}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setAdding(cat)} title="أضف منتجات لهذا التصنيف" style={{ height: 34, borderRadius: 8, background: 'rgba(176,138,69,0.12)', color: '#8A6A2A', border: 'none', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>
                        <RiAddLine size={15} /> منتجات
                      </button>
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

      {adding && <AddProducts cat={adding} categories={categories} onClose={() => setAdding(null)} onDone={() => { setAdding(null); fetchCategories() }} />}

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
      {plan && (
        <div onClick={() => !sorting && setPlan(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,12,10,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #F3F4F6' }}>
              <h3 style={{ margin: 0 }}>إعادة التصنيف: {plan.length} منتج بينتقل</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>راجع القائمة وشيل الصح عن أي منتج ما تبيه ينتقل. «السبب» يقول من وين عرفنا التصنيف.</p>
            </div>
            <div style={{ overflowY: 'auto', padding: '6px 22px' }}>
              {planGroups.map(([to, list]) => (
                <div key={to} style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    → {to} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({list.length})</span>
                    <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, marginInlineStart: 'auto' }}
                      onClick={() => { const on = !list.every((m) => tick[m.id]); setTick((t) => ({ ...t, ...Object.fromEntries(list.map((m) => [m.id, on])) })) }}>الكل</button>
                  </div>
                  {list.map((m) => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid #F7F7F7', fontSize: 13.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!tick[m.id]} onChange={(e) => setTick((t) => ({ ...t, [m.id]: e.target.checked }))} />
                      <span style={{ flex: 1 }}>{m.name}</span>
                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>من: {m.from_name}</span>
                      <span style={{ color: '#B08A45', fontSize: 11.5, minWidth: 70 }}>{m.why}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" disabled={sorting} onClick={applyPlan} style={{ flex: 1 }}>
                {sorting ? 'ينقل…' : `انقل ${Object.values(tick).filter(Boolean).length} منتج`}
              </button>
              <button className="btn btn-ghost" disabled={sorting} onClick={() => setPlan(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/** Pick products (search by name or brand) and move them into a category. */
function AddProducts({ cat, categories, onClose, onDone }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [chosen, setChosen] = useState([])
  const [saving, setSaving] = useState(false)
  const catName = (id) => categories.find(c => c.id === id)?.name_ar || '—'
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const p = new URLSearchParams({ per_page: 80 })
        if (q.trim()) p.set('search', q.trim())
        const r = await api.get(`/admin/products?${p}`)
        setRows(r.data.data || [])
      } catch { setRows([]) } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])
  const toggle = (id) => setChosen(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id])
  const save = async () => {
    setSaving(true)
    try {
      await api.post('/admin/products/bulk-update', { ids: chosen, category_id: cat.id })
      toast.success(`انضاف ${chosen.length} منتج إلى ${cat.name_ar}`)
      onDone()
    } catch { toast.error('تعذّر النقل'); setSaving(false) }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,12,10,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 22px 12px' }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>أضف منتجات إلى «{cat.name_ar}»</h3>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px' }}>
            <RiSearchLine color="#9CA3AF" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم المنتج أو البراند…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, borderTop: '1px solid #F3F4F6' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>يحمّل…</div> : rows.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>ما في منتجات</div> : rows.map(p => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', background: chosen.includes(p.id) ? '#FBF7F0' : '#fff' }}>
              <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} />
              <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F3F4F6', overflow: 'hidden', flexShrink: 0 }}>
                {p.primary_image ? <img src={getImageUrl(p.primary_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name_ar || p.name_en}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{p.brand_name_en || p.brand_name_ar || ''} · الحين في: {p.category_id === cat.id ? <b style={{ color: '#16804A' }}>هذا التصنيف</b> : catName(p.category_id)}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 10, borderTop: '1px solid #F3F4F6' }}>
          <button className="btn btn-primary" disabled={!chosen.length || saving} onClick={save} style={{ flex: 1 }}>{saving ? 'يحفظ…' : `أضف ${chosen.length || ''} للتصنيف`}</button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}
