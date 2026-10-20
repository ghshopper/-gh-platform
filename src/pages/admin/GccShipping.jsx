import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiGlobalLine, RiLoader4Line } from 'react-icons/ri'
import api from '../../services/api'

// Shipping to the Gulf: one switch turns it on for the website and the app.
// Customers see prices in their own currency; every payment is still OMR (Amwal).
export default function GccShipping() {
  const [s, setS] = useState(null)
  const [meta, setMeta] = useState([])
  const [carriers, setCarriers] = useState({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api.get('/admin/gcc-shipping').then((r) => { setS(r.data.data); setMeta(r.data.countries || []); setCarriers(r.data.carriers || {}) })
      .catch(() => toast.error('تعذر التحميل'))
  }, [])

  const set = (patch) => { setS((x) => ({ ...x, ...patch })); setDirty(true) }
  const setC = (code, patch) => { setS((x) => ({ ...x, countries: { ...x.countries, [code]: { ...x.countries[code], ...patch } } })); setDirty(true) }

  const save = async (next = s) => {
    setSaving(true)
    try {
      const r = await api.put('/admin/gcc-shipping', next)
      setS(r.data.data); setDirty(false)
      toast.success('انحفظ')
    } catch (e) {
      toast.error(e.response?.data?.message || 'ما انحفظ')
    } finally { setSaving(false) }
  }
  // the switch saves only itself (unsaved edits on the page stay as they are)
  const toggle = async () => {
    const on = !s.enabled
    if (!window.confirm(on ? 'نشغّل الشحن لدول الخليج في الموقع والتطبيق؟' : 'نوقف الشحن لدول الخليج؟ الطلبات الحالية ما تتأثر.')) return
    setSaving(true)
    try {
      const cur = await api.get('/admin/gcc-shipping')
      await api.put('/admin/gcc-shipping', { ...cur.data.data, enabled: on })
      setS((x) => ({ ...x, enabled: on }))
      toast.success(on ? 'الشحن للخليج شغّال' : 'الشحن للخليج موقّف')
    } catch (e) {
      toast.error(e.response?.data?.message || 'ما انحفظ')
    } finally { setSaving(false) }
  }

  if (!s) return <div className="page"><div className="gh-skel" style={{ height: 420 }} /></div>
  const on = s.enabled

  return (
    <div className="page gc" dir="rtl">
      <div className="gc-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>شحن الخليج</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>السعودية، الإمارات، الكويت، قطر، البحرين. العميل يشوف الأسعار بعملة بلده، والدفع دايماً بالريال العماني عبر أموال.</p>
        </div>
        {dirty && <button className="btn btn-primary" disabled={saving} onClick={() => save()}>{saving ? <RiLoader4Line className="spin" /> : null} حفظ التغييرات</button>}
      </div>

      <div className={`card gc-switch ${on ? 'on' : ''}`}>
        <div className="gc-switch-ic"><RiGlobalLine size={26} /></div>
        <div style={{ flex: 1 }}>
          <b>{on ? 'الشحن للخليج شغّال' : 'الشحن للخليج موقّف'}</b>
          <p>{on ? 'العملاء في دول الخليج يقدرون يختارون بلدهم ويطلبون من الموقع والتطبيق.' : 'ما يظهر للعملاء أي خيار خارج عُمان لين تشغّله.'}</p>
        </div>
        <button className={`gc-toggle ${on ? 'on' : ''}`} onClick={toggle} disabled={saving} aria-label="تشغيل الشحن للخليج"><i /></button>
      </div>

      <div className="gc-grid">
        <div className="card gc-box">
          <h3>السعر والمدة</h3>
          <label>سعر الشحن لكل دول الخليج (ر.ع)<input className="input" type="number" min="0" step="0.5" value={s.fee} onChange={(e) => set({ fee: e.target.value })} /></label>
          <div className="gc-row">
            <label>مدة الشحن من<input className="input" type="number" min="0" value={s.min_days} onChange={(e) => set({ min_days: e.target.value })} /></label>
            <label>إلى (أيام عمل)<input className="input" type="number" min="0" value={s.max_days} onChange={(e) => set({ max_days: e.target.value })} /></label>
          </div>
          <p className="gc-hint">تنضاف على مدة تجهيز الطلب نفسه. مثلاً قطعة من أوروبا (7–12 يوم) + الشحن ({s.min_days}–{s.max_days} أيام عمل).</p>
          <label>شركة الشحن
            <div className="gh-seg" style={{ width: '100%' }}>
              {Object.entries(carriers).map(([k, v]) => <button key={k} className={s.carrier === k ? 'on' : ''} onClick={() => set({ carrier: k })} style={{ flex: 1 }}>{v}</button>)}
            </div>
          </label>
          <p className="gc-hint">تقدر تغيّرها لأي طلب بعدين من صفحة الطلب.</p>
        </div>

        <div className="card gc-box">
          <h3>الدول والعملات</h3>
          <p className="gc-hint" style={{ marginTop: -4 }}>سعر الصرف: كم يساوي 1 ر.ع بعملة البلد. يُستخدم للعرض بس، الخصم دايماً بالريال العماني.</p>
          <div className="gc-countries">
            {meta.map((m) => {
              const c = s.countries[m.code] || {}
              return (
                <div key={m.code} className={`gc-country ${c.enabled ? '' : 'off'}`}>
                  <label className="gc-check"><input type="checkbox" checked={!!c.enabled} onChange={(e) => setC(m.code, { enabled: e.target.checked })} /><b>{m.name_ar}</b><small>{m.currency}</small></label>
                  <label className="gc-mini">1 ر.ع =<input className="input" type="number" step="0.001" min="0" value={c.rate ?? ''} onChange={(e) => setC(m.code, { rate: e.target.value })} />{m.symbol}</label>
                  <label className="gc-mini">شحن<input className="input" type="number" step="0.5" min="0" placeholder={String(s.fee)} value={c.fee ?? ''} onChange={(e) => setC(m.code, { fee: e.target.value === '' ? null : e.target.value })} />ر.ع</label>
                </div>
              )
            })}
          </div>
          <label className="gc-check" style={{ marginTop: 12 }}><input type="checkbox" checked={!!s.show_currency} onChange={(e) => set({ show_currency: e.target.checked })} />اعرض الأسعار بعملة بلد العميل في الموقع والتطبيق</label>
        </div>

        <div className="card gc-box">
          <h3>ملاحظة تظهر للعميل عند الدفع (اختياري)</h3>
          <label>بالعربي<textarea className="input" rows={2} value={s.note_ar} onChange={(e) => set({ note_ar: e.target.value })} placeholder="مثلاً: أي رسوم جمركية في بلدك يدفعها المستلم عند التوصيل" /></label>
          <label>English<textarea className="input" rows={2} dir="ltr" value={s.note_en} onChange={(e) => set({ note_en: e.target.value })} placeholder="e.g. Any customs duties in your country are paid by the recipient" /></label>
        </div>

        <div className="card gc-box">
          <h3>روابط تتبّع الشحنة</h3>
          <p className="gc-hint" style={{ marginTop: -4 }}>حط {'{n}'} مكان رقم الشحنة. العميل يشوف زر «تتبّع الشحنة» في صفحة طلبه.</p>
          <label>DHL<input className="input" dir="ltr" value={s.tracking_dhl} onChange={(e) => set({ tracking_dhl: e.target.value })} /></label>
          <label>جيناكم<input className="input" dir="ltr" value={s.tracking_genacom} onChange={(e) => set({ tracking_genacom: e.target.value })} placeholder="https://…{n}" /></label>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.gc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.gc-switch{display:flex;align-items:center;gap:16px;padding:18px 20px;margin-bottom:16px}
.gc-switch.on{border-color:#5C0B16;background:#FCF8F8}
.gc-switch-ic{width:52px;height:52px;border-radius:14px;background:var(--bg-body);display:flex;align-items:center;justify-content:center;color:var(--text-secondary)}
.gc-switch.on .gc-switch-ic{background:#5C0B16;color:#F2E3C8}
.gc-switch b{font-size:16px}
.gc-switch p{margin:2px 0 0;font-size:13px;color:var(--text-secondary)}
.gc-toggle{width:58px;height:32px;border-radius:99px;border:0;background:#D9D5CF;position:relative;cursor:pointer;flex-shrink:0;transition:background .2s}
.gc-toggle i{position:absolute;top:3px;inset-inline-start:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:inset-inline-start .2s}
.gc-toggle.on{background:#5C0B16}
.gc-toggle.on i{inset-inline-start:29px}
.gc-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.gc-box{padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.gc-box h3{margin:0;font-size:15px;font-weight:700}
.gc-box label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}
.gc-box .input{height:40px;padding:0 12px}
.gc-box textarea.input{height:auto;padding:8px 12px}
.gc-row{display:flex;gap:12px}.gc-row label{flex:1}
.gc-hint{font-size:12px;color:var(--text-secondary);margin:0;font-weight:400}
.gc-countries{display:flex;flex-direction:column;gap:8px}
.gc-country{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--border);border-radius:10px;padding:8px 12px}
.gc-country.off{opacity:.55}
.gc-check{flex-direction:row!important;align-items:center;gap:8px!important;flex:1;min-width:150px;cursor:pointer}
.gc-check small{color:var(--text-light);font-weight:500}
.gc-mini{flex-direction:row!important;align-items:center;gap:6px!important;font-weight:500!important;color:var(--text-secondary)}
.gc-mini .input{width:86px;height:34px!important;padding:0 8px!important;direction:ltr}
@media(max-width:1000px){.gc-grid{grid-template-columns:1fr!important}}
`
