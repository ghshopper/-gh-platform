import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiShieldKeyholeLine, RiLoader4Line, RiCheckLine } from 'react-icons/ri'
import api from '../services/api'

/** The second sign-in step: a code from an authenticator app on the phone. */
export default function TwoFactor() {
  const [on, setOn] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [off, setOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = () => api.get('/auth/two-factor').then((r) => setOn(!!r.data.enabled)).catch(() => setOn(false))
  useEffect(() => { load() }, [])

  const start = async () => {
    setBusy(true)
    try { const r = await api.post('/auth/two-factor/setup'); setSetup(r.data); setCode('') } catch (e) { toast.error(e.response?.data?.message || 'تعذر') } finally { setBusy(false) }
  }
  const enable = async () => {
    setBusy(true)
    try { await api.post('/auth/two-factor/enable', { code }); toast.success('تفعّل الرمز الثاني 🔐'); setSetup(null); load() } catch (e) { toast.error(e.response?.data?.message || 'الرمز غير صحيح') } finally { setBusy(false) }
  }
  const disable = async () => {
    setBusy(true)
    try { await api.post('/auth/two-factor/disable', { password: pw, code }); toast.success('انطفى الرمز الثاني'); setOff(false); setPw(''); setCode(''); load() } catch (e) { toast.error(e.response?.data?.message || 'تعذر') } finally { setBusy(false) }
  }

  const box = { backgroundColor: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0', maxWidth: 800, margin: '24px auto 0' }
  const input = { width: '100%', padding: '12px 14px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 15, outline: 'none' }
  if (on === null) return null

  return (
    <div style={box} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <RiShieldKeyholeLine size={24} color="#4A0D17" />
        <h3 style={{ margin: 0, fontSize: 18 }}>الرمز الثاني عند الدخول</h3>
        {on && <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFDF5', color: '#047857', borderRadius: 99, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}><RiCheckLine /> مفعّل</span>}
      </div>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 16px', lineHeight: 1.7 }}>
        مع كلمة المرور يطلب رمز من تطبيق في جوالك يتغير كل ٣٠ ثانية. لو أحد عرف كلمة المرور ما يقدر يدخل بدون جوالك.
      </p>

      {!on && !setup && <button className="btn btn-primary" disabled={busy} onClick={start}>{busy ? <RiLoader4Line className="spin" /> : null} فعّل الرمز الثاني</button>}

      {!on && setup && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ width: 190, height: 190, border: '1px solid #eee', borderRadius: 12, padding: 8, background: '#fff' }} dangerouslySetInnerHTML={{ __html: (setup.qr_svg || '').replace('<svg ', '<svg width="172" height="172" ') }} />
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9, color: '#374151' }}>
              <li>نزّل <b>Google Authenticator</b> (أو Microsoft Authenticator) على جوالك.</li>
              <li>اضغط + وامسح الكود اللي على اليسار.</li>
              <li>اكتب الرمز اللي يطلع لـ GH Shopper.</li>
            </ol>
            <small style={{ color: '#9CA3AF' }}>ما تقدر تمسح؟ اكتب هذا المفتاح في التطبيق: <span dir="ltr" style={{ fontFamily: 'monospace', color: '#111' }}>{setup.secret}</span></small>
            <input style={{ ...input, letterSpacing: 8, textAlign: 'center', fontSize: 22, direction: 'ltr' }} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9٠-٩]/g, ''))} placeholder="000000" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" disabled={busy || code.length !== 6} onClick={enable}>تأكيد وتفعيل</button>
              <button className="btn btn-ghost" onClick={() => setSetup(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {on && !off && <button className="btn btn-ghost" onClick={() => { setOff(true); setCode('') }}>إطفاء الرمز الثاني</button>}
      {on && off && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          <input style={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة المرور" />
          <input style={{ ...input, direction: 'ltr', textAlign: 'center', letterSpacing: 6 }} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9٠-٩]/g, ''))} placeholder="الرمز من التطبيق" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={busy || !pw || code.length !== 6} onClick={disable}>إطفاء</button>
            <button className="btn btn-ghost" onClick={() => setOff(false)}>إلغاء</button>
          </div>
        </div>
      )}
      <p style={{ color: '#9CA3AF', fontSize: 12.5, margin: '14px 0 0' }}>ضاع جوالك؟ المدير العام يقدر يشيل الرمز الثاني من «المستخدمين» وتفعّله من جديد.</p>
    </div>
  )
}
