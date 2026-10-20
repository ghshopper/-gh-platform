import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'

/** Early access for the top tier: new pieces are theirs alone for N hours. */
export default function VipEarly() {
  const [hours, setHours] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { api.get('/admin/vip-settings').then((r) => setHours(r.data.hours ?? 0)).catch(() => setHours(0)) }, [])
  const save = async (h) => {
    setSaving(true)
    try {
      const r = await api.put('/admin/vip-settings', { hours: h })
      setHours(r.data.hours)
      toast.success(r.data.hours ? `القطع الجديدة لعملاء الأسود أول ${r.data.hours} ساعة` : 'الوصول المبكر موقّف')
    } catch { toast.error('ما انحفظ') } finally { setSaving(false) }
  }
  if (hours === null) return null
  return (
    <div className="vip-early">
      <div className="vip-early-ic">🖤</div>
      <div style={{ flex: 1 }}>
        <b>وصول مبكر لمستوى الأسود</b>
        <p>القطع الجديدة تطلع لعملاء المستوى الأسود بس أول ساعات، ويوصلهم إشعار «قطع جديدة لك قبل الكل». بعدها تفتح للكل.</p>
      </div>
      <div className="gh-seg">
        {[[0, 'موقّف'], [12, '12 ساعة'], [24, '24 ساعة'], [48, '48 ساعة']].map(([h, l]) => (
          <button key={h} disabled={saving} className={hours === h ? 'on' : ''} onClick={() => save(h)}>{l}</button>
        ))}
      </div>
      <style>{`
.vip-early{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:#111;color:#F4ECDD;border-radius:16px;padding:18px 20px;margin-bottom:20px}
.vip-early b{font-size:16px;color:#E8D3A6}
.vip-early p{margin:4px 0 0;font-size:13px;color:rgba(244,236,221,.75);max-width:560px}
.vip-early-ic{font-size:28px}
.vip-early .gh-seg{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15)}
.vip-early .gh-seg button{color:rgba(244,236,221,.8)}
.vip-early .gh-seg button.on{background:#E8D3A6;color:#111}
`}</style>
    </div>
  )
}
