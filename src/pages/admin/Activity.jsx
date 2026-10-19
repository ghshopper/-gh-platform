import { useEffect, useState } from 'react'
import { RiHistoryLine, RiRefreshLine } from 'react-icons/ri'
import api from '../../services/api'
import Empty from '../../components/Empty'
import GHPagination from '../../components/GHPagination'

// Who changed what, from the dashboard or the admin app (passwords and keys hidden).
const AREA = {
  'admin/products': 'المنتجات', 'admin/import-items': 'منتجات للإضافة', 'admin/categories': 'التصنيفات', 'admin/brands': 'البراندات',
  'admin/customers': 'العملاء', 'admin/coupons': 'الكوبونات', 'admin/gift-cards': 'بطاقات الهدايا', 'admin/offers': 'العروض',
  'admin/abandoned-carts': 'السلات المتروكة', 'admin/settings': 'الإعدادات', 'admin/users': 'المستخدمون', 'admin/staff': 'المستخدمون',
  'admin/whatsapp': 'واتساب', 'admin/notifications': 'الإشعارات', 'admin/loyalty-tiers': 'الولاء', 'admin/app-customize': 'واجهة التطبيق',
  'admin/home-customize': 'واجهة الموقع', 'admin/banners': 'البانرات', 'admin/shipping': 'الشحن', 'admin/payment-gateways': 'بوابات الدفع',
  'ps/orders': 'الطلبات', 'ps/items': 'قطع الطلبات', 'ps/payments': 'المدفوعات', 'ps/customers': 'العملاء', 'ps/trips': 'الرحلات',
  'ps/expenses': 'المصاريف', 'ps/invoices': 'فواتير الشراء', 'ps/settings': 'إعدادات الطلبات', 'ps/coupons': 'الكوبونات', 'ps/requests': 'طلبات القطع',
}
const VERB = { POST: 'أضاف / نفّذ', PUT: 'عدّل', PATCH: 'عدّل', DELETE: 'حذف' }
const VERB_COLOR = { POST: '#1D4ED8', PUT: '#B45309', PATCH: '#B45309', DELETE: '#B42318' }

// a few actions read better with their own words
function describe(r) {
  const e = r.event || ''
  const rules = [
    [/ps\/items\/status/, 'غيّر حالة قطع'], [/\/note$/, 'أضاف ملاحظة على طلب'], [/\/pay-link$/, 'أنشأ رابط دفع'], [/\/label$/, 'طبع بوليصة'],
    [/\/remind-all$/, 'ذكّر كل السلات'], [/\/remind$/, 'أرسل تذكير سلة'], [/\/quick$/, 'تعديل سريع على منتج'], [/import-items\/publish/, 'نشر منتجات'],
    [/notifications\/broadcast/, 'أرسل إشعار للكل'], [/\/bulk-/, 'تعديل جماعي'], [/login/, 'دخل'],
  ]
  for (const [re, t] of rules) if (re.test(e)) return t
  const m = e.split(' ')[0]
  return `${VERB[m] || m} · ${AREA[r.auditable_type] || r.auditable_type || ''}`
}
function details(r) {
  let v = {}
  try { v = JSON.parse(r.new_values || '{}') || {} } catch { return '' }
  const pick = ['name', 'name_ar', 'title', 'title_ar', 'status', 'price', 'percent', 'amount', 'text', 'code', 'ids']
  const parts = []
  for (const k of pick) if (v[k] !== undefined && v[k] !== null && v[k] !== '') parts.push(`${k === 'ids' ? 'عدد' : k}: ${Array.isArray(v[k]) ? v[k].length : String(v[k]).slice(0, 60)}`)
  return parts.slice(0, 4).join(' · ')
}
const when = (s) => new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') || String(s).includes('+') ? '' : 'Z')).toLocaleString('ar-OM', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Activity() {
  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ page: 1, last: 1, total: 0 })
  const [staff, setStaff] = useState([])
  const [who, setWho] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const r = await api.get('/admin/activity', { params: { page, user_id: who || undefined, q: q || undefined } })
      setRows(r.data.data || []); setMeta(r.data.meta || {}); setStaff(r.data.staff || [])
    } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load(1) }, [who]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page" dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>سجل النشاط</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>كل تغيير يسويه الفريق من لوحة التحكم أو تطبيق الإدارة: مين، متى، وإيش غيّر.</p>
        </div>
        <div className="gh-toolbar">
          <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">كل الفريق</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); load(1) }}><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث (مثلاً اسم منتج)" /></form>
          <button className="btn btn-ghost btn-sm" onClick={() => load(meta.page)}><RiRefreshLine className={loading ? 'spin' : ''} /></button>
        </div>
      </div>

      <div className="card">
        {rows === null ? <div className="gh-skel" style={{ height: 300, margin: 16 }} /> : rows.length === 0 ? (
          <Empty icon={RiHistoryLine} title="ما فيه نشاط مسجّل للحين" hint="من الحين وطالع، أي تعديل من الفريق بيظهر هنا." />
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>الوقت</th><th>مين</th><th>إيش سوّى</th><th>التفاصيل</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const m = (r.event || '').split(' ')[0]
                  return (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{when(r.created_at)}</td>
                      <td><b>{r.user_name || '—'}</b></td>
                      <td><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 9, background: VERB_COLOR[m] || '#999', marginInlineEnd: 8 }} />{describe(r)}{r.auditable_id ? <span style={{ color: 'var(--text-light)' }}> #{r.auditable_id}</span> : null}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12.5, whiteSpace: 'normal', maxWidth: 420 }}>{details(r)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {meta.last > 1 && <div style={{ padding: 14, display: 'flex', justifyContent: 'center' }}><GHPagination currentPage={meta.page} lastPage={meta.last} total={meta.total} onPageChange={(p) => load(p)} /></div>}
      </div>
    </div>
  )
}
