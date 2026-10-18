import { useState, useEffect, useRef } from 'react'
import { RiAddLine, RiSearchLine, RiPencilLine, RiDeleteBinLine, RiPaletteLine, RiRulerLine, RiText, RiImageAddLine, RiCloseLine } from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import toast from 'react-hot-toast'

export default function Attributes() {
  const [attributes, setAttributes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const emptyForm = { name_ar: '', name_en: '', type: 'text', icon: '', values: [] }
  const [formData, setFormData] = useState(emptyForm)

  const fetchAttributes = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/attributes')
      setAttributes(res.data.data || res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttributes()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/admin/attributes/${editingId}`, formData)
        toast.success('تم التعديل بنجاح')
      } else {
        await api.post('/admin/attributes', formData)
        toast.success('تمت الإضافة بنجاح')
      }
      setShowModal(false)
      setFormData(emptyForm)
      setEditingId(null)
      fetchAttributes()
    } catch (err) {
      console.error(err)
      toast.error("حدث خطأ أثناء الحفظ")
    }
  }

  const handleEdit = (attr) => {
    setEditingId(attr.id)
    setFormData({
      name_ar: attr.name_ar || '',
      name_en: attr.name_en || '',
      type: attr.type || 'text',
      icon: attr.icon || '',
      values: attr.values ? attr.values.map(v => ({
        value_ar: v.value_ar || v.value || '',
        value_en: v.value_en || '',
        color_code: v.color_code || '',
        image: v.image || ''
      })) : []
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if(confirm('هل أنت متأكد من حذف هذه الخاصية؟')) {
      try {
        await api.delete(`/admin/attributes/${id}`)
        toast.success('تم الحذف بنجاح')
        fetchAttributes()
      } catch {
        toast.error('حدث خطأ أثناء الحذف')
      }
    }
  }

  const addValueRow = () => {
    setFormData({
      ...formData,
      values: [...formData.values, { value_ar: '', value_en: '', color_code: '', image: '' }]
    })
  }



  const updateValueRow = (index, field, value) => {
    const newValues = [...formData.values]
    newValues[index][field] = value
    setFormData({ ...formData, values: newValues })
  }

  const removeValueRow = (index) => {
    const newValues = [...formData.values]
    newValues.splice(index, 1)
    setFormData({ ...formData, values: newValues })
  }

  const handleImageUpload = (index, e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      updateValueRow(index, 'image', reader.result)
    }
    reader.readAsDataURL(file)
  }

  const getTypeIcon = (type) => {
    if(type === 'color') return <RiPaletteLine size={18} color="var(--status-delivered)" />
    if(type === 'size') return <RiRulerLine size={18} color="var(--status-shipped)" />
    return <RiText size={18} color="var(--text-secondary)" />
  }

  return (
    <div className="page-container">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">الخصائص (Attributes)</h1>
          <p className="page-subtitle">إدارة الألوان، المقاسات، الخامات، والخيارات الأخرى للمنتجات</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData(emptyForm); setShowModal(true) }}>
          <RiAddLine size={20} /> إضافة خاصية
        </button>
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="card-title">قائمة الخصائص</h2>
          <div className="search-box">
            <RiSearchLine size={18} color="var(--text-light)" />
            <input type="text" placeholder="ابحث في الخصائص..." className="search-input" />
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><input type="checkbox" className="checkbox" /></th>
                  <th>اسم الخاصية (عربي)</th>
                  <th>اسم الخاصية (إنجليزي)</th>
                  <th>النوع</th>
                  <th>القيم المتاحة</th>
                  <th style={{ width: '100px' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {attributes.length === 0 ? (
                  <tr><td colSpan="6" className="text-center p-8 text-gray-500">لا توجد خصائص مضافة حالياً.</td></tr>
                ) : attributes.map((attr) => (
                  <tr key={attr.id}>
                    <td><input type="checkbox" className="checkbox" /></td>
                    <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{attr.name_ar}</td>
                    <td className="font-medium" style={{ color: 'var(--text-secondary)' }}>{attr.name_en}</td>
                    <td>
                      <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        {getTypeIcon(attr.type)}
                        <span style={{ textTransform: 'capitalize' }}>
                          {attr.type === 'color' ? 'لون/صورة' : attr.type === 'size' ? 'مقاس' : 'نص'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        {attr.values && attr.values.map(val => (
                          <span key={val.id} className="badge badge-gold" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {val.image ? (
                              <img src={getImageUrl(val.image)} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : val.color_code ? (
                              <span style={{ 
                                display: 'inline-block', width: 12, height: 12, 
                                borderRadius: '50%', backgroundColor: val.color_code,
                                border: '1px solid rgba(0,0,0,0.1)'
                              }} />
                            ) : null}
                            {val.value_ar || val.value}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(attr)} className="btn btn-ghost btn-sm" style={{ padding: '6px' }} title="تعديل">
                          <RiPencilLine size={18} />
                        </button>
                        <button onClick={() => handleDelete(attr.id)} className="btn btn-ghost btn-sm" style={{ padding: '6px', color: 'var(--status-cancelled)' }} title="حذف">
                          <RiDeleteBinLine size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            width: 700, background: '#fff', borderRadius: 20, padding: 32, direction: 'rtl',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>
              {editingId ? 'تعديل خاصية' : 'إضافة خاصية جديدة'}
            </h2>
            
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>الاسم (عربي) *</label>
                  <input className="input" required style={{ background: '#f8f9fa', border: '1px solid #eee' }} value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>الاسم (إنجليزي)</label>
                  <input className="input" style={{ background: '#f8f9fa', border: '1px solid #eee', direction: 'ltr' }} value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>النوع</label>
                  <select className="input" style={{ background: '#f8f9fa', border: '1px solid #eee' }} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="text">نص (Text)</option>
                    <option value="color">لون/صورة (Color/Image)</option>
                    <option value="size">مقاس (Size)</option>
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>الأيقونة (اختياري)</label>
                  <select className="input" style={{ background: '#f8f9fa', border: '1px solid #eee', fontFamily: 'monospace' }} value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})}>
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
                </div>
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: 20 }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>قيم الخاصية (خيارات)</h3>
                  <button type="button" onClick={addValueRow} className="btn btn-outline btn-sm" style={{ padding: '6px 12px', fontSize: 12 }}>
                    <RiAddLine /> إضافة قيمة
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {formData.values.map((val, index) => (
                    <div key={index} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#FAFAFA', padding: 12, borderRadius: 8, border: '1px solid #F3F4F6' }}>
                      <input className="input flex-1" placeholder="القيمة (عربي) *" required value={val.value_ar} onChange={e => updateValueRow(index, 'value_ar', e.target.value)} />
                      <input className="input flex-1" placeholder="القيمة (إنجليزي)" dir="ltr" value={val.value_en} onChange={e => updateValueRow(index, 'value_en', e.target.value)} />
                      
                      {formData.type === 'color' && (
                        <>
                          <input type="color" style={{ width: 42, height: 42, padding: 2, cursor: 'pointer', border: '1px solid #eee', borderRadius: 6 }} value={val.color_code || '#000000'} onChange={e => updateValueRow(index, 'color_code', e.target.value)} title="كود اللون" />
                          
                          <label style={{ width: 42, height: 42, borderRadius: 6, border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }} title="صورة (بدل اللون)">
                            {val.image ? (
                              <img src={getImageUrl(val.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <RiImageAddLine size={18} color="#ccc" />
                            )}
                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={e => handleImageUpload(index, e)} />
                          </label>
                        </>
                      )}
                      
                      <button type="button" onClick={() => removeValueRow(index)} className="btn btn-ghost" style={{ padding: 10, color: 'red' }}>
                        <RiCloseLine size={20} />
                      </button>
                    </div>
                  ))}
                  
                  {formData.values.length === 0 && (
                    <p style={{ textAlign: 'center', fontSize: 13, color: '#999', padding: 20 }}>لا توجد قيم مضافة. اضغط على "إضافة قيمة"</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline" style={{ background: '#f4f4f4', border: 'none', color: '#555' }}>إلغاء</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-primary)' }}>حفظ الخاصية</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
