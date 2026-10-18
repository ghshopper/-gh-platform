import { useEffect, useMemo, useState } from 'react'
import { RiAddLine, RiCloseLine, RiCoupon3Line, RiDeleteBinLine, RiEdit2Line, RiFileCopyLine, RiLoader4Line, RiRefreshLine } from 'react-icons/ri'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || '/api'
const headers = () => ({
  Authorization: 'Bearer ' + localStorage.getItem('token'),
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const omr = (v) => `${Number(v || 0).toFixed(3)} ر.ع.`
const toInput = (iso) => (iso ? iso.slice(0, 16) : '')

const EMPTY = {
  code: '', description: '', type: 'percent', value: '', min_order: '', max_discount: '',
  brand_ids: [], category_ids: [], usage_limit: '', per_customer_limit: '1', starts_at: '', ends_at: '', is_active: true,
}

function status(c) {
  const now = Date.now()
  if (!c.is_active) return { label: 'موقوف', color: '#6B7280', bg: '#F3F4F6' }
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { label: 'لم يبدأ', color: '#2F7CF6', bg: '#EAF2FE' }
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return { label: 'منتهي', color: '#B3261E', bg: '#FDECEA' }
  if (c.usage_limit && c.used_count >= c.usage_limit) return { label: 'اكتمل', color: '#C26A00', bg: '#FFF3E0' }
  return { label: 'فعّال', color: '#16804A', bg: '#E7F7EE' }
}

const card = { background: '#fff', border: '1px solid #EEE', borderRadius: 14, padding: 18 }
const input = { width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
const label = { fontSize: 12.5, color: '#6B7280', marginBottom: 6, display: 'block' }

export default function Coupons() {
  const [list, setList] = useState([])
  const [brands, setBrands] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null) // null | {..., id?}
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState(null) // { coupon, rows }

  const load = async () => {
    setLoading(true)
    try {
      const [c, b, k] = await Promise.all([
        fetch(`${API}/ps/coupons`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/customer/brands`).then((r) => r.json()),
        fetch(`${API}/customer/categories`).then((r) => r.json()),
      ])
      setList(c.data || [])
      setBrands(Array.isArray(b) ? b : b.data || [])
      const flat = (k.data || []).flatMap((x) => [x, ...(x.children || [])])
      setCats(flat)
    } catch {
      toast.error('تعذّر تحميل الكوبونات')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const totals = useMemo(() => ({
    active: list.filter((c) => status(c).label === 'فعّال').length,
    uses: list.reduce((s, c) => s + (c.used_count || 0), 0),
    given: list.reduce((s, c) => s + Number(c.discount_given || 0), 0),
  }), [list])

  const openNew = () => setForm({ ...EMPTY })
  const openEdit = (c) => setForm({
    ...EMPTY, ...c,
    value: c.value ?? '', min_order: c.min_order ?? '', max_discount: c.max_discount ?? '',
    usage_limit: c.usage_limit ?? '', per_customer_limit: c.per_customer_limit ?? '',
    brand_ids: c.brand_ids || [], category_ids: c.category_ids || [],
    starts_at: toInput(c.starts_at), ends_at: toInput(c.ends_at),
  })

  const save = async () => {
    if (!form.code.trim() || !form.value) return toast.error('اكتب الكود وقيمة الخصم')
    setSaving(true)
    const body = {
      ...form,
      code: form.code.trim().toUpperCase(),
      value: Number(form.value),
      min_order: form.min_order === '' ? 0 : Number(form.min_order),
      max_discount: form.max_discount === '' ? null : Number(form.max_discount),
      usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
      per_customer_limit: form.per_customer_limit === '' ? null : Number(form.per_customer_limit),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    }
    delete body.id; delete body.used_count; delete body.discount_given; delete body.created_at; delete body.updated_at
    try {
      const res = await fetch(`${API}/ps/coupons${form.id ? `/${form.id}` : ''}`, { method: form.id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.message || Object.values(j.errors || {})[0]?.[0] || 'خطأ')
      toast.success(form.id ? 'تم حفظ الكوبون' : 'تم إنشاء الكوبون')
      setForm(null)
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (c) => {
    const body = { ...c, is_active: !c.is_active, brand_ids: c.brand_ids || [], category_ids: c.category_ids || [] }
    for (const k of ['id', 'used_count', 'discount_given', 'created_at', 'updated_at']) delete body[k]
    const res = await fetch(`${API}/ps/coupons/${c.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) })
    if (res.ok) load(); else toast.error('تعذّر التحديث')
  }

  const remove = async (c) => {
    if (!confirm(`حذف الكوبون ${c.code}؟`)) return
    const res = await fetch(`${API}/ps/coupons/${c.id}`, { method: 'DELETE', headers: headers() })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error('تعذّر الحذف')
    toast.success(j.deactivated ? 'الكوبون مستخدم، فأوقفناه بدل الحذف' : 'تم الحذف')
    load()
  }

  const showUsage = async (c) => {
    setUsage({ coupon: c, rows: null })
    const j = await fetch(`${API}/ps/coupons/${c.id}/redemptions`, { headers: headers() }).then((r) => r.json()).catch(() => ({ data: [] }))
    setUsage({ coupon: c, rows: j.data || [] })
  }

  const pickList = (key, id) => {
    const s = new Set(form[key])
    s.has(id) ? s.delete(id) : s.add(id)
    setForm({ ...form, [key]: [...s] })
  }

  return (
    <div dir="rtl" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}><RiCoupon3Line /> كوبونات الخصم</h1>
          <div style={{ color: '#6B7280', fontSize: 13.5, marginTop: 4 }}>تشتغل في تطبيق العملاء الجديد، والسيرفر يحسب الخصم بنفسه في كل طلب.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ ...input, width: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><RiRefreshLine /> تحديث</button>
          <button onClick={openNew} style={{ background: '#111', color: '#fff', border: 0, borderRadius: 10, padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 14 }}><RiAddLine /> كوبون جديد</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={card}><div style={label}>كوبونات فعّالة</div><div style={{ fontSize: 26, fontWeight: 700 }}>{totals.active}</div></div>
        <div style={card}><div style={label}>مرات الاستخدام</div><div style={{ fontSize: 26, fontWeight: 700 }}>{totals.uses}</div></div>
        <div style={card}><div style={label}>إجمالي الخصومات</div><div style={{ fontSize: 26, fontWeight: 700 }}>{omr(totals.given)}</div></div>
      </div>

      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><RiLoader4Line className="animate-spin" size={24} /></div>
        ) : list.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', color: '#6B7280' }}>ما فيه كوبونات للحين. اضغط "كوبون جديد".</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#FAFAFA', textAlign: 'right' }}>
                {['الكود', 'الخصم', 'الشروط', 'الصلاحية', 'الاستخدام', 'الحالة', ''].map((h) => <th key={h} style={{ padding: '12px 14px', fontWeight: 600, color: '#6B7280', fontSize: 12.5 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const st = status(c)
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #F1F1F1' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>{c.code}</div>
                      {c.description ? <div style={{ color: '#6B7280', fontSize: 12 }}>{c.description}</div> : null}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                      {c.type === 'percent' ? `${Number(c.value)}٪` : omr(c.value)}
                      {c.type === 'percent' && c.max_discount ? <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 400 }}>حد أقصى {omr(c.max_discount)}</div> : null}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#4B5563', fontSize: 12.5 }}>
                      {Number(c.min_order) > 0 ? <div>طلب أدنى {omr(c.min_order)}</div> : null}
                      {(c.brand_ids || []).length ? <div>{(c.brand_ids || []).length} براند</div> : null}
                      {(c.category_ids || []).length ? <div>{(c.category_ids || []).length} فئة</div> : null}
                      {c.per_customer_limit ? <div>{c.per_customer_limit} مرة لكل عميل</div> : null}
                      {!Number(c.min_order) && !(c.brand_ids || []).length && !(c.category_ids || []).length && !c.per_customer_limit ? '—' : null}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#4B5563' }}>
                      {c.starts_at ? <div>من {new Date(c.starts_at).toLocaleDateString('ar-OM-u-nu-latn')}</div> : null}
                      {c.ends_at ? <div>إلى {new Date(c.ends_at).toLocaleDateString('ar-OM-u-nu-latn')}</div> : <div>بدون نهاية</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => showUsage(c)} style={{ background: 'none', border: 0, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 14 }}>
                        {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                      </button>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>{omr(c.discount_given)}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => toggle(c)} title="تشغيل / إيقاف" style={{ border: 0, cursor: 'pointer', background: st.bg, color: st.color, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>{st.label}</button>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button title="نسخ" onClick={() => { navigator.clipboard.writeText(c.code); toast.success('نسخت الكود') }} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 6 }}><RiFileCopyLine size={17} /></button>
                      <button title="تعديل" onClick={() => openEdit(c)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 6 }}><RiEdit2Line size={17} /></button>
                      <button title="حذف" onClick={() => remove(c)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 6, color: '#B3261E' }}><RiDeleteBinLine size={17} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {form ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', justifyContent: 'flex-start', zIndex: 60 }} onClick={() => setForm(null)}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', height: '100%', background: '#fff', overflowY: 'auto', padding: 24, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>{form.id ? `تعديل ${form.code}` : 'كوبون جديد'}</h2>
              <button onClick={() => setForm(null)} style={{ background: 'none', border: 0, cursor: 'pointer' }}><RiCloseLine size={22} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><span style={label}>الكود (حروف إنجليزية وأرقام)</span><input style={{ ...input, fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, '') })} placeholder="مثال: EID20" /></div>
              <div><span style={label}>وصف داخلي (اختياري)</span><input style={input} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: عرض العيد" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={label}>نوع الخصم</span>
                  <select style={input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="percent">نسبة ٪</option>
                    <option value="fixed">مبلغ ثابت (ر.ع.)</option>
                  </select>
                </div>
                <div><span style={label}>{form.type === 'percent' ? 'النسبة ٪' : 'المبلغ (ر.ع.)'}</span><input type="number" step="0.001" style={input} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={label}>الحد الأدنى للطلب (ر.ع.)</span><input type="number" step="0.001" style={input} value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} placeholder="بدون" /></div>
                <div><span style={label}>أقصى خصم (ر.ع.)</span><input type="number" step="0.001" style={input} value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} placeholder="بدون" disabled={form.type === 'fixed'} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={label}>عدد مرات الاستخدام (للكل)</span><input type="number" style={input} value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} placeholder="بدون حد" /></div>
                <div><span style={label}>مرات لكل عميل</span><input type="number" style={input} value={form.per_customer_limit} onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value })} placeholder="بدون حد" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={label}>يبدأ</span><input type="datetime-local" style={input} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><span style={label}>ينتهي</span><input type="datetime-local" style={input} value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <div>
                <span style={label}>براندات محددة (فاضي = كل البراندات)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {brands.map((b) => {
                    const on = form.brand_ids.includes(b.id)
                    return <button key={b.id} type="button" onClick={() => pickList('brand_ids', b.id)} style={{ border: `1px solid ${on ? '#111' : '#E5E7EB'}`, background: on ? '#111' : '#fff', color: on ? '#fff' : '#111', borderRadius: 999, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{(b.name_en || b.name_ar || '').toUpperCase()}</button>
                  })}
                </div>
              </div>
              <div>
                <span style={label}>فئات محددة (فاضي = كل الفئات)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cats.map((c) => {
                    const on = form.category_ids.includes(c.id)
                    return <button key={c.id} type="button" onClick={() => pickList('category_ids', c.id)} style={{ border: `1px solid ${on ? '#111' : '#E5E7EB'}`, background: on ? '#111' : '#fff', color: on ? '#fff' : '#111', borderRadius: 999, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{c.name_ar || c.name_en}</button>
                  })}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> الكوبون فعّال
              </label>
              <button onClick={save} disabled={saving} style={{ background: '#111', color: '#fff', border: 0, borderRadius: 10, padding: '13px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? 'جاري الحفظ…' : 'حفظ'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {usage ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setUsage(null)}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 94vw)', maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>استخدامات {usage.coupon.code}</h3>
              <button onClick={() => setUsage(null)} style={{ background: 'none', border: 0, cursor: 'pointer' }}><RiCloseLine size={20} /></button>
            </div>
            {!usage.rows ? <RiLoader4Line className="animate-spin" /> : usage.rows.length === 0 ? <div style={{ color: '#6B7280' }}>ما انستخدم للحين.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead><tr style={{ textAlign: 'right', color: '#6B7280' }}><th style={{ padding: 8 }}>الطلب</th><th style={{ padding: 8 }}>العميل</th><th style={{ padding: 8 }}>الخصم</th><th style={{ padding: 8 }}>التاريخ</th></tr></thead>
                <tbody>
                  {usage.rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #F1F1F1' }}>
                      <td style={{ padding: 8, fontFamily: 'monospace' }}>{r.order_number || '—'}</td>
                      <td style={{ padding: 8 }}>{r.customer || r.phone || '—'}</td>
                      <td style={{ padding: 8 }}>{omr(r.amount)}</td>
                      <td style={{ padding: 8 }}>{r.created_at ? new Date(r.created_at).toLocaleString('ar-OM-u-nu-latn') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
