import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiSearch2Line, RiShoppingBag3Line, RiUser3Line, RiPriceTag3Line, RiArrowLeftSLine, RiCompass3Line } from 'react-icons/ri'
import api, { getImageUrl } from '../services/api'
import { canOpen } from '../lib/access'

// One search for the whole dashboard (⌘K / Ctrl+K): orders by number, name or
// phone, customers, products and pages. Orders and customers come from the
// same data the orders page uses, kept for a minute.
let cache = { at: 0, data: null }
async function loadBase() {
  if (cache.data && Date.now() - cache.at < 60000) return cache.data
  const r = await api.get('/ps/bootstrap')
  cache = { at: Date.now(), data: r.data }
  return r.data
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim()
const digits = (s) => String(s ?? '').replace(/\D/g, '')

export default function GlobalSearch({ pages = [], open, onClose }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [base, setBase] = useState(null)
  const [products, setProducts] = useState([])
  const [sel, setSel] = useState(0)
  const input = useRef(null)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const canOrders = canOpen('/admin/app-orders', user)
  const canProducts = canOpen('/admin/products', user)
  const canCustomers = canOpen('/admin/customers', user)

  useEffect(() => {
    if (!open) return
    setQ(''); setSel(0); setProducts([])
    setTimeout(() => input.current?.focus(), 30)
    if (canOrders) loadBase().then(setBase).catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // products: ask the server (there are many)
  useEffect(() => {
    if (!open || !canProducts || q.trim().length < 2) { setProducts([]); return }
    const t = setTimeout(() => {
      api.get('/admin/products', { params: { search: q.trim(), per_page: 6 } })
        .then((r) => setProducts((r.data?.data || []).slice(0, 6))).catch(() => {})
    }, 220)
    return () => clearTimeout(t)
  }, [q, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const s = norm(q.replace(/^#/, ''))
    const d = digits(q)
    const out = []
    if (!s) {
      pages.slice(0, 8).forEach((p) => out.push({ kind: 'page', key: 'p' + p.path, title: p.label, sub: 'صفحة', go: p.path }))
      return out
    }
    pages.filter((p) => norm(p.label).includes(s)).slice(0, 4)
      .forEach((p) => out.push({ kind: 'page', key: 'p' + p.path, title: p.label, sub: 'صفحة', go: p.path }))
    if (base) {
      const cust = Object.fromEntries((base.customers || []).map((c) => [String(c.id), c]))
      const orders = (base.orders || []).filter((o) => {
        const c = cust[String(o.customer_id)]
        if (d.length >= 2 && [o.ref_no, o.order_no, o.store_order_number, o.waybill_no, c?.phone].some((x) => digits(x).includes(d))) return true
        return norm([c?.name, ...(o.items || []).map((i) => `${i.brand || ''} ${i.name}`)].join(' ')).includes(s)
      }).slice(0, 6)
      orders.forEach((o) => {
        const c = cust[String(o.customer_id)]
        const items = (o.items || []).filter((i) => i.status !== 'cancelled')
        out.push({ kind: 'order', key: 'o' + o.id, title: `#${o.ref_no || o.store_order_number || o.order_no} · ${c?.name || ''}`, sub: items.map((i) => i.brand || i.name).filter(Boolean).slice(0, 3).join('، ') || 'طلب', go: `/admin/app-orders?order=${o.id}` })
      })
      if (canCustomers) {
        ;(base.customers || []).filter((c) => norm(c.name).includes(s) || (d.length >= 3 && digits(c.phone).includes(d))).slice(0, 5)
          .forEach((c) => out.push({ kind: 'customer', key: 'c' + c.id, title: c.name, sub: c.phone || c.email || 'عميل', go: `/admin/customers?open=${c.id}` }))
      }
    }
    products.forEach((p) => out.push({ kind: 'product', key: 'r' + p.id, title: p.name_ar || p.name_en, sub: `${p.brand_name_en || ''} · ${Number(p.price || 0).toFixed(3)} ر.ع`, go: `/admin/products?edit=${p.id}`, img: p.primary_image ? getImageUrl(p.primary_image) : null }))
    return out
  }, [q, base, products, pages, canCustomers])

  useEffect(() => { setSel(0) }, [q])

  if (!open) return null
  const go = (r) => { onClose(); nav(r.go) }
  const onKey = (e) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)) }
    else if (e.key === 'Enter' && results[sel]) go(results[sel])
  }
  const ICON = { page: RiCompass3Line, order: RiShoppingBag3Line, customer: RiUser3Line, product: RiPriceTag3Line }
  const LABEL = { page: 'الصفحات', order: 'الطلبات', customer: 'العملاء', product: 'المنتجات' }
  let last = ''

  return (
    <div className="gs-backdrop" onMouseDown={onClose}>
      <div className="gs-box" onMouseDown={(e) => e.stopPropagation()} dir="rtl">
        <div className="gs-input">
          <RiSearch2Line size={20} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="رقم طلب، اسم عميل، رقم هاتف، منتج أو صفحة…" />
          <kbd>Esc</kbd>
        </div>
        <div className="gs-list">
          {results.length === 0 && <div className="gs-empty">{q.trim() ? 'ما لقينا شي بهذا البحث' : 'اكتب للبحث'}</div>}
          {results.map((r, i) => {
            const head = r.kind !== last ? LABEL[r.kind] : null
            last = r.kind
            const Icon = ICON[r.kind]
            return (
              <div key={r.key}>
                {head && <div className="gs-head">{head}</div>}
                <button className={`gs-row ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
                  <span className="gs-ic">{r.img ? <img src={r.img} alt="" /> : <Icon size={17} />}</span>
                  <span className="gs-txt"><b>{r.title}</b><small>{r.sub}</small></span>
                  <RiArrowLeftSLine className="gs-arrow" size={18} />
                </button>
              </div>
            )
          })}
        </div>
        <div className="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> للتنقل</span><span><kbd>Enter</kbd> للفتح</span><span><kbd>⌘</kbd><kbd>K</kbd> من أي مكان</span></div>
      </div>
    </div>
  )
}
