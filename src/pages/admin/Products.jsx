import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  RiDownloadCloud2Line,
  RiAddLine, RiSearchLine, RiPencilLine, RiDeleteBinLine,
  RiUpload2Line, RiVideoLine, RiSaveLine, RiCloseLine,
  RiImageAddLine, RiArrowLeftLine, RiMagicLine
} from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import toast from 'react-hot-toast'
import AiImportModal from './AiImportModal'
import GHPagination from '../../components/GHPagination'

export default function Products() {
  const [view, setView] = useState('list')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [globalAttributes, setGlobalAttributes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const [activeLang, setActiveLang] = useState('ar')
  const fileRef = useRef(null)

  const [editingProduct, setEditingProduct] = useState(null)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [priceGroups, setPriceGroups] = useState([])
  const [priceModal, setPriceModal] = useState(false)
  const [priceMode, setPriceMode] = useState('set')
  const [priceValue, setPriceValue] = useState('')
  const firstLoad = useRef(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [selected, setSelected] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)

  const bulkSet = async (patch, label) => {
    if (!selected.length) return
    setBulkBusy(true)
    try {
      await api.post('/admin/products/bulk-update', { ids: selected, ...patch })
      const apply = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === 'none' ? null : v]))
      setProducts(list => list.map(p => selected.includes(p.id) ? { ...p, ...apply, ...(patch.category_id ? { category_name: categories.find(c => c.id === patch.category_id)?.name_ar } : {}) } : p))
      toast.success(`${label}: ${selected.length} منتج`)
      setSelected([])
    } catch {
      toast.error('تعذّر التحديث')
    } finally {
      setBulkBusy(false)
    }
  }

  const setAvailability = async (availability) => {
    if (!selected.length) return
    setBulkBusy(true)
    try {
      await api.post('/admin/products/bulk-availability', { ids: selected, availability })
      setProducts(list => list.map(p => selected.includes(p.id) ? { ...p, availability } : p))
      toast.success(`تم تحديث ${selected.length} منتج`)
      setSelected([])
    } catch {
      toast.error('تعذّر التحديث')
    } finally {
      setBulkBusy(false)
    }
  }

  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return }
    const t = setTimeout(() => { setSelected([]); fetchProducts(1) }, 350)
    return () => clearTimeout(t)
  }, [searchQuery, brandFilter, categoryFilter, statusFilter, priceFilter])

  // Select every product that matches the filters (all pages).
  const selectAllResults = async () => {
    try {
      const q = filterParams()
      q.set('ids_only', 1)
      const r = await api.get(`/admin/products?${q}`)
      setSelected(r.data.ids || [])
    } catch {
      toast.error('تعذّر التحديد')
    }
  }

  // Same-price products: show them and select them all.
  const pickPrice = async (price) => {
    setPriceFilter(String(price))
    try {
      const q = filterParams()
      q.set('price', price)
      q.set('ids_only', 1)
      const r = await api.get(`/admin/products?${q}`)
      setTimeout(() => setSelected(r.data.ids || []), 400)
    } catch {}
  }

  const newPrice = (old) => {
    const v = parseFloat(String(priceValue).replace(',', '.'))
    if (Number.isNaN(v)) return null
    if (priceMode === 'set') return v
    if (priceMode === 'add') return old + v
    const x = old * (1 + v / 100)
    return x >= 100 ? Math.round(x) : Math.round(x * 2) / 2
  }

  const applyPrice = async () => {
    const v = parseFloat(String(priceValue).replace(',', '.'))
    if (Number.isNaN(v)) return toast.error('اكتب الرقم')
    setBulkBusy(true)
    try {
      const r = await api.post('/admin/products/bulk-update', { ids: selected, price_mode: priceMode, price_value: v })
      toast.success(`تغيّر سعر ${r.data?.updated ?? selected.length} منتج`)
      setPriceModal(false)
      setPriceValue('')
      setSelected([])
      if (priceFilter !== '') setPriceFilter('')
      else fetchProducts(currentPage)
    } catch {
      toast.error('تعذّر تغيير السعر')
    } finally {
      setBulkBusy(false)
    }
  }

  const emptyForm = {
    name_ar: '', name_en: '',
    category_id: '', brand_id: '',
    price: '', discount_price: '',
    discount_expires_at: '',
    quantity: '',
    description_ar: '', description_en: '',
    primary_image: '', size_guide_image: '', video_url: '',
    gallery_images: [],
    attributes: [],
    is_featured: 0,
    delivery_badge: '',
    availability: 'instant',
    gender: '',
    origin: ''
  }
  const [formData, setFormData] = useState(emptyForm)
  const [imgPreview, setImgPreview] = useState('')
  const [sizeGuidePreview, setSizeGuidePreview] = useState('')

  const [autoImportKey, setAutoImportKey] = useState(null)

  useEffect(() => { 
    fetchData() 
    
    // Check for bookmarklet redirect
    const urlParams = new URLSearchParams(window.location.search)
    const importKey = urlParams.get('import_key')
    if (importKey) {
      setAutoImportKey(importKey)
      setIsAiModalOpen(true)
      // Remove it from URL cleanly
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    // Opened from "Products to add" (a piece that is already in the store).
    const editId = urlParams.get('edit')
    if (editId) {
      window.history.replaceState({}, document.title, window.location.pathname)
      api.get(`/admin/products/${editId}`).then((r) => { if (r.data?.data) openEdit(r.data.data) }).catch(() => {})
    }
  }, [])
  // Filters go to the server, so they search every product (not only this page).
  const filterParams = () => {
    const q = new URLSearchParams()
    if (searchQuery.trim()) q.set('search', searchQuery.trim())
    if (brandFilter) q.set('brand_id', brandFilter)
    if (categoryFilter !== 'all') q.set('category_id', categoryFilter)
    if (statusFilter !== 'all') q.set('status', statusFilter === '1' ? 'active' : 'draft')
    if (priceFilter !== '') q.set('price', priceFilter)
    return q
  }

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true)
      const q = filterParams()
      q.set('page', page)
      q.set('per_page', 50)
      const prodRes = await api.get(`/admin/products?${q}`)
      setProducts(prodRes.data.data || prodRes.data || [])
      setPriceGroups(prodRes.data.price_groups || [])
      setCurrentPage(prodRes.data.current_page || 1)
      setLastPage(prodRes.data.last_page || 1)
      setTotalItems(prodRes.data.total || (prodRes.data.data || prodRes.data || []).length || 0)
    } catch {
      toast.error('خطأ في جلب المنتجات')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const [catRes, brandRes, attrRes] = await Promise.all([
        api.get('/admin/categories'),
        api.get('/admin/brands'),
        api.get('/admin/attributes')
      ])
      await fetchProducts(1)
      setCategories(catRes.data.data || catRes.data || [])
      setBrands(brandRes.data.data || brandRes.data || [])
      setGlobalAttributes(attrRes.data.data || attrRes.data || [])
    } catch {
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1200
          const MAX_HEIGHT = 1200
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e, field) => {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await compressImage(file)
    
    if (field === 'primary_image') {
      setImgPreview(compressed)
    } else if (field === 'size_guide_image') {
      setSizeGuidePreview(compressed)
    }
    setFormData(f => ({ ...f, [field]: compressed }))
  }

  const dataURLtoFile = (dataurl, filename) => {
    if (!dataurl || !dataurl.startsWith('data:')) return dataurl;
    try {
      let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
          bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while(n--){ u8arr[n] = bstr.charCodeAt(n); }
      let ext = mime.split('/')[1] || 'jpg';
      return new File([u8arr], filename + '.' + ext, {type:mime});
    } catch(e) { return dataurl; }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setIsSubmitting(true)
    
    try {
      const payload = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'primary_image' || key === 'size_guide_image') {
          const fileOrStr = dataURLtoFile(formData[key], key);
          if (fileOrStr) payload.append(key, fileOrStr);
        } else if (key === 'gallery_images') {
          if (Array.isArray(formData[key])) {
            formData[key].forEach((img, i) => {
              const f = dataURLtoFile(img, `gallery_${i}`);
              if (f) payload.append(`gallery_images[${i}]`, f);
            });
          }
        } else if (key === 'attributes') {
          payload.append('attributes', JSON.stringify(formData[key] || []));
        } else {
          payload.append(key, formData[key] === null || formData[key] === undefined ? '' : formData[key]);
        }
      });

      const promise = editingProduct
        ? api.post(`/admin/products/${editingProduct.id}?_method=PUT`, payload, { headers: { 'Content-Type': 'multipart/form-data' } })
        : api.post('/admin/products', payload, { headers: { 'Content-Type': 'multipart/form-data' } })

      await toast.promise(promise, {
        loading: 'جاري الحفظ...',
        success: editingProduct ? 'تم تعديل المنتج بنجاح!' : 'تم إضافة المنتج بنجاح!',
        error: 'خطأ في الحفظ'
      })
      setView('list')
      setFormData(emptyForm)
      setImgPreview('')
      setSizeGuidePreview('')
      setEditingProduct(null)
      fetchData()
    } catch { 
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false)
    }
  }

  const openEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name_ar: product.name_ar || '',
      name_en: product.name_en || '',
      category_id: product.category_id || '',
      brand_id: product.brand_id || '',
      price: product.price || '',
      discount_price: product.compare_price || product.discount_price || '',
      quantity: product.stock_quantity || product.quantity || '',
      description_ar: product.description_ar || '',
      description_en: product.description_en || '',
      primary_image: product.primary_image || '',
      size_guide_image: product.size_guide_image || '',
      video_url: product.video_url || '',
      gallery_images: Array.isArray(product.gallery_images) ? product.gallery_images : (JSON.parse(product.gallery_images || '[]')),
      attributes: (() => {
        try {
          const decoded = typeof product.attributes === 'string' ? JSON.parse(product.attributes) : (product.attributes || [])
          if (Array.isArray(decoded)) return decoded.map(a => ({...a, is_selectable: a.is_selectable ?? true}))
          const arr = []
          if (decoded.colors && decoded.colors.length > 0) arr.push({ name_ar: 'اللون', name_en: 'Color', type: 'color', is_selectable: true, values: decoded.colors.map(c => ({ value_ar: c, value_en: c })) })
          if (decoded.sizes && decoded.sizes.length > 0) arr.push({ name_ar: 'المقاس', name_en: 'Size', type: 'size', is_selectable: true, values: decoded.sizes.map(s => ({ value_ar: s, value_en: s })) })
          return arr
        } catch(e) { return [] }
      })(),
      is_featured: product.is_featured || 0,
      delivery_badge: product.delivery_badge || '',
      availability: product.availability || 'instant',
      gender: product.gender || '',
      origin: product.origin || '',
      discount_expires_at: product.discount_expires_at ? product.discount_expires_at.slice(0, 16) : ''
    })
    setImgPreview(getImageUrl(product.primary_image))
    setSizeGuidePreview(product.size_guide_image ? getImageUrl(product.size_guide_image) : '')
    setView('add')
  }

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا المنتج؟')) return
    try {
      const r = await api.delete(`/admin/products/${id}`)
      toast.success(r.data?.result === 'hidden' ? 'انحذف من المتجر (يبقى في الطلبات القديمة)' : 'تم الحذف')
      setProducts(list => list.filter(p => p.id !== id))
      setTotalItems(n => Math.max(0, n - 1))
    } catch { toast.error('خطأ في الحذف') }
  }

  // Copy photos still linked to brand sites onto our server (selected, or all).
  const fixImages = async (ids) => {
    setBulkBusy(true)
    const t = toast.loading('أنسخ الصور على السيرفر…')
    try {
      const r = await api.post('/admin/products/fix-images', ids?.length ? { ids } : {})
      const { fixed = 0, failed = 0, empty = [] } = r.data || {}
      toast.success(fixed || failed ? `انصلحت ${fixed} صورة` + (failed ? ` · انحذفت ${failed} صورة مكسورة` : '') : 'كل الصور على السيرفر', { id: t, duration: 6000 })
      if (empty.length) {
        toast(`${empty.length} منتج صار بدون صور، ضيف لها صور:\n` + empty.slice(0, 8).map(e => '• ' + e.name).join('\n') + (empty.length > 8 ? '\n…' : ''), { icon: '🖼️', duration: 15000, style: { whiteSpace: 'pre-line' } })
      }
      fetchProducts(currentPage)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'تعذّر', { id: t })
    } finally {
      setBulkBusy(false)
    }
  }

  // Delete every selected product.
  const bulkDelete = async () => {
    if (!selected.length) return
    if (!confirm(`تحذف ${selected.length} منتج؟ ما تقدر ترجعها.\nالمنتجات اللي في طلبات قديمة تختفي من المتجر وتبقى في الطلبات.`)) return
    setBulkBusy(true)
    try {
      const r = await api.post('/admin/products/bulk-delete', { ids: selected })
      const { deleted = 0, hidden = 0 } = r.data || {}
      toast.success(`انحذف ${deleted + hidden} منتج` + (hidden ? ` (${hidden} منها في طلبات قديمة، اختفت من المتجر)` : ''))
      setProducts(list => list.filter(p => !selected.includes(p.id)))
      setTotalItems(n => Math.max(0, n - selected.length))
      setSelected([])
    } catch {
      toast.error('تعذّر الحذف')
    } finally {
      setBulkBusy(false)
    }
  }

  // --- AI Import Management ---
  const handleAiImportSuccess = (aiData) => {
    setFormData(prev => ({
      ...prev,
      category_id: aiData.category_id || prev.category_id,
      brand_id: aiData.brand_id || prev.brand_id,
      name_en: aiData.name_en || prev.name_en,
      name_ar: aiData.name_ar || prev.name_ar,
      description_en: aiData.description_en || prev.description_en,
      description_ar: aiData.description_ar || prev.description_ar,
      price: aiData.price || prev.price,
      gallery_images: aiData.images && aiData.images.length > 0 ? aiData.images : prev.gallery_images,
      primary_image: aiData.primary_image || prev.primary_image,
      attributes: [
        ...(Array.isArray(aiData.attributes) ? aiData.attributes.map(attr => ({
            name_ar: attr.name_ar || '',
            name_en: attr.name_en || '',
            type: attr.type || 'text',
            icon: '',
            is_selectable: attr.is_selectable ?? true,
            values: Array.isArray(attr.values) ? attr.values.map(v => ({ value_ar: v.value_ar || '', value_en: v.value_en || '', color_code: '', image: '' })) : []
        })) : [])
      ]
    }))
    
    if (aiData.primary_image) {
      setImgPreview(getImageUrl(aiData.primary_image))
    }
    
    setView('add')
  }

  // --- Attributes Management ---
  const addGlobalAttribute = (e) => {
    const attrId = e.target.value
    if (!attrId) return
    const globalAttr = globalAttributes.find(a => a.id == attrId)
    if (!globalAttr) return
    
    // Check if already added
    if (formData.attributes.some(a => a.name_ar === globalAttr.name_ar)) {
      toast.error('هذه الخاصية مضافة مسبقاً')
      e.target.value = ""
      return
    }

    setFormData(f => ({
      ...f,
      attributes: [...f.attributes, {
        name_ar: globalAttr.name_ar,
        name_en: globalAttr.name_en,
        type: globalAttr.type,
        icon: globalAttr.icon,
        is_selectable: true,
        values: globalAttr.values.map(v => ({ ...v })) // deep copy values
      }]
    }))
    e.target.value = ""
  }

  const addCustomAttribute = () => {
    setFormData(f => ({
      ...f,
      attributes: [...f.attributes, { name_ar: '', name_en: '', type: 'text', icon: '', is_selectable: true, values: [] }]
    }))
  }

  const removeAttribute = (index) => {
    const newAttrs = [...formData.attributes]
    newAttrs.splice(index, 1)
    setFormData(f => ({ ...f, attributes: newAttrs }))
  }

  const updateAttribute = (index, field, value) => {
    const newAttrs = [...formData.attributes]
    newAttrs[index][field] = value
    setFormData(f => ({ ...f, attributes: newAttrs }))
  }

  const addAttributeValue = (attrIndex) => {
    const newAttrs = [...formData.attributes]
    newAttrs[attrIndex].values.push({ value_ar: '', value_en: '', color_code: '', image: '' })
    setFormData(f => ({ ...f, attributes: newAttrs }))
  }

  const removeAttributeValue = (attrIndex, valIndex) => {
    const newAttrs = [...formData.attributes]
    newAttrs[attrIndex].values.splice(valIndex, 1)
    setFormData(f => ({ ...f, attributes: newAttrs }))
  }

  const updateAttributeValue = (attrIndex, valIndex, field, value) => {
    const newAttrs = [...formData.attributes]
    newAttrs[attrIndex].values[valIndex][field] = value
    setFormData(f => ({ ...f, attributes: newAttrs }))
  }

  const handleAttributeImageUpload = (attrIndex, valIndex, e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      updateAttributeValue(attrIndex, valIndex, 'image', reader.result)
    }
    reader.readAsDataURL(file)
  }

  // =================== ADD FORM VIEW ===================
  if (view === 'add') {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <button onClick={() => setView('list')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9CA3AF', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
                <RiArrowLeftLine size={16} /> العودة للمنتجات
              </button>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>إضافة منتج جديد</h1>
            <p style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>أدخل كافة تفاصيل المنتج بدقة قبل النشر</p>
          </div>
          <button onClick={() => { setView('list'); setEditingProduct(null); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <RiCloseLine size={18} /> إلغاء
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          
          {/* === LEFT COLUMN === */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Language Content Card */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA', padding: '0 24px' }}>
                {[{ key: 'ar', label: 'المحتوى العربي', flag: '🇸🇦' }, { key: 'en', label: 'English Content', flag: '🇬🇧' }].map(lang => (
                  <button key={lang.key} type="button" onClick={() => setActiveLang(lang.key)}
                    style={{ padding: '16px 22px', fontSize: 13, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: activeLang === lang.key ? '2px solid var(--color-gold)' : '2px solid transparent', color: activeLang === lang.key ? 'var(--color-gold)' : '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{lang.flag}</span> {lang.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: '24px 28px' }}>
                {activeLang === 'ar' ? (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>اسم المنتج بالعربية *</label>
                      <input required value={formData.name_ar} onChange={e => setFormData(f => ({...f, name_ar: e.target.value}))}
                        style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none', transition: 'border 0.2s' }}
                        placeholder="مثال: عطر ديور سوفاج، ساعة رولكس سابماريز..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>الوصف التفصيلي والمميزات (عربي)</label>
                      <textarea value={formData.description_ar} onChange={e => setFormData(f => ({...f, description_ar: e.target.value}))} rows={5}
                        style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.7 }}
                        placeholder="اكتب وصفاً دقيقاً وجذاباً يشرح مميزات المنتج..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>Product Name (English) *</label>
                      <input required value={formData.name_en} onChange={e => setFormData(f => ({...f, name_en: e.target.value}))}
                        style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, fontFamily: 'sans-serif', outline: 'none', direction: 'ltr' }}
                        placeholder="Ex: Dior Sauvage Parfum 200ml..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' }}>Description & Features (English)</label>
                      <textarea value={formData.description_en} onChange={e => setFormData(f => ({...f, description_en: e.target.value}))} rows={5}
                        style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'sans-serif', outline: 'none', resize: 'vertical', direction: 'ltr', lineHeight: 1.7 }}
                        placeholder="Describe the product features in detail..."
                        onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* General Info */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '24px 28px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 20 }}>معلومات المنتج الأساسية</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>التصنيف (Category) *</label>
                  <select required value={formData.category_id} onChange={e => setFormData(f => ({...f, category_id: e.target.value}))}
                    style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                    <option value="">اختر التصنيف...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>الماركة (Brand)</label>
                  <select value={formData.brand_id} onChange={e => setFormData(f => ({...f, brand_id: e.target.value}))}
                    style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                    <option value="">بدون ماركة</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>التوفر (يظهر في التطبيق)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['instant', '⚡ تسليم فوري'], ['on_order', '🕓 بالطلب']].map(([k, l]) => (
                      <button type="button" key={k} onClick={() => setFormData(f => ({ ...f, availability: k }))}
                        style={{ flex: 1, padding: '11px 10px', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700,
                          border: formData.availability === k ? '1.5px solid var(--color-primary)' : '1.5px solid #E5E7EB',
                          background: formData.availability === k ? 'rgba(74,13,23,0.06)' : '#fff', color: formData.availability === k ? 'var(--color-primary)' : '#374151' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>القسم</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['women', 'نسائي'], ['men', 'رجالي'], ['unisex', 'للجنسين']].map(([k, l]) => (
                      <button type="button" key={k} onClick={() => setFormData(f => ({ ...f, gender: f.gender === k ? '' : k }))}
                        style={{ flex: 1, padding: '11px 10px', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700,
                          border: formData.gender === k ? '1.5px solid var(--color-primary)' : '1.5px solid #E5E7EB',
                          background: formData.gender === k ? 'rgba(74,13,23,0.06)' : '#fff', color: formData.gender === k ? 'var(--color-primary)' : '#374151' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>يُشحن من (يحدد مدة التوصيل)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['oman', '🇴🇲 عُمان'], ['dubai', '🇦🇪 دبي'], ['europe', '🇪🇺 أوروبا']].map(([k, l]) => (
                      <button type="button" key={k} onClick={() => setFormData(f => ({ ...f, origin: f.origin === k ? '' : k }))}
                        style={{ flex: 1, padding: '11px 10px', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700,
                          border: formData.origin === k ? '1.5px solid var(--color-primary)' : '1.5px solid #E5E7EB',
                          background: formData.origin === k ? 'rgba(74,13,23,0.06)' : '#fff', color: formData.origin === k ? 'var(--color-primary)' : '#374151' }}>{l}</button>
                    ))}
                  </div>
                  <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: '6px 0 0' }}>إذا ما اخترت: تسليم فوري = عُمان، بالطلب = أوروبا.</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>شارة التوصيل (Delivery Badge)</label>
                  <select value={formData.delivery_badge} onChange={e => setFormData(f => ({...f, delivery_badge: e.target.value}))}
                    style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                    <option value="">بدون شارة</option>
                    <option value="2h">توصيل خلال ساعتين</option>
                    <option value="3d">توصيل خلال 3 أيام</option>
                    <option value="5_7d">توصيل خلال 5 - 7 أيام</option>
                    <option value="preorder">طلب مسبق</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                {[
                  { key: 'price', label: 'السعر الأساسي (OMR) *', required: true, placeholder: '0.000' },
                  { key: 'discount_price', label: 'سعر التخفيض (OMR)', required: false, placeholder: '0.000' },
                  { key: 'quantity', label: 'الكمية المتوفرة *', required: true, placeholder: '0' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>{field.label}</label>
                    <input type="number" required={field.required} min="0" step="0.001"
                      value={formData[field.key]} onChange={e => setFormData(f => ({...f, [field.key]: e.target.value}))}
                      style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'sans-serif', outline: 'none' }}
                      placeholder={field.placeholder}
                      onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>
                ))}
              </div>

              {/* تاريخ انتهاء الخصم */}
              {formData.discount_price !== undefined && formData.discount_price !== '' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>تاريخ انتهاء الخصم (اختياري - للعد التنازلي)</label>
                    <input type="datetime-local"
                      value={formData.discount_expires_at}
                      onChange={e => setFormData(f => ({...f, discount_expires_at: e.target.value}))}
                      style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'sans-serif', outline: 'none', direction: 'ltr' }}
                      onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                    />
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>يحدد متى ينتهي العد التنازلي في قسم Flash Sale على الموقع</p>
                  </div>
                </div>
              )}
            </div>

            {/* Video */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '24px 28px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>رابط فيديو المنتج (اختياري)</p>
              <div style={{ position: 'relative' }}>
                <RiVideoLine style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} size={20} />
                <input value={formData.video_url} onChange={e => setFormData(f => ({...f, video_url: e.target.value}))}
                  style={{ width: '100%', padding: '13px 48px 13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'sans-serif', outline: 'none', direction: 'ltr' }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  onFocus={e => e.target.style.borderColor = 'var(--color-gold)'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
            </div>
            
            {/* Attributes */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>خصائص المنتج (Attributes)</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <select onChange={addGlobalAttribute} style={{ padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 12, outline: 'none' }}>
                    <option value="">+ استيراد خاصية عامة</option>
                    {globalAttributes.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
                  </select>
                  <button type="button" onClick={addCustomAttribute} style={{ padding: '8px 12px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ خاصية مخصصة</button>
                </div>
              </div>

              {formData.attributes.map((attr, attrIdx) => (
                <div key={attrIdx} style={{ background: '#FAFAFA', border: '1px solid #F3F4F6', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <input value={attr.name_ar} onChange={e => updateAttribute(attrIdx, 'name_ar', e.target.value)} placeholder="اسم الخاصية (عربي)" style={{ flex: 1, minWidth: 150, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 }} />
                    <input value={attr.name_en} onChange={e => updateAttribute(attrIdx, 'name_en', e.target.value)} placeholder="الاسم (إنجليزي)" style={{ flex: 1, minWidth: 150, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, direction: 'ltr' }} />
                    <select value={attr.type} onChange={e => updateAttribute(attrIdx, 'type', e.target.value)} style={{ width: 100, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 }}>
                      <option value="text">نص</option>
                      <option value="color">لون/صورة</option>
                      <option value="size">مقاس</option>
                      <option value="engraving">حفر (نص يكتبه العميل)</option>
                    </select>
                    {attr.type === 'engraving' && (
                      <input type="number" min="1" max="40" value={attr.max_length || 12} onChange={e => updateAttribute(attrIdx, 'max_length', Number(e.target.value))} title="حد الحروف" style={{ width: 70, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 }} />
                    )}
                    <select value={attr.icon || ''} onChange={e => updateAttribute(attrIdx, 'icon', e.target.value)} style={{ width: 130, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'monospace' }}>
                      <option value="">-- بدون أيقونة --</option>
                      <option value="diamond_outlined">💎 Diamond</option>
                      <option value="settings_outlined">⚙️ Settings</option>
                      <option value="water_drop_outlined">💧 Water</option>
                      <option value="straighten">📏 Size/Ruler</option>
                      <option value="scale">⚖️ Weight</option>
                      <option value="verified_outlined">✔️ Verified</option>
                      <option value="star_outline">⭐ Star</option>
                      <option value="favorite_border">❤️ Heart</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#4B5563', cursor: 'pointer', background: '#fff', padding: '6px 10px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                      <input type="checkbox" checked={attr.is_selectable !== false} onChange={e => updateAttribute(attrIdx, 'is_selectable', e.target.checked)} style={{ cursor: 'pointer' }} />
                      قابل للاختيار
                    </label>
                    <button type="button" onClick={() => removeAttribute(attrIdx)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RiDeleteBinLine size={16}/></button>
                  </div>
                  
                  {attr.type === 'engraving' ? (
                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>العميل يكتب النص اللي يبيه ينحفر (اختياري، حتى {attr.max_length || 12} حرف) ويطلع في الطلب.</p>
                  ) : (
                  <div style={{ paddingLeft: 12, borderRight: '2px solid #E5E7EB', marginRight: 12 }}>
                    {attr.values.map((val, valIdx) => (
                      <div key={valIdx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input value={val.value_ar} onChange={e => updateAttributeValue(attrIdx, valIdx, 'value_ar', e.target.value)} placeholder="القيمة (عربي)" style={{ flex: 1, padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12 }} />
                        <input value={val.value_en} onChange={e => updateAttributeValue(attrIdx, valIdx, 'value_en', e.target.value)} placeholder="القيمة (إنجليزي)" style={{ flex: 1, padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, direction: 'ltr' }} />
                        <input type="number" step="0.001" value={val.price_add ?? ''} onChange={e => updateAttributeValue(attrIdx, valIdx, 'price_add', e.target.value === '' ? null : Number(e.target.value))} placeholder="+ ر.ع" title="زيادة على السعر لما يختار هذا الخيار" style={{ width: 80, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, direction: 'ltr' }} />
                        
                        {attr.type === 'color' && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="color" value={val.color_code || '#000000'} onChange={e => updateAttributeValue(attrIdx, valIdx, 'color_code', e.target.value)} style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px dashed #D1D5DB', borderRadius: 4, cursor: 'pointer', background: val.image ? 'transparent' : '#fff', overflow: 'hidden' }}>
                              {val.image ? <img src={val.image.startsWith('data') ? val.image : getImageUrl(val.image)} alt="color" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <RiImageAddLine size={14} color="#9CA3AF" />}
                              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={e => handleAttributeImageUpload(attrIdx, valIdx, e)} />
                            </label>
                          </div>
                        )}
                        <button type="button" onClick={() => removeAttributeValue(attrIdx, valIdx)} style={{ background: 'transparent', color: '#EF4444', border: 'none', cursor: 'pointer', padding: 4 }}><RiCloseLine size={16}/></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addAttributeValue(attrIdx)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}>+ إضافة قيمة</button>
                  </div>
                  )}
                </div>
              ))}
            </div>

          </div>

          {/* === RIGHT COLUMN === */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Image Upload */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '24px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16, textAlign: 'center' }}>الصورة الرئيسية للمنتج</p>

              {/* Upload area */}
              <div onClick={() => fileRef.current?.click()}
                style={{ border: '2px dashed #E5E7EB', borderRadius: 14, minHeight: 180, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'all 0.2s', marginBottom: 16 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.background = '#FBF5EE' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '' }}
              >
                {imgPreview ? (
                  <img src={imgPreview} alt="preview" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                ) : (
                  <>
                    <RiImageAddLine size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#6B7280', margin: 0 }}>ارفع صورة المنتج</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>JPG, PNG, WebP - حتى 10MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, 'primary_image')} />

              <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 10 }}>أو أدخل رابط الصورة مباشرة</p>
              <input value={formData.primary_image} onChange={e => { setFormData(f => ({...f, primary_image: e.target.value})); setImgPreview(e.target.value) }}
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 12, fontFamily: 'sans-serif', outline: 'none', direction: 'ltr' }}
                placeholder="https://..."
              />
            </div>

            {/* Size Guide Image Upload */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '24px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16, textAlign: 'center' }}>صورة دليل المقاسات (اختياري)</p>
              <div onClick={() => document.getElementById('size_guide_upload').click()}
                style={{ border: '2px dashed #E5E7EB', borderRadius: 14, minHeight: 120, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'all 0.2s', marginBottom: 16 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.background = '#FBF5EE' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '' }}
              >
                {sizeGuidePreview ? (
                  <img src={sizeGuidePreview} alt="size-guide" style={{ width: '100%', height: 120, objectFit: 'contain' }} />
                ) : (
                  <>
                    <RiImageAddLine size={24} color="#D1D5DB" style={{ marginBottom: 8 }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', margin: 0 }}>ارفع دليل المقاسات</p>
                  </>
                )}
              </div>
              <input id="size_guide_upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, 'size_guide_image')} />
            </div>

            {/* Gallery Upload */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '24px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16, textAlign: 'center' }}>معرض الصور (Gallery)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {formData.gallery_images.map((img, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                    <img src={getImageUrl(img)} alt={`gallery-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => setFormData(f => ({ ...f, gallery_images: f.gallery_images.filter((_, idx) => idx !== i) }))} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', padding: 4, cursor: 'pointer', color: 'red' }}><RiCloseLine size={14}/></button>
                  </div>
                ))}
                <label style={{ aspectRatio: '1', borderRadius: 8, border: '2px dashed #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#FAFAFA' }}>
                  <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    for (let file of files) {
                      const compressed = await compressImage(file);
                      setFormData(f => ({ ...f, gallery_images: [...f.gallery_images, compressed] }));
                    }
                  }} />
                  <RiAddLine size={24} color="#D1D5DB" />
                </label>
              </div>
            </div>

            {/* Publish Card */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '24px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>إعدادات النشر</p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#FAFAFA', borderRadius: 10, cursor: 'pointer', marginBottom: 20 }}>
                <input type="checkbox" checked={formData.is_featured === 1} onChange={e => setFormData(f => ({...f, is_featured: e.target.checked ? 1 : 0}))}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>منتج مميز ⭐</p>
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>سيظهر في قسم المنتجات المميزة</p>
                </div>
              </label>

              <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '15px', background: isSubmitting ? '#9CA3AF' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-med))', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer', pointerEvents: isSubmitting ? 'none' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: isSubmitting ? 'none' : '0 6px 20px rgba(74,13,23,0.3)' }}>
                <RiSaveLine size={20} /> {isSubmitting ? 'جاري الحفظ...' : 'حفظ وإضافة للكتالوج'}
              </button>
            </div>
          </div>
        </form>

        {/* Blocking Overlay during submit */}
        {isSubmitting && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, cursor: 'not-allowed', background: 'transparent' }} />
        )}
      </div>
    )
  }

  const filteredProducts = products;
  const samplePrice = products.find(p => selected.includes(p.id))?.price;

  // =================== LIST VIEW ===================
  return (
    <div className="page-inner" style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="flex-mobile-col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>المنتجات</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{totalItems || products.length} منتج في المتجر</p>
        </div>
        <div className="flex-mobile-col flex-wrap" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" disabled={bulkBusy} onClick={() => window.confirm('أنسخ كل صور المنتجات اللي للحين على مواقع البراندات إلى السيرفر؟\nالصور اللي ما تنجاب تنحذف من المنتج عشان ما تطلع مكسورة. ممكن ياخذ دقيقة.') && fixImages()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} title="صور ما تطلع؟ ينسخها على السيرفر">
            <RiImageAddLine size={17} /> إصلاح الصور
          </button>
          <Link to="/admin/import-items" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <RiDownloadCloud2Line size={17} /> من مواقع البراندات
          </Link>
          <button className="btn btn-ghost" onClick={() => { setIsAiModalOpen(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <RiMagicLine size={17} /> من رابط واحد
          </button>
          <button className="btn btn-primary" onClick={() => { setFormData(emptyForm); setImgPreview(''); setEditingProduct(null); setView('add') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <RiAddLine size={17} /> منتج جديد
          </button>
        </div>
      </div>
      
      <AiImportModal 
        isOpen={isAiModalOpen} 
        onClose={() => { setIsAiModalOpen(false); setAutoImportKey(null); }} 
        onImportSuccess={handleAiImportSuccess} 
        autoImportKey={autoImportKey}
      />

      {/* Filters */}
      <div className="filters-row flex-mobile-col" style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <RiSearchLine size={20} color="#9CA3AF" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }} placeholder="ابحث باسم المنتج أو البراند…" />
        </div>
        <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPriceFilter('') }} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none', maxWidth: 200 }}>
          <option value="">كل البراندات</option>
          {[...brands].sort((a, b) => (a.name_en || a.name_ar || '').localeCompare(b.name_en || b.name_ar || '')).map(b => <option key={b.id} value={b.id}>{b.name_en || b.name_ar}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
          <option value="all">كل التصنيفات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
          <option value="all">كل الحالات</option>
          <option value="1">نشط</option>
          <option value="0">مسودة</option>
        </select>
      </div>

      {/* Same price: pick one to select all of them */}
      {(priceGroups.length > 0 || priceFilter !== '') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>نفس السعر:</span>
          {priceFilter !== '' ? (
            <button onClick={() => { setPriceFilter(''); setSelected([]) }} style={{ border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {Number(priceFilter).toFixed(3)} OMR ✕
            </button>
          ) : priceGroups.map(g => (
            <button key={g.price} onClick={() => pickPrice(g.price)} style={{ border: '1px solid var(--border)', background: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              <b style={{ fontFamily: 'sans-serif' }}>{Number(g.price).toFixed(3)}</b> OMR <span style={{ color: 'var(--text-secondary)' }}>· {g.n} منتج</span>
            </button>
          ))}
        </div>
      )}

      {/* All results, not only this page */}
      {selected.length > 0 && totalItems > products.length && filteredProducts.every(p => selected.includes(p.id)) && selected.length < totalItems && (
        <div style={{ background: '#FFF8EC', border: '1px solid #F1DFC0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          حددت {selected.length} في هذي الصفحة.{' '}
          <button onClick={selectAllResults} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>حدد كل الـ {totalItems} منتج</button>
        </div>
      )}

      {/* Change price of the selected products */}
      {priceModal && (
        <div onClick={() => !bulkBusy && setPriceModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,12,10,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>تغيير السعر · {selected.length} منتج</h3>
            <div style={{ display: 'flex', gap: 6, margin: '16px 0', background: '#F5F1EC', padding: 4, borderRadius: 10 }}>
              {[['set', 'سعر جديد'], ['percent', 'زيادة %'], ['add', 'زيادة مبلغ']].map(([k, l]) => (
                <button key={k} onClick={() => setPriceMode(k)} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '8px 6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, background: priceMode === k ? '#fff' : 'transparent', boxShadow: priceMode === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
              ))}
            </div>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {priceMode === 'set' ? 'السعر الجديد (OMR)' : priceMode === 'percent' ? 'النسبة % (للتخفيض اكتب بالسالب مثل -10)' : 'المبلغ OMR (للتخفيض اكتب بالسالب)'}
            </label>
            <input autoFocus value={priceValue} onChange={e => setPriceValue(e.target.value)} inputMode="decimal" dir="ltr"
              onKeyDown={e => e.key === 'Enter' && applyPrice()}
              style={{ width: '100%', marginTop: 6, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 18, fontFamily: 'sans-serif', boxSizing: 'border-box' }}
              placeholder={priceMode === 'set' ? '0.000' : priceMode === 'percent' ? '10' : '5'} />
            {samplePrice != null && newPrice(Number(samplePrice)) != null && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '10px 0 0' }}>
                مثال: <span style={{ fontFamily: 'sans-serif' }}>{Number(samplePrice).toFixed(3)}</span> ← <b style={{ fontFamily: 'sans-serif', color: 'var(--color-primary)' }}>{newPrice(Number(samplePrice)).toFixed(3)}</b> OMR
                {priceMode === 'percent' && <><br />يتقرّب لأقرب ريال (أو نص ريال تحت ١٠٠)، والخصم إن وُجد يتحرك بنفس النسبة.</>}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" disabled={bulkBusy} onClick={applyPrice} style={{ flex: 1 }}>{bulkBusy ? 'يحفظ…' : 'تطبيق'}</button>
              <button className="btn btn-ghost" disabled={bulkBusy} onClick={() => setPriceModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div style={{ position: 'sticky', top: 12, zIndex: 20, background: '#111', color: '#fff', borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          <strong style={{ fontSize: 14 }}>{selected.length} منتج محدد</strong>
          <button disabled={bulkBusy} onClick={() => setPriceModal(true)} style={{ background: 'var(--color-gold, #B08A45)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💰 تغيير السعر</button>
          <span style={{ opacity: 0.6, fontSize: 13 }}>غيّر التوفر إلى:</span>
          <button disabled={bulkBusy} onClick={() => setAvailability('instant')} style={{ background: '#16804A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⚡ تسليم فوري</button>
          <button disabled={bulkBusy} onClick={() => setAvailability('on_order')} style={{ background: '#C26A00', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🕓 بالطلب</button>
          <span style={{ opacity: 0.6, fontSize: 13 }}>التصنيف:</span>
          <select disabled={bulkBusy} value="" onChange={e => e.target.value && bulkSet({ category_id: Number(e.target.value) }, 'التصنيف')} style={{ borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', border: 'none', maxWidth: 190 }}>
            <option value="">انقل إلى…</option>
            {categories.filter(c => !c.parent_id).map(sec => [
              <option key={'s' + sec.id} value={sec.id}>{sec.name_ar}</option>,
              ...categories.filter(c => c.parent_id === sec.id).map(c => <option key={c.id} value={c.id}>— {c.name_ar}</option>),
            ])}
          </select>
          <span style={{ opacity: 0.6, fontSize: 13 }}>القسم:</span>
          <select disabled={bulkBusy} value="" onChange={e => e.target.value && bulkSet({ gender: e.target.value }, 'القسم')} style={{ borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', border: 'none' }}>
            <option value="">اختر…</option>
            <option value="women">نسائي</option>
            <option value="men">رجالي</option>
            <option value="unisex">للجنسين</option>
            <option value="none">بدون</option>
          </select>
          <span style={{ opacity: 0.6, fontSize: 13 }}>يُشحن من:</span>
          <select disabled={bulkBusy} value="" onChange={e => e.target.value && bulkSet({ origin: e.target.value }, 'مصدر الشحن')} style={{ borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', border: 'none' }}>
            <option value="">اختر…</option>
            <option value="oman">عُمان</option>
            <option value="dubai">دبي</option>
            <option value="europe">أوروبا</option>
            <option value="none">تلقائي</option>
          </select>
          <button disabled={bulkBusy} onClick={() => fixImages(selected)} style={{ marginInlineStart: 'auto', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>إصلاح الصور</button>
          <button disabled={bulkBusy} onClick={bulkDelete} style={{ background: '#B42318', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}><RiDeleteBinLine size={15} /> حذف المحدد ({selected.length})</button>
          <button onClick={() => setSelected([])} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء التحديد</button>
        </div>
      )}

      {/* Table */}
      <div className="table-container" style={{ background: '#fff' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#9CA3AF' }}>جاري التحميل...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                <th style={{ width: 44, padding: '14px 20px' }}>
                  <input type="checkbox" checked={filteredProducts.length > 0 && filteredProducts.every(p => selected.includes(p.id))}
                    onChange={e => setSelected(e.target.checked ? filteredProducts.map(p => p.id) : [])} />
                </th>
                {['المنتج', 'الفئة', 'السعر (OMR)', 'المخزون', 'التوفر', 'الحالة', 'الإجراءات'].map(h => (
                  <th key={h} style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#9CA3AF', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 80, color: '#9CA3AF', fontSize: 15 }}>لا توجد منتجات مطابقة.</td></tr>
              ) : filteredProducts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <input type="checkbox" checked={selected.includes(p.id)}
                      onChange={e => setSelected(s => e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id))} />
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 10, background: '#F3F4F6', overflow: 'hidden', flexShrink: 0 }}>
                        {p.primary_image ? (
                          <img src={getImageUrl(p.primary_image)} alt={p.name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RiImageAddLine size={20} color="#D1D5DB" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{p.name_ar || '-'}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: 'sans-serif' }}>{p.brand_name_en || p.brand_name_ar || p.sku || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--color-gold)', fontWeight: 600, fontSize: 13 }}>{p.category_name || '-'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    {p.compare_price ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'sans-serif', fontSize: 14 }}>{p.compare_price}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 700 }}>OMR</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                           <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through', fontFamily: 'sans-serif' }}>{p.price}</span>
                           <span style={{ fontSize: 9, color: '#9CA3AF' }}>OMR</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'sans-serif', fontSize: 14 }}>{p.price}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 700 }}>OMR</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 600, color: p.stock_quantity > 0 ? '#15803D' : p.availability === 'on_order' ? 'var(--text-light)' : '#B42318', fontSize: 14 }}>
                      {p.stock_quantity > 0 ? p.stock_quantity : p.availability === 'on_order' ? '—' : 'نفذ'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                      background: p.availability === 'on_order' ? 'rgba(194,106,0,0.1)' : 'rgba(16,128,74,0.1)',
                      color: p.availability === 'on_order' ? '#C26A00' : '#16804A' }}>
                      {p.availability === 'on_order' ? 'بالطلب' : 'تسليم فوري'}
                    </span>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, whiteSpace: 'nowrap' }}>
                      {{ women: 'نسائي', men: 'رجالي', unisex: 'للجنسين' }[p.gender] || '—'} · {{ oman: 'عُمان', dubai: 'دبي', europe: 'أوروبا' }[p.origin] || (p.availability === 'on_order' ? 'أوروبا' : 'عُمان')}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: p.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)', color: p.status === 'active' ? '#10B981' : '#6B7280' }}>
                      {p.status === 'active' ? 'نشط' : 'مسودة'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(p)} style={{ width: 34, height: 34, borderRadius: 8, background: '#F3F4F6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <RiPencilLine size={15} color="#6B7280" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ width: 34, height: 34, borderRadius: 8, background: '#FEF2F2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <RiDeleteBinLine size={15} color="#EF4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer Pagination */}
        {!loading && products.length > 0 && (
          <div style={{
            padding:'14px 20px',
            borderTop:`1px solid rgba(74,13,23,0.06)`,
            background:'#FAFAFA',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: lastPage > 1 ? '16px' : '0' }}>
              <span style={{ fontSize:13, color:'#9CA3AF' }}>عرض {products.length} منتج في هذه الصفحة</span>
              <span style={{ fontSize:13, color: 'var(--primary-color, #4A0E1B)', fontWeight:600 }}>إجمالي المنتجات: {totalItems}</span>
            </div>
            
            {lastPage > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GHPagination 
                  currentPage={currentPage} 
                  lastPage={lastPage} 
                  total={totalItems} 
                  onPageChange={(p) => fetchProducts(p)} 
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
