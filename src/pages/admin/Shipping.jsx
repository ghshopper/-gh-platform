import { useEffect, useState } from 'react'
import { RiTruckLine, RiSave3Line, RiStore2Line, RiHome4Line } from 'react-icons/ri'
import toast from 'react-hot-toast'
import Settings from './Settings'

const API = import.meta.env.VITE_API_URL || '/api'
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token'), Accept: 'application/json', 'Content-Type': 'application/json' })

/**
 * Delivery prices used by the customer app, the website and the admin app
 * (one source: the same values as "الإعدادات" in the admin app).
 */
export default function Shipping() {
  const [home, setHome] = useState('')
  const [branch, setBranch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API}/ps/delivery-options`).then((r) => r.json()).then((d) => {
      setHome(String(d.home_fee ?? 2))
      setBranch(String(d.branch_fee ?? 1))
    }).catch(() => toast.error('تعذّر تحميل أسعار التوصيل'))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch(`${API}/ps/settings`, { method: 'PUT', headers: auth(), body: JSON.stringify({ delivery_home_fee: Number(home) || 0, delivery_office_fee: Number(branch) || 0 }) })
      if (!r.ok) throw new Error()
      toast.success('تم حفظ أسعار التوصيل')
    } catch {
      toast.error('تعذّر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const card = { background: '#fff', border: '1px solid #EEE', borderRadius: 14, padding: 22 }
  const input = { width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', fontSize: 18, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div dir="rtl" style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 10 }}><RiTruckLine /> الشحن والتوصيل</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '6px 0 22px' }}>هذي الأسعار تظهر للعميل في التطبيق والموقع، وهي نفسها اللي في إعدادات تطبيق الإدارة.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 6 }}><RiHome4Line /> لباب البيت</div>
          <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 12 }}>مسقط وبركاء: مندوبنا · باقي السلطنة: جيناكم للبيت</div>
          <input type="number" step="0.1" min="0" value={home} onChange={(e) => setHome(e.target.value)} style={input} />
          <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 6 }}>ر.ع.</div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 6 }}><RiStore2Line /> استلام من فرع شركة التوصيل</div>
          <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 12 }}>العميل يستلم من مكتب جيناكم اللي يختاره</div>
          <input type="number" step="0.1" min="0" value={branch} onChange={(e) => setBranch(e.target.value)} style={input} />
          <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 6 }}>ر.ع.</div>
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{ marginTop: 20, background: '#111', color: '#fff', border: 0, borderRadius: 10, padding: '13px 26px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: saving ? 0.6 : 1 }}>
        <RiSave3Line /> {saving ? 'جاري الحفظ…' : 'حفظ'}
      </button>

      {/* Countries and their shipping cost (was "رسوم الشحن" in the settings) */}
      <div style={{ marginTop: 36 }}>
        <Settings onlyTab="shipping" />
      </div>
    </div>
  )
}
