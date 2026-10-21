import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiRadarLine, RiExternalLinkLine, RiLoader4Line, RiArrowLeftLine, RiRefreshLine } from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import Empty from '../../components/Empty'

// Every product added with the import tool is checked on the brand's site
// once a week: price changed, sold out there, or removed.
const TABS = [
  ['alerts', 'يحتاج نظرك'],
  ['price', 'تغيّر السعر'],
  ['out', 'خلصت عندهم'],
  ['gone', 'انشالت'],
  ['blocked', 'ما قدرنا نشيك'],
  ['ok', 'ما تغيّر شي'],
  ['all', 'الكل'],
]
const STATE = {
  price: ['تغيّر السعر', '#B45309', '#FFFBEB'],
  out: ['خلصت عندهم', '#B42318', '#FEF3F2'],
  gone: ['انشالت من موقعهم', '#B42318', '#FEF3F2'],
  blocked: ['ما قدرنا نشيك', '#6E6A66', '#F3F1EE'],
  region: ['أسعار بلد ثاني', '#6E6A66', '#F3F1EE'],
  ok: ['ما تغيّر', '#047857', '#ECFDF5'],
}
const n = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
const omr = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const ago = (s) => {
  if (!s) return 'ما انشيك للحين'
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
  return d <= 0 ? 'انشيك اليوم' : d === 1 ? 'انشيك أمس' : `انشيك قبل ${d} أيام`
}

export default function SourceWatch() {
  const [tab, setTab] = useState('alerts')
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState(null)
  const [custom, setCustom] = useState({})
  const load = () => api.get('/admin/source-watch', { params: { state: tab } }).then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  useEffect(() => { setD(null); load() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, path, body, msg) => {
    setBusy(id + path)
    try { await api.post(`/admin/source-watch/${id}/${path}`, body || {}); toast.success(msg); await load() } catch (e) { toast.error(e.response?.data?.message || 'تعذر') } finally { setBusy(null) }
  }
  const runNow = async () => {
    setBusy('run')
    try {
      const r = await api.post('/admin/source-watch/run', {}, { timeout: 300000 })
      toast.success(`انشيك ${r.data.checked} منتج${r.data.left ? ` · باقي ${r.data.left} تنشيك خلال الأسبوع` : ''}`)
      await load()
    } catch { toast.error('تعذر') } finally { setBusy(null) }
  }

  const c = d?.counts
  return (
    <div className="page sw" dir="rtl">
      <div className="sw-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>مراقبة مواقع البراندات</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>كل منتج ضفته بالأداة ينشيك في موقع البراند مرة بالأسبوع: تغيّر سعره؟ خلص عندهم؟ انشال من موقعهم؟</p>
        </div>
        <button className="btn btn-ghost" disabled={busy === 'run'} onClick={runNow}>{busy === 'run' ? <RiLoader4Line className="spin" /> : <RiRefreshLine />} شيك الحين</button>
      </div>

      {c && (
        <div className="sw-cards">
          <div className="card"><small>منتجات تحت المراقبة</small><b>{c.total}</b></div>
          <div className="card warn"><small>تغيّر سعرها</small><b>{c.price}</b></div>
          <div className="card bad"><small>خلصت أو انشالت</small><b>{c.out + c.gone}</b></div>
          <div className="card"><small>ما قدرنا نشيك</small><b>{c.blocked}</b></div>
        </div>
      )}

      <div className="gh-seg sw-tabs">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {!d ? <div className="gh-skel" style={{ height: 300 }} /> : d.data.length === 0 ? (
        <div className="card"><Empty icon={RiRadarLine} title={tab === 'alerts' ? 'كل شي تمام 👌' : 'ما فيه شي هنا'} hint={tab === 'alerts' ? 'ما فيه منتج تغيّر سعره أو خلص عند البراند.' : c?.waiting ? `${c.waiting} منتج للحين ما انشيك، تنشيك خلال الأسبوع.` : ''} /></div>
      ) : (
        <div className="sw-list">
          {d.data.map((r) => {
            const st = STATE[r.state] || ['ما انشيك', '#6E6A66', '#F3F1EE']
            const up = r.new_price != null && r.new_price > r.source_price
            return (
              <div key={r.id} className="card sw-row">
                <div className="sw-img">{r.image ? <img src={getImageUrl(r.image)} alt="" /> : null}</div>
                <div className="sw-info">
                  <div className="sw-top">
                    <span className="sw-brand">{r.brand}</span>
                    <span className="badge" style={{ color: st[1], background: st[2] }}>{st[0]}</span>
                    {r.product_status && r.product_status !== 'active' && <span className="badge">مخفي من المتجر</span>}
                  </div>
                  <b>{r.name}</b>
                  {r.state === 'price' && (
                    <div className="sw-price">
                      <span dir="ltr">{n(r.source_price)} {r.currency}</span>
                      <RiArrowLeftLine />
                      <span dir="ltr" className={up ? 'up' : 'down'}>{n(r.new_price)} {r.new_currency || r.currency}</span>
                      <em className={up ? 'up' : 'down'}>{up ? '▲' : '▼'} {Math.abs(Math.round(((r.new_price - r.source_price) * 100) / r.source_price))}%</em>
                    </div>
                  )}
                  <small>{r.note ? r.note + ' · ' : ''}{ago(r.checked_at)}{r.pieces > 1 ? ` · ${r.pieces} ألوان` : ''} · <a href={r.url} target="_blank" rel="noreferrer">صفحة البراند <RiExternalLinkLine /></a></small>
                </div>
                <div className="sw-act">
                  {r.state === 'price' && <>
                    <div className="sw-sugg">
                      <small>سعرك الحين <b dir="ltr">{omr(r.shop_price)}</b></small>
                      <label>المقترح <input className="input" type="number" min="1" step="0.5" dir="ltr" value={custom[r.id] ?? r.suggested ?? ''} onChange={(e) => setCustom((x) => ({ ...x, [r.id]: e.target.value }))} /> ر.ع</label>
                    </div>
                    <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act(r.id, 'apply', { price: Number(custom[r.id] ?? r.suggested) || null }, 'تحدّث السعر في المتجر')}>اعتمد السعر</button>
                    <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(r.id, 'dismiss', {}, 'خليناه على سعره')}>خلّه على سعري</button>
                  </>}
                  {(r.state === 'out' || r.state === 'gone') && <>
                    {r.product_status === 'active'
                      ? <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act(r.id, 'hide', {}, 'انخفى من المتجر')}>اخفه من المتجر</button>
                      : <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(r.id, 'hide', { show: true }, 'رجع يظهر')}>رجّعه يظهر</button>}
                    <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(r.id, 'dismiss', {}, 'تمام')}>تجاهل</button>
                  </>}
                  <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(r.id, 'check', {}, 'انشيك')}>{busy === r.id + 'check' ? <RiLoader4Line className="spin" /> : null} شيك الحين</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="sw-foot">بعض مواقع البراندات تمنع أي شي غير المتصفح، فتطلع في «ما قدرنا نشيك». وأحياناً الموقع يعرض للسيرفر أسعار بلد ثاني، فما نقارنها عشان ما نغلط.</p>
      <style>{`
.sw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.sw-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.sw-cards .card{padding:12px 16px;margin:0;display:flex;flex-direction:column;gap:2px}
.sw-cards small{font-size:12px;color:var(--text-secondary)}
.sw-cards b{font-size:22px}
.sw-cards .warn b{color:#B45309}.sw-cards .bad b{color:#B42318}
.sw-tabs{margin-bottom:12px;flex-wrap:wrap}
.sw-list{display:flex;flex-direction:column;gap:8px}
.sw-row{display:flex;gap:14px;align-items:center;padding:12px 14px;margin:0;flex-wrap:wrap}
.sw-img{width:64px;height:64px;border-radius:10px;background:#F4F3F1;overflow:hidden;flex-shrink:0}
.sw-img img{width:100%;height:100%;object-fit:cover}
.sw-info{flex:1;min-width:220px;display:flex;flex-direction:column;gap:3px}
.sw-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sw-brand{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;color:var(--text-secondary)}
.sw-info b{font-size:14px}
.sw-info small{font-size:12px;color:var(--text-light)}
.sw-info small a{color:inherit;display:inline-flex;align-items:center;gap:2px}
.sw-price{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
.sw-price .up{color:#B42318}.sw-price .down{color:#047857}
.sw-price em{font-style:normal;font-size:12px}
.sw-act{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sw-sugg{display:flex;flex-direction:column;gap:4px;font-size:12px}
.sw-sugg label{display:flex;align-items:center;gap:6px;font-weight:600}
.sw-sugg .input{width:90px;height:34px;padding:0 8px}
.sw-foot{font-size:12px;color:var(--text-secondary);margin-top:12px}
@media(max-width:800px){.sw-cards{grid-template-columns:1fr 1fr}}
`}</style>
    </div>
  )
}
