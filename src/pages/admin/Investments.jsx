import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiCloseLine, RiHandCoinLine, RiArrowRightLine, RiDeleteBinLine, RiEditLine } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'

// Internal investment: a partner puts money in (it buys the instant-delivery
// stock), gets a monthly % of his amount, and each month chooses to take it or
// add it to his amount.
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const monthName = (ym) => { if (!ym) return ''; const [y, m] = ym.split('-'); return `${MONTHS[Number(m) - 1]} ${y}` }
const day = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-OM', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Muscat' })
const TYPE = {
  deposit: ['إيداع', '#047857'],
  withdraw: ['سحب من المبلغ', '#B42318'],
  reinvest: ['ربح انضاف للمبلغ', '#047857'],
}
const STATUS = {
  pending: ['ينتظر قرارك', '#B45309', '#FFFBEB'],
  paid: ['انصرف له', '#6E6A66', '#F3F1EE'],
  reinvested: ['انضاف لمبلغه', '#047857', '#ECFDF5'],
}

export default function Investments() {
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(null) // investor id
  const [form, setForm] = useState(null) // new / edit investor
  const load = () => api.get('/admin/investments').then((r) => setD(r.data)).catch((e) => toast.error(e.response?.data?.message || 'تعذر التحميل'))
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      if (form.id) await api.put(`/admin/investments/${form.id}`, { name: form.name, phone: form.phone || null, monthly_pct: Number(form.monthly_pct), notes: form.notes || null })
      else await api.post('/admin/investments', { ...form, monthly_pct: Number(form.monthly_pct), amount: form.amount ? Number(form.amount) : null })
      toast.success('انحفظ')
      setForm(null)
      load()
    } catch (er) { toast.error(er.response?.data?.message || 'ما انحفظ') }
  }

  if (open) return <Investor id={open} onBack={() => { setOpen(null); load() }} onEdit={(f) => setForm(f)} formEl={form && <InvestorForm form={form} setForm={setForm} save={save} />} />

  const t = d?.totals
  const s = d?.stock
  return (
    <div className="page inv" dir="rtl">
      <div className="inv-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>الاستثمار الداخلي</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>مبالغ الشركاء اللي تشتري فيها بضاعة التسليم الفوري، وربحهم الشهري.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ name: '', phone: '', monthly_pct: 10, amount: '', date: today(), notes: '' })}><RiAddLine /> مستثمر جديد</button>
      </div>

      {!d ? <div className="gh-skel" style={{ height: 300 }} /> : (
        <>
          <div className="inv-cards">
            <div className="card"><small>مجموع مبالغ المستثمرين</small><b>{money(t.capital)}</b><i>ر.ع</i></div>
            <div className="card warn"><small>أرباح تنتظر قرارك</small><b>{money(t.pending)}</b><i>ر.ع</i></div>
            <div className="card"><small>أرباح هالشهر (تستحق آخر الشهر)</small><b>{money(t.this_month)}</b><i>ر.ع</i></div>
            <div className="card"><small>انصرف لهم لين الحين</small><b>{money(t.paid_out)}</b><i>ر.ع</i></div>
          </div>

          <div className="card inv-stock">
            <div><small>بضاعة التسليم الفوري الحين (بسعر البيع)</small><b>{money(s.value)} ر.ع</b><span>{s.pieces} قطعة</span></div>
            <div><small>مبيعات التسليم الفوري هالشهر</small><b>{money(s.sales_this_month)} ر.ع</b></div>
            <div><small>أرباح المستثمرين هالشهر</small><b>{money(t.this_month)} ر.ع</b>
              {t.this_month > 0 && <span className={s.sales_this_month >= t.this_month ? 'ok' : 'bad'}>{s.sales_this_month >= t.this_month ? 'المبيعات تغطيها' : 'المبيعات للحين أقل منها'}</span>}
            </div>
          </div>

          {d.investors.length === 0 ? (
            <div className="card"><Empty icon={RiHandCoinLine} title="ما فيه مستثمرين للحين" hint="اضغط «مستثمر جديد» وسجّل المبلغ وتاريخ ما استلمته." /></div>
          ) : (
            <div className="inv-list">
              {d.investors.map((i) => (
                <button key={i.id} className={`card inv-row ${i.status !== 'active' ? 'off' : ''}`} onClick={() => setOpen(i.id)}>
                  <div className="inv-name"><b>{i.name}</b><small>{i.monthly_pct}% بالشهر{i.since ? ` · من ${day(i.since)}` : ''}{i.status !== 'active' ? ' · منتهي' : ''}</small></div>
                  <div className="inv-num"><small>مبلغه</small><b>{money(i.capital)}</b></div>
                  <div className="inv-num"><small>ربح هالشهر</small><b>{money(i.this_month)}</b></div>
                  <div className="inv-num"><small>انصرف له</small><b>{money(i.paid_out)}</b></div>
                  {i.pending > 0 ? <span className="badge" style={{ color: '#B45309', background: '#FFFBEB' }}>ينتظر قرارك: {money(i.pending)}</span> : <span />}
                </button>
              ))}
            </div>
          )}
          <p className="inv-foot">الربح ينحسب على المبلغ اللي عنده أول كل شهر. الفلوس اللي تجي في نص الشهر تبدأ تربح من الشهر اللي بعده (إلا لو جات يوم ١). كل شهر يخلص، ربحه يطلع هنا وتختار: صرفته له، أو انضاف لمبلغه ويبدأ يربح من الشهر الجاي.</p>
        </>
      )}
      {form && <InvestorForm form={form} setForm={setForm} save={save} />}
      <style>{CSS}</style>
    </div>
  )
}

function InvestorForm({ form, setForm, save }) {
  return (
    <div className="modal-backdrop" onMouseDown={() => setForm(null)}>
      <form className="modal-content" style={{ maxWidth: 480, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="modal-header">
          <h3 className="modal-title">{form.id ? 'تعديل المستثمر' : 'مستثمر جديد'}</h3>
          <button type="button" className="close-btn" onClick={() => setForm(null)} aria-label="إغلاق"><RiCloseLine size={24} /></button>
        </div>
        <div className="modal-body inv-form">
          <label>الاسم<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>رقم الجوال<input className="input" dir="ltr" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>الربح الشهري %<input className="input" type="number" min="0" max="100" step="0.5" required value={form.monthly_pct} onChange={(e) => setForm({ ...form, monthly_pct: e.target.value })} /></label>
          {!form.id && <div className="inv-two">
            <label>المبلغ (ر.ع)<input className="input" type="number" min="0" step="0.001" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label>تاريخ الاستلام<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          </div>}
          <label>ملاحظات<textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          {form.id && <small style={{ color: 'var(--text-secondary)' }}>تغيير النسبة يطبّق على الأشهر اللي للحين تنتظر قرارك والجاية، مب على اللي انصرفت أو انضافت.</small>}
          <button className="btn btn-primary" type="submit">حفظ</button>
        </div>
      </form>
    </div>
  )
}

function Investor({ id, onBack, onEdit, formEl }) {
  const [d, setD] = useState(null)
  const [mv, setMv] = useState(null) // money in / out form
  const [busy, setBusy] = useState(false)
  const load = () => api.get(`/admin/investments/${id}`).then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { load() }, [id, formEl]) // eslint-disable-line react-hooks/exhaustive-deps

  const settle = async (e, action) => {
    setBusy(true)
    try { await api.post(`/admin/investments/${id}/entries/${e.id}/settle`, { action }); toast.success(action === 'pay' ? 'انسجّل إنه انصرف' : action === 'reinvest' ? 'انضاف لمبلغه' : 'رجع ينتظر قرارك'); await load() } catch { toast.error('تعذر') } finally { setBusy(false) }
  }
  const addMove = async (ev) => {
    ev.preventDefault()
    setBusy(true)
    try { await api.post(`/admin/investments/${id}/entries`, { ...mv, amount: Number(mv.amount) }); toast.success('انسجّل'); setMv(null); await load() } catch (er) { toast.error(er.response?.data?.message || 'تعذر') } finally { setBusy(false) }
  }
  const remove = async (e) => {
    if (!window.confirm('نشيل هالحركة؟')) return
    try { await api.delete(`/admin/investments/${id}/entries/${e.id}`); toast.success('انشالت'); await load() } catch (er) { toast.error(er.response?.data?.message || 'تعذر') }
  }
  const close = async () => {
    const inv = d.investor
    const next = inv.status === 'active' ? 'closed' : 'active'
    if (next === 'closed' && !window.confirm('ننهي استثماره؟ ما بتنحسب له أرباح جديدة. (سجّل سحب مبلغه قبل)')) return
    await api.put(`/admin/investments/${id}`, { status: next })
    load()
  }

  if (!d) return <div className="page inv" dir="rtl"><div className="gh-skel" style={{ height: 300 }} /><style>{CSS}</style></div>
  const i = d.investor
  const pending = d.entries.filter((e) => e.type === 'profit' && e.status === 'pending').sort((a, b) => a.month.localeCompare(b.month))
  return (
    <div className="page inv" dir="rtl">
      <button className="inv-back" onClick={onBack}><RiArrowRightLine /> كل المستثمرين</button>
      <div className="inv-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>{i.name}</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{i.monthly_pct}% بالشهر{i.phone ? ` · ${i.phone}` : ''}{i.status !== 'active' ? ' · منتهي' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setMv({ type: 'deposit', amount: '', date: today(), note: '' })}><RiAddLine /> إيداع</button>
          <button className="btn btn-ghost" onClick={() => setMv({ type: 'withdraw', amount: '', date: today(), note: '' })}>سحب من مبلغه</button>
          <button className="btn btn-ghost" onClick={() => onEdit({ id: i.id, name: i.name, phone: i.phone, monthly_pct: i.monthly_pct, notes: i.notes })}><RiEditLine /> تعديل</button>
          <button className="btn btn-ghost" onClick={close}>{i.status === 'active' ? 'إنهاء' : 'إرجاعه'}</button>
        </div>
      </div>

      <div className="inv-cards">
        <div className="card"><small>مبلغه الحين</small><b>{money(i.capital)}</b><i>ر.ع</i></div>
        <div className="card"><small>ربح هالشهر (يستحق آخر الشهر)</small><b>{money(i.this_month)}</b><i>ر.ع</i></div>
        <div className="card"><small>انصرف له لين الحين</small><b>{money(i.paid_out)}</b><i>ر.ع</i></div>
        <div className="card"><small>انضاف لمبلغه من أرباحه</small><b>{money(i.reinvested)}</b><i>ر.ع</i></div>
      </div>

      {pending.length > 0 && (
        <div className="card inv-pending">
          <h3>أرباح تنتظر قرارك</h3>
          {pending.map((e) => (
            <div key={e.id} className="inv-p">
              <div><b>{monthName(e.month)}</b><small>{money(e.base)} × {Number(e.pct)}%</small></div>
              <b className="inv-amt">{money(e.amount)} ر.ع</b>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => settle(e, 'pay')}>صرفته له</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => settle(e, 'reinvest')}>أضفه لمبلغه</button>
            </div>
          ))}
        </div>
      )}

      <div className="card inv-hist">
        <h3>كشف الحساب</h3>
        <table>
          <thead><tr><th>التاريخ</th><th>الحركة</th><th>المبلغ</th><th>ملاحظة</th><th /></tr></thead>
          <tbody>
            {d.entries.map((e) => (
              <tr key={e.id}>
                <td>{day(e.effective_date)}</td>
                <td>
                  {e.type === 'profit'
                    ? <>ربح {monthName(e.month)} <span className="badge" style={{ color: STATUS[e.status]?.[1], background: STATUS[e.status]?.[2] }}>{STATUS[e.status]?.[0]}</span></>
                    : <span style={{ color: TYPE[e.type]?.[1] }}>{TYPE[e.type]?.[0]}</span>}
                </td>
                <td dir="ltr" style={{ textAlign: 'right' }}>{e.type === 'withdraw' ? '−' : ''}{money(e.amount)}</td>
                <td className="inv-note">{e.type === 'reinvest' ? `من ربح ${monthName(e.month)}` : (e.note || '')}</td>
                <td>
                  {e.type === 'profit' && e.status !== 'pending' && <button className="inv-link" onClick={() => settle(e, 'undo')}>تراجع</button>}
                  {(e.type === 'deposit' || e.type === 'withdraw') && <button className="inv-link" aria-label="حذف" onClick={() => remove(e)}><RiDeleteBinLine /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mv && (
        <div className="modal-backdrop" onMouseDown={() => setMv(null)}>
          <form className="modal-content" style={{ maxWidth: 420, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={addMove}>
            <div className="modal-header">
              <h3 className="modal-title">{mv.type === 'deposit' ? 'إيداع' : 'سحب من مبلغه'}</h3>
              <button type="button" className="close-btn" onClick={() => setMv(null)} aria-label="إغلاق"><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body inv-form">
              <label>المبلغ (ر.ع)<input className="input" type="number" min="0.001" step="0.001" required value={mv.amount} onChange={(e) => setMv({ ...mv, amount: e.target.value })} /></label>
              <label>التاريخ<input className="input" type="date" required value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} /></label>
              <label>ملاحظة<input className="input" value={mv.note} onChange={(e) => setMv({ ...mv, note: e.target.value })} placeholder="مثلاً: تحويل بنكي" /></label>
              <small style={{ color: 'var(--text-secondary)' }}>{mv.type === 'deposit' ? 'يبدأ يربح من أول الشهر الجاي (أو هالشهر لو التاريخ يوم ١).' : 'ينقص من مبلغه من هالتاريخ، والشهر اللي بعده ينحسب على الباقي.'}</small>
              <button className="btn btn-primary" type="submit" disabled={busy}>حفظ</button>
            </div>
          </form>
        </div>
      )}
      {formEl}
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.inv-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.inv-back{display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:var(--text-secondary);font-family:inherit;font-size:13px;cursor:pointer;padding:0;margin-bottom:6px}
.inv-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.inv-cards .card{padding:12px 16px;margin:0;display:flex;flex-direction:column;gap:2px}
.inv-cards small{font-size:12px;color:var(--text-secondary)}
.inv-cards b{font-size:22px}
.inv-cards i{font-style:normal;font-size:11px;color:var(--text-secondary)}
.inv-cards .warn b{color:#B45309}
.inv-stock{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:14px 16px;margin:0 0 14px}
.inv-stock>div{display:flex;flex-direction:column;gap:2px}
.inv-stock small{font-size:12px;color:var(--text-secondary)}
.inv-stock b{font-size:16px}
.inv-stock span{font-size:12px;color:var(--text-secondary)}
.inv-stock span.ok{color:#047857;font-weight:600}.inv-stock span.bad{color:#B42318;font-weight:600}
.inv-list{display:flex;flex-direction:column;gap:8px}
.inv-row{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr auto;gap:12px;align-items:center;padding:12px 16px;margin:0;text-align:inherit;font-family:inherit;cursor:pointer;border:1px solid var(--border);width:100%;color:inherit}
.inv-row.off{opacity:.6}
.inv-name{display:flex;flex-direction:column;gap:2px}
.inv-name b{font-size:15px}.inv-name small{font-size:12px;color:var(--text-secondary)}
.inv-num{display:flex;flex-direction:column;gap:1px}
.inv-num small{font-size:11px;color:var(--text-secondary)}.inv-num b{font-size:14px}
.inv-foot{font-size:12px;color:var(--text-secondary);margin-top:12px;line-height:1.8}
.inv-pending{padding:14px 16px;margin:0 0 14px;border:1px solid #FDE68A}
.inv-pending h3,.inv-hist h3{margin:0 0 8px;font-size:15px}
.inv-p{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--border);padding:10px 0}
.inv-p>div{flex:1;min-width:140px;display:flex;flex-direction:column}
.inv-p small{font-size:12px;color:var(--text-secondary)}
.inv-amt{font-size:16px;color:#B45309}
.inv-hist{padding:14px 16px;margin:0;overflow-x:auto}
.inv-hist table{width:100%;border-collapse:collapse;font-size:13px}
.inv-hist th{text-align:right;font-weight:600;color:var(--text-secondary);font-size:12px;padding:8px 6px;border-bottom:1px solid var(--border)}
.inv-hist td{padding:9px 6px;border-bottom:1px solid var(--border);white-space:nowrap}
.inv-hist .inv-note{white-space:normal;color:var(--text-secondary)}
.inv-link{border:0;background:none;color:var(--text-secondary);cursor:pointer;font-family:inherit;font-size:12px;text-decoration:underline}
.inv-form{display:flex;flex-direction:column;gap:12px}
.inv-form label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}
.inv-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:800px){.inv-cards{grid-template-columns:1fr 1fr}.inv-stock{grid-template-columns:1fr}.inv-row{grid-template-columns:1fr 1fr}}
`
