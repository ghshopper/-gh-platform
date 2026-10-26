import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  RiAddLine, RiCloseLine, RiDeleteBinLine, RiDownload2Line, RiEditLine, RiEyeLine, RiFileExcel2Line, RiFilePdf2Line,
  RiFileTextLine, RiFileWord2Line, RiFolder3Line, RiImageLine, RiLoader4Line, RiSearchLine, RiUploadCloud2Line,
} from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'

const API = import.meta.env.VITE_API_URL
const size = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const day = (s) => (s ? new Date(s).toLocaleDateString('ar-OM', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const iconFor = (name = '') => {
  const e = name.split('.').pop().toLowerCase()
  if (e === 'pdf') return RiFilePdf2Line
  if (['jpg', 'png', 'webp', 'heic', 'heif'].includes(e)) return RiImageLine
  if (['doc', 'docx'].includes(e)) return RiFileWord2Line
  if (['xls', 'xlsx'].includes(e)) return RiFileExcel2Line
  return RiFileTextLine
}
const canView = (name = '') => ['pdf', 'jpg', 'png', 'webp'].includes(name.split('.').pop().toLowerCase())

function Expiry({ d }) {
  if (d.days_left === null || d.days_left === undefined) return null
  if (d.days_left < 0) return <span className="doc-badge bad">منتهي من {day(d.expires_on)}</span>
  if (d.days_left <= 30) return <span className="doc-badge warn">ينتهي بعد {d.days_left === 0 ? 'اليوم' : `${d.days_left} يوم`}</span>
  return <span className="doc-badge">ساري لين {day(d.expires_on)}</span>
}

// «ملفات الشركة»: the company's own papers in one place — CR, licences, tax card, bank, contracts…
export default function Documents() {
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const load = () => api.get('/admin/documents').then((r) => setData(r.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { load() }, [])

  const fetchFile = async (d) => {
    const r = await fetch(`${API}/admin/documents/${d.id}/file${canView(d.file_name) ? '?inline=1' : ''}`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
    if (!r.ok) throw new Error()
    return URL.createObjectURL(await r.blob())
  }
  const view = async (d) => {
    const w = window.open('', '_blank')
    try {
      const url = await fetchFile(d)
      if (w) w.location.href = url; else window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { w?.close(); toast.error('ما قدرنا نفتح الملف') }
  }
  const download = async (d) => {
    try {
      const url = await fetchFile(d)
      const a = document.createElement('a'); a.href = url; a.download = d.file_name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch { toast.error('ما قدرنا ننزله') }
  }
  const remove = async (d) => {
    if (!window.confirm(`تحذف «${d.title}»؟ الملف بينحذف نهائياً.`)) return
    try { await api.delete(`/admin/documents/${d.id}`); toast.success('انحذف'); load() } catch { toast.error('ما انحذف') }
  }

  const openNew = (category = 'cr') => setForm({ category, title: '', number: '', issued_on: '', expires_on: '', notes: '', file: null })
  const openEdit = (d) => setForm({ ...d, number: d.number || '', issued_on: d.issued_on || '', expires_on: d.expires_on || '', notes: d.notes || '', file: null })

  const save = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('اكتب اسم الملف')
    if (!form.id && !form.file) return toast.error('اختر الملف')
    const fd = new FormData()
    for (const k of ['category', 'title', 'number', 'issued_on', 'expires_on', 'notes']) fd.append(k, form[k] || '')
    if (form.file) fd.append('file', form.file)
    setBusy(true)
    try {
      await api.post(form.id ? `/admin/documents/${form.id}` : '/admin/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
      toast.success(form.id ? 'انحفظ' : 'انرفع الملف')
      setForm(null); load()
    } catch (err) {
      const er = err.response?.data
      toast.error(er?.errors ? Object.values(er.errors)[0][0] : er?.message || 'ما انرفع')
    } finally { setBusy(false) }
  }

  const groups = useMemo(() => {
    if (!data) return []
    const s = q.trim().toLowerCase()
    const docs = data.documents.filter((d) => !s || [d.title, d.number, d.notes, d.file_name].some((v) => (v || '').toLowerCase().includes(s)))
    return data.categories.map((c) => ({ ...c, docs: docs.filter((d) => d.category === c.key) })).filter((g) => g.docs.length || !s)
  }, [data, q])

  if (!data) return <div className="page"><div className="gh-skel" style={{ height: 300 }} /></div>
  const soon = data.documents.filter((d) => d.days_left !== null && d.days_left <= 30)

  return (
    <div className="page" dir="rtl">
      <div className="doc-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>ملفات الشركة</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>السجل التجاري والتصاريح والبطاقة الضريبية وكل أوراق الشركة في مكان واحد، جاهزة وقت ما تحتاجها.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openNew()}><RiAddLine /> رفع ملف</button>
      </div>

      {soon.length > 0 && (
        <div className="card doc-alert">
          <b>انتبه للتواريخ</b>
          {soon.map((d) => <div key={d.id}>{d.title} — <Expiry d={d} /></div>)}
        </div>
      )}

      {data.documents.length > 0 && (
        <div className="doc-search">
          <RiSearchLine />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر باسم الملف أو الرقم" />
        </div>
      )}

      {data.documents.length === 0 ? (
        <div className="card"><Empty icon={RiFolder3Line} title="ما فيه ملفات للحين" hint="ابدأ بالسجل التجاري، وبعده التصاريح والبطاقة الضريبية." action="رفع ملف" onAction={() => openNew()} /></div>
      ) : groups.map((g) => (
        <section key={g.key} className="doc-group">
          <div className="doc-group-head">
            <h3>{g.label} <small>{g.docs.length || ''}</small></h3>
            <button className="btn btn-ghost btn-sm" onClick={() => openNew(g.key)}><RiAddLine /> إضافة</button>
          </div>
          {g.docs.length === 0 ? <div className="doc-none">ما فيه شي هنا</div> : (
            <div className="doc-grid">
              {g.docs.map((d) => {
                const Ic = iconFor(d.file_name)
                return (
                  <div key={d.id} className="card doc-card">
                    <button className="doc-main" onClick={() => view(d)} title="فتح">
                      <Ic size={26} className="doc-ic" />
                      <div className="doc-txt">
                        <b>{d.title}</b>
                        {d.number && <span dir="ltr">{d.number}</span>}
                        <Expiry d={d} />
                        {d.notes && <em>{d.notes}</em>}
                        <small><bdi>{d.file_name}</bdi> · {size(d.size)}</small>
                      </div>
                    </button>
                    <div className="doc-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => view(d)}><RiEyeLine /> {canView(d.file_name) ? 'عرض' : 'فتح'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => download(d)}><RiDownload2Line /> تنزيل</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)} aria-label="تعديل"><RiEditLine /></button>
                      <button className="btn btn-ghost btn-sm doc-del" onClick={() => remove(d)} aria-label="حذف"><RiDeleteBinLine /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ))}

      <p className="doc-foot">الملفات محفوظة في مكان خاص بالسيرفر، ما أحد يقدر يفتحها إلا المدراء من هنا. النسخة الاحتياطية اليومية للبيانات ما تشمل هالملفات، فخل عندك نسخة منها بعد.</p>

      {form && (
        <div className="modal-backdrop" onMouseDown={() => !busy && setForm(null)}>
          <form className="modal-content" style={{ maxWidth: 480, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
            <div className="modal-header">
              <h3 className="modal-title">{form.id ? 'تعديل الملف' : 'رفع ملف'}</h3>
              <button type="button" className="close-btn" onClick={() => setForm(null)} aria-label="إغلاق"><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body doc-form">
              <label>القسم
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {data.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              <label>اسم الملف
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً: السجل التجاري" autoFocus />
              </label>
              <label>الرقم (اختياري)
                <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="رقم السجل أو الترخيص أو الرقم الضريبي" dir="ltr" />
              </label>
              <div className="doc-two">
                <label>تاريخ الإصدار
                  <input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
                </label>
                <label>تاريخ الانتهاء
                  <input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
                </label>
              </div>
              <label>ملاحظات
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <button type="button" className="doc-drop" onClick={() => fileRef.current?.click()}>
                <RiUploadCloud2Line size={24} />
                {form.file ? <b>{form.file.name}</b> : <span>{form.id ? `الملف الحالي: ${form.file_name} — اضغط لتبديله` : 'اختر الملف (PDF أو صورة أو Word أو Excel، لين 25 ميغا)'}</span>}
              </button>
              <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <RiLoader4Line className="spin" /> : null} {form.id ? 'حفظ' : 'رفع'}</button>
            </div>
          </form>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.doc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.doc-alert{padding:12px 16px;margin:0 0 14px;border:1px solid #FDE68A;display:flex;flex-direction:column;gap:6px;font-size:13.5px}
.doc-search{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:10px;padding:0 12px;margin-bottom:16px;background:var(--bg-card,#fff);max-width:420px}
.doc-search input{border:0;outline:0;background:none;padding:10px 0;flex:1;font-family:inherit;font-size:14px;color:inherit}
.doc-group{margin-bottom:22px}
.doc-group-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.doc-group-head h3{margin:0;font-size:15px}
.doc-group-head small{color:var(--text-secondary);font-weight:400;margin-inline-start:4px}
.doc-none{font-size:13px;color:var(--text-light);padding:10px 2px;border-top:1px dashed var(--border)}
.doc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.doc-card{margin:0;padding:0;display:flex;flex-direction:column;overflow:hidden}
.doc-main{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border:0;background:none;text-align:inherit;font-family:inherit;color:inherit;cursor:pointer;flex:1}
.doc-ic{color:#5C0B16;flex-shrink:0;margin-top:2px}
.doc-txt{display:flex;flex-direction:column;gap:3px;min-width:0}
.doc-txt b{font-size:14.5px}
.doc-txt span{font-size:13px;color:var(--text-secondary)}
.doc-txt em{font-style:normal;font-size:12.5px;color:var(--text-secondary)}
.doc-txt small{font-size:11.5px;color:var(--text-light);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-badge{display:inline-block;align-self:flex-start;font-size:11.5px;padding:2px 8px;border-radius:99px;background:#ECFDF3;color:#047857}
.doc-badge.warn{background:#FFFAEB;color:#B45309}
.doc-badge.bad{background:#FEF3F2;color:#B42318}
.doc-actions{display:flex;gap:2px;border-top:1px solid var(--border);padding:4px 8px}
.doc-del{margin-inline-start:auto;color:#B42318}
.doc-foot{font-size:12.5px;color:var(--text-secondary);margin-top:6px;line-height:1.8}
.doc-form{display:flex;flex-direction:column;gap:12px}
.doc-form label{display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--text-secondary)}
.doc-form input,.doc-form select,.doc-form textarea{border:1px solid var(--border);border-radius:8px;padding:9px 10px;font-family:inherit;font-size:14px;background:var(--bg-card,#fff);color:var(--text-primary,inherit)}
.doc-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.doc-drop{display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px;border:1.5px dashed var(--border);border-radius:10px;background:none;cursor:pointer;font-family:inherit;font-size:13px;color:var(--text-secondary);text-align:center}
.doc-drop b{color:var(--text-primary,inherit);word-break:break-all}
@media (max-width:600px){.doc-two{grid-template-columns:1fr}}
`
