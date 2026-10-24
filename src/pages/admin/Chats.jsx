import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RiChat3Line, RiSearchLine, RiSendPlane2Fill, RiImageAddLine, RiCloseLine, RiWhatsappLine, RiUserLine,
  RiArrowRightLine, RiLoader4Line, RiShoppingBag3Line, RiPriceTag3Line, RiCheckDoubleLine,
  RiChatQuoteLine, RiArrowUpLine, RiArrowDownLine, RiDeleteBinLine, RiAddLine, RiPencilLine,
} from 'react-icons/ri'
import api, { getImageUrl } from '../../services/api'
import { useFeature } from '../../lib/features'
import FeatureOff from '../../components/FeatureOff'
import CustomerProfile from '../../components/CustomerProfile'
import Empty from '../../components/Empty'

/**
 * المحادثات: the customers' live chat inbox.
 * GET /ps/chats (threads) · GET /ps/chats/{id}?after_id= (messages) · POST /ps/chats/{id} (text / image)
 * POST /ps/chats/{id}/read · POST /ps/chats/start/{userId}. Polls every 4 s while open.
 * الردود الجاهزة: GET /ps/chat-replies → {data:[{title,text}]} · PUT /ps/chat-replies {replies:[…]}
 */
const POLL = 4000

// Ready replies: fetched once per page visit, shared by every open conversation.
let repliesCache = null
const cleanReplies = (xs) => listOf(xs)
  .filter((x) => x && (x.title || x.text))
  .map((x) => ({ title: String(x.title || ''), text: String(x.text || '') }))
const loadReplies = () => {
  if (!repliesCache) {
    repliesCache = api.get('/ps/chat-replies').then((r) => cleanReplies(r.data))
    repliesCache.catch(() => { repliesCache = null })
  }
  return repliesCache
}
// {name} = customer's first name, {order} = order the chat is about. A missing value is dropped
// together with a leading "#" / "رقم" and any doubled spaces it leaves behind.
const fillReply = (text, vars) => String(text || '')
  .replace(/\{(name|order)\}/g, (_, k) => (vars[k] ? String(vars[k]) : '\u0000'))
  .replace(/[ \t]*(?:رقم[ \t]*)?#?[ \t]*\u0000/g, '')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/[ \t]+([،,.!?؟:؛])/g, '$1')
  .split('\n').map((l) => l.trim()).join('\n')
  .trim()

// The server keeps times in UTC.
const toDate = (v) => {
  if (!v) return null
  const s = String(v)
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z')
  return isNaN(d) ? null : d
}
const when = (v) => {
  const d = toDate(v)
  if (!d) return ''
  const now = new Date()
  const sameDay = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Muscat' }) === now.toLocaleDateString('en-CA', { timeZone: 'Asia/Muscat' })
  return sameDay
    ? d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Muscat', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ar-OM', { timeZone: 'Asia/Muscat', day: 'numeric', month: 'short' })
}
const clock = (v) => { const d = toDate(v); return d ? d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Muscat', hour: '2-digit', minute: '2-digit' }) : '' }
const dayLabel = (v) => { const d = toDate(v); return d ? d.toLocaleDateString('ar-OM', { timeZone: 'Asia/Muscat', weekday: 'long', day: 'numeric', month: 'long' }) : '' }
const dayKey = (v) => { const d = toDate(v); return d ? d.toLocaleDateString('en-CA', { timeZone: 'Asia/Muscat' }) : '' }
const waPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 8 ? '968' + d : d }
const isOff = (e) => e?.response?.status === 403 && e.response.data?.feature_off
const listOf = (d) => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [])
const mergeMsgs = (a, b) => {
  const m = new Map(a.map((x) => [x.id, x]))
  for (const x of b) m.set(x.id, x)
  return [...m.values()].sort((x, y) => x.id - y.id)
}

export default function Chats() {
  const on = useFeature('chat')
  const [params, setParams] = useSearchParams()
  const openId = params.get('thread') ? Number(params.get('thread')) : null
  const [threads, setThreads] = useState(null)
  const [off, setOff] = useState(false)
  const [q, setQ] = useState('')

  const setOpen = useCallback((id) => {
    const p = new URLSearchParams(params)
    p.delete('user')
    if (id) p.set('thread', id); else p.delete('thread')
    setParams(p, { replace: !id })
  }, [params, setParams])

  const loadThreads = useCallback(() => api.get('/ps/chats')
    .then((r) => setThreads(listOf(r.data)))
    .catch((e) => { if (isOff(e)) setOff(true); else setThreads((t) => t || []) }), [])

  useEffect(() => {
    if (!on) return
    loadThreads()
    const t = setInterval(() => { if (!document.hidden) loadThreads() }, POLL * 2)
    return () => clearInterval(t)
  }, [on, loadThreads])

  // ?user=ID (from the customer's file): open or start their chat
  useEffect(() => {
    const uid = params.get('user')
    if (!on || !uid) return
    api.post(`/ps/chats/start/${uid}`).then((r) => {
      const d = r.data || {}
      const id = d.thread?.id ?? d.data?.id ?? d.id
      if (id) { setOpen(id); loadThreads() }
    }).catch((e) => toast.error(e.response?.data?.message || 'تعذّر فتح المحادثة'))
  }, [on, params.get('user')]) // eslint-disable-line react-hooks/exhaustive-deps

  const markedRead = useCallback((id) => {
    setThreads((ts) => (ts || []).map((t) => (t.id === id ? { ...t, unread_staff: 0 } : t)))
    window.dispatchEvent(new CustomEvent('gh:chats-unread'))
  }, [])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const xs = threads || []
    if (!s) return xs
    return xs.filter((t) => [t.customer_name, t.phone, t.last_preview].filter(Boolean).join(' ').toLowerCase().includes(s))
  }, [threads, q])
  const unreadTotal = (threads || []).reduce((a, t) => a + (Number(t.unread_staff) > 0 ? 1 : 0), 0)
  const current = (threads || []).find((t) => t.id === openId)

  if (on === undefined) return <div className="gh-skel" style={{ height: 480 }} />
  if (on === false || off) return <FeatureOff k="chat" title="المحادثات" />

  return (
    <div className="page ch" dir="rtl">
      <div className="ch-head">
        <div>
          <h1 className="page-title-main" style={{ margin: 0 }}>المحادثات</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>رسائل العملاء من التطبيق والموقع. ردّك يوصلهم إشعار على طول.</p>
        </div>
        {unreadTotal > 0 && <span className="ch-pill">{unreadTotal} محادثة تنتظر ردّك</span>}
      </div>

      <div className={`card ch-shell ${openId ? 'has-open' : ''}`}>
        <aside className="ch-list">
          <div className="ch-search">
            <RiSearchLine />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرقم…" />
          </div>
          <div className="ch-threads">
            {threads === null ? (
              <div style={{ padding: 16 }}><div className="gh-skel" style={{ height: 220 }} /></div>
            ) : list.length === 0 ? (
              <Empty compact icon={RiChat3Line} title={q ? 'ما فيه محادثة بهذا البحث' : 'ما فيه محادثات للحين'} hint={q ? null : 'أول ما يكتب عميل من التطبيق أو الموقع تطلع هنا. وتقدر تبدأ محادثة من ملف العميل.'} />
            ) : list.map((t) => {
              const unread = Number(t.unread_staff) || 0
              return (
                <button key={t.id} className={`ch-thread ${t.id === openId ? 'on' : ''} ${unread ? 'unread' : ''}`} onClick={() => setOpen(t.id)}>
                  <span className="ch-av">{(t.customer_name || '؟').trim().charAt(0)}</span>
                  <span className="ch-th-main">
                    <span className="ch-th-top">
                      <b>{t.customer_name || t.phone || `عميل #${t.user_id}`}</b>
                      <small>{when(t.last_message_at)}</small>
                    </span>
                    <span className="ch-th-bottom">
                      <span className="ch-prev">{t.last_from === 'staff' ? <><RiCheckDoubleLine /> </> : null}{t.last_preview || '—'}</span>
                      {unread > 0 && <span className="ch-badge">{unread > 99 ? '99+' : unread}</span>}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>
        <section className="ch-conv">
          {openId ? (
            <Conversation key={openId} id={openId} summary={current} onBack={() => setOpen(null)} onRead={markedRead} onSent={loadThreads} onOff={() => setOff(true)} />
          ) : (
            <div className="ch-blank">
              <Empty icon={RiChat3Line} title="اختر محادثة" hint="اختر عميل من القائمة عشان تشوف الرسائل وترد عليه." />
            </div>
          )}
        </section>
      </div>
      <style>{CSS}</style>
    </div>
  )
}

function Conversation({ id, summary, onBack, onRead, onSent, onOff }) {
  const [info, setInfo] = useState(null) // { thread, customer }
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [profile, setProfile] = useState(false)
  const [replies, setReplies] = useState(null)
  const [rpOpen, setRpOpen] = useState(false)
  const [rpEdit, setRpEdit] = useState(false)
  const lastId = useRef(0)
  const scroller = useRef(null)
  const atBottom = useRef(true)
  const fileRef = useRef(null)
  const taRef = useRef(null)

  const scrollDown = (force) => {
    const el = scroller.current
    if (el && (force || atBottom.current)) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }

  const markRead = useCallback(() => {
    api.post(`/ps/chats/${id}/read`).then(() => onRead(id)).catch(() => {})
  }, [id, onRead])

  const fetchMsgs = useCallback(async (initial) => {
    try {
      const r = await api.get(`/ps/chats/${id}`, { params: initial || !lastId.current ? {} : { after_id: lastId.current } })
      const d = r.data?.data && !Array.isArray(r.data.data) ? r.data.data : r.data || {}
      if (initial || d.customer) setInfo((p) => ({ thread: d.thread || p?.thread, customer: d.customer || p?.customer }))
      const incoming = Array.isArray(d.messages) ? d.messages : []
      if (incoming.length || initial) {
        setMsgs((m) => {
          const next = mergeMsgs(initial ? [] : m || [], incoming)
          lastId.current = next.length ? next[next.length - 1].id : 0
          return next
        })
        scrollDown(initial)
      }
      if (initial ? (Number(d.thread?.unread_staff) > 0 || Number(summary?.unread_staff) > 0) : incoming.some((x) => x.from === 'customer')) markRead()
    } catch (e) {
      if (isOff(e)) onOff()
      else if (initial) { toast.error(e.response?.data?.message || 'تعذّر فتح المحادثة'); setMsgs([]) }
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    lastId.current = 0
    fetchMsgs(true)
    const t = setInterval(() => { if (!document.hidden) fetchMsgs(false) }, POLL)
    return () => clearInterval(t)
  }, [fetchMsgs])

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const pickFile = (f) => {
    if (!f) return
    if (!/^image\//.test(f.type)) return toast.error('الصور بس')
    if (f.size > 8 * 1024 * 1024) return toast.error('الصورة أكبر من 8 ميجا')
    setFile(f)
  }

  const send = async () => {
    const body = text.trim()
    if ((!body && !file) || sending) return
    setSending(true)
    try {
      let r
      if (file) {
        const fd = new FormData()
        if (body) fd.append('body', body)
        fd.append('image', file)
        r = await api.post(`/ps/chats/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        r = await api.post(`/ps/chats/${id}`, { body })
      }
      const m = r.data?.message || r.data?.data
      if (m?.id) {
        setMsgs((xs) => {
          const next = mergeMsgs(xs || [], [m])
          lastId.current = Math.max(lastId.current, m.id)
          return next
        })
      } else fetchMsgs(false)
      setText(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      scrollDown(true)
      onSent()
      taRef.current?.focus()
    } catch (e) {
      if (isOff(e)) onOff()
      else toast.error(e.response?.data?.message || 'ما انرسلت الرسالة')
    } finally { setSending(false) }
  }

  const c = info?.customer || {}
  const name = c.name || summary?.customer_name || ''
  const phone = c.phone || summary?.phone || ''
  const customerId = c.id || summary?.user_id

  useEffect(() => {
    let alive = true
    loadReplies().then((xs) => { if (alive) setReplies(xs) }).catch(() => { if (alive) setReplies([]) })
    return () => { alive = false }
  }, [])

  const pickReply = (r) => {
    const lastOrder = [...(msgs || [])].reverse().find((m) => m.ps_order?.invoice_no)?.ps_order?.invoice_no
    const filled = fillReply(r.text, { name: String(name || '').trim().split(/\s+/)[0], order: lastOrder })
    setText((t) => (t.trim() ? t.replace(/\s+$/, '') + '\n' + filled : filled))
    setRpOpen(false)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    })
  }

  return (
    <div className="ch-conv-in"
      onDragOver={(e) => { e.preventDefault() }}
      onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}>
      <header className="ch-conv-head">
        <button className="icon-btn ch-back" onClick={onBack} title="رجوع"><RiArrowRightLine size={20} /></button>
        <span className="ch-av lg">{(name || '؟').trim().charAt(0)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b className="ch-name">{name || '…'}</b>
          <div className="ch-sub">
            {phone && <span dir="ltr">{phone}</span>}
            {c.tier && <span className="ch-tier">{typeof c.tier === 'object' ? (c.tier.name_ar || c.tier.name) : c.tier}</span>}
          </div>
        </div>
        {phone && <a className="btn btn-sm btn-ghost" href={`https://wa.me/${waPhone(phone)}`} target="_blank" rel="noreferrer" title="واتساب"><RiWhatsappLine /> <span className="hide-on-mobile">واتساب</span></a>}
        {customerId && <button className="btn btn-sm btn-ghost" onClick={() => setProfile(true)} title="ملف العميل"><RiUserLine /> <span className="hide-on-mobile">ملف العميل</span></button>}
      </header>

      <div className="ch-msgs" ref={scroller} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
        {msgs === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: 'var(--text-secondary)' }}><RiLoader4Line className="spin" size={26} /></div>
        ) : msgs.length === 0 ? (
          <div className="ch-start">ما فيه رسائل للحين. اكتب أول رسالة للعميل 👋</div>
        ) : msgs.map((m, i) => {
          const mine = m.from === 'staff'
          const newDay = i === 0 || dayKey(msgs[i - 1].created_at) !== dayKey(m.created_at)
          return (
            <div key={m.id}>
              {newDay && <div className="ch-day"><span>{dayLabel(m.created_at)}</span></div>}
              <div className={`ch-row ${mine ? 'mine' : ''}`}>
                <div className="ch-bubble">
                  {mine && m.staff_name && <div className="ch-by">{m.staff_name}</div>}
                  {(m.ps_order || m.product) && (
                    <div className="ch-refs">
                      {m.ps_order && <Link to={`/admin/app-orders?order=${m.ps_order.id}`} className="ch-ref"><RiShoppingBag3Line /> طلب {m.ps_order.invoice_no || '#' + m.ps_order.id}</Link>}
                      {m.product && (
                        <span className="ch-ref">
                          {m.product.image ? <img src={getImageUrl(m.product.image)} alt="" /> : <RiPriceTag3Line />}
                          {m.product.name || 'قطعة #' + m.product.id}
                        </span>
                      )}
                    </div>
                  )}
                  {m.image_url && (
                    <a href={m.image_url} target="_blank" rel="noreferrer" className="ch-img"><img src={m.image_url} alt="صورة" onLoad={() => scrollDown(false)} /></a>
                  )}
                  {m.body && <div className="ch-text">{m.body}</div>}
                  <div className="ch-time">{clock(m.created_at)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <footer className="ch-compose">
        {rpOpen && (
          <ReplyPicker replies={replies} onPick={pickReply} onClose={() => setRpOpen(false)}
            onEdit={() => { setRpOpen(false); setRpEdit(true) }} />
        )}
        {preview && (
          <div className="ch-preview">
            <img src={preview} alt="" />
            <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} title="شيل الصورة"><RiCloseLine /></button>
          </div>
        )}
        <div className="ch-compose-row">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          <button className="icon-btn" onClick={() => fileRef.current?.click()} title="إرسال صورة" disabled={sending}><RiImageAddLine size={21} /></button>
          <button className={`icon-btn ${rpOpen ? 'ch-rp-on' : ''}`} onClick={() => setRpOpen((v) => !v)} title="ردود جاهزة" aria-expanded={rpOpen}><RiChatQuoteLine size={21} /></button>
          <textarea
            ref={taRef} rows={1} value={text} maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => { const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type)); if (f) { e.preventDefault(); pickFile(f) } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
            placeholder="اكتب ردّك… (Enter للإرسال، Shift+Enter لسطر جديد)"
          />
          <button className="ch-send" onClick={send} disabled={sending || (!text.trim() && !file)} title="إرسال">
            {sending ? <RiLoader4Line className="spin" size={20} /> : <RiSendPlane2Fill size={20} style={{ transform: 'scaleX(-1)' }} />}
          </button>
        </div>
      </footer>
      {profile && customerId && <CustomerProfile id={customerId} onClose={() => setProfile(false)} />}
      {rpEdit && (
        <ReplyEditor initial={replies || []} onClose={() => setRpEdit(false)}
          onSaved={(xs) => { repliesCache = Promise.resolve(xs); setReplies(xs); setRpEdit(false) }} />
      )}
    </div>
  )
}

/** Searchable list of ready replies, opened from the composer. */
function ReplyPicker({ replies, onPick, onClose, onEdit }) {
  const [s, setS] = useState('')
  const list = useMemo(() => {
    const k = s.trim().toLowerCase()
    const xs = replies || []
    return k ? xs.filter((r) => (r.title + ' ' + r.text).toLowerCase().includes(k)) : xs
  }, [replies, s])
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <>
      <div className="ch-rp-veil" onMouseDown={onClose} />
      <div className="ch-rp" role="dialog" aria-label="ردود جاهزة">
        <div className="ch-rp-top">
          <div className="ch-search" style={{ margin: 0, flex: 1 }}>
            <RiSearchLine />
            <input autoFocus value={s} onChange={(e) => setS(e.target.value)} placeholder="دوّر في الردود…"
              onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); onPick(list[0]) } }} />
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onEdit}><RiPencilLine /> تعديل الردود</button>
        </div>
        <div className="ch-rp-list">
          {replies === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20, color: 'var(--text-secondary)' }}><RiLoader4Line className="spin" size={22} /></div>
          ) : list.length === 0 ? (
            <div className="ch-rp-empty">{s ? 'ما فيه رد بهذا البحث' : 'ما فيه ردود جاهزة للحين. اضغط «تعديل الردود» وأضف أول رد.'}</div>
          ) : list.map((r, i) => (
            <button key={i} className="ch-rp-item" onClick={() => onPick(r)}>
              <b>{r.title || 'بدون عنوان'}</b>
              <span>{r.text}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/** Add / edit / delete / reorder the team's ready replies, saved with PUT. */
function ReplyEditor({ initial, onClose, onSaved }) {
  const [rows, setRows] = useState(() => (initial.length ? initial : [{ title: '', text: '' }]).map((r, i) => ({ ...r, k: i })))
  const [saving, setSaving] = useState(false)
  const nextK = useRef(rows.length)
  const set = (i, patch) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const move = (i, d) => setRows((xs) => {
    const j = i + d
    if (j < 0 || j >= xs.length) return xs
    const n = [...xs]; [n[i], n[j]] = [n[j], n[i]]; return n
  })
  const add = () => setRows((xs) => [...xs, { title: '', text: '', k: nextK.current++ }])
  const remove = (i) => setRows((xs) => xs.filter((_, j) => j !== i))

  const save = async (e) => {
    e.preventDefault()
    const out = rows
      .map((r) => ({ title: r.title.trim(), text: r.text.trim() }))
      .filter((r) => r.title || r.text)
    if (out.some((r) => !r.text)) return toast.error('فيه رد بدون نص. اكتب النص أو احذفه.')
    const replies = out.map((r) => ({ title: r.title || r.text.split('\n')[0].slice(0, 40), text: r.text }))
    setSaving(true)
    try {
      const r = await api.put('/ps/chat-replies', { replies })
      const saved = cleanReplies(r.data)
      toast.success('انحفظت الردود')
      onSaved(saved.length || !replies.length ? saved : replies)
    } catch (err) {
      toast.error(err.response?.data?.message || 'ما انحفظت الردود')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal-content" style={{ maxWidth: 620, width: '100%' }} onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="modal-header">
          <h3 className="modal-title">تعديل الردود الجاهزة</h3>
          <button type="button" className="close-btn" onClick={onClose}><RiCloseLine size={24} /></button>
        </div>
        <div className="modal-body ch-rpe">
          <p className="ch-rpe-note">تقدر تستخدم <code>{'{name}'}</code> لاسم العميل الأول و <code>{'{order}'}</code> لرقم الطلب اللي تخص المحادثة (لو ما فيه طلب ينشال تلقائياً).</p>
          {rows.length === 0 && <div className="ch-rp-empty">ما فيه ردود. أضف رد جديد.</div>}
          {rows.map((r, i) => (
            <div key={r.k} className="ch-rpe-row">
              <div className="ch-rpe-fields">
                <input className="input" value={r.title} maxLength={80} onChange={(e) => set(i, { title: e.target.value })} placeholder="العنوان (مثلاً: ترحيب)" />
                <textarea className="input" rows={3} value={r.text} maxLength={2000} onChange={(e) => set(i, { text: e.target.value })} placeholder="هلا {name}، شكراً لتواصلك…" />
              </div>
              <div className="ch-rpe-acts">
                <button type="button" className="btn btn-ghost" title="فوق" onClick={() => move(i, -1)} disabled={i === 0} style={{ padding: 6 }}><RiArrowUpLine /></button>
                <button type="button" className="btn btn-ghost" title="تحت" onClick={() => move(i, 1)} disabled={i === rows.length - 1} style={{ padding: 6 }}><RiArrowDownLine /></button>
                <button type="button" className="btn btn-ghost" title="حذف" onClick={() => remove(i)} style={{ padding: 6, color: '#B42318' }}><RiDeleteBinLine /></button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={add} style={{ alignSelf: 'flex-start' }}><RiAddLine /> رد جديد</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>إلغاء</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? <RiLoader4Line className="spin" /> : null} حفظ الردود</button>
          </div>
        </div>
      </form>
    </div>
  )
}

const CSS = `
.ch-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.ch-pill{font-size:12.5px;font-weight:700;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:99px;padding:6px 12px}
.ch-shell{margin:0;padding:0;display:grid;grid-template-columns:320px 1fr;height:calc(100dvh - 230px);min-height:480px;overflow:hidden}
.ch-list{border-inline-end:1px solid var(--border);display:flex;flex-direction:column;min-height:0}
.ch-search{display:flex;align-items:center;gap:8px;margin:12px;padding:0 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-body);color:var(--text-light)}
.ch-search input{flex:1;border:0;background:transparent;height:38px;font-family:inherit;font-size:13.5px;outline:none;color:var(--text-primary)}
html[data-theme="dark"] .ch-search input{background:transparent !important;border:0 !important}
.ch-threads{flex:1;overflow-y:auto;min-height:0}
.ch-thread{display:flex;gap:10px;align-items:center;width:100%;border:0;background:transparent;padding:11px 14px;cursor:pointer;text-align:start;font-family:inherit;color:inherit;border-bottom:1px solid var(--divider)}
.ch-thread:hover{background:var(--bg-hover,#F9F7F5)}
.ch-thread.on{background:var(--color-gold-bg,#FBF5EA)}
.ch-av{width:40px;height:40px;border-radius:50%;background:var(--bg-body);color:var(--text-primary);display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;border:1px solid var(--border)}
.ch-av.lg{width:42px;height:42px}
.ch-th-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ch-th-top,.ch-th-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ch-th-top b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-th-top small{font-size:11.5px;color:var(--text-light);flex-shrink:0}
.ch-prev{font-size:12.5px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-flex;align-items:center;gap:2px;min-width:0}
.ch-thread.unread .ch-th-top b{font-weight:800}
.ch-thread.unread .ch-prev{color:var(--text-primary);font-weight:600}
.ch-thread.unread .ch-th-top small{color:#B91C1C;font-weight:700}
.ch-badge{min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:#DC2626;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.ch-conv{min-width:0;min-height:0;display:flex;flex-direction:column}
.ch-blank{flex:1;display:flex;align-items:center;justify-content:center}
.ch-conv-in{flex:1;display:flex;flex-direction:column;min-height:0}
.ch-conv-head{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border)}
.ch-back{display:none}
.ch-name{font-size:15px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-sub{display:flex;gap:4px 8px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--text-secondary)}
.ch-sub>*{white-space:nowrap}
.ch-tier{background:var(--color-gold-bg,#FBF5EA);color:var(--accent,#A8833F);border-radius:99px;padding:1px 8px;font-weight:600}
.ch-msgs{flex:1;overflow-y:auto;padding:16px 18px;background:var(--bg-body);display:flex;flex-direction:column;gap:4px;min-height:0}
.ch-start{margin:auto;color:var(--text-secondary);font-size:13.5px}
.ch-day{display:flex;justify-content:center;margin:10px 0 6px}
.ch-day span{font-size:11.5px;color:var(--text-secondary);background:var(--bg-card);border:1px solid var(--border);border-radius:99px;padding:3px 10px}
.ch-row{display:flex;justify-content:flex-start}
.ch-row.mine{justify-content:flex-end}
.ch-bubble{max-width:min(72%,520px);background:var(--bg-card);border:1px solid var(--border);border-radius:14px;border-start-start-radius:4px;padding:8px 11px 5px;box-shadow:0 1px 1px rgba(0,0,0,.03)}
.ch-row.mine .ch-bubble{background:#5C0B16;color:#fff;border-color:#5C0B16;border-start-start-radius:14px;border-start-end-radius:4px}
html[data-theme="dark"] .ch-row.mine .ch-bubble{background:#7A1F2B;border-color:#7A1F2B}
.ch-by{font-size:11px;font-weight:700;opacity:.75;margin-bottom:2px}
.ch-text{font-size:14px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.ch-time{font-size:10.5px;opacity:.6;text-align:end;margin-top:2px;direction:ltr}
.ch-img{display:block;margin:2px 0 4px}
.ch-img img{display:block;max-width:100%;max-height:300px;border-radius:10px;object-fit:cover}
.ch-refs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.ch-ref{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;border-radius:8px;padding:4px 8px;background:var(--bg-body);color:var(--text-primary);text-decoration:none;border:1px solid var(--border)}
.ch-ref img{width:22px;height:22px;border-radius:5px;object-fit:cover}
.ch-row.mine .ch-ref{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.2)}
.ch-compose{border-top:1px solid var(--border);padding:10px 12px;background:var(--bg-card);position:relative}
.ch-rp-on{color:var(--accent,#A8833F)}
.ch-rp-veil{position:fixed;inset:0;z-index:40}
.ch-rp{position:absolute;bottom:calc(100% + 6px);inset-inline:12px;z-index:41;background:var(--bg-card);border:1px solid var(--border);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.14);display:flex;flex-direction:column;max-height:min(360px,55dvh);overflow:hidden}
.ch-rp-top{display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid var(--border)}
.ch-rp-list{overflow-y:auto;min-height:0}
.ch-rp-item{display:flex;flex-direction:column;gap:2px;width:100%;border:0;background:transparent;padding:9px 14px;cursor:pointer;text-align:start;font-family:inherit;color:inherit;border-bottom:1px solid var(--divider)}
.ch-rp-item:hover{background:var(--bg-hover,#F9F7F5)}
.ch-rp-item b{font-size:13.5px;font-weight:700}
.ch-rp-item span{font-size:12.5px;color:var(--text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
.ch-rp-empty{padding:18px 14px;text-align:center;font-size:13px;color:var(--text-secondary)}
.ch-rpe{display:flex;flex-direction:column;gap:12px}
.ch-rpe-note{font-size:12px;color:var(--text-secondary);background:var(--bg-body);border-radius:10px;padding:10px 12px;margin:0;line-height:1.7}
.ch-rpe-note code{direction:ltr;unicode-bidi:isolate;font-size:11.5px;background:var(--bg-card);border:1px solid var(--border);border-radius:5px;padding:0 4px}
.ch-rpe-row{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--border);border-radius:12px;padding:10px}
.ch-rpe-fields{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.ch-rpe-fields .input{width:100%;padding:8px 12px;font-family:inherit;font-size:13.5px;color:var(--text-primary)}
.ch-rpe-fields input.input{height:40px}
.ch-rpe-fields textarea.input{resize:vertical;min-height:72px;line-height:1.6}
.ch-rpe-acts{display:flex;flex-direction:column;gap:2px}
.ch-compose-row{display:flex;align-items:flex-end;gap:8px}
.ch-compose textarea{flex:1;resize:none;border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-family:inherit;font-size:14px;line-height:1.5;max-height:140px;min-height:42px;outline:none;background:var(--bg-body);color:var(--text-primary);field-sizing:content}
.ch-send{width:42px;height:42px;border-radius:50%;border:0;background:#5C0B16;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.ch-send:disabled{opacity:.4;cursor:default}
html[data-theme="dark"] .ch-send{background:#C9A465;color:#111}
.ch-preview{position:relative;display:inline-block;margin-bottom:8px}
.ch-preview img{height:84px;border-radius:10px;border:1px solid var(--border);display:block}
.ch-preview button{position:absolute;top:-8px;inset-inline-end:-8px;width:24px;height:24px;border-radius:50%;border:0;background:#111;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
@media(max-width:820px){
  .ch-shell{grid-template-columns:1fr;height:calc(100dvh - 190px)}
  .ch-shell.has-open .ch-list{display:none}
  .ch-shell:not(.has-open) .ch-conv{display:none}
  .ch-back{display:inline-flex}
  .ch-bubble{max-width:86%}
}
`
