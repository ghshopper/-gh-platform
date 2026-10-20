import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RiTranslate2, RiLoader4Line } from 'react-icons/ri'
import api from '../services/api'

/** Products still without an Arabic name: one button translates them, 25 at a time. */
export default function TranslateMissing({ onDone }) {
  const [left, setLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/admin/products-translate-missing', { params: { count: 1 } }).then((r) => setLeft(r.data.left || 0)).catch(() => {}) }, [])
  if (!left) return null
  const run = async () => {
    setBusy(true)
    let total = 0
    try {
      for (let i = 0; i < 40; i++) {
        const r = await api.post('/admin/products-translate-missing', {}, { timeout: 120000 })
        total += r.data.translated || 0
        setLeft(r.data.left || 0)
        if (!r.data.left || !r.data.translated) break
      }
      toast.success(`ترجمت ${total} اسم`)
      onDone?.()
    } catch {
      toast.error('وقفت الترجمة، جرّب مرة ثانية')
    } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13.5, flexWrap: 'wrap' }}>
      <RiTranslate2 size={20} />
      <span style={{ flex: 1 }}><b>{left}</b> منتج اسمه بالإنجليزي بس (ما انترجم وقت الإضافة).</span>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={run}>{busy ? <><RiLoader4Line className="spin" /> أترجم… باقي {left}</> : 'ترجمها للعربي'}</button>
    </div>
  )
}
