import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { RiPulseLine, RiRefreshLine, RiCheckLine, RiFileCopyLine, RiSmartphoneLine, RiComputerLine, RiShoppingBag3Line, RiUser3Line } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'

// System status and visitors: who is on the website / app right now, visit
// statistics, the health of each part of the system, errors, and the product
// catalog for Instagram and Google ads.
const TABS = [['live', 'لايف'], ['stats', 'الإحصائيات'], ['status', 'حالة النظام'], ['errors', 'الأخطاء'], ['catalog', 'كتالوج الإعلانات']]
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const PLAT = { ios: 'iPhone', android: 'Android', desktop: 'كمبيوتر', mobile: 'جوال' }
const n = (v) => Number(v || 0).toLocaleString('en-US')

export default function Monitor() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'live'
  const setTab = (t) => setParams({ tab: t }, { replace: true })
  return (
    <div className="page mn" dir="rtl">
      <div className="mn-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>حالة النظام والزوار</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>مين داخل الموقع والتطبيق الحين، الإحصائيات، وصحة كل جزء من النظام.</p>
        </div>
        <div className="gh-seg">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      </div>
      {tab === 'live' && <Live />}
      {tab === 'stats' && <Stats />}
      {tab === 'status' && <Status />}
      {tab === 'errors' && <Errors />}
      {tab === 'catalog' && <Catalog />}
      <style>{CSS}</style>
    </div>
  )
}

function Live() {
  const [d, setD] = useState(null)
  useEffect(() => {
    let on = true
    const load = () => api.get('/admin/monitor/live').then((r) => on && setD(r.data)).catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => { on = false; clearInterval(t) }
  }, [])
  if (!d) return <div className="gh-skel" style={{ height: 300 }} />
  return (
    <>
      <div className="mn-cards">
        <div className="mn-card hero"><small><i className="mn-dot" /> داخلين الحين</small><b>{d.now}</b><span>يتحدث كل 10 ثواني</span></div>
        <div className="mn-card"><small><RiComputerLine /> الموقع</small><b>{d.web}</b></div>
        <div className="mn-card"><small><RiSmartphoneLine /> التطبيق</small><b>{d.app}</b></div>
        <div className="mn-card"><small><RiShoppingBag3Line /> عندهم سلة</small><b>{d.with_cart}</b></div>
        <div className="mn-card"><small><RiUser3Line /> مسجّلين دخول</small><b>{d.signed_in}</b></div>
        <div className="mn-card"><small>زوار اليوم</small><b>{n(d.today_visitors)}</b></div>
      </div>
      <div className="mn-grid">
        <div className="card mn-panel">
          <h3>مين داخل وين</h3>
          {d.sessions.length === 0 ? <Empty compact icon={RiPulseLine} title="ما فيه أحد داخل الحين" hint="أول ما يفتح أحد الموقع أو التطبيق بيطلع هنا." /> : (
            <div className="mn-live">
              {d.sessions.map((s, i) => (
                <div key={i} className="mn-live-row">
                  <span className={`mn-src ${s.source}`}>{s.source === 'app' ? <RiSmartphoneLine /> : <RiComputerLine />}{PLAT[s.platform] || (s.source === 'app' ? 'التطبيق' : 'الموقع')}</span>
                  <span className="mn-page">{s.page}</span>
                  {s.user && <span className="mn-user">{s.user}</span>}
                  {s.cart > 0 && <span className="mn-cart"><RiShoppingBag3Line /> {s.cart}</span>}
                  <span className="mn-since">{s.since ? `${s.since} د` : 'الحين'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card mn-panel">
          <h3>الصفحات المفتوحة الحين</h3>
          {Object.keys(d.top_now || {}).length === 0 ? <Empty compact title="—" /> : <Bars rows={Object.entries(d.top_now).map(([page, v]) => ({ page, v }))} label="page" value="v" />}
        </div>
      </div>
    </>
  )
}

function Bars({ rows, label, value, fmt = n, sub }) {
  const max = Math.max(...rows.map((r) => Number(r[value]) || 0), 1)
  return (
    <div className="mn-bars">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mn-bar-top"><span>{r[label]}</span><b>{fmt(r[value])}{sub ? <em> · {sub(r)}</em> : null}</b></div>
          <div className="mn-bar"><i style={{ width: `${Math.max(2, (Number(r[value]) / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function Stats() {
  const [days, setDays] = useState(7)
  const [d, setD] = useState(null)
  useEffect(() => {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - (days - 1))
    setD(null)
    api.get('/admin/monitor/analytics', { params: { from: iso(from), to: iso(to) } }).then((r) => setD(r.data)).catch(() => toast.error('تعذر التحميل'))
  }, [days])
  const daily = useMemo(() => {
    if (!d?.from) return []
    const map = Object.fromEntries((d.daily || []).map((x) => [x.d, x]))
    const out = []; const cur = new Date(d.from + 'T00:00:00'); const end = new Date(d.to + 'T00:00:00')
    while (cur <= end && out.length < 400) { const k = iso(cur); out.push({ d: k, visitors: Number(map[k]?.visitors || 0), views: Number(map[k]?.views || 0) }); cur.setDate(cur.getDate() + 1) }
    return out
  }, [d])
  const change = d && d.prev_visitors ? Math.round(((d.visitors - d.prev_visitors) / d.prev_visitors) * 100) : null
  const srcRows = (d?.by_source || []).map((r) => ({ label: `${r.source === 'app' ? 'التطبيق' : 'الموقع'} · ${PLAT[r.platform] || '—'}`, v: Number(r.visitors), views: Number(r.views) }))
  const maxDay = Math.max(...daily.map((x) => x.visitors), 1)
  const hours = Array.from({ length: 24 }, (_, h) => Number(d?.hours?.[h] || 0))
  const maxH = Math.max(...hours, 1)
  return (
    <>
      <div className="gh-seg" style={{ marginBottom: 14 }}>
        {[[1, 'اليوم'], [7, '7 أيام'], [30, '30 يوم'], [90, '3 شهور']].map(([k, l]) => <button key={k} className={days === k ? 'on' : ''} onClick={() => setDays(k)}>{l}</button>)}
      </div>
      {!d ? <div className="gh-skel" style={{ height: 360 }} /> : d.empty || !d.visitors ? (
        <div className="card"><Empty icon={RiPulseLine} title="ما فيه زيارات مسجّلة في هذي الفترة" hint="العد يبدأ من أول ما ينزل التحديث: الموقع على طول، والتطبيق من النسخة الجاية." /></div>
      ) : (
        <>
          <div className="mn-cards">
            <div className="mn-card hero"><small>الزوار</small><b>{n(d.visitors)}</b>{change != null && <span className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)}% عن الفترة اللي قبلها</span>}</div>
            <div className="mn-card"><small>زوار جدد</small><b>{n(d.new)}</b></div>
            <div className="mn-card"><small>مشاهدات الصفحات</small><b>{n(d.views)}</b></div>
            <div className="mn-card"><small>صفحات لكل زائر</small><b>{d.pages_per_visitor}</b></div>
            <div className="mn-card"><small>طلبات</small><b>{n(d.orders)}</b></div>
            <div className="mn-card"><small>نسبة الشراء</small><b>{d.conversion}%</b></div>
          </div>
          <div className="card mn-panel">
            <h3>الزوار كل يوم</h3>
            <div className="mn-daily">{daily.map((x) => <div key={x.d} title={`${x.d}: ${x.visitors} زائر · ${x.views} مشاهدة`}><i style={{ height: `${x.visitors ? Math.max(3, (x.visitors / maxDay) * 100) : 0}%` }} /></div>)}</div>
          </div>
          <div className="mn-grid">
            <div className="card mn-panel"><h3>أكثر الصفحات زيارة</h3><Bars rows={d.pages} label="page" value="views" sub={(r) => `${n(r.visitors)} زائر`} /></div>
            <div className="card mn-panel"><h3>أكثر المنتجات مشاهدة</h3>{d.products?.length ? <Bars rows={d.products} label="name" value="views" sub={(r) => `${n(r.visitors)} زائر`} /> : <Empty compact title="—" />}</div>
            <div className="card mn-panel"><h3>من وين يدخلون</h3><Bars rows={srcRows} label="label" value="v" sub={(r) => `${n(r.views)} مشاهدة`} />
              {d.referrers?.length ? <><h3 style={{ marginTop: 16 }}>جايين من</h3><Bars rows={d.referrers.map((r) => ({ ...r, visitors: Number(r.visitors) }))} label="referrer" value="visitors" /></> : null}
            </div>
            <div className="card mn-panel">
              <h3>من الزيارة للطلب</h3>
              <Bars rows={[{ l: 'دخلوا', v: d.funnel.visitors }, { l: 'شافوا منتج', v: d.funnel.product }, { l: 'وصلوا صفحة الدفع', v: d.funnel.checkout }, { l: 'طلبوا', v: d.funnel.orders }]} label="l" value="v" />
              <h3 style={{ marginTop: 16 }}>أوقات الزيارة (بتوقيت عُمان)</h3>
              <div className="mn-hours">{hours.map((v, h) => <div key={h} title={`${h}:00 — ${v} مشاهدة`}><i style={{ height: `${v ? Math.max(4, (v / maxH) * 100) : 0}%` }} /><span>{h % 3 === 0 ? h : ''}</span></div>)}</div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

const STATE = { ok: ['شغّال', '#047857', '#ECFDF5'], warn: ['انتبه', '#B45309', '#FFFBEB'], fail: ['مشكلة', '#B42318', '#FEF3F2'], info: ['', '#6E6A66', '#F3F1EE'] }

function Status() {
  const [d, setD] = useState(null)
  const load = () => { setD(null); api.get('/admin/monitor/status').then((r) => setD(r.data)).catch(() => toast.error('تعذر الفحص')) }
  useEffect(() => { load() }, [])
  if (!d) return <div className="gh-skel" style={{ height: 300 }} />
  const top = STATE[d.state]
  return (
    <>
      <div className="card mn-status-top" style={{ borderColor: top[1], background: top[2] }}>
        <b style={{ color: top[1] }}>{d.state === 'ok' ? 'كل شي شغّال ✓' : d.state === 'warn' ? 'شغّال، بس فيه أشياء تحتاج انتباه' : 'فيه مشكلة تحتاج حل'}</b>
        <span>فحص الساعة {d.server.time} · PHP {d.server.php} · Laravel {d.server.laravel}</span>
        <button className="btn btn-ghost btn-sm" onClick={load}><RiRefreshLine /> افحص مرة ثانية</button>
      </div>
      <div className="mn-checks">
        {d.checks.map((c) => {
          const s = STATE[c.state] || STATE.info
          return (
            <div key={c.key} className="card mn-check">
              <i style={{ background: s[1] }} />
              <div><b>{c.label}</b><span>{c.detail}</span></div>
              {s[0] && <em style={{ color: s[1], background: s[2] }}>{s[0]}</em>}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Errors() {
  const [rows, setRows] = useState(null)
  const [all, setAll] = useState(false)
  const load = () => api.get('/admin/monitor/errors', { params: { all: all ? 1 : 0 } }).then((r) => setRows(r.data.data || [])).catch(() => setRows([]))
  useEffect(() => { load() }, [all]) // eslint-disable-line react-hooks/exhaustive-deps
  const resolve = (e) => api.post(`/admin/monitor/errors/${e.id}/resolve`).then(() => { toast.success('انحل'); load() })
  const SRC = { server: 'السيرفر', web: 'الموقع', app: 'التطبيق' }
  return (
    <>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> اعرض اللي انحلت بعد</label>
      {rows === null ? <div className="gh-skel" style={{ height: 200 }} /> : rows.length === 0 ? (
        <div className="card"><Empty icon={RiCheckLine} title="ما فيه أخطاء 👌" hint="أي خطأ في السيرفر أو الموقع أو التطبيق يطلع هنا، ويوصل جوالات الفريق إشعار (مرة بالساعة لكل خطأ)." /></div>
      ) : (
        <div className="mn-errors">
          {rows.map((e) => (
            <div key={e.id} className={`card mn-err ${e.resolved_at ? 'done' : ''}`}>
              <div className="mn-err-top">
                <span className="badge" style={{ background: '#FEF3F2', color: '#B42318' }}>{SRC[e.source] || e.source}</span>
                <b>{e.kind}</b>
                <span className="mn-err-count">{e.count} مرة</span>
                <span className="mn-err-when">آخر مرة {new Date(String(e.last_seen).replace(' ', 'T') + 'Z').toLocaleString('ar-OM', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                {!e.resolved_at && <button className="btn btn-ghost btn-sm" onClick={() => resolve(e)}><RiCheckLine /> انحل</button>}
              </div>
              <div className="mn-err-msg">{e.message}</div>
              <div className="mn-err-where">{[e.url, e.where].filter(Boolean).join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Catalog() {
  const [d, setD] = useState(null)
  useEffect(() => { api.get('/admin/monitor/catalog').then((r) => setD(r.data)).catch(() => {}) }, [])
  const copy = (u) => { navigator.clipboard.writeText(u); toast.success('نسخت الرابط') }
  if (!d) return <div className="gh-skel" style={{ height: 300 }} />
  const en = d.url + '?lang=en'
  return (
    <>
      <div className="mn-cards">
        <div className="mn-card hero"><small>منتجات في الكتالوج</small><b>{n(d.in_feed)}</b><span>من {n(d.active)} منتج نشط</span></div>
        <div className="mn-card"><small>بدون صورة (ما تدخل)</small><b>{n(d.no_image)}</b></div>
        <div className="mn-card"><small>بدون سعر (ما تدخل)</small><b>{n(d.no_price)}</b></div>
      </div>
      <div className="card mn-panel">
        <h3>روابط الكتالوج</h3>
        <p className="mn-hint">يتحدث وحده كل 30 دقيقة: الأسعار، العروض، والمتوفر.</p>
        {[['بالعربي', d.url], ['English', en]].map(([l, u]) => (
          <div key={u} className="mn-url"><span>{l}</span><code dir="ltr">{u}</code><button className="btn btn-ghost btn-sm" onClick={() => copy(u)}><RiFileCopyLine /> نسخ</button></div>
        ))}
      </div>
      <div className="mn-grid">
        <div className="card mn-panel">
          <h3>انستقرام وفيسبوك (Meta)</h3>
          <ol className="mn-steps">
            <li>افتح <b>Commerce Manager</b> من business.facebook.com وسوِّ كتالوج جديد «E-commerce».</li>
            <li>Data sources ← Add items ← <b>Data feed</b> ← «Scheduled feed».</li>
            <li>الصق رابط الكتالوج، والتحديث «كل يوم»، والعملة OMR.</li>
            <li>اربط الكتالوج بحساب انستقرام من Instagram Shopping، وبعد الموافقة تقدر تسوي تاق للقطع في البوستات والستوري.</li>
            <li>في Ads Manager استخدم «Advantage+ catalog ads» عشان تطلع الإعلانات بالقطع اللي شافها كل شخص.</li>
          </ol>
        </div>
        <div className="card mn-panel">
          <h3>قوقل (Google Merchant Center)</h3>
          <ol className="mn-steps">
            <li>افتح merchants.google.com وسجّل النشاط، الدولة: عُمان.</li>
            <li>Products ← Add products ← <b>Add from a file</b> ← «Enter a link to your file».</li>
            <li>الصق رابط الكتالوج (الإنجليزي أفضل لقوقل)، والتحديث يومي.</li>
            <li>أكّد ملكية الموقع ghshopper.com، وفعّل «Free listings» عشان تطلع منتجاتك في Google Shopping ببلاش.</li>
          </ol>
        </div>
      </div>
    </>
  )
}

const CSS = `
.mn-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.mn-cards{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:16px}
.mn-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
.mn-card small{color:var(--text-secondary);font-size:12px;display:flex;align-items:center;gap:5px}
.mn-card b{font-size:24px;font-weight:700}
.mn-card span{font-size:11.5px;color:var(--text-light)}
.mn-card span.up{color:#047857}.mn-card span.down{color:#B42318}
.mn-card.hero{background:#111;border-color:#111;color:#fff}
.mn-card.hero small,.mn-card.hero span{color:rgba(255,255,255,.7)}
.mn-dot{width:8px;height:8px;border-radius:50%;background:#22C55E;display:inline-block;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:mn-pulse 1.6s infinite}
@keyframes mn-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.mn-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.mn-panel{padding:18px 20px;margin-bottom:16px}
.mn-grid .mn-panel{margin-bottom:0}
.mn-panel h3{margin:0 0 12px;font-size:15px;font-weight:700}
.mn-live{display:flex;flex-direction:column;gap:6px;max-height:460px;overflow-y:auto}
.mn-live-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--divider);border-radius:10px;font-size:13px}
.mn-src{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:2px 8px;border-radius:999px;background:var(--bg-body);color:var(--text-secondary);white-space:nowrap}
.mn-src.app{background:#F3E8EA;color:#5C0B16}
.mn-page{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.mn-user{font-size:12px;color:var(--text-secondary)}
.mn-cart{display:inline-flex;align-items:center;gap:3px;font-size:12px;color:#B45309}
.mn-since{font-size:11.5px;color:var(--text-light);white-space:nowrap}
.mn-bars{display:flex;flex-direction:column;gap:10px}
.mn-bar-top{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:4px}
.mn-bar-top span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mn-bar-top em{font-style:normal;color:var(--text-light);font-weight:400;font-size:12px}
.mn-bar{height:7px;background:var(--bg-body);border-radius:99px;overflow:hidden}
.mn-bar i{display:block;height:100%;background:#5C0B16;border-radius:99px}
.mn-daily{display:flex;align-items:flex-end;gap:3px;height:150px;border-bottom:1px solid var(--border)}
.mn-daily>div{flex:1;height:100%;display:flex;align-items:flex-end}
.mn-daily i{display:block;width:100%;background:#111;border-radius:3px 3px 0 0}
.mn-daily>div:hover i{background:#5C0B16}
.mn-hours{display:flex;align-items:flex-end;gap:2px;height:90px;direction:ltr}
.mn-hours>div{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}
.mn-hours i{display:block;width:100%;background:#A88443;border-radius:2px 2px 0 0}
.mn-hours span{font-size:9.5px;color:var(--text-light);height:12px}
.mn-status-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 18px;margin-bottom:14px;border-width:1.5px}
.mn-status-top b{font-size:16px}
.mn-status-top span{flex:1;font-size:12.5px;color:var(--text-secondary)}
.mn-checks{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.mn-check{margin:0!important;display:flex;align-items:center;gap:12px;padding:14px 16px}
.mn-check>i{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.mn-check>div{flex:1;display:flex;flex-direction:column;gap:2px}
.mn-check span{font-size:12.5px;color:var(--text-secondary)}
.mn-check em{font-style:normal;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:999px}
.mn-errors{display:flex;flex-direction:column;gap:10px}
.mn-err{padding:14px 16px;margin:0!important}
.mn-err.done{opacity:.55}
.mn-err-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mn-err-count{font-size:12px;font-weight:600;color:#B42318}
.mn-err-when{flex:1;font-size:12px;color:var(--text-light)}
.mn-err-msg{margin-top:8px;font-family:ui-monospace,monospace;font-size:12.5px;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-word;background:var(--bg-body);padding:8px 10px;border-radius:8px}
.mn-err-where{margin-top:6px;font-size:11.5px;color:var(--text-light);direction:ltr;text-align:left}
.mn-hint{font-size:12.5px;color:var(--text-secondary);margin:-6px 0 12px}
.mn-url{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--divider)}
.mn-url span{width:64px;font-size:12.5px;color:var(--text-secondary)}
.mn-url code{flex:1;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mn-steps{margin:0;padding-inline-start:20px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.7;color:var(--text-secondary)}
.mn-steps b{color:var(--ink)}
@media(max-width:1200px){.mn-cards{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.mn-cards{grid-template-columns:1fr 1fr}.mn-grid,.mn-checks{grid-template-columns:1fr!important}.mn-head .gh-seg{overflow-x:auto;flex-wrap:nowrap}}
`
