import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiUserSharedLine, RiCake2Line, RiStarSmileLine, RiLoader4Line } from 'react-icons/ri'
import api from '../services/api'

/** Invite a friend, birthday gift, review request after delivery: switches and amounts. */
export default function GrowthSettings() {
  const [d, setD] = useState(null)
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const load = () => api.get('/admin/growth').then((r) => { setD(r.data); setS({ referral: r.data.referral, birthday: r.data.birthday, review: r.data.review }) }).catch(() => {})
  useEffect(() => { load() }, [])
  if (!s) return null
  const set = (k, patch) => setS((x) => ({ ...x, [k]: { ...x[k], ...patch } }))
  const save = async () => {
    setSaving(true)
    try { await api.put('/admin/growth', s); toast.success('انحفظ'); load() } catch { toast.error('ما انحفظ') } finally { setSaving(false) }
  }
  const sw = (on, fn) => (
    <button type="button" onClick={fn} aria-label="تشغيل" style={{ width: 50, height: 28, borderRadius: 99, border: 0, background: on ? '#5C0B16' : '#D9D5CF', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
      <i style={{ position: 'absolute', top: 3, insetInlineStart: on ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
    </button>
  )
  const num = (v, fn, suffix = 'نقطة') => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
      <input className="input" type="number" min="0" value={v} onChange={(e) => fn(Number(e.target.value))} style={{ width: 110, height: 38, padding: '0 10px' }} /> {suffix}
    </label>
  )
  const r = d.referrals
  const card = { background: '#fff', borderRadius: 16, border: '1px solid #F3F4F6', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }
  const head = (icon, title, on, fn) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{icon}<b style={{ flex: 1, fontSize: 15 }}>{title}</b>{sw(on, fn)}</div>

  return (
    <div style={{ marginBottom: 24 }} dir="rtl">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <div style={card}>
          {head(<RiUserSharedLine size={22} color="#5C0B16" />, 'ادعُ صديقك', s.referral.enabled, () => set('referral', { enabled: !s.referral.enabled }))}
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>كل عميل له كود ورابط يشاركه. لما صديقه يستلم أول طلب، الاثنين ياخذون نقاط.</p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div><small style={{ color: 'var(--text-secondary)' }}>الصديق الجديد</small>{num(s.referral.friend_points, (v) => set('referral', { friend_points: v }))}</div>
            <div><small style={{ color: 'var(--text-secondary)' }}>اللي دعاه</small>{num(s.referral.referrer_points, (v) => set('referral', { referrer_points: v }))}</div>
          </div>
          <div style={{ fontSize: 13, background: 'var(--bg-body)', borderRadius: 10, padding: '8px 12px' }}>{r.joined} سجّلوا بدعوة · {r.ordered} طلبوا</div>
          {r.top?.length > 0 && <div style={{ fontSize: 12.5 }}>{r.top.slice(0, 5).map((u) => <div key={u.id}>{u.name} <span style={{ color: 'var(--text-light)' }}>({u.code})</span> · {u.joined} دعوة · {u.ordered} طلبوا</div>)}</div>}
        </div>
        <div style={card}>
          {head(<RiCake2Line size={22} color="#5C0B16" />, 'هدية عيد الميلاد', s.birthday.enabled, () => set('birthday', { enabled: !s.birthday.enabled }))}
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>العميل يكتب تاريخ ميلاده في حسابه، ويوصله في يومه إشعار «كل عام وأنت بخير» ونقاط هدية (مرة بالسنة).</p>
          {num(s.birthday.points, (v) => set('birthday', { points: v }))}
          <div style={{ fontSize: 13, background: 'var(--bg-body)', borderRadius: 10, padding: '8px 12px' }}>{d.with_birthday} عميل كتب تاريخ ميلاده · {d.birthdays_today} عيد ميلاد اليوم</div>
        </div>
        <div style={card}>
          {head(<RiStarSmileLine size={22} color="#5C0B16" />, 'طلب تقييم بعد التسليم', s.review.enabled, () => set('review', { enabled: !s.review.enabled }))}
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>بعد التسليم بكم يوم يوصل العميل «كيف القطعة؟» ويفتح له صفحة التقييم على طول. التقييمات تنتظر موافقتك في «التقييمات».</p>
          {num(s.review.days, (v) => set('review', { days: v }), 'يوم بعد التسليم')}
          <div style={{ fontSize: 13, background: 'var(--bg-body)', borderRadius: 10, padding: '8px 12px' }}>{d.reviews_asked} طلب تقييم انرسل آخر ٣٠ يوم</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? <RiLoader4Line className="spin" /> : null} حفظ</button>
      </div>
    </div>
  )
}
