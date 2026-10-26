import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  RiArrowLeftSLine, RiArrowRightSLine, RiCalendarLine, RiCloseLine, RiDeleteBinLine, RiDownload2Line, RiLoader4Line,
  RiPenNibLine, RiSave3Line, RiShieldStarLine, RiText, RiUploadCloud2Line, RiFileCopyLine,
} from 'react-icons/ri'
import api from '../../services/api'

/* Signing & stamping documents in the browser (idea from the Al Somahan tool):
   the PDF or picture is drawn page by page, the saved signature, the stamp,
   the date and free text are dragged on it, and a new PDF is made locally.
   pdf.js / pdf-lib live in /admin/vendor and load only when this opens. */

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
const loaded = {}
function script(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('ما قدرنا نحمّل أداة الملفات')); document.head.appendChild(s) })
  return loaded[src]
}
async function libs() {
  await script(BASE + 'vendor/pdf.min.js')
  await script(BASE + 'vendor/pdf-lib.min.js')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + 'vendor/pdf.worker.min.js'
}

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('ما قدرنا نقرأ الصورة')); i.src = src })
const fileToDataURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f) })

/** Trims the empty edges of a transparent canvas. */
function cropCanvas(c) {
  const ctx = c.getContext('2d'); const { width: w, height: h } = c; const d = ctx.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return null
  const p = 4; x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(w - 1, x1 + p); y1 = Math.min(h - 1, y1 + p)
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height)
  return o.toDataURL('image/png')
}

/** A photo of a signature or stamp on white paper → transparent PNG (white removed, edges trimmed). */
async function cleanImage(file, { maxSide = 1200, ink = false } = {}) {
  const img = await loadImg(await fileToDataURL(file))
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height)
  const id = x.getImageData(0, 0, c.width, c.height); const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    const a = l > 232 ? 0 : l > 150 ? (232 - l) / 82 : 1
    d[i + 3] = Math.round(d[i + 3] * a)
    if (ink && a > 0) { const t = Math.min(1, (232 - l) / 140); d[i] = Math.round(20 + (1 - t) * 30); d[i + 1] = Math.round(33 + (1 - t) * 30); d[i + 2] = Math.round(92 + (1 - t) * 40) }
  }
  x.putImageData(id, 0, 0)
  const url = cropCanvas(c)
  if (!url) throw new Error('الصورة فاضية أو فاتحة وايد')
  return url
}

const today = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() }

/** A line of text as a sharp transparent PNG (so it embeds in the PDF exactly as seen). */
function textImage(t) {
  const font = '500 64px "IBM Plex Sans Arabic", "Readex Pro", Arial, sans-serif'
  const c = document.createElement('canvas'); let x = c.getContext('2d'); x.font = font
  const w = Math.max(20, Math.ceil(x.measureText(t || ' ').width) + 16)
  c.width = w; c.height = 96; x = c.getContext('2d'); x.font = font; x.fillStyle = '#14215c'; x.textBaseline = 'middle'
  x.direction = /[؀-ۿ]/.test(t) ? 'rtl' : 'ltr'; x.textAlign = x.direction === 'rtl' ? 'right' : 'left'
  x.fillText(t || ' ', x.direction === 'rtl' ? w - 8 : 8, 50)
  return { url: c.toDataURL('image/png'), ar: c.height / c.width }
}

async function srcOf(url) { if (!url) return null; const im = await loadImg(url); return { url, ar: im.naturalHeight / im.naturalWidth } }
const bytes = (u) => { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a }

let uid = 1

/** source: { blob, name, category?, title? } — brand: { signature, stamp, signer_name, signer_role } */
export default function DocSign({ source, brand, onClose, onSaved }) {
  const [doc, setDoc] = useState(null)
  const [err, setErr] = useState(null)
  const [page, setPage] = useState(0)
  const [items, setItems] = useState([])
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [srcs, setSrcs] = useState({ sig: null, stamp: null })
  const canvasRef = useRef(null)
  const layerRef = useRef(null)
  const stageRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        await libs()
        const [sig, stamp] = await Promise.all([srcOf(brand.signature), srcOf(brand.stamp)])
        if (!off) setSrcs({ sig, stamp })
        const buf = new Uint8Array(await source.blob.arrayBuffer())
        const isPdf = source.blob.type === 'application/pdf' || /\.pdf$/i.test(source.name)
        if (isPdf) {
          const pdf = await window.pdfjsLib.getDocument({ data: buf.slice(0), isEvalSupported: false }).promise
          const pages = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i); const vp1 = p.getViewport({ scale: 1 }); const k = 1400 / vp1.width
            const c = document.createElement('canvas'); c.width = Math.round(vp1.width * k); c.height = Math.round(vp1.height * k)
            const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
            await p.render({ canvasContext: x, viewport: p.getViewport({ scale: k }) }).promise
            pages.push({ canvas: c, w: c.width, h: c.height, vp: vp1 })
          }
          if (!off) setDoc({ type: 'pdf', bytes: buf, pages })
        } else {
          const im = await loadImg(await fileToDataURL(source.blob))
          const k = Math.min(1, 2000 / im.naturalWidth)
          const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k)
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height)
          if (!off) setDoc({ type: 'image', pages: [{ canvas: c, w: c.width, h: c.height }] })
        }
      } catch (e) { console.error(e); if (!off) setErr(e.message || 'ما قدرنا نفتح الملف') }
    })()
    return () => { off = true }
  }, [source, brand])

  // draw the current page
  useEffect(() => {
    if (!doc || !canvasRef.current) return
    const pg = doc.pages[page]; const cv = canvasRef.current
    cv.width = pg.w; cv.height = pg.h; cv.getContext('2d').drawImage(pg.canvas, 0, 0)
  }, [doc, page])

  const pg = doc?.pages[page]
  const srcOfItem = (it) => (it.kind === 'sig' ? srcs.sig : it.kind === 'stamp' ? srcs.stamp : it.src)
  const heightFor = (it, w, p = doc.pages[it.page]) => { const s = srcOfItem(it); return (w * p.w * (s ? s.ar : 1)) / p.h }

  const add = (kind, text) => {
    if (!doc) return
    if (kind === 'sig' && !srcs.sig) return toast.error('ما فيه توقيع محفوظ. أضفه من «التوقيع والختم»')
    if (kind === 'stamp' && !srcs.stamp) return toast.error('ما فيه ختم محفوظ. أضفه من «التوقيع والختم»')
    let it
    if (kind === 'sig' || kind === 'stamp') {
      it = { id: 'i' + uid++, kind, page, w: kind === 'sig' ? 0.24 : 0.17, x: kind === 'sig' ? 0.12 : 0.62, y: 0 }
    } else {
      const src = textImage(text)
      const w = Math.min(0.7, (pg.h * 0.02) / src.ar / pg.w)
      it = { id: 'i' + uid++, kind: 'text', text, src, page, w, x: 0.4, y: 0 }
    }
    it.h = heightFor(it, it.w)
    // drop it in the middle of what is on screen now
    const st = stageRef.current, el = layerRef.current
    let mid = 0.5
    if (st && el) { const r = el.getBoundingClientRect(), v = st.getBoundingClientRect(); mid = ((v.top + v.bottom) / 2 - r.top) / r.height }
    const n = items.filter((i) => i.page === page).length
    it.y = Math.min(Math.max(0, mid - it.h / 2 + n * 0.02), 1 - it.h)
    setItems((a) => [...a, it]); setSel(it.id)
  }
  const selected = items.find((i) => i.id === sel)
  const update = (id, patch) => setItems((a) => a.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const setText = (t) => { if (!selected) return; const src = textImage(t); const w = selected.w; update(selected.id, { text: t, src, h: (w * pg.w * src.ar) / pg.h }) }
  const remove = () => { setItems((a) => a.filter((i) => i.id !== sel)); setSel(null) }
  const allPages = () => {
    if (!selected || doc.pages.length < 2) return
    const copies = doc.pages.map((p, i) => i).filter((i) => i !== selected.page).map((i) => ({ ...selected, id: 'i' + uid++, page: i, h: heightFor(selected, selected.w, doc.pages[i]) }))
    setItems((a) => [...a, ...copies]); toast.success('انحط على كل الصفحات')
  }

  const down = (e) => {
    const el = e.target.closest('[data-id]'); if (!el) { setSel(null); return }
    e.preventDefault(); const it = items.find((i) => i.id === el.dataset.id); if (!it) return
    setSel(it.id)
    const r = layerRef.current.getBoundingClientRect()
    drag.current = { id: it.id, mode: e.target.dataset.handle ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.w, W: r.width, H: r.height }
    try { layerRef.current.setPointerCapture(e.pointerId) } catch { /* old browsers */ }
  }
  const move = (e) => {
    const d = drag.current; if (!d) return
    const dx = (e.clientX - d.sx) / d.W, dy = (e.clientY - d.sy) / d.H
    setItems((a) => a.map((it) => {
      if (it.id !== d.id) return it
      if (d.mode === 'move') return { ...it, x: Math.min(Math.max(0, d.ox + dx), 1 - it.w), y: Math.min(Math.max(0, d.oy + dy), 1 - it.h) }
      // the handle sits on the left-bottom corner in RTL: dragging left makes it bigger
      const w = Math.max(0.03, Math.min(d.ow - dx, d.ox + d.ow)); const h = heightFor(it, w)
      return { ...it, w, h, x: d.ox + d.ow - w, y: Math.min(it.y, 1 - h) }
    }))
  }
  const up = () => { drag.current = null }

  const build = async () => {
    const PDFLib = window.PDFLib
    const cache = new Map(); const embed = async (pdf, s) => { if (!cache.has(s.url)) cache.set(s.url, await pdf.embedPng(bytes(s.url))); return cache.get(s.url) }
    if (doc.type === 'pdf') {
      const pdf = await PDFLib.PDFDocument.load(doc.bytes.slice(0), { ignoreEncryption: true })
      for (const it of items) {
        const s = srcOfItem(it); if (!s) continue
        const vp = doc.pages[it.page].vp; const p = pdf.getPage(it.page)
        const vx = it.x * vp.width, vy = it.y * vp.height, vw = it.w * vp.width, vh = it.h * vp.height
        const [px, py] = vp.convertToPdfPoint(vx, vy + vh)
        p.drawImage(await embed(pdf, s), { x: px, y: py, width: vw, height: vh, rotate: PDFLib.degrees(((vp.rotation % 360) + 360) % 360) })
      }
      return new Blob([await pdf.save()], { type: 'application/pdf' })
    }
    const pdf = await PDFLib.PDFDocument.create()
    const p0 = doc.pages[0]; const pw = 595.28, ph = (pw * p0.h) / p0.w; const p = pdf.addPage([pw, ph])
    p.drawImage(await pdf.embedJpg(bytes(p0.canvas.toDataURL('image/jpeg', 0.92))), { x: 0, y: 0, width: pw, height: ph })
    for (const it of items) { const s = srcOfItem(it); if (s) p.drawImage(await embed(pdf, s), { x: it.x * pw, y: ph - (it.y + it.h) * ph, width: it.w * pw, height: it.h * ph }) }
    return new Blob([await pdf.save()], { type: 'application/pdf' })
  }
  const outName = () => source.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '-') + ' - موقّع.pdf'

  const download = async () => {
    if (!items.length) return toast.error('حط التوقيع أو الختم أول')
    setBusy(true)
    try {
      const url = URL.createObjectURL(await build())
      const a = document.createElement('a'); a.href = url; a.download = outName(); a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) { console.error(e); toast.error('ما قدرنا نجهز الملف') } finally { setBusy(false) }
  }
  const save = async () => {
    if (!items.length) return toast.error('حط التوقيع أو الختم أول')
    setBusy(true)
    try {
      const blob = await build()
      const fd = new FormData()
      fd.append('category', source.category || 'other')
      fd.append('title', (source.title || source.name.replace(/\.[^.]+$/, '')) + ' — موقّع ومختوم')
      fd.append('notes', 'نسخة موقّعة بتاريخ ' + today())
      fd.append('file', new File([blob], outName(), { type: 'application/pdf' }))
      await api.post('/admin/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
      toast.success('انحفظت نسخة موقّعة في ملفات الشركة'); onSaved?.(); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'ما انحفظت') } finally { setBusy(false) }
  }

  return (
    <div className="ds-wrap" dir="rtl">
      <div className="ds-top">
        <button className="ds-x" onClick={onClose} aria-label="إغلاق"><RiCloseLine size={22} /></button>
        <b className="ds-name">{source.title || source.name}</b>
        <div className="ds-out">
          <button className="btn btn-ghost btn-sm" disabled={busy || !doc} onClick={download}><RiDownload2Line /> تنزيل PDF</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !doc} onClick={save}>{busy ? <RiLoader4Line className="spin" /> : <RiSave3Line />} حفظ في ملفات الشركة</button>
        </div>
      </div>
      <div className="ds-tools">
        <button onClick={() => add('sig')}><RiPenNibLine /> التوقيع</button>
        <button onClick={() => add('stamp')}><RiShieldStarLine /> الختم</button>
        <button onClick={() => add('text', today())}><RiCalendarLine /> التاريخ</button>
        <button onClick={() => add('text', brand.signer_name || 'الاسم')}><RiText /> الاسم</button>
        <button onClick={() => add('text', 'نص')}><RiText /> نص</button>
        {selected && (
          <span className="ds-selbar">
            {selected.kind === 'text' && <input value={selected.text} onChange={(e) => setText(e.target.value)} dir="auto" aria-label="النص" />}
            {doc?.pages.length > 1 && <button onClick={allPages}><RiFileCopyLine /> كل الصفحات</button>}
            <button className="ds-del" onClick={remove}><RiDeleteBinLine /> حذف</button>
          </span>
        )}
      </div>
      <div className="ds-stage" ref={stageRef}>
        {err ? <p className="ds-msg">{err}</p> : !doc ? <p className="ds-msg"><RiLoader4Line className="spin" /> نجهز الملف…</p> : (
          <div className="ds-page" style={{ aspectRatio: `${pg.w} / ${pg.h}` }}>
            <canvas ref={canvasRef} />
            <div className="ds-layer" ref={layerRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              {items.filter((i) => i.page === page).map((it) => {
                const s = srcOfItem(it)
                return (
                  <div key={it.id} data-id={it.id} className={`ds-item ${sel === it.id ? 'on' : ''}`} style={{ left: it.x * 100 + '%', top: it.y * 100 + '%', width: it.w * 100 + '%', height: it.h * 100 + '%' }}>
                    {s && <img src={s.url} alt="" draggable={false} />}
                    {sel === it.id && <i data-handle="1" className="ds-handle" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {doc && doc.pages.length > 1 && (
        <div className="ds-pager">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="السابقة"><RiArrowRightSLine size={20} /></button>
          <span>صفحة {page + 1} من {doc.pages.length}</span>
          <button disabled={page === doc.pages.length - 1} onClick={() => setPage(page + 1)} aria-label="التالية"><RiArrowLeftSLine size={20} /></button>
        </div>
      )}
      <p className="ds-hint">اسحب التوقيع أو الختم لمكانه، وكبّره أو صغّره من الزاوية. الملف الأصلي ما يتغير، والنسخة الموقّعة تنحفظ كملف جديد.</p>
      <style>{CSS}</style>
    </div>
  )
}

/** Settings: the signer's name/title, the signature (draw or photo) and the stamp (photo). */
export function BrandSheet({ brand, onClose, onSaved }) {
  const [name, setName] = useState(brand.signer_name || '')
  const [role, setRole] = useState(brand.signer_role || '')
  const [sig, setSig] = useState(brand.signature)
  const [stamp, setStamp] = useState(brand.stamp)
  const [busy, setBusy] = useState(false)
  const pad = useRef(null)
  const drawn = useRef(false)

  useEffect(() => {
    const c = pad.current; if (!c) return
    const r = c.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 3)
    c.width = Math.round(r.width * d); c.height = Math.round(r.height * d)
    const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.lineCap = 'round'; x.lineJoin = 'round'
    let on = false, last = null
    const pt = (e) => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top } }
    const dn = (e) => { e.preventDefault(); on = true; last = pt(e); drawn.current = true; try { c.setPointerCapture(e.pointerId) } catch { /* */ } }
    const mv = (e) => { if (!on) return; const p = pt(e); x.strokeStyle = '#14215c'; x.lineWidth = e.pointerType === 'pen' ? 1.6 + (e.pressure || 0.5) * 2 : 2.6; x.beginPath(); x.moveTo(last.x, last.y); x.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2); x.lineTo(p.x, p.y); x.stroke(); last = p }
    const st = () => { on = false }
    c.addEventListener('pointerdown', dn); c.addEventListener('pointermove', mv); ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.addEventListener(t, st))
    return () => { c.removeEventListener('pointerdown', dn); c.removeEventListener('pointermove', mv); ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.removeEventListener(t, st)) }
  }, [])
  const clearPad = () => { const c = pad.current; c.getContext('2d').save(); c.getContext('2d').setTransform(1, 0, 0, 1, 0, 0); c.getContext('2d').clearRect(0, 0, c.width, c.height); c.getContext('2d').restore(); drawn.current = false }
  const pick = async (e, kind) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    try { const url = await cleanImage(f, kind === 'sig' ? { maxSide: 1000, ink: true } : { maxSide: 900 }); if (kind === 'sig') { setSig(url); clearPad() } else setStamp(url) } catch (er) { toast.error(er.message) }
  }
  const save = async () => {
    setBusy(true)
    try {
      const body = { signer_name: name, signer_role: role, stamp: stamp || '' }
      body.signature = drawn.current ? cropCanvas(pad.current) || sig || '' : sig || ''
      const r = await api.put('/admin/documents/brand', body)
      toast.success('انحفظ'); onSaved(r.data); onClose()
    } catch (e) { toast.error(e.response?.data?.message || 'ما انحفظ') } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520, width: '100%' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">التوقيع والختم</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="إغلاق"><RiCloseLine size={24} /></button>
        </div>
        <div className="modal-body doc-form">
          <div className="doc-two">
            <label>اسم الموقّع<input value={name} onChange={(e) => setName(e.target.value)} dir="auto" /></label>
            <label>الصفة<input value={role} onChange={(e) => setRole(e.target.value)} dir="auto" /></label>
          </div>
          <div className="bs-block">
            <b>التوقيع</b>
            <canvas ref={pad} className="bs-pad" aria-label="ارسم التوقيع هنا" />
            <div className="bs-row">
              <span>ارسم توقيعك فوق بالماوس أو بإصبعك، أو</span>
              <label className="bs-link"><RiUploadCloud2Line /> ارفع صورة توقيع على ورقة بيضاء<input type="file" accept="image/*" hidden onChange={(e) => pick(e, 'sig')} /></label>
              <button type="button" className="bs-link red" onClick={clearPad}>مسح الرسم</button>
            </div>
            {sig && <div className="bs-thumb"><img src={sig} alt="التوقيع المحفوظ" /><button type="button" onClick={() => setSig(null)}>حذف</button></div>}
          </div>
          <div className="bs-block">
            <b>ختم الشركة</b>
            <div className="bs-row">
              <label className="bs-link"><RiUploadCloud2Line /> {stamp ? 'تغيير الختم' : 'ارفع صورة الختم'}<input type="file" accept="image/*" hidden onChange={(e) => pick(e, 'stamp')} /></label>
              <span>اختم على ورقة بيضاء وصوّرها من فوق، الأبيض ينشال بروحه.</span>
            </div>
            {stamp && <div className="bs-thumb"><img src={stamp} alt="الختم" /><button type="button" onClick={() => setStamp(null)}>حذف</button></div>}
          </div>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <RiLoader4Line className="spin" /> : null} حفظ</button>
          <small style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>التوقيع والختم محفوظين في مكان خاص بالسيرفر، وما يقدر يستخدمهم إلا المدراء من هالصفحة.</small>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.ds-wrap{position:fixed;inset:0;z-index:1000;user-select:none;-webkit-user-select:none;background:var(--bg-main,#F5F4F2);display:flex;flex-direction:column}
.ds-top{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border)}
.ds-x{border:0;background:none;cursor:pointer;color:inherit;display:flex;padding:4px}
.ds-name{flex:1;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-out{display:flex;gap:6px}
.ds-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 16px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border)}
.ds-tools button{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);background:none;border-radius:99px;padding:6px 12px;font-family:inherit;font-size:13px;cursor:pointer;color:inherit}
.ds-tools button:hover{border-color:#5C0B16;color:#5C0B16}
.ds-selbar{display:inline-flex;gap:6px;align-items:center;margin-inline-start:auto}
.ds-selbar input{user-select:text;-webkit-user-select:text;border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-family:inherit;font-size:13px;min-width:180px;background:var(--bg-card,#fff);color:inherit}
.ds-tools .ds-del{color:#B42318}
.ds-stage{flex:1;overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start}
.ds-msg{margin:60px auto;color:var(--text-secondary);display:flex;gap:8px;align-items:center}
.ds-page{position:relative;width:min(100%,820px);background:#fff;box-shadow:0 6px 30px rgba(0,0,0,.12)}
.ds-page canvas{width:100%;height:100%;display:block}
.ds-layer{position:absolute;inset:0;touch-action:none}
.ds-item{position:absolute;cursor:move;outline:1px dashed transparent}
.ds-item img{width:100%;height:100%;display:block;pointer-events:none;user-select:none}
.ds-item.on{outline-color:#5C0B16}
.ds-handle{position:absolute;left:-7px;bottom:-7px;width:14px;height:14px;border-radius:50%;background:#5C0B16;border:2px solid #fff;cursor:nesw-resize}
.ds-pager{display:flex;align-items:center;justify-content:center;gap:12px;padding:8px;font-size:13px}
.ds-pager button{border:1px solid var(--border);background:var(--bg-card,#fff);border-radius:8px;padding:4px 8px;cursor:pointer;color:inherit}
.ds-hint{text-align:center;font-size:12px;color:var(--text-secondary);margin:0 0 10px;padding:0 16px}
.doc-form label{min-width:0}.doc-form input{min-width:0;width:100%;box-sizing:border-box}
.bs-block{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--border);border-radius:10px}
.bs-block>b{font-size:14px}
.bs-pad{width:100%;height:150px;border:1.5px dashed var(--border);border-radius:8px;background:#fff;touch-action:none;cursor:crosshair}
.bs-row{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:12.5px;color:var(--text-secondary)}
.doc-form .bs-link,.bs-link{display:inline-flex;flex-direction:row;align-items:center;gap:4px;color:#5C0B16;cursor:pointer;border:0;background:none;font-family:inherit;font-size:12.5px;padding:0}
.bs-link.red{color:#B42318}
.bs-thumb{display:flex;align-items:center;gap:10px;padding:8px;background:repeating-conic-gradient(#f3f3f3 0 25%,#fff 0 50%) 0 0/14px 14px;border-radius:8px}
.bs-thumb img{max-height:90px;max-width:70%}
.bs-thumb button{margin-inline-start:auto;border:0;background:none;color:#B42318;cursor:pointer;font-family:inherit;font-size:12.5px}
@media (max-width:640px){.ds-out .btn{padding:6px 8px;font-size:12px}.ds-selbar{margin:0;width:100%}.ds-selbar input{flex:1;min-width:0}.ds-stage{padding:10px}}
`
