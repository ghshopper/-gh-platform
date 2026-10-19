// The "GH collect" bookmark. Runs on a brand page in the admin's own browser
// (brand sites block servers, not browsers). It reads the products on the
// page, then opens each product page in the background (same site, so it is
// allowed) for the full description, all photos, shades/colours and sizes,
// and sends everything to "Products to add".
/* eslint-disable */

function collector(API, KEY) {
  if (window.__ghCollecting) return
  window.__ghCollecting = true
  var CUR = { '€': 'EUR', EUR: 'EUR', AED: 'AED', 'د.إ': 'AED', DHS: 'AED', '$': 'USD', USD: 'USD', 'US$': 'USD', '£': 'GBP', GBP: 'GBP', SAR: 'SAR', 'ر.س': 'SAR', QAR: 'QAR', OMR: 'OMR', 'ر.ع': 'OMR', KWD: 'KWD', BHD: 'BHD', CHF: 'CHF' }
  var SYM = '€|EUR|AED|د\\.إ|DHS|US\\$|USD|\\$|£|GBP|SAR|ر\\.س|QAR|OMR|ر\\.ع|KWD|BHD|CHF'
  var NUM = '\\d[\\d.,\\s\\u00a0\\u202f]*'
  var RE = new RegExp('(?:(' + SYM + ')\\s*(' + NUM + '))|(?:(' + NUM + ')\\s*(' + SYM + '))', 'i')
  var here = location.hostname.replace(/^www\./, '')

  function num(s) {
    s = String(s == null ? '' : s).replace(/[\s  ]/g, '')
    var c = s.lastIndexOf(','), d = s.lastIndexOf('.')
    if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
    else if (c > -1) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
    else if (d > -1 && /\.\d{3}$/.test(s)) s = s.replace(/\./g, '')
    var n = parseFloat(s)
    return isNaN(n) ? null : n
  }
  function price(t) {
    var m = RE.exec(t || '')
    if (!m) return null
    var sym = m[1] || m[4] || '', v = num(m[2] || m[3])
    if (v === null || v <= 0) return null
    return { price: v, currency: CUR[sym] || CUR[sym.toUpperCase()] || sym.toUpperCase() }
  }
  function abs(u, base) { try { return new URL(u, base || location.href).href } catch (e) { return '' } }
  function clean(u) { try { var x = new URL(u); x.hash = ''; return x.href } catch (e) { return u } }
  function key(u) { return clean(u).split('?')[0].replace(/\/$/, '') }
  function txt(el) { return el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '' }
  function okImg(u) { return /^https?:/.test(u) && !/\.svg(\?|$)|placeholder|blank|spacer|logo|icon|sprite/i.test(u) }
  function bestImg(img, base) {
    var c = [], ss = img.getAttribute('srcset') || img.getAttribute('data-srcset') || ''
    if (img.parentElement && img.parentElement.tagName === 'PICTURE')
      [].forEach.call(img.parentElement.querySelectorAll('source'), function (s) { ss += ',' + (s.getAttribute('srcset') || s.getAttribute('data-srcset') || '') })
    ss.split(',').forEach(function (p) { p = p.trim().split(/\s+/); if (p[0]) c.push({ u: p[0], w: parseInt(p[1]) || 0 }) })
    c.sort(function (a, b) { return b.w - a.w })
    var cur = img.currentSrc || img.getAttribute('src') || ''
    if (/^data:/.test(cur)) cur = ''
    var u = abs((c[0] && c[0].u) || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || cur, base)
    return okImg(u) ? u : ''
  }
  function hex(color) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color || '')
    if (!m) return /^#[0-9a-f]{3,6}$/i.test(color || '') ? color : null
    return '#' + [m[1], m[2], m[3]].map(function (x) { return ('0' + (+x).toString(16)).slice(-2) }).join('')
  }
  function uniq(a) { var o = []; a.forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x) }); return o }

  // ── structured data (JSON-LD), used on listing and product pages ──
  function readLd(doc, base) {
    var res = { products: [], crumbs: [] }
    function walk(x) {
      if (!x) return
      if (Array.isArray(x)) return x.forEach(walk)
      if (typeof x !== 'object') return
      if (x['@graph']) walk(x['@graph'])
      var t = [].concat(x['@type'] || []).join(',')
      if (/BreadcrumbList/.test(t)) [].concat(x.itemListElement || []).forEach(function (e) { var n = e.name || (e.item && e.item.name); if (n) res.crumbs.push(String(n)) })
      else if (/Product/.test(t)) res.products.push(x)
      else if (/ItemList/.test(t)) [].concat(x.itemListElement || []).forEach(function (e) { walk(e.item || e) })
    }
    ;[].forEach.call(doc.querySelectorAll('script[type="application/ld+json"]'), function (s) { try { walk(JSON.parse(s.textContent)) } catch (e) {} })
    return res
  }
  function offerOf(x) { var o = [].concat(x.offers || [])[0] || {}; if (o.offers) o = [].concat(o.offers)[0] || {}; return o }
  function imgsOf(x, base) {
    return [].concat(x.image || []).map(function (i) { return abs(typeof i === 'string' ? i : (i && (i.url || i.contentUrl)) || '', base) }).filter(okImg)
  }
  function brandOf(x) { var b = x.brand; if (!b) return null; if (Array.isArray(b)) b = b[0]; return typeof b === 'string' ? b : b.name || null }

  // A product (or product group) from JSON-LD → our item.
  function fromLd(x, base) {
    var of = offerOf(x)
    var variants = [].concat(x.hasVariant || [])
    var colors = [], sizes = [], imgs = imgsOf(x, base)
    var baseName = String(x.name || '').trim()
    var SIZE_RE = /(\d+(?:[.,]\d+)?\s?(?:ml|mL|ML|g|gr|oz|fl\.?\s?oz|cl))\b/
    var prices = []
    function addSize(label, vp) { if (label && !sizes.some(function (k) { return k.en === label })) sizes.push({ en: label, price: vp }) }
    variants.forEach(function (v) {
      var vp = num(offerOf(v).price || offerOf(v).lowPrice || '') || null
      if (vp) prices.push(vp)
      var rest = v.name && baseName && v.name !== baseName ? String(v.name).replace(baseName, '').replace(/^[\s\-–|,:]+|[\s\-–|,:]+$/g, '') : ''
      var sz = v.size ? String(v.size) : (SIZE_RE.exec(rest || '') || [])[1] || null
      if (sz) addSize(sz.replace(/\s+/g, ' ').trim(), vp)
      var c = v.color || (rest && !SIZE_RE.test(rest) ? rest : null)
      if (c && !colors.some(function (k) { return k.en === String(c) })) colors.push({ en: String(c), image: imgsOf(v, base)[0] || null, price: vp })
      imgsOf(v, base).slice(0, 1).forEach(function (i) { if (imgs.indexOf(i) < 0) imgs.push(i) })
      if (!of.price) of = offerOf(v)
    })
    if (x.color && !colors.length) colors.push({ en: String(x.color) })
    if (x.size && !sizes.length) addSize(String(x.size), null)
    // Different prices per size/colour: the product starts at the lowest one.
    var low = prices.length ? Math.min.apply(null, prices) : null
    return {
      name_en: baseName,
      brand: brandOf(x),
      description_en: String(x.description || '').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim(),
      price: low || num(of.price || of.lowPrice || '') || null,
      currency: of.priceCurrency || null,
      source_url: abs(x.url || of.url || base, base),
      images: imgs,
      colors: colors,
      sizes: sizes,
      category: x.category ? String(x.category) : null,
    }
  }

  // Swatches drawn on the page (shade / colour buttons).
  function swatches(root) {
    var out = [], seen = {}
    ;[].forEach.call(root.querySelectorAll('[class*="swatch" i], [class*="shade" i], [class*="color" i], [class*="colour" i], [data-color], [data-shade]'), function (el) {
      var name = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-shade') || el.getAttribute('data-color') || el.getAttribute('data-name') || ''
      var im = el.tagName === 'IMG' ? el : el.querySelector('img')
      if (!name && im) name = im.getAttribute('alt') || ''
      name = name.replace(/^(select|choose|colou?r|shade)\s*[:\-]?\s*/i, '').trim()
      if (!name || name.length > 60 || seen[name.toLowerCase()] || price(name)) return
      if (el.querySelectorAll('[aria-label],[title]').length > 3) return // a container, not a swatch
      seen[name.toLowerCase()] = 1
      var bg = ''
      try { bg = getComputedStyle(el).backgroundColor } catch (e) {}
      var h = hex(el.getAttribute('data-hex') || el.getAttribute('data-color-code') || (bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : ''))
      out.push({ en: name, hex: h, image: im ? bestImg(im) || null : null })
    })
    return out
  }

  // ── listing page: one card per product ──
  var items = [], byKey = {}
  function add(o) {
    if (!o.name_en || !o.source_url) return
    var k = key(o.source_url)
    var e = byKey[k]
    if (e) {
      if (!e.price && o.price) { e.price = o.price; e.currency = o.currency }
      ;(o.images || []).forEach(function (i) { if (e.images.indexOf(i) < 0) e.images.push(i) })
      return
    }
    o.source_url = clean(o.source_url)
    o.images = o.images || []
    byKey[k] = o
    items.push(o)
  }

  var ld = readLd(document, location.href)
  var isProductPage = ld.products.length === 1 && !!(ld.products[0].description || ld.products[0].hasVariant)
  ld.products.forEach(function (x) { add(fromLd(x, location.href)) })

  if (!isProductPage) {
    ;[].forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var raw = a.getAttribute('href') || ''
      var h = abs(raw)
      if (!h || /^(#|javascript:|mailto:|tel:)/i.test(raw) || h.indexOf(here) < 0) return
      if (key(h) === key(location.href)) return
      var card = a, prev = a
      for (var i = 0; i < 7 && card; i++) {
        var tx = card.innerText || ''
        if (card.querySelector('img') && price(tx)) {
          var links = {}
          ;[].forEach.call(card.querySelectorAll('a[href]'), function (l) { links[key(abs(l.getAttribute('href')))] = 1 })
          if (Object.keys(links).length > 3 && prev !== a) card = prev
          break
        }
        prev = card
        card = card.parentElement
      }
      if (!card || !card.querySelector || !card.querySelector('img')) return
      var p = price(card.innerText || '')
      if (!p) return
      var q = card.querySelector('[class*="name" i],[class*="title" i],[itemprop="name"],h2,h3,h4')
      var nm = txt(q)
      if (!nm || price(nm)) nm = (a.getAttribute('aria-label') || a.getAttribute('title') || '').trim()
      if (!nm) { var al = card.querySelector('img[alt]'); nm = al ? al.alt.trim() : '' }
      if (!nm) nm = (card.innerText || '').split('\n').map(function (s) { return s.trim() }).filter(function (s) { return s.length > 3 && !price(s) && !/^(new|nouveau|sold out|online exclusive|exclusive|new in)$/i.test(s) })[0] || ''
      var ims = []
      ;[].forEach.call(card.querySelectorAll('img'), function (im) { var u = bestImg(im); if (u && ims.indexOf(u) < 0) ims.push(u) })
      add({ name_en: nm.replace(/\s+/g, ' ').slice(0, 250), price: p.price, currency: p.currency, source_url: h, images: ims.slice(0, 6), colors: swatches(card), sizes: [] })
    })
  } else {
    var one = items[0]
    var sw = swatches(document)
    if (sw.length > (one.colors || []).length) one.colors = sw
    if (one.images.length < 2) [].forEach.call(document.querySelectorAll('main img, [class*="gallery" i] img, [class*="product" i] img'), function (im) { var u = bestImg(im); if (u && one.images.indexOf(u) < 0 && im.naturalWidth > 300) one.images.push(u) })
    one.images = one.images.slice(0, 8)
  }

  var siteName = (document.querySelector('meta[property="og:site_name"]') || {}).content || ''
  var h1 = txt(document.querySelector('h1'))
  var category = ld.crumbs.length ? ld.crumbs.slice(-2).join(' / ') : h1 || document.title
  items.forEach(function (o) { if (!o.category) o.category = category })

  if (!items.length) {
    window.__ghCollecting = false
    alert('GH Shopper: ما لقيت منتجات في هذي الصفحة. انزل لآخر الصفحة عشان تتحمل كل المنتجات وجرب مرة ثانية.')
    return
  }
  if (!confirm(isProductPage
    ? 'GH Shopper: لقيت «' + items[0].name_en + '». أرسله لصفحة «منتجات للإضافة»؟'
    : 'GH Shopper: لقيت ' + items.length + ' منتج.\nبفتح صفحة كل منتج عشان أجيب الوصف وكل الصور والألوان/الدرجات والمقاسات، وبعدها أرسلها لصفحة «منتجات للإضافة».')) {
    window.__ghCollecting = false
    return
  }

  // ── progress box ──
  var box = document.createElement('div')
  box.setAttribute('style', 'position:fixed;z-index:2147483647;top:16px;left:50%;transform:translateX(-50%);background:#111;color:#fff;font:600 14px/1.5 -apple-system,system-ui,sans-serif;padding:12px 20px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.3);direction:rtl')
  document.body.appendChild(box)
  function show(t) { box.textContent = 'GH Shopper · ' + t }

  // ── product pages, 4 at a time ──
  function detail(o) {
    return fetch(o.source_url, { credentials: 'include' }).then(function (r) { return r.ok ? r.text() : '' }).then(function (html) {
      if (!html) return
      var doc = new DOMParser().parseFromString(html, 'text/html')
      var d = readLd(doc, o.source_url)
      var x = d.products.filter(function (p) { return p.description || p.hasVariant || p.offers })[0]
      if (x) {
        var f = fromLd(x, o.source_url)
        if (f.description_en) o.description_en = f.description_en
        if (f.brand) o.brand = f.brand
        if (f.colors.length > (o.colors || []).length) o.colors = f.colors
        if (f.sizes.length) o.sizes = f.sizes
        if (f.price && (!o.price || f.sizes.some(function (z) { return z.price }))) { o.price = f.price; o.currency = f.currency || o.currency }
        f.images.forEach(function (i) { if (o.images.indexOf(i) < 0) o.images.push(i) })
        if (f.category) o.category = f.category
      }
      if (d.crumbs.length) o.category = d.crumbs.slice(-3).join(' / ')
      if (!o.description_en) {
        var md = doc.querySelector('meta[name="description"], meta[property="og:description"]')
        if (md && md.content && md.content.length > 40) o.description_en = md.content.trim()
      }
      var og = doc.querySelector('meta[property="og:image"]')
      if (og && og.content) { var u = abs(og.content, o.source_url); if (okImg(u) && o.images.indexOf(u) < 0) o.images.push(u) }
      o.images = o.images.slice(0, 8)
    }).catch(function () {})
  }

  var queue = isProductPage ? [] : items.slice(), done = 0
  function worker() {
    var o = queue.shift()
    if (!o) return Promise.resolve()
    return detail(o).then(function () { done++; show('أجيب التفاصيل ' + done + ' / ' + items.length); return worker() })
  }
  show(isProductPage ? 'أرسل…' : 'أجيب التفاصيل 0 / ' + items.length)
  Promise.all([worker(), worker(), worker(), worker()]).then(send)

  function send() {
    show('أرسل للداشبورد…')
    var payload = JSON.stringify({ page: location.href, site: siteName, category: category, items: items })
    function finish(msg) { box.remove(); window.__ghCollecting = false; alert(msg) }
    function viaForm() {
      box.remove(); window.__ghCollecting = false
      var f = document.createElement('form')
      f.method = 'POST'; f.action = API + '/import-items/collect'; f.target = '_blank'
      ;[['key', KEY], ['payload', payload]].forEach(function (kv) { var i = document.createElement('input'); i.type = 'hidden'; i.name = kv[0]; i.value = kv[1]; f.appendChild(i) })
      document.body.appendChild(f); f.submit()
    }
    try {
      fetch(API + '/import-items/collect', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ key: KEY, payload: payload }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || r.status); return j }) })
        .then(function (j) { finish('GH Shopper: تمت إضافة ' + j.added + ' منتج' + (j.skipped ? ' · ' + j.skipped + ' موجودة من قبل' : '') + '.\nافتح «منتجات للإضافة» في الداشبورد.') })
        .catch(function (e) { if (/مفتاح/.test(e.message || '')) finish('GH Shopper: ' + e.message); else viaForm() })
    } catch (e) { viaForm() }
  }
}

export function collectorSource(apiBase, key) {
  return '(' + collector.toString() + ')(' + JSON.stringify(apiBase) + ',' + JSON.stringify(key) + ')'
}

export function bookmarkletHref(apiBase, key) {
  return 'javascript:' + encodeURIComponent(collectorSource(apiBase, key))
}
