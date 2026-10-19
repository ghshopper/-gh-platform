import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiCloseLine, RiWhatsappLine, RiPhoneLine, RiMailLine, RiShoppingBag3Line } from 'react-icons/ri'
import toast from 'react-hot-toast'
import api from '../services/api'
import Empty from './Empty'

const TIER_LOOK = {
  Beige: { bg: 'linear-gradient(135deg,#ECDFC9,#CDB794)', fg: '#5B4126' },
  Burgundy: { bg: 'linear-gradient(135deg,#6A0E1A,#2E0306)', fg: '#F1DDB5' },
  Black: { bg: 'linear-gradient(135deg,#1C1C1C,#000)', fg: '#E8D3A6' },
}
const STAGE = {
  requested: ['بانتظار الشراء', '#B45309', '#FEF3C7'],
  purchased: ['تم الشراء', '#1D4ED8', '#DBEAFE'],
  arrived: ['وصل عُمان', '#7C3AED', '#EDE9FE'],
  out_for_delivery: ['خرج للتوصيل', '#0E7490', '#CFFAFE'],
  delivered: ['تم التسليم', '#047857', '#D1FAE5'],
  cancelled: ['ملغي', '#B91C1C', '#FEE2E2'],
}
const SUGGESTED_TAGS = ['VIP', 'هدايا', 'ساعات', 'مجوهرات', 'يدفع أقساط', 'يحتاج متابعة']
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const day = (s) => (s ? new Date(s).toLocaleDateString('ar-OM', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const waPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 8 ? '968' + d : d }

/** Full customer card: what they spent, their orders, tier, notes and tags. */
export default function CustomerProfile({ id, onClose }) {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    setData(null)
    api.get(`/admin/customers/${id}/profile`).then((r) => {
      setData(r.data)
      setNotes(r.data.customer.notes || '')
      setTags(r.data.customer.tags || [])
    }).catch(() => { toast.error('تعذر فتح ملف العميل'); onClose() })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (nextTags = tags, nextNotes = notes) => {
    setSaving(true)
    try {
      await api.put(`/admin/customers/${id}/meta`, { notes: nextNotes, tags: nextTags })
      toast.success('انحفظ')
    } catch { toast.error('ما انحفظ') } finally { setSaving(false) }
  }
  const toggleTag = (t) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]
    setTags(next); save(next)
  }

  if (!id) return null
  const c = data?.customer
  const s = data?.stats
  const look = TIER_LOOK[c?.loyalty_tier] || TIER_LOOK.Beige

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-content cp-modal" onMouseDown={(e) => e.stopPropagation()} dir="rtl">
        <div className="modal-header">
          <h3 className="modal-title">ملف العميل</h3>
          <button className="close-btn" onClick={onClose}><RiCloseLine size={24} /></button>
        </div>
        {!data ? <div className="modal-body"><div className="gh-skel" style={{ height: 320 }} /></div> : (
          <div className="modal-body cp-body">
            <div className="cp-top">
              <div className="cp-who">
                <div className="cp-avatar">{(c.name || '؟').trim().charAt(0)}</div>
                <div>
                  <h2>{c.name}</h2>
                  <div className="cp-contact">
                    {c.phone && <span><RiPhoneLine /> <span dir="ltr">{c.phone}</span></span>}
                    {c.email && <span><RiMailLine /> {c.email}</span>}
                    <span>عميل من {day(c.created_at)}</span>
                  </div>
                  <div className="cp-actions">
                    {c.phone && <a className="btn btn-sm btn-ghost" href={`https://wa.me/${waPhone(c.phone)}`} target="_blank" rel="noreferrer"><RiWhatsappLine /> واتساب</a>}
                    {c.phone && <a className="btn btn-sm btn-ghost" href={`tel:${c.phone}`}><RiPhoneLine /> اتصال</a>}
                    <button className="btn btn-sm btn-primary" onClick={() => { onClose(); nav('/admin/app-orders?q=' + encodeURIComponent(c.phone || c.name)) }}><RiShoppingBag3Line /> طلباته</button>
                  </div>
                </div>
              </div>
              <div className="cp-tier" style={{ background: look.bg, color: look.fg }}>
                <small>المستوى</small>
                <b>{c.tier_ar || c.loyalty_tier || '—'}</b>
                <span>{Number(c.loyalty_points || 0).toLocaleString('en-US')} نقطة</span>
              </div>
            </div>

            <div className="cp-stats">
              <div><small>إجمالي المشتريات</small><b>{money(s.spent)} <i>ر.ع</i></b></div>
              <div><small>عدد الطلبات</small><b>{s.orders}</b></div>
              <div><small>متوسط الطلب</small><b>{money(s.average)} <i>ر.ع</i></b></div>
              <div className={s.owed > 0 ? 'warn' : ''}><small>المتبقي عليه</small><b>{money(s.owed)} <i>ر.ع</i></b></div>
            </div>
            <div className="cp-meta-line">
              <span>أول طلب: <b>{day(s.first_order)}</b></span>
              <span>آخر طلب: <b>{day(s.last_order)}</b></span>
              {Object.keys(s.top_brands || {}).length > 0 && <span>البراندات المفضلة: <b>{Object.keys(s.top_brands).join('، ')}</b></span>}
            </div>

            <div className="cp-grid">
              <section>
                <h4>التصنيفات</h4>
                <div className="cp-tags">
                  {[...new Set([...SUGGESTED_TAGS, ...tags])].map((t) => (
                    <button key={t} className={`cp-tag ${tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
                  ))}
                  <form onSubmit={(e) => { e.preventDefault(); const t = newTag.trim(); if (t && !tags.includes(t)) { const n = [...tags, t]; setTags(n); save(n) } setNewTag('') }}>
                    <input className="input cp-tag-input" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="+ تصنيف" maxLength={30} />
                  </form>
                </div>
                <h4 style={{ marginTop: 18 }}>ملاحظات داخلية</h4>
                <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً: تحب الذهب الأصفر، مقاس الخاتم 52، تفضل التوصيل بعد العصر…" />
                <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} disabled={saving || notes === (c.notes || '')} onClick={() => save(tags, notes)}>{saving ? 'جاري الحفظ…' : 'حفظ الملاحظة'}</button>
              </section>
              <section>
                <h4>كل الطلبات ({data.orders.length})</h4>
                {data.orders.length === 0 ? <Empty icon={RiShoppingBag3Line} title="ما طلب شي للحين" /> : (
                  <div className="cp-orders">
                    {data.orders.map((o) => {
                      const st = STAGE[o.stage] || STAGE.requested
                      return (
                        <button key={o.id} className="cp-order" onClick={() => { onClose(); nav(`/admin/app-orders?order=${o.id}`) }}>
                          <div><b dir="ltr">#{o.ref}</b><small>{day(o.created_at)} · {o.pieces} قطعة{o.brands?.length ? ' · ' + o.brands.join('، ') : ''}</small></div>
                          <div className="cp-order-end">
                            <b>{money(o.total)}</b>
                            <span className="badge" style={{ color: st[1], background: st[2] }}>{st[0]}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
