import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiAddLine, RiFileCopyLine, RiMegaphoneLine, RiArchiveLine, RiInboxUnarchiveLine } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'

// One link per story, ad or influencer: ghshopper.com/c/xxxx opens the page you
// choose, and the visits and orders it brings are counted here.
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function Campaigns() {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState({ name: '', target: '/' })
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const load = () => api.get('/admin/campaigns').then((r) => setRows(r.data.data || [])).catch(() => setRows([]))
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('اكتب اسم الحملة')
    setSaving(true)
    try {
      await api.post('/admin/campaigns', form)
      toast.success('جاهز، انسخ الرابط وحطه في الستوري أو الإعلان')
      setForm({ name: '', target: '/' })
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'تعذر') } finally { setSaving(false) }
  }
  const copy = (u) => { navigator.clipboard.writeText(u); toast.success('نسخت الرابط') }
  const archive = (c) => api.post(`/admin/campaigns/${c.id}/archive`).then(load)
  const list = (rows || []).filter((c) => showArchived || !c.archived)
  const best = Math.max(...list.map((c) => c.visitors), 1)

  return (
    <div className="page cp2" dir="rtl">
      <h1 className="page-title-main" style={{ margin: 0 }}>روابط الحملات</h1>
      <p className="page-subtitle" style={{ margin: '4px 0 18px' }}>رابط لكل ستوري أو إعلان أو مشهورة، وتشوف كم زائر وكم طلب جاب كل واحد.</p>

      <form className="card cp2-form" onSubmit={create}>
        <label>اسم الحملة<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: ستوري جولة أوروبا · إعلان سناب ديور" /></label>
        <label>يفتح على
          <input className="input" dir="ltr" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="/ أو رابط منتج أو براند من الموقع" />
        </label>
        <button className="btn btn-primary" disabled={saving}><RiAddLine /> سوّ الرابط</button>
        <p className="cp2-hint">الصق أي رابط من ghshopper.com (منتج، براند، تصنيف) أو خلّه «/» للرئيسية. الطلب ينحسب للحملة إذا طلب الزائر خلال 7 أيام.</p>
      </form>

      {rows === null ? <div className="gh-skel" style={{ height: 200 }} /> : list.length === 0 ? (
        <div className="card"><Empty icon={RiMegaphoneLine} title="ما فيه حملات للحين" hint="سوّ رابط لأول ستوري أو إعلان، وبتطلع أرقامه هنا." /></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>الحملة</th><th>الرابط</th><th>زوار</th><th>طلبات</th><th>المبيعات</th><th>نسبة الشراء</th><th></th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} style={{ opacity: c.archived ? 0.5 : 1 }}>
                    <td><b>{c.name}</b><div style={{ fontSize: 11.5, color: 'var(--text-light)' }} dir="ltr">{c.target}</div></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => copy(c.url)} dir="ltr"><RiFileCopyLine /> {c.url.replace(/^https?:\/\//, '')}</button></td>
                    <td>
                      <b>{c.visitors}</b>
                      <div className="cp2-bar"><i style={{ width: `${(c.visitors / best) * 100}%` }} /></div>
                    </td>
                    <td><b>{c.orders}</b></td>
                    <td>{money(c.sales)} <span style={{ fontSize: 11, color: 'var(--text-light)' }}>ر.ع</span></td>
                    <td>{c.conversion}%</td>
                    <td><button className="icon-btn" title={c.archived ? 'رجّعها' : 'أرشفة'} onClick={() => archive(c)}>{c.archived ? <RiInboxUnarchiveLine size={18} /> : <RiArchiveLine size={18} />}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {(rows || []).some((c) => c.archived) && <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 12 }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> اعرض المؤرشفة</label>}
      <style>{`
.cp2-form{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;padding:16px 18px;margin-bottom:16px}
.cp2-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}
.cp2-form .input{height:42px;padding:0 12px}
.cp2-form .btn{height:42px}
.cp2-hint{grid-column:1/-1;margin:0;font-size:12px;color:var(--text-secondary)}
.cp2-bar{height:4px;background:var(--bg-body);border-radius:9px;margin-top:4px;width:80px}
.cp2-bar i{display:block;height:100%;background:#5C0B16;border-radius:9px}
@media(max-width:768px){.cp2-form{grid-template-columns:1fr!important}}
`}</style>
    </div>
  )
}
