import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiArrowDownLine, RiArrowUpLine, RiDeleteBinLine, RiPencilLine, RiQuestionLine } from 'react-icons/ri'
import api from '../../services/api'

const EMPTY = { topic_ar: '', topic_en: '', question_ar: '', question_en: '', answer_ar: '', answer_en: '', is_active: true }

/** Frequently asked questions shown in the app and on the website. */
export default function Faqs() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const r = await api.get('/admin/faqs')
      setRows(r.data.data || [])
    } catch {
      toast.error('تعذّر تحميل الأسئلة')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const topics = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => { if (!m.has(r.topic_ar)) m.set(r.topic_ar, []); m.get(r.topic_ar).push(r) })
    return [...m.entries()]
  }, [rows])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { ...edit, is_active: !!edit.is_active }
      if (edit.id) await api.put(`/admin/faqs/${edit.id}`, body)
      else await api.post('/admin/faqs', body)
      toast.success('انحفظ')
      setEdit(null)
      load()
    } catch (x) {
      toast.error(x.response?.data?.message || 'تعذّر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r) => {
    if (!window.confirm(`تحذف السؤال «${r.question_ar}»؟`)) return
    await api.delete(`/admin/faqs/${r.id}`).catch(() => toast.error('تعذّر الحذف'))
    load()
  }

  // Move a question up or down inside its topic.
  const move = async (list, i, dir) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i], b = list[j]
    await api.post('/admin/faqs/reorder', { items: [{ id: a.id, sort_order: b.sort_order }, { id: b.id, sort_order: a.sort_order === b.sort_order ? b.sort_order + dir : a.sort_order }] })
    load()
  }

  const field = (k, label, opts = {}) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#6B7280', marginBottom: 6 }}>{label}</span>
      {opts.area
        ? <textarea rows={4} dir={opts.ltr ? 'ltr' : 'rtl'} value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} required={opts.required} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />
        : <input dir={opts.ltr ? 'ltr' : 'rtl'} list={opts.list} value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} required={opts.required} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />}
    </label>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>الأسئلة الشائعة</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>تظهر في التطبيق (حسابي ← الأسئلة الشائعة) وفي الموقع ({rows.length} سؤال)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit({ ...EMPTY })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RiAddLine /> سؤال جديد</button>
      </div>

      {loading ? <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>جاري التحميل…</div> : topics.map(([topic, list]) => (
        <div key={topic} className="card" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', fontWeight: 800, background: '#FAF7F2', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RiQuestionLine color="#B08A45" /> {topic} <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: 13 }}>· {list.length}</span>
            <button className="btn btn-ghost" style={{ marginInlineStart: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => setEdit({ ...EMPTY, topic_ar: topic, topic_en: list[0]?.topic_en || '' })}><RiAddLine /> سؤال في هذا الموضوع</button>
          </div>
          {list.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 18px', borderBottom: '1px solid #F3F4F6', opacity: Number(r.is_active) ? 1 : 0.5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.question_ar}{Number(r.is_active) ? '' : ' (مخفي)'}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, lineHeight: 1.7 }}>{r.answer_ar}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost" title="فوق" onClick={() => move(list, i, -1)} disabled={i === 0} style={{ padding: 6 }}><RiArrowUpLine /></button>
                <button className="btn btn-ghost" title="تحت" onClick={() => move(list, i, 1)} disabled={i === list.length - 1} style={{ padding: 6 }}><RiArrowDownLine /></button>
                <button className="btn btn-ghost" title="تعديل" onClick={() => setEdit({ ...r, is_active: !!Number(r.is_active) })} style={{ padding: 6 }}><RiPencilLine /></button>
                <button className="btn btn-ghost" title="حذف" onClick={() => remove(r)} style={{ padding: 6, color: '#B42318' }}><RiDeleteBinLine /></button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {edit && (
        <div onClick={() => !saving && setEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,12,10,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} style={{ background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px' }}>{edit.id ? 'تعديل السؤال' : 'سؤال جديد'}</h3>
            <datalist id="faq-topics">{topics.map(([t]) => <option key={t} value={t} />)}</datalist>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {field('topic_ar', 'الموضوع (عربي)', { required: true, list: 'faq-topics' })}
              {field('topic_en', 'Topic (English)', { ltr: true })}
            </div>
            {field('question_ar', 'السؤال (عربي)', { required: true })}
            {field('answer_ar', 'الجواب (عربي)', { required: true, area: true })}
            {field('question_en', 'Question (English)', { ltr: true })}
            {field('answer_en', 'Answer (English)', { ltr: true, area: true })}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: '4px 0 16px' }}>
              <input type="checkbox" checked={!!edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> يظهر للعملاء
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'يحفظ…' : 'حفظ'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
