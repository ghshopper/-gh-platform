import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiMailSendLine, RiDownload2Line, RiLoader4Line } from 'react-icons/ri'
import api from '../services/api'

/** The monthly report e-mail: who gets it (1st of each month, 9:00), send now, download the PDF. */
export default function MonthlyReportBox() {
  const [emails, setEmails] = useState('')
  const [to, setTo] = useState([])
  const [busy, setBusy] = useState('')
  const last = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })()
  const [month, setMonth] = useState(last)
  useEffect(() => { api.get('/admin/monthly-report').then((r) => { setEmails(r.data.emails || ''); setTo(r.data.recipients || []) }).catch(() => {}) }, [])
  const saveEmails = async () => {
    setBusy('save')
    try { const r = await api.put('/admin/monthly-report', { emails }); setTo(r.data.recipients || []); toast.success('انحفظ') } catch { toast.error('ما انحفظ') } finally { setBusy('') }
  }
  const send = async () => {
    setBusy('send')
    try { const r = await api.post('/admin/monthly-report/send', { month }); toast.success('انرسل إلى ' + (r.data.to || []).join('، ')) } catch (e) { toast.error(e.response?.data?.message || 'ما انرسل') } finally { setBusy('') }
  }
  const pdf = async () => {
    setBusy('pdf')
    try {
      const r = await api.get('/admin/monthly-report/pdf', { params: { month }, responseType: 'blob' })
      const url = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = url; a.download = `GH-Shopper-${month}.pdf`; a.click(); URL.revokeObjectURL(url)
    } catch { toast.error('تعذر') } finally { setBusy('') }
  }
  return (
    <div className="card mrb">
      <div className="mrb-top">
        <div>
          <h3>التقرير الشهري بالإيميل</h3>
          <p>يوصل كل أول الشهر الساعة 9 الصبح: المبيعات والربح ومقارنة بالشهر اللي قبله، وأفضل البراندات والعملاء والحملات، مع ملف PDF.</p>
        </div>
      </div>
      <div className="mrb-row">
        <input className="input" dir="ltr" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="الإيميلات (افصل بينها بفاصلة) — فاضي = إيميل المدير العام" />
        <button className="btn btn-ghost btn-sm" disabled={busy === 'save'} onClick={saveEmails}>حفظ</button>
      </div>
      <div className="mrb-to">يوصل إلى: {to.length ? to.join('، ') : '— (ما فيه إيميل)'}</div>
      <div className="mrb-row">
        <input className="input" type="month" value={month} max={last} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 180 }} />
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={pdf}>{busy === 'pdf' ? <RiLoader4Line className="spin" /> : <RiDownload2Line />} حمّل PDF</button>
        <button className="btn btn-primary btn-sm" disabled={!!busy || !to.length} onClick={send}>{busy === 'send' ? <RiLoader4Line className="spin" /> : <RiMailSendLine />} أرسله الحين</button>
      </div>
      <style>{`
.mrb{padding:18px 20px;margin-top:16px}
.mrb h3{margin:0;font-size:15px;font-weight:700}
.mrb p{margin:4px 0 12px;font-size:12.5px;color:var(--text-secondary)}
.mrb-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.mrb-row .input{flex:1;min-width:200px;height:38px;padding:0 10px}
.mrb-to{font-size:12px;color:var(--text-light);margin-bottom:12px}
`}</style>
    </div>
  )
}
