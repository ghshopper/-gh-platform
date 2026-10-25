import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiCloseLine, RiHandCoinLine, RiArrowRightLine, RiDeleteBinLine, RiEditLine, RiShieldCheckLine, RiStore2Line, RiPercentLine } from 'react-icons/ri'
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
const thisMonth = () => today().slice(0, 7)
const SAFETY = {
  safe: ['#047857', '#ECFDF5', '#A7F3D0'],
  watch: ['#B45309', '#FFFBEB', '#FDE68A'],
  danger: ['#B42318', '#FEF3F2', '#FECDCA'],
}
const PIECE = {
  in_stock: ['بالمخزن', '#1D4ED8', '#EFF6FF'],
  sold: ['انباعت', '#047857', '#ECFDF5'],
  returned: ['رجعت للمورد', '#6E6A66', '#F3F1EE'],
  written_off: ['خسارة (انشطبت)', '#B42318', '#FEF3F2'],
}
const MOVE = { withdraw: 'سحب المحل من الصندوق', deposit: 'إضافة من المحل', adjust: 'تصحيح' }
const STATUS = {
  pending: ['ينتظر قرارك', '#B45309', '#FFFBEB'],
  paid: ['انصرف له', '#6E6A66', '#F3F1EE'],
  reinvested: ['انضاف لمبلغه', '#047857', '#ECFDF5'],
}

export default function Investments() {
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(null) // investor id
  const [form, setForm] = useState(null) // new / edit investor
  const [tab, setTab] = useState('investors') // investors | pieces
  const [pm, setPm] = useState(null) // pool move form
  const load = () => api.get('/admin/investments').then((r) => setD(r.data)).catch((e) => toast.error(e.response?.data?.message || 'تعذر التحميل'))
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    try {
      if (form.id) await api.put(`/admin/investments/${form.id}`, { name: form.name, phone: form.phone || null, notes: form.notes || null, ...(form.has_rates ? {} : { monthly_pct: Number(form.monthly_pct) }) })
      else await api.post('/admin/investments', { ...form, monthly_pct: Number(form.monthly_pct), amount: form.amount ? Number(form.amount) : null })
      toast.success('انحفظ')
      setForm(null)
      load()
    } catch (er) { toast.error(er.response?.data?.message || 'ما انحفظ') }
  }

  if (open) return <Investor id={open} onBack={() => { setOpen(null); load() }} onEdit={(f) => setForm(f)} formEl={form && <InvestorForm form={form} setForm={setForm} save={save} />} />

  const savePm = async (e) => {
    e.preventDefault()
    try { await api.post('/admin/investments/pool-moves', { ...pm, amount: Number(pm.amount) }); toast.success('انسجّل'); setPm(null); load() } catch (er) { toast.error(er.response?.data?.message || 'تعذر') }
  }
  const delPm = async (m) => {
    if (!window.confirm('نشيل هالحركة؟')) return
    try { await api.delete(`/admin/investments/pool-moves/${m.id}`); load() } catch { toast.error('تعذر') }
  }

  const t = d?.totals
  const s = d?.stock
  const pool = d?.pool
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

          {pool ? <PoolCards pool={pool} onMove={() => setPm({ type: 'withdraw', amount: '', date: today(), note: '' })} onDelMove={delPm} /> : (
            <div className="card inv-stock">
              <div><small>بضاعة التسليم الفوري الحين (بسعر البيع)</small><b>{money(s.value)} ر.ع</b><span>{s.pieces} قطعة</span></div>
              <div><small>مبيعات التسليم الفوري هالشهر</small><b>{money(s.sales_this_month)} ر.ع</b></div>
              <div><small>أرباح المستثمرين هالشهر</small><b>{money(t.this_month)} ر.ع</b></div>
            </div>
          )}

          {pool && (
            <div className="inv-tabs">
              <button className={tab === 'investors' ? 'on' : ''} onClick={() => setTab('investors')}>المستثمرين ({d.investors.length})</button>
              <button className={tab === 'pieces' ? 'on' : ''} onClick={() => setTab('pieces')}>القطع ({pool.pieces_count})</button>
            </div>
          )}

          {tab === 'pieces' && pool ? <Pieces onChange={load} /> : <>
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
          </>}
        </>
      )}
      {form && <InvestorForm form={form} setForm={setForm} save={save} />}
      {pm && (
        <Modal title="حركة على صندوق الاستثمار" onClose={() => setPm(null)} onSubmit={savePm}>
          <label>النوع<select className="input" value={pm.type} onChange={(e) => setPm({ ...pm, type: e.target.value })}>
            <option value="withdraw">سحب المحل من الصندوق (ربح المحل أو مصروف)</option>
            <option value="deposit">إضافة من المحل للصندوق</option>
            <option value="adjust">تصحيح (+ أو −)</option>
          </select></label>
          <div className="inv-two">
            <label>المبلغ (ر.ع)<input className="input" type="number" step="0.001" required value={pm.amount} onChange={(e) => setPm({ ...pm, amount: e.target.value })} /></label>
            <label>التاريخ<input className="input" type="date" value={pm.date} onChange={(e) => setPm({ ...pm, date: e.target.value })} /></label>
          </div>
          <label>ملاحظة<input className="input" value={pm.note} onChange={(e) => setPm({ ...pm, note: e.target.value })} /></label>
          <small style={{ color: 'var(--text-secondary)' }}>هذي للفلوس اللي تطلع أو تدخل الصندوق مب عن طريق المستثمرين أو القطع، عشان الكاش المتوفر يطابق الواقع.</small>
          <button className="btn btn-primary" type="submit">حفظ</button>
        </Modal>
      )}
      <style>{CSS}</style>
    </div>
  )
}

function Modal({ title, onClose, onSubmit, children, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal-content" style={{ maxWidth: wide ? 760 : 460, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="إغلاق"><RiCloseLine size={24} /></button>
        </div>
        <div className="modal-body inv-form">{children}</div>
      </form>
    </div>
  )
}

function PoolCards({ pool: p, onMove, onDelMove }) {
  const sf = p.safety
  const c = SAFETY[sf.status] || SAFETY.safe
  const [moves, setMoves] = useState(false)
  return (
    <>
      <div className="card inv-pool">
        <div className="inv-pool-head">
          <h3>صندوق الاستثمار</h3>
          <button className="btn btn-ghost btn-sm" onClick={onMove}>حركة على الصندوق</button>
        </div>
        <div className="inv-pool-grid">
          <div><small>مبالغ المستثمرين</small><b>{money(p.capital)}</b></div>
          <div><small>بالمخزن (بالتكلفة)</small><b>{money(p.in_stock_cost)}</b><span>{p.in_stock_qty} قطعة</span></div>
          <div><small>الكاش المتوفر</small><b className={p.cash_available < 0 ? 'neg' : ''}>{money(p.cash_available)}</b><span>بعد الأرباح اللي تنتظر: {money(p.cash_after_pending)}</span></div>
          <div><small>الربح المحقق</small><b>{money(p.realized_profit)}</b><span>هالشهر {money(p.profit_this_month)} · الشهر الماضي {money(p.profit_last_month)}</span></div>
          <div><small>المخزن بسعر البيع</small><b>{money(p.stock_value_at_price)}</b><span>ربح متوقع {money(p.expected_profit_in_stock)}{p.unpriced_qty > 0 ? ` · ${p.unpriced_qty} قطعة بالتكلفة` : ''}</span></div>
        </div>
        <p className="inv-pool-note">الكاش = مبالغ المستثمرين − اللي انضاف لمبالغهم من أرباحهم + الربح المحقق − تكلفة اللي بالمخزن − الأرباح اللي انصرفت ± حركات المحل
          {p.moves.length > 0 && <> · <button className="inv-link" onClick={() => setMoves(!moves)}>{moves ? 'خفّ الحركات' : `حركات المحل (${p.moves.length})`}</button></>}</p>
        {moves && (
          <table className="inv-mini"><tbody>
            {p.moves.map((m) => (
              <tr key={m.id}><td>{day(m.date)}</td><td>{MOVE[m.type]}</td><td dir="ltr" style={{ textAlign: 'right' }}>{m.type === 'withdraw' ? '−' : ''}{money(m.amount)}</td><td className="inv-note">{m.note}</td>
                <td><button className="inv-link" aria-label="حذف" onClick={() => onDelMove(m)}><RiDeleteBinLine /></button></td></tr>
            ))}
          </tbody></table>
        )}
      </div>

      <div className="card inv-safe" style={{ borderColor: c[2], background: c[1] }}>
        <div className="inv-safe-badge" style={{ color: c[0] }}><RiShieldCheckLine size={22} /><b>{sf.label}</b></div>
        <div className="inv-safe-body">
          <p style={{ color: c[0] }}>{sf.message}</p>
          <div className="inv-safe-grid">
            <div><small>أرباح المستثمرين بالشهر</small><b>{money(sf.monthly_obligation)}</b></div>
            <div><small>{sf.basis === 'last_months' ? `متوسط ربح البضاعة (${sf.months_used.length === 1 ? 'آخر شهر' : `آخر ${sf.months_used.length} أشهر`})` : 'ربح البضاعة هالشهر لين الحين'}</small><b>{money(sf.profit_used)}</b></div>
            <div><small>التغطية</small><b>{sf.ratio == null ? '—' : `${sf.ratio}×`}</b></div>
            <div><small>هالشهر لين الحين</small><b>{money(sf.this_month_profit)}</b>{sf.this_month_ratio != null && <span>{sf.this_month_ratio}×</span>}</div>
            <div><small>الكاش يكفي</small><b>{sf.months_of_cover == null ? '—' : `${sf.months_of_cover} شهر`}</b></div>
          </div>
          <small className="inv-safe-rule">آمن: الربح ١٫٥ ضعف أو أكثر من أرباح المستثمرين · انتبه: بين ١ و ١٫٥ · خطر: أقل منها. يوم ١ كل شهر يوصلك تنبيه لو الحالة مب آمن.</small>
        </div>
      </div>
    </>
  )
}

function Pieces({ onChange }) {
  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('')
  const [add, setAdd] = useState(null)
  const [link, setLink] = useState(null) // { products, picked: {id: {qty, unit_cost}}, bought_on }
  const [sell, setSell] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => api.get('/admin/investments/pieces').then((r) => setList(r.data.pieces)).catch((e) => toast.error(e.response?.data?.message || 'تعذر التحميل'))
  useEffect(() => { load() }, [])
  const done = (msg) => { toast.success(msg); load(); onChange() }
  const err = (e) => toast.error(e.response?.data?.message || 'تعذر')

  const saveAdd = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api.post('/admin/investments/pieces', { name: add.name, brand: add.brand || null, qty: Number(add.qty || 1), unit_cost: Number(add.unit_cost), bought_on: add.bought_on, note: add.note || null }); setAdd(null); done('انضافت') } catch (er) { err(er) } finally { setBusy(false) }
  }
  const openLink = async () => {
    try { const r = await api.get('/admin/investments/candidates'); setLink({ products: r.data.products, picked: {}, bought_on: today(), q: '' }) } catch (er) { err(er) }
  }
  const toggle = (p) => {
    const picked = { ...link.picked }
    if (picked[p.id]) delete picked[p.id]
    else picked[p.id] = { qty: p.stock, unit_cost: p.cost_price ?? '' }
    setLink({ ...link, picked })
  }
  const setPick = (id, k, v) => setLink({ ...link, picked: { ...link.picked, [id]: { ...link.picked[id], [k]: v } } })
  const saveLink = async (e) => {
    e.preventDefault()
    const items = Object.entries(link.picked).map(([id, v]) => ({ product_id: Number(id), qty: Number(v.qty) || null, unit_cost: v.unit_cost === '' ? null : Number(v.unit_cost) }))
    if (!items.length) return toast.error('اختر منتج وحد على الأقل')
    setBusy(true)
    try {
      const r = await api.post('/admin/investments/pieces/bulk', { bought_on: link.bought_on, items })
      if (r.data.skipped?.length) toast.error(`ما انربطت ${r.data.skipped.length}: ما عليها سعر تكلفة`)
      setLink(null); done(`انربطت ${r.data.added} بالصندوق`)
    } catch (er) { err(er) } finally { setBusy(false) }
  }
  const saveSell = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api.post(`/admin/investments/pieces/${sell.id}/sell`, { qty: Number(sell.qty || 1), amount: Number(sell.amount), sold_on: sell.sold_on, note: sell.note || null }); setSell(null); done('انسجّلت البيعة') } catch (er) { err(er) } finally { setBusy(false) }
  }
  const setStatus = async (p, status) => {
    const q = { returned: 'رجعت هالقطعة للمورد ورجعت فلوسها؟', written_off: 'نشطب الباقي منها كخسارة؟', in_stock: 'نرجعها للمخزن؟' }[status]
    if (!window.confirm(q)) return
    try { await api.put(`/admin/investments/pieces/${p.id}`, { status, closed_on: today() }); done('تم') } catch (er) { err(er) }
  }
  const remove = async (p) => {
    if (!window.confirm('نشيل هالقطعة من الصندوق؟ (المنتج نفسه ما يتأثر)')) return
    try { await api.delete(`/admin/investments/pieces/${p.id}`); done('انشالت') } catch (er) { err(er) }
  }
  const delSale = async (p, m) => {
    if (!window.confirm('نشيل هالبيعة؟')) return
    try { await api.delete(`/admin/investments/pieces/${p.id}/sales/${m.id}`); done('انشالت') } catch (er) { err(er) }
  }

  const shown = (list || []).filter((p) => !filter || p.status === filter)
  const cands = link ? link.products.filter((p) => !link.q || `${p.brand} ${p.name} ${p.name_ar}`.toLowerCase().includes(link.q.toLowerCase())) : []
  return (
    <div>
      <div className="inv-pieces-bar">
        <div className="inv-chips">
          {[['', 'الكل'], ['in_stock', 'بالمخزن'], ['sold', 'انباعت'], ['returned', 'رجعت'], ['written_off', 'خسارة']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={openLink}><RiStore2Line /> ربط من المتجر</button>
          <button className="btn btn-ghost" onClick={() => setAdd({ name: '', brand: '', qty: 1, unit_cost: '', bought_on: today(), note: '' })}><RiAddLine /> قطعة مب بالمتجر</button>
        </div>
      </div>

      {!list ? <div className="gh-skel" style={{ height: 200 }} /> : shown.length === 0 ? (
        <div className="card"><Empty icon={RiStore2Line} title="ما فيه قطع" hint="اضغط «ربط من المتجر» واختر بضاعة التسليم الفوري اللي انشرت من فلوس المستثمرين." /></div>
      ) : (
        <div className="card inv-hist">
          <table>
            <thead><tr><th>القطعة</th><th>الحالة</th><th>العدد</th><th>التكلفة</th><th>انباع</th><th>الربح</th><th>ربح متوقع</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="inv-note" style={{ color: 'inherit' }}><b>{p.brand ? `${p.brand} · ` : ''}{p.name}</b><br /><small style={{ color: 'var(--text-secondary)' }}>اشتريت {day(p.bought_on)}{p.product_id ? ' · مربوطة بالمتجر' : ' · مب بالمتجر'}{p.note ? ` · ${p.note}` : ''}</small>
                    {p.manual_sales.map((m) => <div key={m.id} className="inv-sale">بيعة يدوية: {m.qty} بـ {money(m.amount)} · {day(m.date)} <button className="inv-link" onClick={() => delSale(p, m)}>شيل</button></div>)}
                  </td>
                  <td><span className="badge" style={{ color: PIECE[p.status]?.[1], background: PIECE[p.status]?.[2] }}>{PIECE[p.status]?.[0]}</span></td>
                  <td>{p.sold_qty}/{p.qty}{p.left > 0 ? <small style={{ color: 'var(--text-secondary)' }}> · باقي {p.left}</small> : null}</td>
                  <td>{money(p.unit_cost)}{p.qty > 1 ? <small style={{ color: 'var(--text-secondary)' }}> × {p.qty}</small> : null}</td>
                  <td>{money(p.sold_amount)}{p.sold_on ? <small style={{ color: 'var(--text-secondary)' }}><br />{day(p.sold_on)}</small> : null}</td>
                  <td style={{ color: p.profit < 0 ? '#B42318' : p.profit > 0 ? '#047857' : undefined }}>{money(p.profit)}</td>
                  <td>{p.expected_profit == null ? '—' : money(p.expected_profit)}</td>
                  <td className="inv-acts">
                    {p.status === 'in_stock' && <button className="inv-link" onClick={() => setSell({ id: p.id, name: p.name, left: p.left, qty: 1, amount: p.price ?? '', sold_on: today(), note: '' })}>بيعة يدوية</button>}
                    {p.status === 'in_stock' && <button className="inv-link" onClick={() => setStatus(p, 'returned')}>رجعت</button>}
                    {p.status === 'in_stock' && <button className="inv-link" onClick={() => setStatus(p, 'written_off')}>خسارة</button>}
                    {(p.status === 'returned' || p.status === 'written_off') && <button className="inv-link" onClick={() => setStatus(p, 'in_stock')}>رجعها للمخزن</button>}
                    <button className="inv-link" aria-label="حذف" onClick={() => remove(p)}><RiDeleteBinLine /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="inv-foot">القطع المربوطة بالمتجر تنحسب مبيعاتها لحالها من طلبات المتجر (من يوم الشراء، الأقدم ينباع أول). لو الطلب انلغى أو رجع، البيعة تنشال. القطع اللي تنباع برا طلبات المتجر (مثلاً من تطبيق الإدارة) سجّلها «بيعة يدوية».</p>

      {add && (
        <Modal title="قطعة مب بالمتجر" onClose={() => setAdd(null)} onSubmit={saveAdd}>
          <div className="inv-two">
            <label>البراند<input className="input" value={add.brand} onChange={(e) => setAdd({ ...add, brand: e.target.value })} /></label>
            <label>اسم القطعة<input className="input" required value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} /></label>
          </div>
          <div className="inv-two">
            <label>العدد<input className="input" type="number" min="1" value={add.qty} onChange={(e) => setAdd({ ...add, qty: e.target.value })} /></label>
            <label>تكلفة القطعة (ر.ع)<input className="input" type="number" min="0" step="0.001" required value={add.unit_cost} onChange={(e) => setAdd({ ...add, unit_cost: e.target.value })} /></label>
          </div>
          <label>تاريخ الشراء<input className="input" type="date" value={add.bought_on} onChange={(e) => setAdd({ ...add, bought_on: e.target.value })} /></label>
          <label>ملاحظة<input className="input" value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} /></label>
          <button className="btn btn-primary" type="submit" disabled={busy}>حفظ</button>
        </Modal>
      )}

      {link && (
        <Modal wide title="ربط بضاعة من المتجر بالصندوق" onClose={() => setLink(null)} onSubmit={saveLink}>
          <div className="inv-two">
            <label>بحث<input className="input" value={link.q} onChange={(e) => setLink({ ...link, q: e.target.value })} placeholder="البراند أو الاسم" /></label>
            <label>تاريخ الشراء<input className="input" type="date" value={link.bought_on} onChange={(e) => setLink({ ...link, bought_on: e.target.value })} /></label>
          </div>
          {link.products.length === 0 ? <small style={{ color: 'var(--text-secondary)' }}>كل بضاعة التسليم الفوري اللي بالمخزن مربوطة.</small> : (
            <div className="inv-cands">
              {cands.map((p) => {
                const on = link.picked[p.id]
                return (
                  <div key={p.id} className={`inv-cand ${on ? 'on' : ''}`}>
                    <label className="inv-cand-main"><input type="checkbox" checked={!!on} onChange={() => toggle(p)} />
                      <span><b>{p.brand ? `${p.brand} · ` : ''}{p.name}</b><small>السعر {money(p.price)} · التكلفة {p.cost_price == null ? '—' : money(p.cost_price)} · بالمخزن {p.stock}{p.status !== 'active' ? ' · مخفي' : ''}</small></span>
                    </label>
                    {on && <div className="inv-cand-in">
                      <input className="input" type="number" min="1" value={on.qty} onChange={(e) => setPick(p.id, 'qty', e.target.value)} aria-label="العدد" title="العدد" />
                      <input className="input" type="number" min="0" step="0.001" required value={on.unit_cost} placeholder="التكلفة" onChange={(e) => setPick(p.id, 'unit_cost', e.target.value)} aria-label="التكلفة" title="تكلفة القطعة" />
                    </div>}
                  </div>
                )
              })}
            </div>
          )}
          <small style={{ color: 'var(--text-secondary)' }}>التكلفة تنعبى من سعر التكلفة في المنتج، وتقدر تغيّرها. العدد = اللي انشرى من فلوس الصندوق.</small>
          <button className="btn btn-primary" type="submit" disabled={busy}>اربط {Object.keys(link.picked).length || ''}</button>
        </Modal>
      )}

      {sell && (
        <Modal title={`بيعة يدوية: ${sell.name}`} onClose={() => setSell(null)} onSubmit={saveSell}>
          <div className="inv-two">
            <label>العدد (باقي {sell.left})<input className="input" type="number" min="1" max={sell.left} value={sell.qty} onChange={(e) => setSell({ ...sell, qty: e.target.value })} /></label>
            <label>المبلغ اللي انباعت فيه (كامل)<input className="input" type="number" min="0" step="0.001" required value={sell.amount} onChange={(e) => setSell({ ...sell, amount: e.target.value })} /></label>
          </div>
          <label>تاريخ البيع<input className="input" type="date" value={sell.sold_on} onChange={(e) => setSell({ ...sell, sold_on: e.target.value })} /></label>
          <label>ملاحظة<input className="input" value={sell.note} onChange={(e) => setSell({ ...sell, note: e.target.value })} placeholder="مثلاً: طلب رقم ..." /></label>
          <button className="btn btn-primary" type="submit" disabled={busy}>حفظ</button>
        </Modal>
      )}
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
          {!form.has_rates && <label>الربح الشهري %<input className="input" type="number" min="0" max="100" step="0.5" required value={form.monthly_pct} onChange={(e) => setForm({ ...form, monthly_pct: e.target.value })} /></label>}
          {!form.id && <div className="inv-two">
            <label>المبلغ (ر.ع)<input className="input" type="number" min="0" step="0.001" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label>تاريخ الاستلام<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          </div>}
          <label>ملاحظات<textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          {form.id && <small style={{ color: 'var(--text-secondary)' }}>{form.has_rates ? 'النسبة تتغيّر من «تغيير النسبة» في صفحته (من شهر معيّن).' : 'تغيير النسبة هنا يطبّق على الأشهر اللي للحين تنتظر قرارك والجاية. عشان تغيّرها من شهر معيّن بدون ما تأثر على اللي قبله، استخدم «تغيير النسبة».'}</small>}
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
  const [rt, setRt] = useState(null) // rate change form
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
  const saveRate = async (ev) => {
    ev.preventDefault()
    setBusy(true)
    try { await api.post(`/admin/investments/${id}/rate`, { pct: Number(rt.pct), from_month: rt.from_month, note: rt.note || null }); toast.success('انحفظت النسبة'); setRt(null); await load() } catch (er) { toast.error(er.response?.data?.message || 'تعذر') } finally { setBusy(false) }
  }
  const delRate = async (r) => {
    if (!window.confirm(`نشيل نسبة ${r.pct}% من ${monthName(r.from_month)}؟`)) return
    try { await api.delete(`/admin/investments/${id}/rate/${r.id}`); toast.success('انشالت'); await load() } catch (er) { toast.error(er.response?.data?.message || 'تعذر') }
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
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{i.monthly_pct}% بالشهر{i.next_pct != null && i.next_pct !== i.monthly_pct ? ` (من الشهر الجاي ${i.next_pct}%)` : ''}{i.phone ? ` · ${i.phone}` : ''}{i.status !== 'active' ? ' · منتهي' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setMv({ type: 'deposit', amount: '', date: today(), note: '' })}><RiAddLine /> إيداع</button>
          <button className="btn btn-ghost" onClick={() => setMv({ type: 'withdraw', amount: '', date: today(), note: '' })}>سحب من مبلغه</button>
          <button className="btn btn-ghost" onClick={() => { const from = d.can_change_rate_from && d.can_change_rate_from > thisMonth() ? d.can_change_rate_from : thisMonth(); setRt({ pct: i.next_pct ?? i.monthly_pct, from_month: from, min: d.can_change_rate_from, note: '' }) }}><RiPercentLine /> تغيير النسبة</button>
          <button className="btn btn-ghost" onClick={() => onEdit({ id: i.id, name: i.name, phone: i.phone, monthly_pct: i.base_pct ?? i.monthly_pct, notes: i.notes, has_rates: (i.rates || []).length > 0 })}><RiEditLine /> تعديل</button>
          <button className="btn btn-ghost" onClick={close}>{i.status === 'active' ? 'إنهاء' : 'إرجاعه'}</button>
        </div>
      </div>

      <div className="inv-cards">
        <div className="card"><small>مبلغه الحين</small><b>{money(i.capital)}</b><i>ر.ع</i></div>
        <div className="card"><small>ربح هالشهر (يستحق آخر الشهر)</small><b>{money(i.this_month)}</b><i>ر.ع</i></div>
        <div className="card"><small>انصرف له لين الحين</small><b>{money(i.paid_out)}</b><i>ر.ع</i></div>
        <div className="card"><small>انضاف لمبلغه من أرباحه</small><b>{money(i.reinvested)}</b><i>ر.ع</i></div>
      </div>

      {(i.rates || []).length > 0 && (
        <div className="card inv-rates">
          <h3>تغييرات النسبة</h3>
          <div className="inv-rate"><span>قبل أول تغيير</span><b>{i.base_pct}%</b><span /></div>
          {i.rates.map((r) => (
            <div key={r.id} className="inv-rate">
              <span>من {monthName(r.from_month)}{r.note ? ` · ${r.note}` : ''}</span><b>{r.pct}%</b>
              {(!d.can_change_rate_from || r.from_month >= d.can_change_rate_from) ? <button className="inv-link" aria-label="حذف" onClick={() => delRate(r)}><RiDeleteBinLine /></button> : <span />}
            </div>
          ))}
        </div>
      )}

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
      {rt && (
        <Modal title="تغيير النسبة من شهر معيّن" onClose={() => setRt(null)} onSubmit={saveRate}>
          <div className="inv-two">
            <label>النسبة الجديدة %<input className="input" type="number" min="0" max="100" step="0.5" required value={rt.pct} onChange={(e) => setRt({ ...rt, pct: e.target.value })} /></label>
            <label>من شهر<input className="input" type="month" required min={rt.min || undefined} value={rt.from_month} onChange={(e) => setRt({ ...rt, from_month: e.target.value })} /></label>
          </div>
          <label>ملاحظة<input className="input" value={rt.note} onChange={(e) => setRt({ ...rt, note: e.target.value })} placeholder="مثلاً: اتفاق جديد" /></label>
          <small style={{ color: 'var(--text-secondary)' }}>النسبة الجديدة تطبّق من هالشهر وطالع. الأشهر اللي قبله تبقى على نسبتها. {rt.min ? `أقدم شهر تقدر تختاره ${monthName(rt.min)} (اللي قبله انصرف ربحه أو انضاف).` : ''}</small>
          <button className="btn btn-primary" type="submit" disabled={busy}>حفظ</button>
        </Modal>
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
.inv-pool{padding:14px 16px;margin:0 0 10px}
.inv-pool-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
.inv-pool-head h3{margin:0;font-size:15px}
.inv-pool-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.inv-pool-grid>div{display:flex;flex-direction:column;gap:2px}
.inv-pool-grid small{font-size:12px;color:var(--text-secondary)}
.inv-pool-grid b{font-size:18px}.inv-pool-grid b.neg{color:#B42318}
.inv-pool-grid span{font-size:11px;color:var(--text-secondary)}
.inv-pool-note{font-size:11px;color:var(--text-secondary);margin:10px 0 0;line-height:1.7}
.inv-mini{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
.inv-mini td{padding:6px;border-top:1px solid var(--border);white-space:nowrap}
.inv-safe{display:flex;gap:16px;align-items:flex-start;padding:14px 16px;margin:0 0 14px;border:1px solid}
.inv-safe-badge{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:64px}
.inv-safe-badge b{font-size:20px}
.inv-safe-body{flex:1}
.inv-safe-body p{margin:0 0 8px;font-weight:600;font-size:14px}
.inv-safe-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.inv-safe-grid>div{display:flex;flex-direction:column;gap:1px}
.inv-safe-grid small{font-size:11px;color:var(--text-secondary)}.inv-safe-grid b{font-size:15px}.inv-safe-grid span{font-size:11px;color:var(--text-secondary)}
.inv-safe-rule{display:block;font-size:11px;color:var(--text-secondary);margin-top:8px}
.inv-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:12px}
.inv-tabs button{border:0;background:none;font-family:inherit;font-size:14px;padding:8px 14px;cursor:pointer;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-1px}
.inv-tabs button.on{color:inherit;font-weight:700;border-bottom-color:currentColor}
.inv-pieces-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.inv-chips{display:flex;gap:6px;flex-wrap:wrap}
.inv-chips button{border:1px solid var(--border);background:none;border-radius:999px;padding:4px 12px;font-family:inherit;font-size:12px;cursor:pointer;color:inherit}
.inv-chips button.on{background:var(--text-primary,#1C1A18);color:#fff;border-color:transparent}
.inv-sale{font-size:11px;color:var(--text-secondary);margin-top:3px}
.inv-acts{display:flex;gap:8px;align-items:center}
.inv-cands{display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow:auto}
.inv-cand{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;flex-wrap:wrap}
.inv-cand.on{border-color:#A7F3D0;background:#F6FEF9}
.inv-cand-main{flex:1;display:flex !important;flex-direction:row !important;align-items:center;gap:10px;font-weight:400 !important;cursor:pointer;min-width:220px}
.inv-cand-main span{display:flex;flex-direction:column}
.inv-cand-main small{font-size:11px;color:var(--text-secondary)}
.inv-cand-in{display:flex;gap:6px}.inv-cand-in .input{width:96px}
.inv-rates{padding:14px 16px;margin:0 0 14px}
.inv-rates h3{margin:0 0 6px;font-size:15px}
.inv-rate{display:grid;grid-template-columns:1fr auto 28px;gap:10px;align-items:center;border-top:1px solid var(--border);padding:8px 0;font-size:13px}
@media(max-width:800px){.inv-pool-grid,.inv-safe-grid{grid-template-columns:1fr 1fr}.inv-safe{flex-direction:column}.inv-cards{grid-template-columns:1fr 1fr}.inv-stock{grid-template-columns:1fr}.inv-row{grid-template-columns:1fr 1fr}}
`
