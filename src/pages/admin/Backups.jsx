import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiDatabase2Line, RiDownload2Line, RiLoader4Line } from 'react-icons/ri'
import api from '../../services/api'

const API = import.meta.env.VITE_API_URL
const mb = (b) => (b / 1048576 >= 1 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const when = (s) => (s ? new Date(s).toLocaleString('ar-OM', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')

// Daily copy of the whole database: the last 7 kept on the server, and e-mailed.
export default function Backups() {
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => api.get('/admin/backups').then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { load() }, [])

  const now = async () => {
    setBusy(true)
    try { await api.post('/admin/backups', {}, { timeout: 300000 }); toast.success('انسوت نسخة جديدة'); load() } catch (e) { toast.error(e.response?.data?.message || 'ما انسوت') } finally { setBusy(false) }
  }
  const download = async (name) => {
    try {
      const r = await fetch(`${API}/admin/backups/${name}`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
      if (!r.ok) throw new Error()
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch { toast.error('ما قدرنا ننزلها') }
  }
  const toggleMail = async () => {
    try { await api.put('/admin/backups/settings', { email: !d.settings.email }); load() } catch { toast.error('تعذر') }
  }

  if (!d) return <div className="page"><div className="gh-skel" style={{ height: 300 }} /></div>
  const s = d.settings
  return (
    <div className="page" dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>النسخ الاحتياطية</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>نسخة من كل البيانات (الطلبات، العملاء، المنتجات…) تنسوي بروحها كل يوم بعد ٣ الفجر. آخر ٧ نسخ تنحفظ هنا.</p>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={now}>{busy ? <RiLoader4Line className="spin" /> : <RiDatabase2Line />} خذ نسخة الحين</button>
      </div>

      <div className="card" style={{ padding: '16px 20px', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b>أرسل النسخة اليومية على الإيميل</b>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            عشان تكون عندك نسخة بعيد عن الاستضافة. توصل: <span dir="ltr">{d.recipients.join('، ') || '—'}</span> (نفس إيميلات التقرير الشهري).
          </div>
        </div>
        <button className={`gc-toggle ${s.email ? 'on' : ''}`} onClick={toggleMail} aria-label="إيميل" style={{ width: 58, height: 32, borderRadius: 99, border: 0, background: s.email ? '#5C0B16' : '#D9D5CF', position: 'relative', cursor: 'pointer' }}>
          <i style={{ position: 'absolute', top: 3, insetInlineStart: s.email ? 29 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
        </button>
      </div>

      {s.last_error && <div className="card" style={{ padding: '12px 16px', marginBottom: 14, color: '#B42318', fontSize: 13.5 }}>آخر محاولة ما نجحت: {s.last_error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {d.files.length === 0 ? <p style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', margin: 0 }}>ما فيه نسخ للحين. اضغط «خذ نسخة الحين».</p> : d.files.map((f, i) => (
          <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: i ? '1px solid var(--border)' : 0 }}>
            <RiDatabase2Line size={20} color="#5C0B16" />
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 14 }}>{when(f.at)}</b>
              <div style={{ fontSize: 12, color: 'var(--text-light)' }} dir="ltr">{f.name} · {mb(f.size)}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => download(f.name)}><RiDownload2Line /> تنزيل</button>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 12 }}>للاسترجاع وقت الحاجة: cPanel ← phpMyAdmin ← اختر قاعدة البيانات ← Import ← اختر الملف. (أو كلّمني وأسويها معك.) الملف فيه بيانات العملاء، فلا تشاركه.</p>
    </div>
  )
}
