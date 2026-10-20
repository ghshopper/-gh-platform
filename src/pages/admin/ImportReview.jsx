import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { RiErrorWarningLine, RiCheckLine, RiArrowRightLine } from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'

// What the import tool just added: fix the brand of one or many products,
// and split "colour" groups that are really different products.
export default function ImportReview() {
  const [days, setDays] = useState(7)
  const [d, setD] = useState(null)
  const [brandF, setBrandF] = useState('')
  const [sel, setSel] = useState({})
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => api.get('/admin/import-review', { params: { days } }).then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { setD(null); setSel({}); load() }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = d?.data || []
  const groups = useMemo(() => {
    const m = {}
    rows.filter((r) => r.bad_group).forEach((r) => { (m[r.group_key] ||= []).push(r) })
    return Object.entries(m)
  }, [rows])
  const brandCounts = useMemo(() => {
    const c = {}
    rows.forEach((r) => { const k = r.brand || 'بدون براند'; c[k] = (c[k] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [rows])
  const list = rows.filter((r) => !brandF || (r.brand || 'بدون براند') === brandF)
  const guesses = rows.filter((r) => r.brand_guess)
  const ids = Object.keys(sel).filter((k) => sel[k]).map(Number)
  const allOn = list.length > 0 && list.every((r) => sel[r.id])

  const put = async (body, msg) => {
    setBusy(true)
    try {
      await api.put('/admin/import-review', body)
      toast.success(msg)
      setSel({})
      await load()
    } catch (e) { toast.error(e.response?.data?.message || 'ما انحفظ') } finally { setBusy(false) }
  }
  const brandIdOf = (name) => d?.brands.find((b) => (b.name_en || '').toLowerCase() === (name || '').toLowerCase())?.id
  const applyGuesses = async () => {
    const by = {}
    guesses.forEach((r) => { const id = brandIdOf(r.brand_guess); if (id) (by[id] ||= []).push(r.id) })
    setBusy(true)
    try {
      for (const [bid, list] of Object.entries(by)) await api.put('/admin/import-review', { ids: list, brand_id: Number(bid) })
      toast.success('تصحّح البراند')
      await load()
    } catch { toast.error('تعذر') } finally { setBusy(false) }
  }
  const split = async (key) => {
    if (!window.confirm('كل قطعة في هالمجموعة تصير منتج لحالها باسمها. السعر والمقاسات مأخوذة من أول قطعة، راجعها بعدين. نكمل؟')) return
    setBusy(true)
    try {
      await api.post('/admin/import-review/split-group', { group_key: key })
      toast.success('انفصلت. اضغط «ترجمها للعربي» في المنتجات للأسماء')
      await load()
    } catch { toast.error('تعذر') } finally { setBusy(false) }
  }

  return (
    <div className="page ir" dir="rtl">
      <div className="ir-head">
        <div>
          <Link to="/admin/import-items" className="ir-back"><RiArrowRightLine /> منتجات للإضافة</Link>
          <h1 className="page-title-main" style={{ margin: 0 }}>مراجعة المنتجات المضافة بالأداة</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>صحّح البراند لمنتج أو لمجموعة مرة وحدة، وافصل الألوان اللي طلعت منتجات ثانية.</p>
        </div>
        <div className="gh-seg">
          {[1, 3, 7, 30].map((n) => <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{n === 1 ? 'اليوم' : `آخر ${n} أيام`}</button>)}
        </div>
      </div>

      {!d ? <div className="gh-skel" style={{ height: 320 }} /> : (
        <>
          {guesses.length > 0 && (
            <div className="ir-warn">
              <RiErrorWarningLine size={20} />
              <span style={{ flex: 1 }}><b>{guesses.length}</b> منتج اسمه يبدأ ببراند ثاني غير المسجل (مثلاً اسمه «Dior…» ومسجل YSL).</span>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={applyGuesses}>صحّحها كلها</button>
            </div>
          )}
          {groups.length > 0 && (
            <div className="card ir-groups">
              <h3>ألوان طلعت منتجات ثانية ({groups.length})</h3>
              <p>الأداة أخذت منتجات «قد يعجبك أيضاً» كأنها ألوان. افصلها عشان كل واحد يصير منتج باسمه، أو اخفها وضيفها من جديد بالأداة.</p>
              {groups.map(([key, g]) => (
                <div key={key} className="ir-group">
                  <div className="ir-thumbs">{g.slice(0, 10).map((p) => <img key={p.id} src={getImageUrl(p.image)} alt="" title={p.variant} />)}{g.length > 10 && <span>+{g.length - 10}</span>}</div>
                  <div className="ir-gname">{g[0].name_en} · {g.length} قطعة</div>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => split(key)}>افصلها</button>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm(`نخفي ${g.length} قطعة من المتجر؟`) && put({ ids: g.map((p) => p.id), status: 'draft' }, 'انخفت')}>اخفها</button>
                </div>
              ))}
            </div>
          )}

          <div className="ir-brands">
            <button className={!brandF ? 'on' : ''} onClick={() => setBrandF('')}>الكل <i>{rows.length}</i></button>
            {brandCounts.map(([b, n]) => <button key={b} className={brandF === b ? 'on' : ''} onClick={() => { setBrandF(b); setSel({}) }}>{b} <i>{n}</i></button>)}
          </div>

          <div className={`ir-bar ${ids.length ? 'show' : ''}`}>
            <label className="ir-all"><input type="checkbox" checked={allOn} onChange={(e) => setSel(e.target.checked ? Object.fromEntries(list.map((r) => [r.id, true])) : {})} /> الكل</label>
            {ids.length > 0 && <>
              <b>{ids.length} محدد</b>
              <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">غيّر البراند إلى…</option>
                {d.brands.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!to || busy} onClick={() => put({ ids, brand_id: Number(to) }, 'تغيّر البراند')}>تطبيق</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => put({ ids, status: 'draft' }, 'انخفت')}>إخفاء</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => put({ ids, status: 'active' }, 'رجعت تظهر')}>إظهار</button>
            </>}
          </div>

          {list.length === 0 ? <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>ما فيه منتجات مضافة بالأداة في هالفترة</div> : (
            <div className="ir-grid">
              {list.map((r) => (
                <label key={r.id} className={`ir-item ${sel[r.id] ? 'on' : ''} ${r.status !== 'active' ? 'off' : ''}`}>
                  <input type="checkbox" checked={!!sel[r.id]} onChange={(e) => setSel((s) => ({ ...s, [r.id]: e.target.checked }))} />
                  <div className="ir-img">{r.image ? <img src={getImageUrl(r.image)} alt="" loading="lazy" /> : null}</div>
                  <div className="ir-info">
                    <span className={`ir-b ${r.brand ? '' : 'none'}`}>{r.brand || 'بدون براند'}</span>
                    {r.brand_guess && <span className="ir-guess">الاسم يقول: {r.brand_guess}</span>}
                    <b>{r.name}</b>
                    <small>{Number(r.price).toFixed(3)} ر.ع{r.status !== 'active' ? ' · مخفي' : ''}{r.bad_group ? ' · لون مشكوك' : ''}</small>
                  </div>
                </label>
              ))}
            </div>
          )}
        </>
      )}
      <style>{`
.ir-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.ir-back{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;color:var(--text-secondary);text-decoration:none;margin-bottom:4px}
.ir-warn{display:flex;align-items:center;gap:12px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13.5px;flex-wrap:wrap}
.ir-groups{padding:14px 16px;margin-bottom:14px}
.ir-groups h3{margin:0;font-size:15px}
.ir-groups>p{margin:4px 0 10px;font-size:12.5px;color:var(--text-secondary)}
.ir-group{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border);padding:10px 0}
.ir-thumbs{display:flex;gap:4px;align-items:center}
.ir-thumbs img{width:40px;height:40px;object-fit:cover;border-radius:6px;background:#F4F3F1}
.ir-thumbs span{font-size:12px;color:var(--text-secondary);padding:0 4px}
.ir-gname{flex:1;min-width:160px;font-size:13px;font-weight:600}
.ir-brands{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.ir-brands button{border:1px solid var(--border);background:#fff;border-radius:99px;padding:5px 12px;font-size:12.5px;cursor:pointer;font-family:inherit}
.ir-brands button.on{background:#111;color:#fff;border-color:#111}
.ir-brands i{font-style:normal;opacity:.6;margin-inline-start:4px}
.ir-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;border-radius:10px;background:var(--bg-body);margin-bottom:10px;position:sticky;top:64px;z-index:3}
.ir-bar .input{height:34px;padding:0 10px;width:auto;min-width:180px}
.ir-all{display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer}
.ir-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
.ir-item{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:8px 10px;cursor:pointer}
.ir-item.on{border-color:#5C0B16;background:#FCF8F8}
.ir-item.off{opacity:.6}
.ir-img{width:56px;height:56px;border-radius:8px;background:#F4F3F1;overflow:hidden;flex-shrink:0}
.ir-img img{width:100%;height:100%;object-fit:cover}
.ir-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.ir-info b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ir-info small{font-size:11.5px;color:var(--text-secondary)}
.ir-b{font-size:10.5px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:var(--text-secondary)}
.ir-b.none{color:#B45309}
.ir-guess{font-size:11px;color:#B42318;font-weight:600}
.ir-edit{font-size:12px;color:var(--text-secondary)}
`}</style>
    </div>
  )
}
