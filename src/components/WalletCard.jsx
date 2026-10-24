import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiWallet3Line, RiAddLine, RiSubtractLine, RiLoader4Line } from 'react-icons/ri'
import api from '../services/api'

/**
 * محفظة GH on the customer's file: balance, ledger, add / remove credit with a note.
 * GET /admin/customers/{id}/wallet → {balance, transactions}
 * POST /admin/customers/{id}/wallet {amount (signed), note}
 */
const TYPE = {
  topup: ['شحن رصيد', '#047857'],
  points: ['تحويل نقاط', '#7C3AED'],
  spend: ['دفع طلب', '#B91C1C'],
  refund: ['استرجاع', '#047857'],
  credit: ['إضافة من الفريق', '#047857'],
  debit: ['خصم من الفريق', '#B91C1C'],
  gift_card: ['بطاقة هدية', '#047857'],
}
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const day = (s) => {
  if (!s) return ''
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(s)) ? s : String(s).replace(' ', 'T') + 'Z')
  return isNaN(d) ? String(s).slice(0, 10) : d.toLocaleDateString('ar-OM', { timeZone: 'Asia/Muscat', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WalletCard({ customerId }) {
  const [w, setW] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(null) // { sign: 1 | -1, amount, note }
  const [busy, setBusy] = useState(false)
  const [all, setAll] = useState(false)

  const load = () => api.get(`/admin/customers/${customerId}/wallet`)
    .then((r) => { const d = r.data?.data && !Array.isArray(r.data.data) ? r.data.data : r.data; setW({ balance: Number(d?.balance || 0), transactions: d?.transactions || [] }); setErr('') })
    .catch((e) => setErr(e.response?.data?.message || 'تعذّر تحميل المحفظة'))
  useEffect(() => { load() }, [customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    const amt = Math.round(Number(form.amount) * 1000) / 1000
    if (!(amt > 0)) return toast.error('اكتب المبلغ')
    if (!form.note.trim()) return toast.error('اكتب السبب (يظهر في سجل المحفظة)')
    if (form.sign < 0 && amt > (w?.balance || 0) + 0.0005) return toast.error('المبلغ أكبر من رصيد العميل')
    setBusy(true)
    try {
      await api.post(`/admin/customers/${customerId}/wallet`, { amount: form.sign * amt, note: form.note.trim() })
      toast.success(form.sign > 0 ? `أضفنا ${money(amt)} ر.ع لمحفظته` : `خصمنا ${money(amt)} ر.ع من محفظته`)
      setForm(null)
      load()
    } catch (e2) {
      toast.error(e2.response?.data?.message || 'ما انحفظ')
    } finally { setBusy(false) }
  }

  const txs = w?.transactions || []
  const shown = all ? txs : txs.slice(0, 6)

  return (
    <section className="wl-card">
      <div className="wl-head">
        <span className="wl-ic"><RiWallet3Line size={20} /></span>
        <div style={{ flex: 1 }}>
          <small>رصيد محفظة GH</small>
          <b>{w ? money(w.balance) : '—'} <i>ر.ع</i></b>
        </div>
        {w && !form && (
          <div className="wl-act">
            <button className="btn btn-sm btn-ghost" onClick={() => setForm({ sign: 1, amount: '', note: '' })}><RiAddLine /> إضافة</button>
            <button className="btn btn-sm btn-ghost" disabled={!(w.balance > 0)} onClick={() => setForm({ sign: -1, amount: '', note: '' })}><RiSubtractLine /> خصم</button>
          </div>
        )}
      </div>
      {err && <div className="wl-err">{err}</div>}
      {form && (
        <form className="wl-form" onSubmit={submit}>
          <div className="gh-seg">
            <button type="button" className={form.sign > 0 ? 'on' : ''} onClick={() => setForm({ ...form, sign: 1 })}>إضافة رصيد</button>
            <button type="button" className={form.sign < 0 ? 'on' : ''} onClick={() => setForm({ ...form, sign: -1 })}>خصم رصيد</button>
          </div>
          <div className="wl-row">
            <input className="input" dir="ltr" type="number" min="0" step="0.001" inputMode="decimal" placeholder="المبلغ (ر.ع)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
            <input className="input" maxLength={190} placeholder={form.sign > 0 ? 'السبب: مثلاً تعويض تأخير الطلب' : 'السبب: مثلاً تصحيح رصيد'} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="wl-row end">
            <span className="wl-hint">العميل يوصله إشعار {form.sign > 0 ? 'بالإضافة' : ''}، والسبب يظهر في سجل محفظته.</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm(null)}>إلغاء</button>
            <button className="btn btn-sm btn-primary" disabled={busy}>{busy ? <RiLoader4Line className="spin" /> : null} {form.sign > 0 ? 'إضافة' : 'خصم'}</button>
          </div>
        </form>
      )}
      {w && (txs.length === 0 ? <div className="wl-none">ما فيه حركات في المحفظة للحين</div> : (
        <div className="wl-list">
          {shown.map((t) => {
            const [label, color] = TYPE[t.type] || [t.type, '#475569']
            const amt = Number(t.amount || 0)
            return (
              <div key={t.id} className="wl-tx">
                <div style={{ minWidth: 0 }}>
                  <b style={{ color }}>{t.type_label_ar || label}</b>
                  <small>{day(t.created_at)}{t.order_number ? ` · طلب ${t.order_number}` : ''}{t.note ? ` · ${t.note}` : ''}</small>
                </div>
                <div className="wl-tx-end">
                  <b dir="ltr" style={{ color: amt < 0 ? '#B91C1C' : '#047857' }}>{amt < 0 ? '−' : '+'}{money(Math.abs(amt))}</b>
                  {t.balance_after != null && <small dir="ltr">{money(t.balance_after)}</small>}
                </div>
              </div>
            )
          })}
          {txs.length > 6 && <button className="wl-more" onClick={() => setAll(!all)}>{all ? 'أقل' : `كل الحركات (${txs.length})`}</button>}
        </div>
      ))}
      <style>{CSS}</style>
    </section>
  )
}

const CSS = `
.wl-card{border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin:14px 0;background:var(--bg-card);display:flex;flex-direction:column;gap:10px}
.wl-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.wl-ic{width:40px;height:40px;border-radius:12px;background:var(--color-gold-bg,#FBF5EA);color:var(--accent,#A8833F);display:inline-flex;align-items:center;justify-content:center}
.wl-head small{display:block;font-size:12px;color:var(--text-secondary)}
.wl-head b{font-size:22px;font-weight:700;color:var(--text-primary)}
.wl-head b i{font-style:normal;font-size:12px;color:var(--text-secondary);font-weight:500}
.wl-act{display:flex;gap:6px}
.wl-err{font-size:12.5px;color:#B91C1C}
.wl-form{display:flex;flex-direction:column;gap:8px;background:var(--bg-body);border-radius:12px;padding:12px}
.wl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.wl-row .input{height:38px;padding:0 10px;flex:1;min-width:140px}
.wl-row .input[type=number]{flex:0 0 140px}
.wl-row.end{justify-content:flex-end}
.wl-hint{flex:1;font-size:11.5px;color:var(--text-secondary);min-width:160px}
.wl-none{font-size:12.5px;color:var(--text-secondary);text-align:center;padding:8px}
.wl-list{display:flex;flex-direction:column}
.wl-tx{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--divider)}
.wl-tx b{font-size:13px;font-weight:700}
.wl-tx small{display:block;font-size:11.5px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis}
.wl-tx-end{text-align:left;flex-shrink:0}
.wl-more{border:0;background:none;color:var(--accent,#A8833F);font-weight:700;font-size:12.5px;cursor:pointer;padding:6px 0 0;font-family:inherit}
`
