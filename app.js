/* מחולל דפי קטלוג A4 – טופס שדות + תצוגה מקדימה בעיצוב קבוע לפי הדוגמה,
   מספר מוצרים משתנה בעמוד, עורך תמונה ידני, ייבוא/ייצוא אקסל */
(() => {
  'use strict';

  // ---------- קבועים ----------
  const PAGE_W = 794, PAGE_H = 1123;          // A4 ב-96dpi
  const EXPORT_W = 1240, EXPORT_H = 1754;     // A4 ב-150dpi
  const EXPORT_DPI = 150;
  const MAX_IMG = 3000;          // מספיק ל-300dpi גם בתמונה בגודל עמוד
  const AI_BG_URLS = [
    'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm',
    'https://esm.sh/@imgly/background-removal@1.7.0',
  ];
  const IN_VIEWER = !!(window.claude && typeof window.claude.use === 'function');

  // מידות העמוד, נמדדו מעמוד הדוגמה (פריסת 2×2 = קנה מידה 1)
  const L = {
    grayH: 42.5, redH: 55.4, redW: 372, redSlant: 50,
    logo: { x: 40, y: 10, w: 146, h: 36 },
    hdrText: { right: 60, cy: 28.3 },
    area: { x: 87, y: 82, w: 646, h: 960.3, gapX: 30, gapY: 20.3 },
    base: { w: 308, h: 470 },                 // גודל תא מוצר בדוגמה
    foot: { cy: 1098, numX: 74, webRight: 60, logo: { x: 350, y: 1063, w: 95, h: 46 } },
    botRed: { y: 1109.5, h: 13.5, w: 140, slant: 10 },
  };
  // פריסות: עמודות × שורות
  const LAYOUTS = [
    ['1x1', 'מוצר 1 (1×1)'], ['2x1', '2 מוצרים (2×1)'], ['3x1', '3 מוצרים (3×1)'],
    ['2x2', '4 מוצרים (2×2) – כמו בדוגמה'], ['3x2', '6 מוצרים (3×2)'], ['2x3', '6 מוצרים (2×3)'],
    ['2x4', '8 מוצרים (2×4)'], ['3x3', '9 מוצרים (3×3)'], ['4x3', '12 מוצרים (4×3)'], ['3x4', '12 מוצרים (3×4)'],
    ['4x4', '16 מוצרים (4×4)'], ['4x5', '20 מוצרים (4×5)'],
  ];
  const LAYOUT_BY_N = { 1: '1x1', 2: '2x1', 3: '3x1', 4: '2x2', 6: '2x3', 8: '2x4', 9: '3x3', 12: '3x4', 16: '4x4', 20: '4x5' };
  const parseLayout = k => { const m = /^(\d+)x(\d+)$/.exec(k || ''); return m ? [+m[1], +m[2]] : [2, 2]; };
  const slotsOf = pg => { const [c, r] = parseLayout(pg.layout); return c * r; };
  const FONTS = [['Heebo', 'Heebo'], ['Assistant', 'Assistant'], ['Rubik', 'Rubik'], ['Secular One', 'Secular One'], ['Arial', 'Arial']];

  // ---------- מצב ----------
  const assets = {};
  let state, cur = 0, zoom = 1;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = (p = 'a') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function addAsset(url) { const id = uid(); assets[id] = url; return id; }

  function emptyProduct() {
    return { show: true, title: '', name: '', code: '', pack: '', ean: '', img: null, orig: null, cut: null, imgName: '', imgScale: 100, imgY: 0 };
  }
  const isEmptyProduct = p => !p || (!p.title && !p.name && !p.code && !p.pack && !p.ean && !p.img);
  function newPage(from = {}) {
    return { brand: from.brand || '', category: from.category || '', logo: from.logo || null, logoScale: from.logoScale || 100, layout: from.layout || '2x2', products: [] };
  }
  function ensureSlots(pg) { const n = slotsOf(pg); while (pg.products.length < n) pg.products.push(emptyProduct()); }
  function defaultSettings() {
    return {
      accent: '#c5312d', titleColor: '#c8302c', panel: '#f2f3f5', pageBg: '#ffffff',
      grayFrom: '#e6e7e9', grayTo: '#c4c5c7', textColor: '#333333',
      codeLabel: 'קוד פריט', packLabel: 'אריזה', website: 'www.sirka.co.il',
      logoFooter: null, showFooterLogo: true, firstPage: 5, showPageNum: true,
      titleFont: 'Heebo', titleSize: 20, nameSize: 10.5, rowSize: 9.6, hdrSize: 15.5,
      cmykAccent: '', cmykTitle: '', cmykPanel: '', cmykGrayFrom: '', cmykGrayTo: '', cmykText: '',
    };
  }
  function sampleState() {
    const S = window.SAMPLE_IMAGES || {};
    const a = k => S[k] ? (assets['s_' + k] = S[k], 's_' + k) : null;
    const st = { version: 3, settings: defaultSettings(), pages: [] };
    st.settings.logoFooter = a('logoFooter');
    const P = (title, name, code, pack, ean, img) => Object.assign(emptyProduct(), { title, name, code, pack, ean, img: a(img), imgName: img + '.jpg' });
    const pg = newPage({ brand: 'פיברקולור', category: 'טושים', logo: a('logo'), layout: '2x2' });
    pg.products = [
      P('טוש ארגונומי 12 פיברקולור', 'טוש ארגונומי\n12 פיברקולור', '7010152', '96/12', '8008621025817', 'product1'),
      P("טוש הדגשה  צבעי  פסטל 6 יח'", "טוש הדגשה\nצבעי  פסטל 6 יח'", '4012483', '144/12', '8008621025770', 'product2'),
      P("טוש פיברקולור דו צדדי 10 יח'", "טוש פיברקולור\nדו צדדי 10 יח'", '1910110', '72/12', '8008621000845', 'product3'),
      P("טוש פיברקולור דו צדדי 12 יח'", "טוש פיברקולור\nדו צדדי 12 יח'", '1910244', '72/12', '8008621000067', 'product4'),
    ];
    st.pages.push(pg);
    return st;
  }
  const page = () => state.pages[cur];

  // ---------- EAN-13 ----------
  function eanCheckDigit(d12) { let s = 0; for (let i = 0; i < 12; i++) s += (+d12[i]) * (i % 2 ? 3 : 1); return (10 - (s % 10)) % 10; }
  function normalizeEAN(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (!d.length) return { ok: false, empty: true, code: null, msg: 'ללא ברקוד' };
    if (d.length === 12) { const c = eanCheckDigit(d); return { ok: true, code: d + c, msg: 'ספרת ביקורת חושבה: ' + c + ' → ' + d + c }; }
    if (d.length === 13) {
      const c = eanCheckDigit(d.slice(0, 12));
      return c === +d[12] ? { ok: true, code: d, msg: 'ברקוד תקין ✓' } : { ok: false, code: d.slice(0, 12) + c, msg: 'ספרת ביקורת שגויה – הנכונה היא ' + c };
    }
    return { ok: false, code: null, msg: 'יש להזין 12 או 13 ספרות (הוזנו ' + d.length + ')' };
  }
  const bcCache = new Map();
  // ברקוד וקטורי (SVG) – חד בכל רזולוציית הדפסה
  function barcodeURL(value, w, h, fontPx) {
    w = Math.round(w * 10) / 10; h = Math.round(h * 10) / 10;
    const key = [value, w, h, fontPx].join('|');
    if (bcCache.has(key)) return bcCache.get(key);
    const n = normalizeEAN(value);
    if (!n.ok) return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const module = 10;
    let font = 60;
    const opts = h2 => ({ format: 'EAN13', width: module, height: h2, margin: 0, marginLeft: module * 2, marginRight: 0, marginTop: 0, marginBottom: 0,
      displayValue: true, font: 'Arial', fontSize: font, textMargin: Math.round(module * 0.4), background: '#ffffff', lineColor: '#000000' });
    const size = () => [parseFloat(svg.getAttribute('width')), parseFloat(svg.getAttribute('height'))];
    try {
      for (let i = 0; i < 3; i++) { JsBarcode(svg, n.code, opts(100)); font = Math.max(8, Math.round(fontPx * size()[0] / w)); }
      JsBarcode(svg, n.code, opts(100));
      const extra = size()[1] - 100;
      JsBarcode(svg, n.code, opts(Math.max(20, Math.round(size()[0] * h / w - extra))));
      const [W, H] = size();
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.removeAttribute('style');
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      if (bcCache.size > 500) bcCache.clear();
      bcCache.set(key, url);
      return url;
    } catch (e) { console.error(e); return null; }
  }

  // ---------- בניית עמוד ----------
  const px = v => Math.round(v * 100) / 100 + 'px';
  const box = (x, y, w, h) => `left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)};`;

  // מיקום כל תא בעמוד + קנה מידה פנימי (k=1 בפריסת 2×2 של הדוגמה)
  function slotRects(layout) {
    const [c, r] = parseLayout(layout), A = L.area;
    const w = (A.w - (c - 1) * A.gapX) / c, h = (A.h - (r - 1) * A.gapY) / r;
    const k = Math.min(w / L.base.w, h / L.base.h);
    const out = [];
    for (let i = 0; i < c * r; i++) {
      const col = i % c, row = Math.floor(i / c);
      out.push({ x: A.x + A.w - w - col * (w + A.gapX), y: A.y + row * (h + A.gapY), w, h, k }); // מימין לשמאל
    }
    return out;
  }

  function productHTML(p, i, R) {
    const s = state.settings, k = R.k;
    const H = [];
    const titleH = 30 * k, panelY = R.y + titleH + 4.6 * k, panelH = R.h - titleH - 4.6 * k;
    H.push(`<div data-slot="${i}">`);
    H.push(`<div class="abs c-title" style="${box(R.x, R.y, R.w, titleH)}padding-bottom:${(5 * k).toFixed(2)}px;color:${s.titleColor};font-family:'${s.titleFont}',Arial,sans-serif;font-size:${(s.titleSize * k).toFixed(2)}px;">${esc(p.title)}</div>`);
    H.push(`<div class="abs" style="${box(R.x, R.y + titleH, R.w / 2, Math.max(2, 3 * k))}background:${s.accent};"></div>`);
    H.push(`<div class="abs c-panel" style="${box(R.x, panelY, R.w, panelH)}background:${s.panel};">`);
    const iw = 90.5 * k, ix = (R.w - iw) / 2;
    const infoTop = panelH - 11.2 * k - 118 * k;
    if (p.img && assets[p.img]) {
      const sc = (p.imgScale || 100) / 100;
      const aw = R.w - 40 * k, ah = Math.max(10, infoTop - 17 * k - 15.4 * k);
      const w = aw * sc, h = ah * sc;
      H.push(`<img class="c-img" src="${assets[p.img]}" style="${box(20 * k + (aw - w) / 2, 15.4 * k + (ah - h) / 2 + (+p.imgY || 0) * k, w, h)}">`);
    }
    const rs = s.rowSize * k, vs = (s.rowSize * 0.96 * k).toFixed(2);
    H.push(`<div class="abs c-name" style="${box(ix, infoTop, iw, 30 * k)}font-size:${(s.nameSize * k).toFixed(2)}px;line-height:${(s.nameSize * 1.1 * k).toFixed(2)}px;color:${s.textColor};">${esc(p.name)}</div>`);
    H.push(`<div class="abs c-row" style="${box(ix, infoTop + 33.6 * k, iw, 15.5 * k)}font-size:${rs.toFixed(2)}px;color:${s.textColor};border-bottom-width:${Math.max(0.6, 1.2 * k).toFixed(2)}px;"><span>${esc(s.codeLabel)}</span><span class="v" style="font-size:${vs}px">${esc(p.code)}</span></div>`);
    H.push(`<div class="abs c-row" style="${box(ix, infoTop + 52.6 * k, iw, 15.5 * k)}font-size:${rs.toFixed(2)}px;color:${s.textColor};border-bottom-width:${Math.max(0.6, 1.2 * k).toFixed(2)}px;"><span>${esc(s.packLabel)}</span><span class="v" style="font-size:${vs}px">${esc(p.pack)}</span></div>`);
    const bc = barcodeURL(p.ean, iw, 43 * k, 8 * k);
    if (bc) H.push(`<img class="abs c-barcode" src="${bc}" style="${box(ix, infoTop + 75 * k, iw, 43 * k)}">`);
    H.push(`</div></div>`);
    return H.join('');
  }

  // bleed = שולי גלישה בפיקסלים (להדפסה): רכיבים שנוגעים בקצה הדף נמשכים מעבר לקו החיתוך
  function buildPage(pg, index, interactive, bleed = 0) {
    const s = state.settings, B = bleed;
    const el = document.createElement('div');
    el.className = 'cpage';
    el.style.background = s.pageBg;
    if (B) { el.style.width = PAGE_W + 2 * B + 'px'; el.style.height = PAGE_H + 2 * B + 'px'; }
    const H = [];
    const tanTop = L.redSlant / L.redH, tanBot = L.botRed.slant / L.botRed.h;
    H.push(`<div class="abs" style="${box(-B, -B, PAGE_W + 2 * B, L.grayH + B)}background:linear-gradient(to right, ${s.grayFrom} 0%, ${s.grayFrom} 45%, ${s.grayTo} 100%);"></div>`);
    H.push(`<div class="abs" style="${box(-B, -B, L.redW + B, L.redH + B)}background:${s.accent};"></div>`);
    const skTop = Math.atan(tanTop) * 180 / Math.PI;
    H.push(`<div class="abs" style="${box(L.redW - L.redSlant - B * tanTop, -B, L.redSlant, L.redH + B)}background:${s.accent};transform:skewX(${skTop}deg);transform-origin:0 0;"></div>`);
    H.push(`<div class="abs" style="${box(L.redW - B * tanTop, -B, 34, L.grayH + B)}background:linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%);transform:skewX(${skTop}deg);transform-origin:0 0;"></div>`);
    if (pg.logo && assets[pg.logo]) {
      const k = (pg.logoScale || 100) / 100, w = L.logo.w * k, h = L.logo.h * k;
      H.push(`<img class="abs c-logo" data-go="header" src="${assets[pg.logo]}" style="${box(L.logo.x, L.logo.y + (L.logo.h - h) / 2, w, h)}object-position:left center;">`);
    }
    H.push(`<div class="abs c-hdr-text" data-go="header" style="right:${px(L.hdrText.right)};top:${px(L.hdrText.cy - 14)};width:400px;height:28px;font-size:${s.hdrSize}px;letter-spacing:${(s.hdrSize * 0.2).toFixed(2)}px;">
      <span>${esc(pg.brand)}</span>${pg.brand && pg.category ? `<span class="sep" style="color:${s.accent}">|</span>` : ''}<span>${esc(pg.category)}</span></div>`);

    const rects = slotRects(pg.layout);
    rects.forEach((R, i) => {
      const p = pg.products[i];
      if (!p || !p.show || isEmptyProduct(p)) {
        if (interactive) H.push(`<div data-slot="${i}" class="abs" style="${box(R.x, R.y, R.w, R.h)}"></div>`);
        return;
      }
      H.push(productHTML(p, i, R));
    });

    if (s.showPageNum) H.push(`<div class="abs c-foot-num" data-go="footer" style="${box(L.foot.numX - 25, L.foot.cy - 10, 50, 20)}font-size:15px;line-height:20px;">${(+s.firstPage || 1) + index}</div>`);
    if (s.showFooterLogo && s.logoFooter && assets[s.logoFooter]) H.push(`<img class="abs c-logo" data-go="footer" src="${assets[s.logoFooter]}" style="${box(L.foot.logo.x, L.foot.logo.y, L.foot.logo.w, L.foot.logo.h)}">`);
    H.push(`<div class="abs c-foot-web" data-go="footer" style="right:${px(L.foot.webRight)};top:${px(L.foot.cy - 10)};width:300px;height:20px;font-size:13.5px;line-height:20px;letter-spacing:2.6px;">${esc(s.website)}</div>`);
    H.push(`<div class="abs" style="${box(-B, L.botRed.y, L.botRed.w + B, L.botRed.h + B)}background:${s.accent};"></div>`);
    H.push(`<div class="abs" style="${box(L.botRed.w - L.botRed.slant, L.botRed.y, L.botRed.slant, L.botRed.h + B)}background:${s.accent};transform:skewX(${Math.atan(tanBot) * 180 / Math.PI}deg);transform-origin:0 0;"></div>`);
    el.innerHTML = B ? `<div class="abs" style="${box(B, B, PAGE_W, PAGE_H)}">${H.join('')}</div>` : H.join('');
    if (!interactive) $$('[data-slot],[data-go]', el).forEach(n => { n.removeAttribute('data-slot'); n.removeAttribute('data-go'); });
    return el;
  }

  // ---------- תצוגה בעורך ----------
  let previewTimer = null;
  function renderPreview() {
    const host = $('#previewScale');
    const el = buildPage(page(), cur, true);
    el.style.transform = `scale(${zoom})`;
    el.style.transformOrigin = 'top left';
    host.style.width = PAGE_W * zoom + 'px';
    host.style.height = PAGE_H * zoom + 'px';
    host.replaceChildren(el);
    $('#pageInfo').textContent = `עמוד ${cur + 1} מתוך ${state.pages.length}`;
    $('#prevPage').disabled = cur === 0;
    $('#nextPage').disabled = cur === state.pages.length - 1;
    $('#delPage').disabled = state.pages.length < 2;
  }
  function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 90); scheduleSave(); }

  $('#previewScale').addEventListener('click', e => {
    const slot = e.target.closest('[data-slot]'), go = e.target.closest('[data-go]');
    const target = slot ? 'sec-p' + slot.dataset.slot : go ? 'sec-' + go.dataset.go : null;
    const sec = target && document.getElementById(target);
    if (!sec) return;
    sec.open = true;
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sec.classList.remove('flash'); void sec.offsetWidth; sec.classList.add('flash');
  });

  function setZoom(z) { zoom = clamp(Math.round(z * 100) / 100, 0.25, 2.5); $('#zoomLabel').textContent = Math.round(zoom * 100) + '%'; renderPreview(); }
  function zoomFit() { const w = $('#previewWrap'); setZoom(Math.min((w.clientWidth - 48) / PAGE_W, (w.clientHeight - 48) / PAGE_H)); }
  $('#zoomIn').onclick = () => setZoom(zoom + 0.1);
  $('#zoomOut').onclick = () => setZoom(zoom - 0.1);
  $('#zoomFit').onclick = zoomFit;
  $('#previewWrap').addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });

  // ---------- טופס ----------
  const idOf = path => 'fld-' + path.replace(/\./g, '-');
  const txt = (label, path, val, extra = '') => `<div class="f"><label for="${idOf(path)}">${label}</label><input type="text" id="${idOf(path)}" data-path="${path}" value="${esc(val)}" ${extra}></div>`;
  const area = (label, path, val, hint = '') => `<div class="f"><label for="${idOf(path)}">${label}</label><textarea id="${idOf(path)}" data-path="${path}" rows="2">${esc(val)}</textarea>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  const numf = (label, path, val, min, max, step = 1) => `<div class="f"><label for="${idOf(path)}">${label}</label><input type="number" id="${idOf(path)}" data-path="${path}" value="${val}" min="${min}" max="${max}" step="${step}"></div>`;
  const color = (label, path, val) => `<div class="f"><label for="${idOf(path)}">${label}</label><input type="color" id="${idOf(path)}" data-path="${path}" value="${val}"></div>`;
  const range = (label, path, val, min, max) => `<div class="f"><label for="${idOf(path)}">${label}: <span data-out="${path}">${val}</span></label><input type="range" id="${idOf(path)}" data-path="${path}" value="${val}" min="${min}" max="${max}"></div>`;
  const check = (label, path, val) => `<label class="check"><input type="checkbox" id="${idOf(path)}" data-path="${path}" ${val ? 'checked' : ''}> ${label}</label>`;
  const cmykField = (label, key, hex) => {
    const c = parseRGBA(cssColor(hex)) || { r: 0, g: 0, b: 0 };
    const auto = rgbToCmyk(c.r, c.g, c.b).map(v => Math.round(v * 100)).join(',');
    return `<div class="f"><label for="fld-s-${key}">${label}</label><input type="text" id="fld-s-${key}" data-path="s.${key}" value="${esc(state.settings[key] || '')}" placeholder="אוטומטי: ${auto}" dir="ltr"></div>`;
  };
  const layoutOptions = cur => LAYOUTS.map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l}</option>`).join('');

  function imgField(key, assetId, opts = {}) {
    const has = assetId && assets[assetId];
    return `<div class="imgfield" data-imgkey="${key}">
      <div class="thumb ${opts.logo ? 'logo' : ''}" data-act="pick" title="לחצו לבחירת תמונה או גררו קובץ לכאן">${has ? `<img src="${assets[assetId]}" alt="">` : 'לחצו או גררו<br>תמונה לכאן'}</div>
      <div class="imgbtns">
        <button class="small" data-act="pick">📂 ${has ? 'החלף' : 'הוסף'} תמונה</button>
        ${has ? `<button class="small" data-act="edit">✏️ עריכה ידנית / מחיקת רקע</button>
        <button class="small" data-act="bgFast">⚡ הסר רקע</button>
        <button class="small" data-act="bgAI">✨ רקע AI</button>
        <button class="small" data-act="trim">✂️ חתוך שוליים</button>
        ${opts.orig ? '<button class="small" data-act="restore">↺ מקור</button>' : ''}
        <button class="small" data-act="clear">🗑 הסר</button>` : ''}
      </div>
    </div>`;
  }

  let tolerance = 38;
  function renderForm() {
    const s = state.settings, pg = page();
    ensureSlots(pg);
    const N = slotsOf(pg);
    const hidden = pg.products.slice(N).filter(p => !isEmptyProduct(p)).length;
    const H = [];
    H.push(`<details class="sec" id="sec-header" open><summary>כותרת ופריסת העמוד <span class="badge">עמוד ${cur + 1}</span></summary><div class="sec-body">
      <div class="f"><label for="fld-layout">מספר מוצרים בעמוד</label><select id="fld-layout" data-path="page.layout">${layoutOptions(pg.layout)}</select></div>
      ${hidden ? `<div class="warn">${hidden} מוצרים בעמוד הזה מוסתרים כי אין להם מקום בפריסה. הגדילו את מספר המוצרים, או לחצו "סדר את כל הקטלוג" כדי להעביר אותם לעמודים נוספים.</div>` : ''}
      <div class="imgbtns"><button class="small" data-act="applyLayoutAll">סדר את כל הקטלוג בפריסה הזו</button></div>
      <div class="hint">"סדר את כל הקטלוג" מעביר את כל המוצרים לפי הסדר לעמודים בפריסה שנבחרה, ומוסיף עמודים לפי הצורך.</div>
      <div class="f"><label>לוגו (בפס האדום)</label>${imgField('logo', pg.logo, { logo: true })}</div>
      ${range('גודל הלוגו (%)', 'page.logoScale', pg.logoScale || 100, 40, 160)}
      <div class="f2">${txt('שם המותג (בכותרת)', 'page.brand', pg.brand)}${txt('קטגוריה', 'page.category', pg.category)}</div>
      <div class="imgbtns"><button class="small" data-act="logoToBrand">החל לוגו זה על כל העמודים של "${esc(pg.brand || 'המותג')}"</button></div>
    </div></details>`);

    for (let i = 0; i < N; i++) {
      const p = pg.products[i];
      const n = normalizeEAN(p.ean);
      H.push(`<details class="sec" id="sec-p${i}" ${i === 0 && N <= 4 ? 'open' : ''}><summary>מוצר ${i + 1} <span class="badge" data-badge="${i}">${esc(p.title || '—')}</span></summary><div class="sec-body">
        ${check('הצג את המוצר בדף', `p.${i}.show`, p.show)}
        ${txt('כותרת המוצר (באדום)', `p.${i}.title`, p.title)}
        <div class="f"><label>תמונת המוצר</label>${imgField('p.' + i, p.img, { orig: !!p.orig })}</div>
        <div class="f2">${range('גודל תמונה (%)', `p.${i}.imgScale`, p.imgScale || 100, 40, 160)}${range('הזזה אנכית', `p.${i}.imgY`, p.imgY || 0, -120, 120)}</div>
        ${area('תיאור קצר (מתחת לתמונה)', `p.${i}.name`, p.name, 'Enter יורד שורה – כמו בדוגמה (2 שורות)')}
        <div class="f2">${txt(esc(s.codeLabel || 'קוד פריט'), `p.${i}.code`, p.code, 'dir="ltr"')}${txt(esc(s.packLabel || 'אריזה'), `p.${i}.pack`, p.pack, 'dir="ltr"')}</div>
        <div class="f"><label for="${idOf(`p.${i}.ean`)}">ברקוד EAN-13 (12 ספרות – ספרת ביקורת תחושב, או 13 ספרות)</label>
          <input type="text" id="${idOf(`p.${i}.ean`)}" data-path="p.${i}.ean" value="${esc(p.ean)}" dir="ltr" inputmode="numeric" maxlength="13">
          <div class="ean-msg ${n.empty ? '' : n.ok ? 'ok' : 'bad'}" data-eanmsg="${i}">${esc(n.msg)}</div>
          <div class="imgbtns"><button class="small" data-fix="${i}">תקן ספרת ביקורת</button><button class="small" data-clearp="${i}">נקה מוצר</button></div>
        </div>
      </div></details>`);
    }

    H.push(`<details class="sec" id="sec-footer"><summary>תחתית העמוד <span class="badge">משותף לכל העמודים</span></summary><div class="sec-body">
      ${txt('אתר / פרטי קשר', 's.website', s.website, 'dir="ltr"')}
      <div class="f2">${numf('מספר העמוד הראשון', 's.firstPage', s.firstPage, 1, 9999)}<div class="f"><label>&nbsp;</label>${check('הצג מספר עמוד', 's.showPageNum', s.showPageNum)}</div></div>
      <div class="f"><label>לוגו תחתון (במרכז)</label>${imgField('logoFooter', s.logoFooter, { logo: true })}</div>
      ${check('הצג לוגו תחתון', 's.showFooterLogo', s.showFooterLogo)}
    </div></details>`);

    H.push(`<details class="sec" id="sec-design"><summary>עיצוב מתקדם <span class="badge">צבעים, גופנים וכיתובים</span></summary><div class="sec-body">
      <div class="f3">${color('צבע ראשי (אדום)', 's.accent', s.accent)}${color('צבע כותרות מוצר', 's.titleColor', s.titleColor)}${color('רקע מוצר', 's.panel', s.panel)}</div>
      <div class="f3">${color('פס עליון – התחלה', 's.grayFrom', s.grayFrom)}${color('פס עליון – סוף', 's.grayTo', s.grayTo)}${color('צבע טקסט', 's.textColor', s.textColor)}</div>
      <div class="f3">${color('רקע הדף', 's.pageBg', s.pageBg)}</div>
      <div class="f2"><div class="f"><label for="fld-s-titleFont">גופן כותרות</label><select id="fld-s-titleFont" data-path="s.titleFont">${FONTS.map(([v, l]) => `<option value="${v}" ${v === s.titleFont ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${numf('גודל כותרת מוצר', 's.titleSize', s.titleSize, 8, 40, 0.5)}</div>
      <div class="f3">${numf('גודל תיאור', 's.nameSize', s.nameSize, 6, 20, 0.5)}${numf('גודל קוד/אריזה', 's.rowSize', s.rowSize, 6, 20, 0.2)}${numf('גודל כותרת עליונה', 's.hdrSize', s.hdrSize, 8, 30, 0.5)}</div>
      <div class="hint">הגדלים הם לפריסת 4 מוצרים; בפריסות צפופות יותר הכול מוקטן באופן יחסי.</div>
      <div class="f2">${txt('כיתוב "קוד פריט"', 's.codeLabel', s.codeLabel)}${txt('כיתוב "אריזה"', 's.packLabel', s.packLabel)}</div>
      <div class="f"><label for="tolRange">רגישות הסרת רקע מהירה: <span id="tolOut">${tolerance}</span></label><input type="range" id="tolRange" min="5" max="120" value="${tolerance}"><div class="hint">גבוה יותר = מסיר יותר. "הסר רקע" מתאים לרקע אחיד; "AI" לכל רקע${IN_VIEWER ? ' (זמין רק כשפותחים את הקובץ מהמחשב)' : ' (דורש אינטרנט)'}.</div></div>
      <details class="box"><summary><b>ערכי CMYK לדפוס (אופציונלי)</b></summary>
        <div class="hint">כמו בתוכנת עימוד: אם יש לכם ערכי CMYK מדויקים של צבעי המותג (מבית הדפוס או ממדריך המותג), הזינו אותם כאן באחוזים: C,M,Y,K. שדה ריק = המרה אוטומטית.</div>
        <div class="f2">${cmykField('צבע ראשי', 'cmykAccent', s.accent)}${cmykField('כותרות מוצר', 'cmykTitle', s.titleColor)}</div>
        <div class="f2">${cmykField('רקע מוצר', 'cmykPanel', s.panel)}${cmykField('צבע טקסט', 'cmykText', s.textColor)}</div>
        <div class="f2">${cmykField('פס עליון – התחלה', 'cmykGrayFrom', s.grayFrom)}${cmykField('פס עליון – סוף', 'cmykGrayTo', s.grayTo)}</div>
      </details>
      <div><button class="small" data-act="resetDesign">החזר עיצוב ברירת מחדל</button></div>
    </div></details>`);

    const panel = $('#formPanel');
    const open = new Set($$('details.sec[open]', panel).map(d => d.id));
    const scroll = panel.scrollTop;
    panel.innerHTML = H.join('');
    if (open.size) $$('details.sec', panel).forEach(d => { d.open = open.has(d.id); });
    panel.scrollTop = scroll;
  }

  function getTarget(path) {
    const parts = path.split('.');
    if (parts[0] === 's') return [state.settings, parts[1]];
    if (parts[0] === 'page') return [page(), parts[1]];
    if (parts[0] === 'p') return [page().products[+parts[1]], parts[2]];
    return [null, null];
  }

  const formPanel = $('#formPanel');
  formPanel.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'tolRange') { tolerance = +t.value; $('#tolOut').textContent = t.value; return; }
    const path = t.dataset.path; if (!path) return;
    const [obj, key] = getTarget(path); if (!obj) return;
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if (t.type === 'number' || t.type === 'range') { v = parseFloat(v); if (isNaN(v)) return; }
    if (key === 'ean') v = String(v).replace(/\D/g, '').slice(0, 13);
    obj[key] = v;
    const out = formPanel.querySelector(`[data-out="${path}"]`); if (out) out.textContent = v;
    if (key === 'title') { const b = formPanel.querySelector(`[data-badge="${path.split('.')[1]}"]`); if (b) b.textContent = v || '—'; }
    if (key === 'ean') {
      const i = path.split('.')[1], n = normalizeEAN(v), m = formPanel.querySelector(`[data-eanmsg="${i}"]`);
      m.textContent = n.msg; m.className = 'ean-msg ' + (n.empty ? '' : n.ok ? 'ok' : 'bad');
    }
    if (key === 'layout') { renderForm(); renderPreview(); scheduleSave(); return; }
    schedulePreview();
  });
  formPanel.addEventListener('change', e => {
    const k = e.target.dataset.path || '';
    if (k === 's.codeLabel' || k === 's.packLabel' || k === 'page.brand') renderForm();
  });
  formPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-act],[data-fix],[data-clearp]'); if (!b) return;
    e.preventDefault();
    if (b.dataset.fix !== undefined) {
      const p = page().products[+b.dataset.fix], n = normalizeEAN(p.ean);
      if (n.code) { p.ean = n.code; renderForm(); schedulePreview(); } else toast('יש להזין לפחות 12 ספרות', 'bad');
      return;
    }
    if (b.dataset.clearp !== undefined) { page().products[+b.dataset.clearp] = emptyProduct(); renderForm(); schedulePreview(); toast('המוצר נוקה'); return; }
    const act = b.dataset.act;
    if (act === 'resetDesign') {
      const o = state.settings;
      state.settings = Object.assign(defaultSettings(), { website: o.website, logoFooter: o.logoFooter, firstPage: o.firstPage, codeLabel: o.codeLabel, packLabel: o.packLabel });
      renderForm(); schedulePreview(); return;
    }
    if (act === 'applyLayoutAll') { reflowAll(page().layout); return; }
    if (act === 'logoToBrand') {
      const pg = page(); let n = 0;
      state.pages.forEach(p => { if (p !== pg && p.brand === pg.brand) { p.logo = pg.logo; p.logoScale = pg.logoScale; n++; } });
      toast(n ? `הלוגו הוחל על ${n} עמודים נוספים` : 'אין עמודים נוספים עם אותו מותג'); scheduleSave(); return;
    }
    const key = b.closest('[data-imgkey]')?.dataset.imgkey; if (!key) return;
    imageAction(key, act);
  });
  formPanel.addEventListener('dragover', e => { const t = e.target.closest('.thumb'); if (t) { e.preventDefault(); t.classList.add('drag'); } });
  formPanel.addEventListener('dragleave', e => { const t = e.target.closest('.thumb'); if (t) t.classList.remove('drag'); });
  formPanel.addEventListener('drop', e => {
    const t = e.target.closest('.thumb'); if (!t) return;
    e.preventDefault(); t.classList.remove('drag');
    const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (f) loadImageInto(t.closest('[data-imgkey]').dataset.imgkey, f);
  });
  const pw = $('#previewWrap');
  pw.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  pw.addEventListener('drop', e => {
    e.preventDefault();
    const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')); if (!f) return;
    const slot = e.target.closest('[data-slot]'), go = e.target.closest('[data-go]');
    if (slot) loadImageInto('p.' + slot.dataset.slot, f);
    else if (go && go.dataset.go === 'header') loadImageInto('logo', f);
    else toast('גררו את התמונה על אחד המוצרים בדף');
  });

  // סידור כל המוצרים מחדש לפי פריסה – עמוד חדש גם כשמשתנים המותג/הקטגוריה
  function reflowAll(layout) {
    const items = [];
    state.pages.forEach(pg => pg.products.forEach(p => { if (!isEmptyProduct(p)) items.push({ p, hdr: pg }); }));
    const pages = buildPagesFromItems(items, layout);
    if (!pages.length) { page().layout = layout; renderForm(); renderPreview(); return; }
    const before = state.pages.length;
    state.pages = pages; cur = 0;
    renderForm(); renderPreview(); scheduleSave();
    toast(`הקטלוג סודר מחדש: ${pages.length} עמודים (לפני: ${before})`, 'ok');
  }
  function buildPagesFromItems(items, layout, fixedGroups) {
    const n = (() => { const [c, r] = parseLayout(layout); return c * r; })();
    const pages = [];
    let pg = null, lastKey = null;
    items.forEach(({ p, hdr, group }) => {
      const key = fixedGroups ? group : (hdr.brand || '') + '|' + (hdr.category || '');
      if (!pg || pg.products.length >= n || key !== lastKey) {
        pg = newPage({ brand: hdr.brand, category: hdr.category, logo: hdr.logo, logoScale: hdr.logoScale, layout });
        pages.push(pg);
      }
      lastKey = key;
      pg.products.push(p);
    });
    pages.forEach(ensureSlots);
    return pages;
  }

  // ---------- תמונות ----------
  function imgRef(key) {
    if (key === 'logo') return { obj: page(), k: 'logo', logo: true };
    if (key === 'logoFooter') return { obj: state.settings, k: 'logoFooter', logo: true };
    return { obj: page().products[+key.split('.')[1]], k: 'img', logo: false };
  }
  let pickKey = null;
  $('#fileInput').addEventListener('change', e => { const f = e.target.files[0]; if (f && pickKey) loadImageInto(pickKey, f); pickKey = null; });

  const fileToDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function normalizeImage(url) {
    const img = await loadImg(url);
    let w = img.naturalWidth, h = img.naturalHeight;
    const k = Math.min(1, MAX_IMG / Math.max(w, h));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let alpha = false; for (let i = 3; i < d.length; i += 28) if (d[i] < 250) { alpha = true; break; }
    return alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.95);
  }
  async function loadImageInto(key, file) {
    if (!file.type.startsWith('image/')) { toast('הקובץ אינו תמונה', 'bad'); return; }
    showBusy('טוען תמונה…');
    try {
      const url = await normalizeImage(await fileToDataURL(file));
      const r = imgRef(key);
      r.obj[r.k] = addAsset(url);
      if (!r.logo) { r.obj.orig = null; r.obj.cut = null; r.obj.imgName = file.name; }
      renderForm(); renderPreview(); scheduleSave();
    } catch (e) { console.error(e); toast('לא ניתן לטעון את התמונה', 'bad'); }
    finally { hideBusy(); }
  }

  async function imageAction(key, act) {
    const r = imgRef(key);
    if (act === 'pick') { pickKey = key; $('#fileInput').value = ''; $('#fileInput').click(); return; }
    if (act === 'clear') { r.obj[r.k] = null; if (!r.logo) { r.obj.orig = null; r.obj.cut = null; } renderForm(); schedulePreview(); return; }
    if (act === 'restore') { if (r.obj.orig) { r.obj[r.k] = r.obj.orig; r.obj.orig = null; r.obj.cut = null; renderForm(); schedulePreview(); } return; }
    if (act === 'edit') { openEditor(key); return; }
    const id = r.obj[r.k]; if (!id || !assets[id]) return;
    try {
      if (act === 'trim') {
        showBusy('חותך שוליים…');
        const c = toCanvas(await loadImg(assets[id]));
        r.obj[r.k] = addAsset(r.logo ? trimmed(c, true).toDataURL('image/png') : flattenOnWhite(trimmed(c, true)));
        renderForm(); renderPreview(); scheduleSave(); toast('השוליים נחתכו', 'ok');
        return;
      }
      const { src, srcId } = await editorSources(r, false);
      if (act === 'bgFast') {
        showBusy('מסיר רקע…'); await new Promise(z => setTimeout(z, 30));
        const cut = floodRemove(copyCanvas(src), tolerance);
        refineCutout(cut, src, { hard: 50, shrink: 0, specks: true });
        commitCutout(r, cut, srcId);
        toast(r.logo ? 'הרקע הוסר (שקוף)' : 'הרקע הוסר והתמונה נצרבה על רקע לבן. לתיקונים: "עריכה ידנית".', 'ok');
      } else if (act === 'bgAI') {
        const cut = await aiCutout(src);
        setBusy('מנקה קצוות…'); await new Promise(z => setTimeout(z, 20));
        refineCutout(cut, src, AI_REFINE);
        hideBusy();
        openEditor(key, { src, work: cut, srcId, note: 'התוצאה של ה-AI מוכנה. בדקו את הקצוות, תקנו עם מחק / שחזר אם צריך, ולחצו שמור.' });
      }
    } catch (e) {
      console.error(e);
      toast((act === 'bgAI' ? 'הסרת רקע AI נכשלה: ' : 'העיבוד נכשל: ') + (e && e.message || e), 'bad');
    } finally { hideBusy(); }
  }
  const AI_REFINE = { hard: 60, shrink: 1, specks: true };
  // מקור לעריכה: התמונה המקורית + שכבת החיתוך השקופה אם יש, אחרת התמונה הנוכחית
  async function editorSources(r, withWork = true) {
    const id = r.obj[r.k];
    const useCut = !r.logo && r.obj.orig && r.obj.cut && assets[r.obj.orig] && assets[r.obj.cut];
    const srcId = (!r.logo && r.obj.orig && assets[r.obj.orig]) ? r.obj.orig : id;
    const sImg = await loadImg(assets[srcId]);
    const k = Math.min(1, 2400 / Math.max(sImg.naturalWidth, sImg.naturalHeight));
    const W = Math.max(1, Math.round(sImg.naturalWidth * k)), H = Math.max(1, Math.round(sImg.naturalHeight * k));
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    src.getContext('2d').drawImage(sImg, 0, 0, W, H);
    if (!withWork) return { src, srcId };
    let work;
    if (useCut) {
      work = document.createElement('canvas'); work.width = W; work.height = H;
      work.getContext('2d').drawImage(await loadImg(assets[r.obj.cut]), 0, 0, W, H);
    } else if (srcId !== id) {
      // יש מקור אבל אין שכבת חיתוך (פרויקט ישן) – עובדים על התמונה הנוכחית
      const cImg = await loadImg(assets[id]);
      const src2 = document.createElement('canvas'); src2.width = cImg.naturalWidth; src2.height = cImg.naturalHeight;
      src2.getContext('2d').drawImage(cImg, 0, 0);
      return { src: src2, work: copyCanvas(src2), srcId: id };
    } else work = copyCanvas(src);
    return { src, work, srcId };
  }
  function copyCanvas(c) { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0); return o; }
  // שמירת חיתוך: לוגו – PNG שקוף; מוצר – שכבת חיתוך שקופה + "צריבה" על רקע לבן
  function commitCutout(r, cut, srcId) {
    if (r.logo) r.obj[r.k] = addAsset(trimmed(cut, true).toDataURL('image/png'));
    else {
      if (!r.obj.orig) r.obj.orig = srcId;
      r.obj.cut = addAsset(cut.toDataURL('image/png'));
      r.obj[r.k] = addAsset(flattenOnWhite(trimmed(cut, true)));
    }
    renderForm(); renderPreview(); scheduleSave();
  }
  function toCanvas(img) { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c; }

  function floodRemove(canvas, tol) {
    const w = canvas.width, h = canvas.height, g = canvas.getContext('2d', { willReadFrequently: true });
    const im = g.getImageData(0, 0, w, h), d = im.data, N = w * h;
    const rs = [], gs = [], bs = [];
    const pushPx = i => { if (d[i * 4 + 3] > 10) { rs.push(d[i * 4]); gs.push(d[i * 4 + 1]); bs.push(d[i * 4 + 2]); } };
    for (let x = 0; x < w; x++) { pushPx(x); pushPx((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { pushPx(y * w); pushPx(y * w + w - 1); }
    const med = a => { if (!a.length) return 255; a.sort((p, q) => p - q); return a[a.length >> 1]; };
    const ref = [med(rs), med(gs), med(bs)];
    const dist = i => { const r = d[i * 4] - ref[0], gg = d[i * 4 + 1] - ref[1], b = d[i * 4 + 2] - ref[2]; return Math.sqrt(r * r * 0.9 + gg * gg * 1.2 + b * b * 0.9); };
    const dist2 = (i, j) => { const r = d[i * 4] - d[j * 4], gg = d[i * 4 + 1] - d[j * 4 + 1], b = d[i * 4 + 2] - d[j * 4 + 2]; return Math.sqrt(r * r + gg * gg + b * b); };
    const bg = new Uint8Array(N), q = new Int32Array(N);
    let qh = 0, qt = 0;
    const seed = i => { if (!bg[i] && (d[i * 4 + 3] <= 10 || dist(i) < tol)) { bg[i] = 1; q[qt++] = i; } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    const lt = Math.max(8, tol * 0.6);
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i - x) / w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j < 0 || bg[j]) continue;
        if (d[j * 4 + 3] <= 10 || (dist(j) < tol * 1.4 && dist2(i, j) < lt)) { bg[j] = 1; q[qt++] = j; }
      }
    }
    softenAlpha(d, w, h, bg);
    g.putImageData(im, 0, 0);
    return canvas;
  }
  // אלפא לפי מסכת רקע + ריכוך קצוות בפיקסל אחד
  function softenAlpha(d, w, h, bg) {
    const N = w * h, a = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = bg[i] ? 0 : d[i * 4 + 3] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (a[i] === 0) { d[i * 4 + 3] = 0; continue; }
      let s = 0, c = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { s += a[yy * w + xx]; c++; }
      d[i * 4 + 3] = Math.round(Math.min(a[i], s / c * 1.15) * 255);
    }
  }
  function trimmed(canvas, margin) {
    const w = canvas.width, h = canvas.height, d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    let x1 = w, y1 = h, x2 = -1, y2 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 40 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245 || d[i + 3] < 250)) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    }
    if (x2 < 0) return canvas;
    const m = margin ? Math.round(Math.max(x2 - x1, y2 - y1) * 0.02) : 0;
    x1 = Math.max(0, x1 - m); y1 = Math.max(0, y1 - m); x2 = Math.min(w - 1, x2 + m); y2 = Math.min(h - 1, y2 + m);
    const out = document.createElement('canvas'); out.width = x2 - x1 + 1; out.height = y2 - y1 + 1;
    out.getContext('2d').drawImage(canvas, x1, y1, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }
  function flattenOnWhite(canvas) {
    const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
    const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height); g.drawImage(canvas, 0, 0);
    return out.toDataURL('image/jpeg', 0.95);
  }
  let aiModule = null;
  async function loadAI() {
    if (aiModule) return aiModule;
    let err;
    for (const u of AI_BG_URLS) { try { aiModule = await import(u); return aiModule; } catch (e) { err = e; } }
    throw err;
  }

  // הסרת רקע ב-AI: מחזיר קנבס באותו גודל כמו המקור, עם שקיפות
  async function aiCutout(src) {
    if (IN_VIEWER) throw new Error('בגרסת הקישור אין גישה לשרת המודל. הסרת רקע AI עובדת כשפותחים את index.html מהמחשב. כאן השתמשו ב"הסר רקע" או ב"עריכה ידנית".');
    showBusy('טוען מודל AI (בפעם הראשונה עד דקה)…');
    const mod = await loadAI();
    const fn = mod.removeBackground || mod.default?.removeBackground || mod.default;
    const blob = await new Promise(res => src.toBlob(res, 'image/png'));
    const progress = (k, c, t) => { if (t) setBusy(`מוריד מודל AI… ${Math.round(c / t * 100)}%`); };
    let out;
    try { out = await fn(blob, { model: 'isnet', output: { format: 'image/png' }, progress }); }   // המודל המדויק ביותר
    catch (e) { console.warn('isnet failed, falling back', e); out = await fn(blob, { output: { format: 'image/png' }, progress }); }
    setBusy('מסיר רקע…');
    const u = URL.createObjectURL(out);
    try {
      const img = await loadImg(u);
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(img, 0, 0, src.width, src.height);
      return c;
    } finally { URL.revokeObjectURL(u); }
  }

  // ניקוי קצוות לצריבה נקייה על לבן:
  // קשיחות – מחדד את מעבר השקיפות; כיווץ – מוריד את הפס הדק של הרקע הישן סביב המוצר;
  // כתמים – מוחק שאריות קטנות מנותקות; ובסוף צבעי הקצה נלקחים מתוך המוצר (בלי "הילה" אפורה)
  function refineCutout(cut, src, { hard = 60, shrink = 1, specks = true } = {}) {
    const w = cut.width, h = cut.height, N = w * h;
    const cg = cut.getContext('2d', { willReadFrequently: true });
    const im = cg.getImageData(0, 0, w, h), d = im.data;
    const sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    let a = new Float32Array(N);
    const bw = 1 - (hard / 100) * 0.9, lo = 0.5 - bw / 2, hi = 0.5 + bw / 2;
    for (let i = 0; i < N; i++) { const v = d[i * 4 + 3] / 255; a[i] = v <= lo ? 0 : v >= hi ? 1 : (v - lo) / (hi - lo); }
    if (specks) {
      const lab = new Int32Array(N), q = new Int32Array(N), sizes = [0];
      let n = 0;
      for (let i = 0; i < N; i++) {
        if (a[i] < 0.5 || lab[i]) continue;
        n++; let qh = 0, qt = 0; q[qt++] = i; lab[i] = n; let cnt = 0;
        while (qh < qt) {
          const j = q[qh++], x = j % w, y = (j - x) / w; cnt++;
          if (x > 0 && !lab[j - 1] && a[j - 1] >= 0.5) { lab[j - 1] = n; q[qt++] = j - 1; }
          if (x < w - 1 && !lab[j + 1] && a[j + 1] >= 0.5) { lab[j + 1] = n; q[qt++] = j + 1; }
          if (y > 0 && !lab[j - w] && a[j - w] >= 0.5) { lab[j - w] = n; q[qt++] = j - w; }
          if (y < h - 1 && !lab[j + w] && a[j + w] >= 0.5) { lab[j + w] = n; q[qt++] = j + w; }
        }
        sizes.push(cnt);
      }
      const biggest = Math.max(0, ...sizes.slice(1));
      const minSize = Math.max(30, biggest * 0.015);
      // כתם קטן ומנותק נמחק, כולל השוליים הרכים שסביבו
      const kill = new Uint8Array(n + 1);
      for (let k = 1; k <= n; k++) if (sizes[k] < minSize) kill[k] = 1;
      for (let i = 0; i < N; i++) if (lab[i] && kill[lab[i]]) a[i] = 0;
    }
    for (let s = 0; s < shrink; s++) {
      const b2 = new Float32Array(a);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (a[i] === 0) continue;
        if ((x > 0 && a[i - 1] === 0) || (x < w - 1 && a[i + 1] === 0) || (y > 0 && a[i - w] === 0) || (y < h - 1 && a[i + w] === 0)) b2[i] = a[i] * 0.35;
      }
      a = b2;
    }
    // צבע: מהמקור; בפיקסלי קצה – ממוצע של פיקסלים אטומים סמוכים
    const R = 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      let r = sd[o], g = sd[o + 1], b = sd[o + 2];
      if (a[i] > 0 && a[i] < 0.98) {
        let sr = 0, sg = 0, sb = 0, c = 0;
        for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++)
          for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) {
            const j = yy * w + xx; if (a[j] >= 0.98) { sr += sd[j * 4]; sg += sd[j * 4 + 1]; sb += sd[j * 4 + 2]; c++; }
          }
        if (c) { r = sr / c; g = sg / c; b = sb / c; }
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = Math.round(a[i] * 255);
    }
    cg.putImageData(im, 0, 0);
    return cut;
  }

  // ---------- חלונות ----------
  function openModal(html, { wide = false, onClose } = {}) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    $('#modalHost').appendChild(back);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    return { el: back.firstElementChild, close };
  }

  // ---------- תצוגה מקדימה של כל העמודים ----------
  $('#btnPreview').onclick = () => {
    const m = openModal(`<div class="modal-head"><h2>תצוגה מקדימה – ${state.pages.length} עמודים</h2>
        <button data-pv="fit">רוחב מסך</button><button data-pv="small">מוקטן</button>
        <button class="primary" data-pv="pdf">ייצוא PDF</button><button class="close-x" data-close aria-label="סגור">✕</button></div>
      <div class="pv-body" id="pvBody"></div>`, { wide: true });
    const body = $('#pvBody', m.el);
    let mode = 'fit';
    const draw = () => {
      const avail = body.clientWidth - 48;
      const z = mode === 'fit' ? clamp(avail / PAGE_W, 0.3, 1.4) : 0.42;
      body.style.flexDirection = mode === 'fit' ? 'column' : 'row';
      body.style.flexWrap = 'wrap'; body.style.justifyContent = 'center';
      body.replaceChildren(...state.pages.map((pg, i) => {
        const wrap = document.createElement('div'); wrap.className = 'pv-page';
        const fr = document.createElement('div'); fr.className = 'pv-frame';
        fr.style.width = PAGE_W * z + 'px'; fr.style.height = PAGE_H * z + 'px';
        const el = buildPage(pg, i, false); el.style.transform = `scale(${z})`;
        fr.appendChild(el);
        const lb = document.createElement('div'); lb.className = 'pv-label';
        lb.textContent = `עמוד ${(+state.settings.firstPage || 1) + i}` + (pg.category ? ' · ' + pg.category : '');
        fr.style.cursor = 'pointer'; fr.title = 'לחצו לעריכת העמוד';
        fr.onclick = () => { m.close(); goPage(i); };
        wrap.append(fr, lb); return wrap;
      }));
    };
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-pv]'); if (!b) return;
      if (b.dataset.pv === 'pdf') { m.close(); openExportDialog('pdf'); return; }
      mode = b.dataset.pv; draw();
    });
    requestAnimationFrame(draw);
  };

  // ---------- עורך תמונה ידני ----------
  async function openEditor(key, preset) {
    const r = imgRef(key);
    const id = r.obj[r.k]; if (!id || !assets[id]) return;
    showBusy('פותח עורך…');
    let srcs;
    try { srcs = preset || await editorSources(r); } finally { hideBusy(); }
    const { src, work, srcId } = srcs;
    const W = src.width, H = src.height;

    const m = openModal(`<div class="modal-head"><h2>עריכת תמונה – מחיקת רקע ידנית</h2>
        <button class="close-x" data-close aria-label="סגור">✕</button></div>
      <div class="ed-wrap">
        <div class="ed-tools">
          ${preset && preset.note ? `<div class="warn">${esc(preset.note)}</div>` : ''}
          <div class="f"><label>כלי</label><div class="tool-btns">
            <button data-tool="erase" class="on">🧽 מחק</button><button data-tool="restore">🖌 שחזר</button>
            <button data-tool="wand">🪄 מטה קסם</button><button data-tool="pan">✋ הזזה</button></div></div>
          <div class="f"><label for="edSize">גודל מברשת: <span id="edSizeOut">40</span></label><input type="range" id="edSize" min="4" max="200" value="40"></div>
          <div class="f"><label for="edTol">רגישות מטה קסם / אוטומטי: <span id="edTolOut">${tolerance}</span></label><input type="range" id="edTol" min="4" max="120" value="${tolerance}"></div>
          <div class="hint"><b>מחק</b> – מעבירים על אזורי הרקע. <b>שחזר</b> – מחזיר חלקים של המוצר שנמחקו. <b>מטה קסם</b> – לחיצה על צבע הרקע מוחקת את כל האזור הדומה הרציף.</div>
          <div class="tool-btns"><button data-ed="ai">✨ הסרת רקע AI</button><button data-ed="auto">⚡ הסרה מהירה</button>
            <button data-ed="undo">↶ בטל</button><button data-ed="reset">↺ התחל מחדש</button>
            <button data-ed="zin">🔍＋</button><button data-ed="zout">🔍−</button><button data-ed="fit">התאם</button></div>
          <div class="box"><h3>ניקוי קצוות</h3>
            <div class="f"><label for="edHard">חדות הקצה: <span id="edHardOut">${AI_REFINE.hard}</span></label><input type="range" id="edHard" min="0" max="100" value="${AI_REFINE.hard}"></div>
            <div class="f"><label for="edShrink">כיווץ קצה (פיקסלים): <span id="edShrinkOut">${AI_REFINE.shrink}</span></label><input type="range" id="edShrink" min="0" max="4" value="${AI_REFINE.shrink}"></div>
            <label class="check"><input type="checkbox" id="edSpecks" checked> מחק כתמים קטנים מנותקים</label>
            <button data-ed="refine">✨ נקה קצוות</button>
            <div class="hint">מסיר את הפס האפור סביב המוצר ונותן צריבה נקייה על לבן.</div></div>
          <label class="check"><input type="checkbox" id="edWhite"> הצג על רקע לבן (כמו בדף)</label>
        </div>
        <div class="ed-stage" id="edStage"><div class="ed-canvas-box" id="edBox"><canvas id="edCanvas"></canvas><div class="ed-cursor" id="edCursor" hidden></div></div></div>
      </div>
      <div class="modal-foot"><button class="primary" data-ed="save">💾 שמור ${r.logo ? '(רקע שקוף)' : '(צריבה על רקע לבן)'}</button><button data-close>ביטול</button></div>`, { wide: true });

    const el = m.el, stage = $('#edStage', el), boxEl = $('#edBox', el), cv = $('#edCanvas', el), cursor = $('#edCursor', el);
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(work, 0, 0);
    let tool = 'erase', size = 40, tol = tolerance, disp = 1;
    const refineOpts = Object.assign({}, AI_REFINE);
    const undo = [];
    const pushUndo = () => { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 25) undo.shift(); };
    const fit = () => { disp = Math.min((stage.clientWidth - 40) / W, (stage.clientHeight - 40) / H, 4); setDisp(disp); };
    const setDisp = z => { disp = clamp(z, 0.05, 8); boxEl.style.width = W * disp + 'px'; boxEl.style.height = H * disp + 'px'; updCursor(); };
    requestAnimationFrame(fit);

    const toImg = e => { const rc = cv.getBoundingClientRect(); return { x: (e.clientX - rc.left) * W / rc.width, y: (e.clientY - rc.top) * H / rc.height }; };
    const updCursor = () => { if (tool === 'wand' || tool === 'pan') return; cursor.style.width = cursor.style.height = size + 'px'; };
    const radius = () => size / 2 / disp;
    function dab(x, y) {
      const rr = radius();
      if (tool === 'erase') {
        g.save(); g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); g.restore();
      } else if (tool === 'restore') {
        g.save(); g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.clip();
        g.clearRect(x - rr - 1, y - rr - 1, rr * 2 + 2, rr * 2 + 2); g.drawImage(src, 0, 0); g.restore();
      }
    }
    function stroke(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), step = Math.max(1, radius() / 3);
      for (let t = step; t <= dist; t += step) dab(a.x + dx * t / dist, a.y + dy * t / dist);
      dab(b.x, b.y);
    }
    function wand(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const im = g.getImageData(0, 0, W, H), d = im.data, N = W * H;
      const s0 = (y * W + x) * 4;
      if (d[s0 + 3] < 10) return;
      const ref = [d[s0], d[s0 + 1], d[s0 + 2]];
      const near = i => { const r2 = d[i * 4] - ref[0], g2 = d[i * 4 + 1] - ref[1], b2 = d[i * 4 + 2] - ref[2]; return Math.sqrt(r2 * r2 + g2 * g2 + b2 * b2) < tol * 1.2; };
      const bg = new Uint8Array(N), q = new Int32Array(N);
      let qh = 0, qt = 0; const st = y * W + x; bg[st] = 1; q[qt++] = st;
      while (qh < qt) {
        const i = q[qh++], xx = i % W, yy = (i - xx) / W;
        const nb = [xx > 0 ? i - 1 : -1, xx < W - 1 ? i + 1 : -1, yy > 0 ? i - W : -1, yy < H - 1 ? i + W : -1];
        for (const j of nb) if (j >= 0 && !bg[j] && d[j * 4 + 3] > 10 && near(j)) { bg[j] = 1; q[qt++] = j; }
      }
      for (let i = 0; i < N; i++) if (d[i * 4 + 3] <= 10) bg[i] = 1;
      softenAlpha(d, W, H, bg);
      g.putImageData(im, 0, 0);
    }

    let drawing = false, last = null, panStart = null;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      if (tool === 'pan') { panStart = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop }; return; }
      pushUndo();
      const p = toImg(e);
      if (tool === 'wand') { wand(p.x, p.y); return; }
      drawing = true; last = p; dab(p.x, p.y);
    });
    cv.addEventListener('pointermove', e => {
      const rc = boxEl.getBoundingClientRect();
      cursor.hidden = false;
      cursor.className = 'ed-cursor' + (tool === 'wand' ? ' wand' : '');
      cursor.style.display = tool === 'pan' ? 'none' : '';
      cursor.style.left = (e.clientX - rc.left) + 'px'; cursor.style.top = (e.clientY - rc.top) + 'px';
      if (panStart) { stage.scrollLeft = panStart.sl - (e.clientX - panStart.x); stage.scrollTop = panStart.st - (e.clientY - panStart.y); return; }
      if (!drawing) return;
      const p = toImg(e); stroke(last, p); last = p;
    });
    const end = () => { drawing = false; last = null; panStart = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { cursor.hidden = true; });
    cv.style.cursor = 'none';
    stage.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setDisp(disp * (e.deltaY < 0 ? 1.15 : 0.87)); } }, { passive: false });

    el.addEventListener('input', e => {
      if (e.target.id === 'edSize') { size = +e.target.value; $('#edSizeOut', el).textContent = size; updCursor(); }
      if (e.target.id === 'edTol') { tol = +e.target.value; $('#edTolOut', el).textContent = tol; }
      if (e.target.id === 'edWhite') stage.style.backgroundImage = e.target.checked ? 'none' : '';
      if (e.target.id === 'edHard') { refineOpts.hard = +e.target.value; $('#edHardOut', el).textContent = e.target.value; }
      if (e.target.id === 'edShrink') { refineOpts.shrink = +e.target.value; $('#edShrinkOut', el).textContent = e.target.value; }
      if (e.target.id === 'edSpecks') refineOpts.specks = e.target.checked;
    });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-tool]');
      if (t) {
        tool = t.dataset.tool; $$('[data-tool]', el).forEach(b => b.classList.toggle('on', b === t));
        cv.style.cursor = tool === 'pan' ? 'grab' : 'none'; updCursor(); return;
      }
      const b = e.target.closest('[data-ed]'); if (!b) return;
      const a = b.dataset.ed;
      if (a === 'undo') { const u = undo.pop(); if (u) g.putImageData(u, 0, 0); }
      if (a === 'reset') { pushUndo(); g.clearRect(0, 0, W, H); g.drawImage(src, 0, 0); }
      if (a === 'auto') { pushUndo(); g.clearRect(0, 0, W, H); g.drawImage(src, 0, 0); floodRemove(cv, tol); refineCutout(cv, src, { hard: 50, shrink: 0, specks: true }); }
      if (a === 'refine') {
        pushUndo(); showBusy('מנקה קצוות…');
        setTimeout(() => { try { refineCutout(cv, src, refineOpts); } finally { hideBusy(); } }, 20);
      }
      if (a === 'ai') {
        (async () => {
          try {
            const cut = await aiCutout(src);
            setBusy('מנקה קצוות…'); await new Promise(z => setTimeout(z, 20));
            refineCutout(cut, src, refineOpts);
            pushUndo(); g.clearRect(0, 0, W, H); g.drawImage(cut, 0, 0);
          } catch (err) { console.error(err); toast('הסרת רקע AI נכשלה: ' + (err && err.message || err), 'bad'); }
          finally { hideBusy(); }
        })();
      }
      if (a === 'zin') setDisp(disp * 1.25);
      if (a === 'zout') setDisp(disp / 1.25);
      if (a === 'fit') fit();
      if (a === 'save') { commitCutout(r, cv, srcId); m.close(); toast(r.logo ? 'התמונה נשמרה עם רקע שקוף' : 'התמונה נשמרה על רקע לבן', 'ok'); }
    });
  }

  // ---------- עמודים ----------
  function goPage(i) { cur = clamp(i, 0, state.pages.length - 1); renderForm(); renderPreview(); scheduleSave(); }
  $('#prevPage').onclick = () => goPage(cur - 1);
  $('#nextPage').onclick = () => goPage(cur + 1);
  $('#addPage').onclick = () => {
    const p = page(), np = newPage(p); ensureSlots(np);
    state.pages.splice(cur + 1, 0, np);
    goPage(cur + 1); toast('נוסף עמוד חדש (עם אותו לוגו, כותרת ופריסה)');
  };
  $('#dupPage').onclick = () => { state.pages.splice(cur + 1, 0, JSON.parse(JSON.stringify(page()))); goPage(cur + 1); toast('העמוד שוכפל'); };
  let delArmed = 0;
  $('#delPage').onclick = () => {
    if (state.pages.length < 2) return;
    if (Date.now() - delArmed > 3000) { delArmed = Date.now(); toast('לחצו שוב על "מחק" כדי לאשר מחיקת העמוד'); return; }
    delArmed = 0; state.pages.splice(cur, 1); goPage(Math.min(cur, state.pages.length - 1)); toast('העמוד נמחק');
  };

  // ---------- ייצוא לדפוס: PDF / JPG ----------
  const EXPORT_PRESETS = {
    print: { label: 'בית דפוס: 300dpi, גלישה 3 מ"מ וסימני חיתוך (מומלץ)', dpi: 300, bleed: 3, marks: true },
    printExact: { label: 'דפוס בלי גלישה: 300dpi, A4 מדויק', dpi: 300, bleed: 0, marks: false },
    hq: { label: 'איכות גבוהה במיוחד: 600dpi, A4 מדויק', dpi: 600, bleed: 0, marks: false },
    screen: { label: 'מסך או מייל: 150dpi, קובץ קטן', dpi: 150, bleed: 0, marks: false },
  };
  let exportOpts = { preset: 'print', dpi: 300, bleed: 3, marks: true, pdfQuality: 'jpeg', pdfMode: 'vector', color: 'cmyk', jpgCmyk: false };
  try { Object.assign(exportOpts, JSON.parse(localStorage.getItem('catalog-export') || '{}')); } catch (e) { /* ללא אחסון */ }
  const saveExportOpts = () => { try { localStorage.setItem('catalog-export', JSON.stringify(exportOpts)); } catch (e) { /* ללא אחסון */ } };
  const MM = 96 / 25.4;   // פיקסלים במילימטר (ב-96dpi)

  // מרנדר עמוד לקנבס ברזולוציה ובגלישה המבוקשות
  async function renderCanvas(index, opts = exportOpts) {
    const dpi = +opts.dpi || 300, bleedMM = +opts.bleed || 0, B = bleedMM * MM;
    const hostEl = $('#exportHost');
    const el = buildPage(state.pages[index], index, false, B);
    hostEl.replaceChildren(el);
    await document.fonts.ready;
    await Promise.all($$('img', el).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
    const W = PAGE_W + 2 * B, H = PAGE_H + 2 * B;
    try {
      const c = await window.html2canvas(el, {
        scale: dpi / 96, width: W, height: H, backgroundColor: state.settings.pageBg, logging: false, useCORS: true,
        onclone: (cd, cel) => {
          // html2canvas מאבד רווחים בעברית; ריווח אותיות זעיר גורם לציור אות-אות במקום המדויק
          const win = cd.defaultView;
          (cel || cd.body).querySelectorAll('*').forEach(n => {
            if (n.children.length === 0 && n.textContent.trim() && !parseFloat(win.getComputedStyle(n).letterSpacing)) n.style.letterSpacing = '0.01px';
          });
        },
      });
      const out = document.createElement('canvas');
      out.width = Math.round((210 + 2 * bleedMM) / 25.4 * dpi);
      out.height = Math.round((297 + 2 * bleedMM) / 25.4 * dpi);
      const g = out.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.fillStyle = state.settings.pageBg; g.fillRect(0, 0, out.width, out.height);
      g.drawImage(c, 0, 0, out.width, out.height);
      c.width = c.height = 0;
      return out;
    } finally { hostEl.replaceChildren(); }
  }
  function setJpegDpi(bytes, dpi) {
    if (bytes[2] === 0xFF && bytes[3] === 0xE0 && bytes[6] === 0x4A && bytes[7] === 0x46) {
      bytes[13] = 1; bytes[14] = dpi >> 8; bytes[15] = dpi & 255; bytes[16] = dpi >> 8; bytes[17] = dpi & 255; return bytes;
    }
    const app0 = new Uint8Array([0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0]);
    const out = new Uint8Array(bytes.length + 18); out.set(bytes.subarray(0, 2), 0); out.set(app0, 2); out.set(bytes.subarray(2), 20); return out;
  }
  const safeName = s => String(s || '').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const fileBase = () => safeName('קטלוג ' + [state.pages[0].brand, state.pages[0].category].filter(Boolean).join(' ')).slice(0, 60) || 'catalog';
  let downloadsCap;
  async function download(blob, name) {
    if (IN_VIEWER) {
      if (downloadsCap === undefined) { try { downloadsCap = await window.claude.use('downloads'); } catch (e) { downloadsCap = null; } }
      if (downloadsCap) {
        try { await downloadsCap.save({ filename: name, data: blob }); toast('הקובץ נשמר: ' + name, 'ok'); }
        catch (err) {
          if (err && err.code === 'declined') toast('השמירה בוטלה');
          else if (err && err.code === 'rate_limited') toast('חלון שמירה כבר פתוח – נסו שוב בעוד רגע');
          else toast('לא ניתן לשמור קובץ כאן: ' + (err && (err.message || err.code) || err), 'bad');
        }
        return;
      }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  // רזולוציה בקובץ JPG בצבעי CMYK – בלוק Photoshop (APP13), כמו בקבצים מתוכנות עריכה
  function withPhotoshopDpi(bytes, dpi) {
    const res = [0x38, 0x42, 0x49, 0x4D, 0x03, 0xED, 0, 0, 0, 0, 0, 16,
      (dpi >> 8) & 255, dpi & 255, 0, 0, 0, 1, 0, 1, (dpi >> 8) & 255, dpi & 255, 0, 0, 0, 1, 0, 1];
    const head = [...'Photoshop 3.0'].map(c => c.charCodeAt(0)).concat([0]);
    const payload = head.concat(res), len = payload.length + 2;
    const seg = new Uint8Array([0xFF, 0xED, len >> 8, len & 255, ...payload]);
    const out = new Uint8Array(bytes.length + seg.length);
    out.set(bytes.subarray(0, 2), 0); out.set(seg, 2); out.set(bytes.subarray(2), 2 + seg.length);
    return out;
  }
  const optsTag = o => `${o.dpi}dpi` + (+o.bleed ? ` גלישה ${o.bleed}mm` : '');
  async function jpgBlob(index, o) {
    const c = await renderCanvas(index, o);
    if (o.jpgCmyk) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, out = new Uint8Array(c.width * c.height * 4);
      for (let i = 0; i < d.length; i += 4) {
        const v = rgbToCmyk(d[i], d[i + 1], d[i + 2]);
        out[i] = 255 - Math.round(v[0] * 255); out[i + 1] = 255 - Math.round(v[1] * 255); out[i + 2] = 255 - Math.round(v[2] * 255); out[i + 3] = 255 - Math.round(v[3] * 255);
      }
      const jpg = window.encodeCMYKJpeg(out, c.width, c.height, 97);
      c.width = c.height = 0;
      return new Blob([withPhotoshopDpi(jpg, +o.dpi)], { type: 'image/jpeg' });
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 1.0));
    c.width = c.height = 0;
    return new Blob([setJpegDpi(new Uint8Array(await blob.arrayBuffer()), +o.dpi)], { type: 'image/jpeg' });
  }
  async function exportJPG(o = exportOpts) {
    showBusy(`מייצא JPG ‏(${o.dpi}dpi)…`);
    try {
      const blob = await jpgBlob(cur, o);
      hideBusy();
      await download(blob, `${fileBase()} - עמוד ${(+state.settings.firstPage || 1) + cur} (${optsTag(o)}).jpg`);
    } catch (e) { console.error(e); toast('הייצוא נכשל: ' + e.message, 'bad'); } finally { hideBusy(); }
  }
  async function exportAllJPG(o = exportOpts) {
    showBusy('מייצא את כל העמודים כ-JPG…');
    try {
      const zip = new JSZip();
      for (let i = 0; i < state.pages.length; i++) {
        setBusy(`מייצא JPG ‏(${o.dpi}dpi)… עמוד ${i + 1} מתוך ${state.pages.length}`);
        zip.file(`page-${String((+state.settings.firstPage || 1) + i).padStart(3, '0')}.jpg`, await jpgBlob(i, o));
      }
      setBusy('אורז קובץ ZIP…');
      const blob = await zip.generateAsync({ type: 'blob' });
      hideBusy();
      await download(blob, `${fileBase()} - JPG (${optsTag(o)}).zip`);
    } catch (e) { console.error(e); toast('הייצוא נכשל: ' + e.message, 'bad'); } finally { hideBusy(); }
  }
  async function exportPDF(o = exportOpts) {
    if (o.pdfMode !== 'raster') return exportVectorPDF(o);
    showBusy(`מייצא PDF ‏(${o.dpi}dpi)…`);
    try {
      const { jsPDF } = window.jspdf;
      const b = +o.bleed || 0, slug = o.marks ? 10 : 0;          // שוליים לסימני חיתוך מחוץ לגלישה
      const pw = 210 + 2 * (b + slug), ph = 297 + 2 * (b + slug);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pw, ph], compress: true });
      for (let i = 0; i < state.pages.length; i++) {
        setBusy(`מייצא PDF ‏(${o.dpi}dpi)… עמוד ${i + 1} מתוך ${state.pages.length}`);
        const c = await renderCanvas(i, o);
        if (i > 0) pdf.addPage([pw, ph], 'portrait');
        if (o.pdfQuality === 'png') pdf.addImage(c, 'PNG', slug, slug, 210 + 2 * b, 297 + 2 * b, undefined, 'FAST');
        else pdf.addImage(c.toDataURL('image/jpeg', 1.0), 'JPEG', slug, slug, 210 + 2 * b, 297 + 2 * b, undefined, 'NONE');
        c.width = c.height = 0;
        setPageBoxes(pdf, slug, b);
        if (o.marks) drawCropMarks(pdf, slug + b, slug + b, 210, 297, b);
        await new Promise(z => setTimeout(z, 0));
      }
      pdf.setProperties({ title: fileBase(), subject: `A4 ${optsTag(o)}`, creator: 'מחולל דפי קטלוג' });
      hideBusy();
      await download(pdf.output('blob'), `${fileBase()} (${optsTag(o)}).pdf`);
    } catch (e) { console.error(e); toast('הייצוא נכשל: ' + e.message, 'bad'); } finally { hideBusy(); }
  }
  // TrimBox / BleedBox – כמו בתוכנות עימוד, כדי שתוכנת בית הדפוס תזהה את קו החיתוך
  function setPageBoxes(pdf, slug, bleed) {
    const pt = mm => mm * 72 / 25.4;
    const ctx = pdf.internal.getCurrentPageInfo().pageContext;
    ctx.trimBox = { bottomLeftX: pt(slug + bleed), bottomLeftY: pt(slug + bleed), topRightX: pt(slug + bleed + 210), topRightY: pt(slug + bleed + 297) };
    ctx.bleedBox = { bottomLeftX: pt(slug), bottomLeftY: pt(slug), topRightX: pt(slug + 2 * bleed + 210), topRightY: pt(slug + 2 * bleed + 297) };
  }

  // ---------- PDF וקטורי מקצועי: CMYK, טקסט וקטורי וגופנים מוטמעים ----------
  // הדף נבנה ב-DOM, ומכל רכיב נלקחים המיקום והסגנון המדויקים ומצוירים כאובייקטים וקטוריים ב-PDF
  const PX = 25.4 / 96;   // מ"מ לפיקסל
  function parseRGBA(str) {
    const m = /rgba?\(([^)]+)\)/.exec(str || ''); if (!m) return null;
    const v = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  }
  const hex2 = n => Math.round(n).toString(16).padStart(2, '0');
  const rgbHex = c => '#' + hex2(c.r) + hex2(c.g) + hex2(c.b);
  function parseCMYK(str) {
    const v = String(str || '').split(/[ ,/]+/).filter(Boolean).map(parseFloat);
    return v.length === 4 && v.every(n => !isNaN(n)) ? v.map(n => clamp(n, 0, 100) / 100) : null;
  }
  // המרת RGB ל-CMYK: אפור ושחור – רק בדיו שחור (K), כמו בעבודה מקצועית; צבע – הפרדה עם GCR מלא
  function rgbToCmyk(r, g, b) {
    if (Math.abs(r - g) <= 4 && Math.abs(g - b) <= 4 && Math.abs(r - b) <= 4) return [0, 0, 0, 1 - (r + g + b) / 765];
    let c = 1 - r / 255, m = 1 - g / 255, y = 1 - b / 255;
    const k = Math.min(c, m, y);
    if (k >= 1) return [0, 0, 0, 1];
    return [(c - k) / (1 - k), (m - k) / (1 - k), (y - k) / (1 - k), k];
  }
  function cmykOverrides() {
    const s = state.settings, map = new Map();
    [['accent', 'cmykAccent'], ['titleColor', 'cmykTitle'], ['panel', 'cmykPanel'], ['grayFrom', 'cmykGrayFrom'], ['grayTo', 'cmykGrayTo'], ['textColor', 'cmykText']]
      .forEach(([k, ck]) => { const v = parseCMYK(s[ck]); if (v && s[k]) map.set(s[k].toLowerCase(), v); });
    return map;
  }
  function makeColorFn(mode) {
    const over = cmykOverrides();
    return c => {
      if (mode === 'rgb') return [c.r, c.g, c.b];
      return (over.get(rgbHex(c)) || rgbToCmyk(c.r, c.g, c.b)).map(v => Math.round(v * 10000) / 10000);
    };
  }
  const applyFill = (pdf, col) => col.length === 4 ? pdf.setFillColor(...col) : pdf.setFillColor(...col);
  const applyText = (pdf, col) => col.length === 4 ? pdf.setTextColor(...col) : pdf.setTextColor(...col);

  // תמונה → JPEG ב-CMYK (או RGB), בצפיפות של עד dpi נקודות לאינץ' בגודל ההדפסה
  async function imageForPdf(src, wMM, hMM, dpi, mode, bg) {
    const img = await loadImg(src);
    const tw = Math.max(1, Math.min(img.naturalWidth, Math.round(wMM / 25.4 * dpi)));
    const th = Math.max(1, Math.min(img.naturalHeight, Math.round(hMM / 25.4 * dpi)));
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.fillStyle = bg ? `rgb(${bg.r},${bg.g},${bg.b})` : '#fff'; g.fillRect(0, 0, tw, th);
    g.drawImage(img, 0, 0, tw, th);
    if (mode === 'rgb') return { data: c.toDataURL('image/jpeg', 0.97), fmt: 'JPEG' };
    const d = g.getImageData(0, 0, tw, th).data, out = new Uint8Array(tw * th * 4);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 4) {
      const [cc, m, y, k] = rgbToCmyk(d[i], d[i + 1], d[i + 2]);
      out[j] = 255 - Math.round(cc * 255); out[j + 1] = 255 - Math.round(m * 255); out[j + 2] = 255 - Math.round(y * 255); out[j + 3] = 255 - Math.round(k * 255);
    }
    return { data: window.encodeCMYKJpeg(out, tw, th, 95), fmt: 'JPEG' };
  }

  const fontsUsed = new Set();
  function pdfFontFor(pdf, family, weight) {
    const F = window.PDF_FONTS || {};
    let fam = String(family || '').split(',')[0].replace(/["']/g, '').trim();
    if (!F[fam]) fam = /arial|helvetica|sans/i.test(fam) ? 'Arimo' : 'Heebo';
    const ws = Object.keys(F[fam]).map(Number);
    const w = ws.reduce((best, x) => Math.abs(x - weight) < Math.abs(best - weight) ? x : best, ws[0]);
    const name = `${fam.replace(/\s+/g, '')}-${w}`;
    if (!pdf.__fonts) pdf.__fonts = new Set();
    if (!pdf.__fonts.has(name)) {
      pdf.addFileToVFS(name + '.ttf', F[fam][w]);
      pdf.addFont(name + '.ttf', name, 'normal');
      pdf.__fonts.add(name);
    }
    return name;
  }

  // מרחק קו הבסיס מראש תיבת הטקסט, לפי הגופן כפי שהדפדפן מצייר אותו
  const baselineCache = new Map();
  function baselineOffset(cs, host) {
    const key = cs.fontFamily + '|' + cs.fontWeight + '|' + cs.fontSize + '|' + cs.fontStyle;
    if (baselineCache.has(key)) return baselineCache.get(key);
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;line-height:normal;letter-spacing:0;font-family:${cs.fontFamily};font-weight:${cs.fontWeight};font-size:${cs.fontSize};font-style:${cs.fontStyle}`;
    const t = document.createTextNode('Hא'); probe.appendChild(t);
    const mark = document.createElement('span'); mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    probe.appendChild(mark); host.appendChild(probe);
    const r = document.createRange(); r.selectNodeContents(t);
    const off = mark.getBoundingClientRect().top - r.getBoundingClientRect().top;
    probe.remove();
    baselineCache.set(key, off);
    return off;
  }

  const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
  function drawTextNodes(pdf, pageEl, origin, colorFn) {
    const pr = pageEl.getBoundingClientRect();
    const tw = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = tw.nextNode(); node; node = tw.nextNode()) {
      const text = node.nodeValue;
      if (!text || !text.trim()) continue;
      const el = node.parentElement, cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const col = parseRGBA(cs.color); if (!col || col.a === 0) continue;
      const clipEl = el.closest('.c-title, .c-name, .c-panel, .c-row');
      const clip = clipEl ? clipEl.getBoundingClientRect() : null;
      const chars = [];
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rc = range.getClientRects()[0];
        if (!rc || rc.width === 0 && !/\S/.test(text[i])) continue;
        if (clip && (rc.left + rc.width / 2 < clip.left - 0.5 || rc.left + rc.width / 2 > clip.right + 0.5 || rc.top + rc.height / 2 > clip.bottom + 0.5 || rc.top + rc.height / 2 < clip.top - 0.5)) continue;
        chars.push({ ch: text[i], l: rc.left, r: rc.right, t: rc.top });
      }
      if (!chars.length) continue;
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
      const fontName = pdfFontFor(pdf, cs.fontFamily, weight);
      const base = baselineOffset(cs, pageEl);
      const ls = parseFloat(cs.letterSpacing) || 0;
      const rtl = cs.direction === 'rtl';
      pdf.setFont(fontName, 'normal');
      pdf.setFontSize(size * 0.75);
      applyText(pdf, colorFn(col));
      // שורות לפי גובה, ובכל שורה מילים לפי המיקום האופקי (סדר חזותי)
      const lines = [];
      chars.forEach(c => { let ln = lines.find(L => Math.abs(L.t - c.t) < size * 0.4); if (!ln) lines.push(ln = { t: c.t, cs: [] }); ln.cs.push(c); });
      lines.forEach(ln => {
        ln.cs.sort((a, b) => a.l - b.l);
        let word = [];
        const flush = () => {
          if (!word.length) return;
          const hasHeb = word.some(c => /[\u0590-\u05FF]/.test(c.ch));
          const str = word.map(c => (rtl || hasHeb) && MIRROR[c.ch] ? MIRROR[c.ch] : c.ch).join('');
          const x = (word[0].l - pr.left) * PX + origin.x;
          const y = (ln.t + base - pr.top) * PX + origin.y;
          pdf.text(str, x, y, { baseline: 'alphabetic', charSpace: ls ? ls * PX : 0 });
          word = [];
        };
        ln.cs.forEach(c => { if (/\s/.test(c.ch)) flush(); else word.push(c); });
        flush();
      });
    }
  }

  // צורות, רקעים, קווים, תמונות וברקודים – לפי סדר הציור ב-DOM
  async function drawShapes(pdf, pageEl, origin, colorFn, o, surfaces) {
    const pr = pageEl.getBoundingClientRect();
    const mm = (x, y) => [(x - pr.left) * PX + origin.x, (y - pr.top) * PX + origin.y];
    const all = [pageEl, ...pageEl.querySelectorAll('*')];
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const poly = elementPolygon(el, cs, pr);
      const clipEl = el !== pageEl ? el.parentElement.closest('.c-panel') : null;
      const withClip = fn => {
        if (!clipEl) return fn();
        const r = clipEl.getBoundingClientRect(), [x, y] = mm(r.left, r.top);
        pdf.saveGraphicsState(); pdf.rect(x, y, r.width * PX, r.height * PX, null); pdf.clip(); pdf.discardPath();
        const res = fn(); pdf.restoreGraphicsState(); return res;
      };
      // רקע
      const bgImg = cs.backgroundImage;
      if (bgImg && bgImg.startsWith('linear-gradient')) drawGradient(pdf, poly, bgImg, colorFn, mm);
      else {
        const bg = parseRGBA(cs.backgroundColor);
        if (bg && bg.a > 0.01) {
          applyFill(pdf, colorFn(bg));
          withClip(() => fillPoly(pdf, poly.map(p => mm(p[0], p[1]))));
          surfaces.push({ poly, color: bg });
        }
      }
      // קו תחתון (שורות קוד פריט / אריזה)
      const bb = parseFloat(cs.borderBottomWidth);
      if (bb > 0 && cs.borderBottomStyle !== 'none') {
        const bc = parseRGBA(cs.borderBottomColor);
        if (bc && bc.a > 0) {
          const r = el.getBoundingClientRect(), [x, y] = mm(r.left, r.bottom - bb);
          applyFill(pdf, colorFn(bc)); pdf.rect(x, y, r.width * PX, bb * PX, 'F');
        }
      }
      if (el.tagName === 'IMG' && el.getAttribute('src')) {
        const src = el.getAttribute('src');
        const r = el.getBoundingClientRect();
        if (src.startsWith('data:image/svg+xml')) { drawBarcodeSVG(pdf, src, r, mm, colorFn); continue; }
        const nat = await loadImg(src);
        const fit = cs.objectFit;
        let dw = r.width, dh = r.height, dx = r.left, dy = r.top;
        if (fit === 'contain') {
          const k = Math.min(r.width / nat.naturalWidth, r.height / nat.naturalHeight);
          dw = nat.naturalWidth * k; dh = nat.naturalHeight * k;
          const [px1, py1] = (cs.objectPosition || '50% 50%').split(' ').map(v => parseFloat(v) / 100);
          dx = r.left + (r.width - dw) * (isNaN(px1) ? 0.5 : px1); dy = r.top + (r.height - dh) * (isNaN(py1) ? 0.5 : py1);
        }
        // תמונה עם שקיפות (לוגו) מונחת על צבע הרקע שמתחתיה
        const cx = dx + dw / 2, cy = dy + dh / 2;
        const under = [...surfaces].reverse().find(sf => pointInPoly(cx, cy, sf.poly));
        const [x, y] = mm(dx, dy);
        const im = await imageForPdf(src, dw * PX, dh * PX, +o.dpi || 300, o.color, under ? under.color : { r: 255, g: 255, b: 255 });
        withClip(() => pdf.addImage(im.data, im.fmt, x, y, dw * PX, dh * PX, undefined, 'NONE'));
      }
    }
  }
  function elementPolygon(el, cs, pr) {
    // תיבה מקורית (לפני transform) ביחס לעמוד
    let L = 0, T = 0, n = el;
    const pageEl = el.closest('.cpage');
    if (el === pageEl) { const r = el.getBoundingClientRect(); return [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]]; }
    while (n && n !== pageEl) { L += n.offsetLeft; T += n.offsetTop; n = n.offsetParent; }
    const W = el.offsetWidth, H = el.offsetHeight;
    const ox = pr.left, oy = pr.top;
    const t = cs.transform;
    let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
    if (t && t !== 'none') { const m = /matrix\(([^)]+)\)/.exec(t); if (m) [a, b, c, d, e, f] = m[1].split(',').map(parseFloat); }
    const [tox, toy] = (cs.transformOrigin || '0 0').split(' ').map(parseFloat);
    const P = (x, y) => { const lx = x - tox, ly = y - toy; return [ox + L + tox + a * lx + c * ly + e, oy + T + toy + b * lx + d * ly + f]; };
    return [P(0, 0), P(W, 0), P(W, H), P(0, H)];
  }
  function fillPoly(pdf, pts) {
    const segs = []; for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    pdf.lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true);
  }
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  // מעבר צבע אופקי: פסים צרים (וקטוריים) בצבע מחושב לכל נקודה
  function drawGradient(pdf, poly, str, colorFn, mm) {
    const stops = [];
    const re = /(rgba?\([^)]+\))\s*([\d.]+)%?/g; let m;
    while ((m = re.exec(str))) stops.push({ c: parseRGBA(m[1]), p: parseFloat(m[2]) / 100 });
    if (stops.length < 2) return;
    const at = p => {
      let i = 0; while (i < stops.length - 2 && p > stops[i + 1].p) i++;
      const A = stops[i], B = stops[i + 1], t = clamp((p - A.p) / ((B.p - A.p) || 1), 0, 1);
      return { r: A.c.r + (B.c.r - A.c.r) * t, g: A.c.g + (B.c.g - A.c.g) * t, b: A.c.b + (B.c.b - A.c.b) * t, a: A.c.a + (B.c.a - A.c.a) * t };
    };
    const [p0, p1, p2, p3] = poly;   // מקבילית: עליון שמאל, עליון ימין, תחתון ימין, תחתון שמאל
    const N = 160;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = Math.min(1, (i + 1) / N + 0.002), col = at((i + 0.5) / N);
      if (col.a < 0.01) continue;
      const lerp = (P, Q, t) => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
      const q = [lerp(p0, p1, t0), lerp(p0, p1, t1), lerp(p3, p2, t1), lerp(p3, p2, t0)].map(p => mm(p[0], p[1]));
      const gs = col.a < 0.99 ? new pdf.GState({ opacity: col.a }) : null;
      if (gs) { pdf.saveGraphicsState(); pdf.setGState(gs); }
      applyFill(pdf, colorFn(col)); fillPoly(pdf, q);
      if (gs) pdf.restoreGraphicsState();
    }
  }
  // ברקוד וקטורי: הפסים כמלבנים בשחור (K בלבד) והספרות כטקסט
  function drawBarcodeSVG(pdf, src, r, mm, colorFn) {
    const xml = decodeURIComponent(src.slice(src.indexOf(',') + 1));
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    const svg = doc.documentElement;
    const [, , vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(parseFloat);
    const sx = r.width / vw, sy = r.height / vh;
    const walk = (node, tx, ty, fill) => {
      for (const ch of node.children) {
        let x = tx, y = ty;
        const tr = ch.getAttribute('transform'); const m = tr && /translate\(([^,)]+)[, ]+([^)]+)\)/.exec(tr);
        if (m) { x += parseFloat(m[1]); y += parseFloat(m[2]); }
        const f = ch.getAttribute('fill') || (ch.getAttribute('style') || '').replace(/.*fill:\s*([^;]+).*/, '$1') || fill;
        if (ch.tagName === 'rect') {
          const c = parseRGBA(cssColor(f)); if (!c) continue;
          const [px0, py0] = mm(r.left + (x + +ch.getAttribute('x')) * sx, r.top + (y + +ch.getAttribute('y')) * sy);
          applyFill(pdf, colorFn(c)); pdf.rect(px0, py0, +ch.getAttribute('width') * sx * PX, +ch.getAttribute('height') * sy * PX, 'F');
        } else if (ch.tagName === 'text') {
          const c = parseRGBA(cssColor(f)) || { r: 0, g: 0, b: 0, a: 1 };
          if (!ch.textContent.trim()) continue;
          const fs = parseFloat(ch.getAttribute('font-size')) || parseFloat((ch.getAttribute('style') || '').replace(/.*font:\s*([\d.]+)px.*/, '$1')) || 20;
          pdf.setFont(pdfFontFor(pdf, 'Arimo', 400), 'normal'); pdf.setFontSize(fs * sy * 0.75); applyText(pdf, colorFn(c));
          const anchor = ch.getAttribute('text-anchor') || 'start';
          const [tx2, ty2] = mm(r.left + (x + +ch.getAttribute('x')) * sx, r.top + (y + +ch.getAttribute('y')) * sy);
          pdf.text(ch.textContent, tx2, ty2, { align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left', baseline: 'alphabetic' });
        } else if (ch.tagName === 'g') walk(ch, x, y, f);
      }
    };
    walk(svg, 0, 0, '#000000');
  }
  const cssColorCtx = document.createElement('canvas').getContext('2d');
  function cssColor(v) { cssColorCtx.fillStyle = '#000'; cssColorCtx.fillStyle = v; const h = cssColorCtx.fillStyle; return h.startsWith('#') ? `rgb(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)})` : h; }

  async function exportVectorPDF(o = exportOpts) {
    showBusy('מכין PDF מקצועי…');
    const hostEl = $('#exportHost');
    try {
      const { jsPDF } = window.jspdf;
      const b = +o.bleed || 0, slug = o.marks ? 10 : 0, B = b * MM;
      const pw = 210 + 2 * (b + slug), ph = 297 + 2 * (b + slug);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pw, ph], compress: true, putOnlyUsedFonts: true });
      const colorFn = makeColorFn(o.color);
      await document.fonts.ready;
      for (let i = 0; i < state.pages.length; i++) {
        setBusy(`מייצא PDF מקצועי (${o.color === 'rgb' ? 'RGB' : 'CMYK'})… עמוד ${i + 1} מתוך ${state.pages.length}`);
        if (i > 0) pdf.addPage([pw, ph], 'portrait');
        const el = buildPage(state.pages[i], i, false, B);
        hostEl.replaceChildren(el);
        await Promise.all($$('img', el).map(im => im.complete ? null : new Promise(r => { im.onload = im.onerror = r; })));
        const origin = { x: slug, y: slug };
        const surfaces = [];
        await drawShapes(pdf, el, origin, colorFn, o, surfaces);
        drawTextNodes(pdf, el, origin, colorFn);
        setPageBoxes(pdf, slug, b);
        if (o.marks) drawCropMarks(pdf, slug + b, slug + b, 210, 297, b);
        await new Promise(z => setTimeout(z, 0));
      }
      pdf.setProperties({ title: fileBase(), subject: `A4 · ${o.color === 'rgb' ? 'RGB' : 'CMYK'} · ${optsTag(o)}`, creator: 'מחולל דפי קטלוג', keywords: 'print-ready' });
      hideBusy();
      await download(pdf.output('blob'), `${fileBase()} (${o.color === 'rgb' ? 'RGB' : 'CMYK'}, ${optsTag(o)}).pdf`);
    } catch (e) { console.error(e); toast('הייצוא נכשל: ' + e.message, 'bad'); }
    finally { hostEl.replaceChildren(); hideBusy(); }
  }
  // סימני חיתוך בפינות קו החיתוך, מחוץ לאזור הגלישה
  function drawCropMarks(pdf, x0, y0, w, h, bleed) {
    const x1 = x0 + w, y1 = y0 + h, gap = bleed + 1, len = 6;
    pdf.setDrawColor(1, 1, 1, 1); pdf.setLineWidth(0.1);   // צבע רישום (Registration)
    for (const x of [x0, x1]) { pdf.line(x, y0 - gap - len, x, y0 - gap); pdf.line(x, y1 + gap, x, y1 + gap + len); }
    for (const y of [y0, y1]) { pdf.line(x0 - gap - len, y, x0 - gap, y); pdf.line(x1 + gap, y, x1 + gap + len, y); }
  }

  // בדיקה לפני דפוס: רזולוציית תמונות בגודל ההדפסה וברקודים לא תקינים
  async function preflight(o) {
    const issues = [];
    let images = 0;
    const ppiOf = async (id, boxW, boxH) => {
      const im = await loadImg(assets[id]);
      const k = Math.min(boxW / im.naturalWidth, boxH / im.naturalHeight);
      return Math.round(96 / k);
    };
    for (let pi = 0; pi < state.pages.length; pi++) {
      const pg = state.pages[pi], pn = (+state.settings.firstPage || 1) + pi;
      const rects = slotRects(pg.layout);
      for (let i = 0; i < rects.length; i++) {
        const p = pg.products[i], R = rects[i], k = R.k;
        if (!p || !p.show || isEmptyProduct(p)) continue;
        if (p.ean && !normalizeEAN(p.ean).ok) issues.push(`עמוד ${pn}, מוצר ${i + 1}: ברקוד לא תקין`);
        if (p.img && assets[p.img]) {
          images++;
          const panelH = R.h - 30 * k - 4.6 * k, infoTop = panelH - 11.2 * k - 118 * k, sc = (p.imgScale || 100) / 100;
          const ppi = await ppiOf(p.img, (R.w - 40 * k) * sc, Math.max(10, infoTop - 17 * k - 15.4 * k) * sc);
          if (ppi < 200) issues.push(`עמוד ${pn}, מוצר ${i + 1} (${esc(p.title || 'ללא כותרת')}): תמונה ב-${ppi}ppi – מומלץ 300, מינימום 200`);
        }
      }
      if (pg.logo && assets[pg.logo]) {
        const sc = (pg.logoScale || 100) / 100, ppi = await ppiOf(pg.logo, L.logo.w * sc, L.logo.h * sc);
        if (ppi < 200) issues.push(`עמוד ${pn}: לוגו ב-${ppi}ppi – מומלץ קובץ לוגו גדול יותר`);
      }
    }
    if (!issues.length) return `<span class="ean-msg ok">✓ הכול תקין: ${images} תמונות ברזולוציה מספקת לדפוס, וכל הברקודים תקינים.</span>`;
    const shown = issues.slice(0, 12);
    return `<span class="ean-msg bad">נמצאו ${issues.length} הערות:</span><ul style="margin:4px 0;padding-inline-start:18px">${shown.map(t => `<li>${t}</li>`).join('')}</ul>`
      + (issues.length > shown.length ? `<div>ועוד ${issues.length - shown.length}…</div>` : '')
      + '<div>אפשר לייצא בכל זאת. תמונה ברזולוציה נמוכה עלולה להיראות מטושטשת בהדפסה.</div>';
  }
  function openExportDialog(focus = 'pdf') {
    const o = Object.assign({}, exportOpts);
    const m = openModal(`<div class="modal-head"><h2>ייצוא לדפוס</h2><button class="close-x" data-close aria-label="סגור">✕</button></div>
      <div class="modal-body">
        <div class="f"><label for="exPreset">מטרת הקובץ</label><select id="exPreset">
          ${Object.entries(EXPORT_PRESETS).map(([k, v]) => `<option value="${k}" ${k === o.preset ? 'selected' : ''}>${v.label}</option>`).join('')}
          <option value="custom" ${o.preset === 'custom' ? 'selected' : ''}>הגדרה ידנית</option></select></div>
        <div class="box"><h3>הגדרות</h3>
          <div class="f2"><div class="f"><label for="exDpi">רזולוציה</label><select id="exDpi">
            ${[150, 300, 400, 600].map(d => `<option value="${d}" ${+o.dpi === d ? 'selected' : ''}>${d}dpi${d === 300 ? ' (תקן דפוס)' : ''}</option>`).join('')}</select></div>
            <div class="f"><label for="exBleed">גלישה (מ"מ מכל צד)</label><input type="number" id="exBleed" min="0" max="10" step="0.5" value="${o.bleed}"></div></div>
          <label class="check"><input type="checkbox" id="exMarks" ${o.marks ? 'checked' : ''}> סימני חיתוך ב-PDF</label>
          <div class="f"><label for="exMode">סוג ה-PDF</label><select id="exMode">
            <option value="vector" ${o.pdfMode !== 'raster' ? 'selected' : ''}>מקצועי: טקסט וקטורי, גופנים מוטמעים, צורות וברקוד וקטוריים (מומלץ)</option>
            <option value="raster" ${o.pdfMode === 'raster' ? 'selected' : ''}>תמונה אחת לכל עמוד (RGB)</option></select></div>
          <div class="f" id="exColorRow"><label for="exColor">מרחב צבע</label><select id="exColor">
            <option value="cmyk" ${o.color !== 'rgb' ? 'selected' : ''}>CMYK לדפוס (מומלץ)</option>
            <option value="rgb" ${o.color === 'rgb' ? 'selected' : ''}>RGB</option></select></div>
          <label class="check"><input type="checkbox" id="exJpgCmyk" ${o.jpgCmyk ? 'checked' : ''}> קובצי JPG בצבעי CMYK</label>
          <div class="f" id="exQRow"><label for="exQ">דחיסת התמונה ב-PDF</label><select id="exQ">
            <option value="jpeg" ${o.pdfQuality !== 'png' ? 'selected' : ''}>JPEG באיכות 100% (מומלץ)</option>
            <option value="png" ${o.pdfQuality === 'png' ? 'selected' : ''}>ללא איבוד איכות (PNG, קובץ גדול ואיטי)</option></select></div>
          <div class="summary" id="exInfo"></div>
        </div>
        <div class="box"><h3>בדיקת קבצים לפני דפוס (Preflight)</h3><div id="exPre" class="hint">בודק…</div></div>
        <div class="hint">גלישה היא הרחבה של הרקעים שבקצה הדף (הפסים האדומים והאפורים) מעבר לקו החיתוך, כדי שלא יישאר פס לבן אחרי החיתוך. רוב בתי הדפוס מבקשים 3 מ"מ.
          ב-PDF המקצועי הטקסט נשאר טקסט (לא תמונה) עם גופנים מוטמעים, הצבעים ב-CMYK (אפור ושחור בדיו שחור בלבד), התמונות ב-CMYK בצפיפות שנבחרה, ומוגדרים TrimBox ו-BleedBox כמו בייצוא מתוכנת עימוד.</div>
      </div>
      <div class="modal-foot">
        <button class="${focus === 'pdf' ? 'primary' : ''}" data-ex="pdf">ייצוא PDF (כל ${state.pages.length} העמודים)</button>
        <button class="${focus === 'jpg' ? 'primary' : ''}" data-ex="jpg">ייצוא JPG (עמוד זה)</button>
        <button data-ex="jpgall">כל העמודים כ-JPG (ZIP)</button>
        <button data-close>ביטול</button></div>`);
    const el = m.el;
    const info = () => {
      const b = +o.bleed || 0, w = Math.round((210 + 2 * b) / 25.4 * o.dpi), h = Math.round((297 + 2 * b) / 25.4 * o.dpi);
      $('#exInfo', el).innerHTML = `גודל עמוד: <b>${210 + 2 * b}×${297 + 2 * b} מ"מ</b>${b ? ' (A4 עם גלישה)' : ' (A4)'} · תמונה: <b>${w}×${h}</b> פיקסלים ב-${o.dpi}dpi`
        + (o.marks && b ? ' · עם סימני חיתוך' : '') + (+o.dpi >= 600 ? '<br>600dpi לוקח יותר זמן ויוצר קובץ גדול.' : '');
    };
    preflight(o).then(html => { const n = $('#exPre', el); if (n) n.innerHTML = html; }).catch(() => {});
    const modeVis = () => { $('#exColorRow', el).hidden = o.pdfMode === 'raster'; $('#exQRow', el).hidden = o.pdfMode !== 'raster'; };
    modeVis();
    const sync = () => { $('#exDpi', el).value = o.dpi; $('#exBleed', el).value = o.bleed; $('#exMarks', el).checked = o.marks; info(); };
    info();
    el.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'exPreset') { o.preset = t.value; if (EXPORT_PRESETS[t.value]) Object.assign(o, EXPORT_PRESETS[t.value]); sync(); return; }
      if (t.id === 'exDpi') o.dpi = +t.value;
      if (t.id === 'exBleed') o.bleed = clamp(parseFloat(t.value) || 0, 0, 10);
      if (t.id === 'exMarks') o.marks = t.checked;
      if (t.id === 'exQ') { o.pdfQuality = t.value; return; }
      if (t.id === 'exMode') { o.pdfMode = t.value; modeVis(); return; }
      if (t.id === 'exColor') { o.color = t.value; return; }
      if (t.id === 'exJpgCmyk') { o.jpgCmyk = t.checked; return; }
      o.preset = 'custom'; $('#exPreset', el).value = 'custom'; info();
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-ex]'); if (!b) return;
      exportOpts = o; saveExportOpts(); m.close();
      if (b.dataset.ex === 'pdf') exportPDF(o);
      if (b.dataset.ex === 'jpg') exportJPG(o);
      if (b.dataset.ex === 'jpgall') exportAllJPG(o);
    });
  }
  $('#btnExportJpg').onclick = () => openExportDialog('jpg');
  $('#btnExportPdf').onclick = () => openExportDialog('pdf');

  // ---------- אקסל: עמודות ----------
  const COLS = [
    ['page', 'עמוד', ['עמוד', 'מספר עמוד', 'דף', 'page']],
    ['brand', 'מותג', ['מותג', 'brand', 'יצרן', 'ספק']],
    ['category', 'קטגוריה', ['קטגוריה', 'category', 'סדרה', 'משפחה', 'משפחת מוצר']],
    ['perPage', 'מוצרים בעמוד', ['מוצרים בעמוד', 'כמות בעמוד', 'per page', 'perpage', 'layout', 'פריסה']],
    ['pos', 'מיקום', ['מיקום', 'מיקום בעמוד', 'position', 'pos']],
    ['title', 'כותרת', ['כותרת', 'שם מוצר', 'כותרת מוצר', 'שם', 'title', 'name', 'product']],
    ['desc', 'תיאור', ['תיאור', 'תיאור קצר', 'תאור', 'description', 'desc']],
    ['code', 'קוד פריט', ['קוד פריט', 'מקט', 'מק"ט', 'מק\'\'ט', 'קוד', 'sku', 'item code', 'code', 'item', 'פריט']],
    ['pack', 'אריזה', ['אריזה', 'כמות באריזה', 'קרטון', 'pack', 'packing', 'package']],
    ['ean', 'ברקוד', ['ברקוד', 'barcode', 'ean', 'ean13', 'ean-13', 'upc']],
    ['image', 'קובץ תמונה', ['קובץ תמונה', 'תמונה', 'שם תמונה', 'image', 'picture', 'img', 'photo', 'file', 'קובץ']],
  ];
  const normH = s => String(s ?? '').toLowerCase().replace(/["'`״׳\s_\-.]/g, '');
  function mapHeaders(header) {
    const map = {}, used = new Set();
    const hs = header.map(normH);
    for (const pass of ['exact', 'contains']) {
      for (const [key, , syn] of COLS) {
        if (map[key] !== undefined) continue;
        const ns = syn.map(normH);
        const idx = hs.findIndex((h, i) => h && !used.has(i) && (pass === 'exact' ? ns.includes(h) : ns.some(s => s.length > 1 && (h.includes(s)))));
        if (idx >= 0) { map[key] = idx; used.add(idx); }
      }
    }
    return map;
  }
  function extOfDataURL(u) { const m = /^data:image\/(\w+)/.exec(u || ''); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'jpg'; }

  function collectRows() {
    const rows = [], images = [], names = new Set();
    state.pages.forEach((pg, pi) => {
      const N = slotsOf(pg);
      pg.products.slice(0, N).forEach((p, i) => {
        if (isEmptyProduct(p)) return;
        let fname = '';
        if (p.img && assets[p.img]) {
          const ext = extOfDataURL(assets[p.img]);
          let base = safeName((p.imgName || '').replace(/\.[a-z0-9]+$/i, '')) || safeName(p.code) || safeName(p.ean) || `עמוד${pi + 1}-${i + 1}`;
          fname = base + '.' + ext; let n = 2;
          while (names.has(fname.toLowerCase())) fname = `${base}-${n++}.${ext}`;
          names.add(fname.toLowerCase());
          images.push({ name: fname, url: assets[p.img] });
        }
        rows.push([(+state.settings.firstPage || 1) + pi, pg.brand, pg.category, N, i + 1, p.title, p.name, p.code, p.pack, p.ean, fname]);
      });
    });
    return { rows, images };
  }
  function buildWorkbook(rows) {
    const aoa = [COLS.map(c => c[1]), ...rows.map(r => r.map(v => (v === undefined || v === null) ? '' : v))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // ברקוד וקוד פריט כטקסט, כדי שאקסל לא יהפוך אותם למספר מדעי
    for (let r = 1; r < aoa.length; r++) for (const c of [7, 8, 9]) {
      const ref = XLSX.utils.encode_cell({ r, c }); if (ws[ref]) { ws[ref].t = 's'; ws[ref].v = String(ws[ref].v); ws[ref].z = '@'; }
    }
    ws['!cols'] = [6, 14, 14, 8, 7, 34, 30, 12, 10, 16, 22].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, 'מוצרים');
    return wb;
  }
  const wbBlob = wb => new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  function dataURLtoBytes(u) { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }

  $('#btnExcel').onclick = () => {
    const { rows, images } = collectRows();
    const m = openModal(`<div class="modal-head"><h2>ייצוא הקטלוג לאקסל</h2><button class="close-x" data-close aria-label="סגור">✕</button></div>
      <div class="modal-body">
        <div class="summary">${rows.length} מוצרים ב-${state.pages.length} עמודים · ${images.length} תמונות</div>
        <div class="cols-list">העמודות בקובץ: ${COLS.map(c => `<code>${c[1]}</code>`).join(' ')}</div>
        <div class="hint">כל שורה היא מוצר. אפשר לערוך את הקובץ באקסל ולייבא אותו בחזרה ("ייבוא מאקסל") כדי לעדכן או ליצור עמודים.<br>
        את התמונות אי אפשר לשמור בתוך תאי האקסל, לכן הן נשמרות כקבצים נפרדים בקובץ ZIP. העמודה "קובץ תמונה" מקשרת כל מוצר לתמונה שלו.</div>
      </div>
      <div class="modal-foot"><button class="primary" data-x="zip">📦 אקסל + תמונות (ZIP)</button><button data-x="xlsx">📄 אקסל בלבד (.xlsx)</button><button data-close>ביטול</button></div>`);
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      m.close();
      showBusy('מכין קובץ…');
      try {
        const wb = buildWorkbook(rows);
        if (b.dataset.x === 'xlsx') { hideBusy(); await download(wbBlob(wb), fileBase() + '.xlsx'); return; }
        const zip = new JSZip();
        zip.file(fileBase() + '.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
        const folder = zip.folder('images');
        images.forEach(im => folder.file(im.name, dataURLtoBytes(im.url)));
        const blob = await zip.generateAsync({ type: 'blob' });
        hideBusy(); await download(blob, fileBase() + '.zip');
      } catch (err) { console.error(err); toast('הייצוא נכשל: ' + err.message, 'bad'); } finally { hideBusy(); }
    });
  };

  // ---------- ייבוא מאקסל ----------
  $('#btnImport').onclick = () => {
    let sheetRows = null, sheetName = '', imageFiles = [];
    const m = openModal(`<div class="modal-head"><h2>ייבוא מוצרים מאקסל – יצירת עמודים אוטומטית</h2><button class="close-x" data-close aria-label="סגור">✕</button></div>
      <div class="modal-body">
        <div class="box"><h3>1. קובץ אקסל (או CSV, או ZIP שיוצא מכאן)</h3>
          <input type="file" id="impFile" accept=".xlsx,.xls,.csv,.zip">
          <div class="cols-list">שורה ראשונה = כותרות העמודות. עמודות מוכרות: ${COLS.map(c => `<code>${c[1]}</code>`).join(' ')}<br>
          חובה לפחות אחת מ: כותרת / תיאור / קוד פריט / ברקוד. שאר העמודות אופציונליות.</div>
          <div><button class="small" data-imp="template">⬇ הורד קובץ אקסל לדוגמה</button></div></div>
        <div class="box"><h3>2. תמונות (אופציונלי)</h3>
          <input type="file" id="impImgs" accept="image/*" multiple>
          <div class="hint">בחרו את כל קבצי התמונות בבת אחת. ההתאמה לפי העמודה "קובץ תמונה", ואם אין – לפי שם קובץ שהוא קוד הפריט או הברקוד (לדוגמה <code>7010152.jpg</code>).</div>
          <label class="check"><input type="checkbox" id="impBg"> הסר רקע אוטומטית מכל התמונות (מהיר, לרקע אחיד)</label></div>
        <div class="box"><h3>3. הגדרות</h3>
          <div class="f"><label for="impLayout">מוצרים בכל עמוד</label><select id="impLayout">${layoutOptions(page().layout)}</select>
            <div class="hint">אם בקובץ יש עמודה "עמוד" – המוצרים יקובצו לפיה; אחרת עמוד חדש נפתח כשמתמלא העמוד או כשמשתנים המותג/הקטגוריה.</div></div>
          <div class="radio-row"><label><input type="radio" name="impMode" value="replace" checked> החלף את כל הקטלוג</label>
            <label><input type="radio" name="impMode" value="append"> הוסף אחרי העמודים הקיימים</label></div>
        </div>
        <div class="summary" id="impSummary">בחרו קובץ כדי לראות מה ייווצר.</div>
      </div>
      <div class="modal-foot"><button class="primary" id="impGo" disabled>צור עמודים</button><button data-close>ביטול</button></div>`);
    const el = m.el;

    function summarize() {
      const sum = $('#impSummary', el);
      if (!sheetRows) { $('#impGo', el).disabled = true; return; }
      const { items, map, header } = parseRows(sheetRows);
      const found = COLS.filter(c => map[c[0]] !== undefined).map(c => `${c[1]} ← "${esc(header[map[c[0]]])}"`);
      if (!items.length) { sum.className = 'summary bad'; sum.innerHTML = 'לא נמצאו מוצרים בקובץ. בדקו שהשורה הראשונה היא כותרות העמודות.'; $('#impGo', el).disabled = true; return; }
      const layout = $('#impLayout', el).value;
      const pages = groupItems(items, layout);
      const matched = items.filter(it => findImage(it, imageFiles)).length;
      sum.className = 'summary';
      sum.innerHTML = `גיליון "${esc(sheetName)}": <b>${items.length}</b> מוצרים → <b>${pages.length}</b> עמודים.<br>
        תמונות: ${imageFiles.length ? `${matched} מתוך ${items.length} מוצרים קיבלו תמונה` : 'לא נבחרו'}.<br>
        <span class="hint">עמודות שזוהו: ${found.join(' · ')}</span>`;
      $('#impGo', el).disabled = false;
    }

    el.addEventListener('change', async e => {
      if (e.target.id === 'impFile') {
        const f = e.target.files[0]; if (!f) return;
        showBusy('קורא קובץ…');
        try {
          if (/\.zip$/i.test(f.name)) {
            const zip = await JSZip.loadAsync(f);
            const entries = Object.values(zip.files).filter(z => !z.dir);
            const xl = entries.find(z => /\.(xlsx|xls|csv)$/i.test(z.name));
            if (!xl) throw new Error('בקובץ ה-ZIP אין קובץ אקסל');
            ({ rows: sheetRows, name: sheetName } = readSheet(await xl.async('arraybuffer'), xl.name));
            const imgs = entries.filter(z => /\.(jpe?g|png|webp|gif|bmp)$/i.test(z.name));
            imageFiles = await Promise.all(imgs.map(async z => {
              const blob = await z.async('blob'); const nm = z.name.split('/').pop();
              const type = /png$/i.test(nm) ? 'image/png' : /webp$/i.test(nm) ? 'image/webp' : /gif$/i.test(nm) ? 'image/gif' : 'image/jpeg';
              const file = new File([blob], nm, { type }); file.__zip = true; return file;
            }));
          } else {
            ({ rows: sheetRows, name: sheetName } = readSheet(await f.arrayBuffer(), f.name));
          }
        } catch (err) { console.error(err); sheetRows = null; toast('לא ניתן לקרוא את הקובץ: ' + err.message, 'bad'); }
        finally { hideBusy(); summarize(); }
      }
      if (e.target.id === 'impImgs') { imageFiles = [...imageFiles.filter(f => f.__zip), ...e.target.files]; summarize(); }
      if (e.target.id === 'impLayout') summarize();
    });
    el.addEventListener('click', async e => {
      if (e.target.closest('[data-imp="template"]')) {
        const wb = buildWorkbook([
          [1, 'פיברקולור', 'טושים', 4, 1, 'טוש ארגונומי 12 פיברקולור', 'טוש ארגונומי\n12 פיברקולור', '7010152', '96/12', '8008621025817', '7010152.jpg'],
          [1, 'פיברקולור', 'טושים', 4, 2, "טוש הדגשה צבעי פסטל 6 יח'", "טוש הדגשה\nצבעי פסטל 6 יח'", '4012483', '144/12', '8008621025770', '4012483.jpg'],
        ]);
        await download(wbBlob(wb), 'תבנית ייבוא קטלוג.xlsx');
      }
      if (e.target.id === 'impGo') {
        const layout = $('#impLayout', el).value;
        const mode = el.querySelector('input[name=impMode]:checked').value;
        const autoBg = $('#impBg', el).checked;
        m.close();
        await runImport(sheetRows, imageFiles, layout, mode, autoBg);
      }
    });
  };

  function readSheet(buf, name) {
    let wb;
    if (/\.csv$/i.test(name)) {
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1255').decode(buf);
      wb = XLSX.read(text.replace(/^﻿/, ''), { type: 'string' });
    } else wb = XLSX.read(buf, { type: 'array' });
    const sn = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' });
    return { rows, name: sn };
  }
  // הופך שורות גיליון לרשימת מוצרים
  function parseRows(rows) {
    const hi = rows.findIndex(r => r.some(c => String(c).trim()));
    if (hi < 0) return { items: [], map: {}, header: [] };
    const header = rows[hi].map(c => String(c).trim());
    const map = mapHeaders(header);
    const get = (r, k) => map[k] === undefined ? '' : String(r[map[k]] ?? '').trim();
    const items = [];
    for (const r of rows.slice(hi + 1)) {
      const title = get(r, 'title'), desc = get(r, 'desc'), code = get(r, 'code'), ean = get(r, 'ean').replace(/\D/g, '');
      if (!title && !desc && !code && !ean) continue;
      items.push({
        page: get(r, 'page'), brand: get(r, 'brand'), category: get(r, 'category'), perPage: get(r, 'perPage'),
        title: title || desc.split('\n')[0], desc: desc || splitTwoLines(title), code, pack: get(r, 'pack'), ean, image: get(r, 'image'),
      });
    }
    return { items, map, header };
  }
  // פיצול כותרת לשתי שורות (כמו בדוגמה) – בערך באמצע, ברווח
  function splitTwoLines(t) {
    t = String(t || '').trim(); if (t.length < 14 || t.includes('\n')) return t;
    const mid = t.length / 2; let best = -1;
    for (let i = 0; i < t.length; i++) if (t[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return best > 0 ? t.slice(0, best).trim() + '\n' + t.slice(best + 1).trim() : t;
  }
  function layoutFromValue(v, fallback) {
    v = String(v || '').trim().replace(/[×*X]/g, 'x');
    if (/^\d+x\d+$/.test(v)) return v;
    return LAYOUT_BY_N[parseInt(v, 10)] || fallback;
  }
  function groupItems(items, layout) {
    const hasPage = items.some(it => it.page);
    const prepared = items.map(it => ({ p: it, hdr: { brand: it.brand, category: it.category }, group: hasPage ? it.page : null }));
    if (!hasPage) return buildPagesFromItems(prepared, layout).map(pg => ({ layout: pg.layout, items: pg.products.filter(p => !isEmptyProduct(p) && p.title !== undefined) }));
    // לפי עמודת "עמוד": כל ערך = עמוד; פריסה מהעמודה "מוצרים בעמוד" אם קיימת, אחרת הקטנה ביותר שמכילה
    const groups = [];
    prepared.forEach(x => { let g = groups.find(g => g.key === x.group); if (!g) groups.push(g = { key: x.group, list: [] }); g.list.push(x.p); });
    const out = [];
    groups.forEach(g => {
      let lay = layoutFromValue(g.list.find(it => it.perPage)?.perPage, null);
      if (!lay) {
        const [c, r] = parseLayout(layout);
        lay = g.list.length > c * r ? (Object.entries(LAYOUT_BY_N).find(([n]) => +n >= g.list.length)?.[1] || layout) : layout;
      }
      const [c, r] = parseLayout(lay), n = c * r;
      for (let i = 0; i < g.list.length; i += n) out.push({ layout: lay, items: g.list.slice(i, i + n) });
    });
    return out;
  }
  function findImage(it, files) {
    if (!files.length) return null;
    const keys = [];
    const base = s => String(s || '').toLowerCase().trim().split(/[\\/]/).pop();
    const noext = s => base(s).replace(/\.[a-z0-9]+$/i, '');
    if (it.image) keys.push(base(it.image), noext(it.image));
    if (it.code) keys.push(noext(it.code));
    if (it.ean) keys.push(noext(it.ean));
    return files.find(f => keys.includes(base(f.name)) || keys.includes(noext(f.name))) || null;
  }

  async function runImport(rows, files, layout, mode, autoBg) {
    showBusy('יוצר עמודים…');
    try {
      const { items } = parseRows(rows);
      const groups = groupItems(items, layout);
      const logoByBrand = {};
      state.pages.forEach(p => { if (p.brand && p.logo && !logoByBrand[p.brand]) logoByBrand[p.brand] = { logo: p.logo, logoScale: p.logoScale }; });
      const fallback = page();
      const cache = new Map();
      const pages = [];
      let done = 0, total = items.length;
      for (const gr of groups) {
        const first = gr.items[0];
        const lg = logoByBrand[first.brand] || (first.brand && first.brand !== fallback.brand ? { logo: null } : { logo: fallback.logo, logoScale: fallback.logoScale });
        const pg = newPage({ brand: first.brand || fallback.brand, category: first.category || fallback.category, logo: lg.logo, logoScale: lg.logoScale, layout: gr.layout });
        for (const it of gr.items) {
          const p = Object.assign(emptyProduct(), { title: it.title, name: it.desc, code: it.code, pack: it.pack, ean: it.ean, imgName: it.image });
          const f = findImage(it, files);
          if (f) {
            if (!cache.has(f)) {
              const url = await normalizeImage(await fileToDataURL(f));
              if (autoBg) {
                const src = toCanvas(await loadImg(url));
                const cut = floodRemove(copyCanvas(src), tolerance);
                refineCutout(cut, src, { hard: 50, shrink: 0, specks: true });
                cache.set(f, { img: addAsset(flattenOnWhite(trimmed(cut, true))), orig: addAsset(url), cut: addAsset(cut.toDataURL('image/png')) });
              } else cache.set(f, { img: addAsset(url) });
            }
            Object.assign(p, cache.get(f));
            p.imgName = f.name;
          }
          pg.products.push(p);
          done++; if (done % 5 === 0) { setBusy(`יוצר עמודים… ${done} מתוך ${total} מוצרים`); await new Promise(z => setTimeout(z, 0)); }
        }
        ensureSlots(pg);
        pages.push(pg);
      }
      if (mode === 'replace') { state.pages = pages; cur = 0; }
      else { const at = state.pages.length; state.pages.push(...pages); cur = at; }
      renderForm(); renderPreview(); scheduleSave();
      const withImg = pages.reduce((s, p) => s + p.products.filter(x => x.img).length, 0);
      toast(`נוצרו ${pages.length} עמודים עם ${items.length} מוצרים (${withImg} עם תמונה)`, 'ok');
    } catch (e) { console.error(e); toast('הייבוא נכשל: ' + e.message, 'bad'); }
    finally { hideBusy(); }
  }

  // ---------- פרויקט ----------
  function usedAssets() {
    const out = {};
    const add = id => { if (id && assets[id]) out[id] = assets[id]; };
    add(state.settings.logoFooter);
    state.pages.forEach(p => { add(p.logo); p.products.forEach(x => { add(x.img); add(x.orig); add(x.cut); }); });
    return out;
  }
  function loadState(obj) {
    if (!obj || !obj.state || !Array.isArray(obj.state.pages) || !obj.state.pages.length) throw new Error('קובץ פרויקט לא תקין');
    Object.assign(assets, obj.assets || {});
    state = obj.state;
    state.settings = Object.assign(defaultSettings(), state.settings || {});
    state.pages.forEach(p => {
      if (!p.layout) p.layout = '2x2';
      p.products = (p.products || []).map(x => Object.assign(emptyProduct(), x || {}));
      ensureSlots(p);
    });
    cur = clamp(obj.cur || 0, 0, state.pages.length - 1);
  }
  $('#btnSave').onclick = () => download(new Blob([JSON.stringify({ app: 'catalog-pages', state, assets: usedAssets() })], { type: 'application/json' }), fileBase() + '.json');
  $('#btnOpen').onclick = () => { $('#projectInput').value = ''; $('#projectInput').click(); };
  $('#projectInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { loadState(JSON.parse(await f.text())); renderForm(); renderPreview(); scheduleSave(); toast('הפרויקט נפתח', 'ok'); }
    catch (err) { toast('לא ניתן לפתוח: ' + err.message, 'bad'); }
  });
  let resetArmed = 0;
  $('#btnReset').onclick = () => {
    if (Date.now() - resetArmed > 3000) { resetArmed = Date.now(); toast('לחצו שוב כדי להחליף את כל העבודה בדף הדוגמה'); return; }
    resetArmed = 0; state = sampleState(); cur = 0; renderForm(); renderPreview(); scheduleSave(); toast('דף הדוגמה נטען');
  };

  const DB = {
    open() { return new Promise((res, rej) => { const r = indexedDB.open('catalog-pages', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
    async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  };
  let saveTimer;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { DB.set('autosave', { state, assets: usedAssets(), cur }).catch(() => {}); }, 700); }

  // ---------- הודעות ----------
  let toastTimer;
  function toast(msg, kind) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (kind ? ' ' + kind : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, Math.min(12000, 3000 + msg.length * 45));
  }
  function showBusy(t) { $('#busyText').textContent = t; $('#busy').hidden = false; }
  function setBusy(t) { $('#busyText').textContent = t; }
  function hideBusy() { $('#busy').hidden = true; }

  // ---------- אתחול ----------
  // הגופנים המוטמעים נטענים גם לדף עצמו – כך המסך, ה-JPG וה-PDF משתמשים באותם קבצי גופן בדיוק, גם בלי אינטרנט
  async function loadEmbeddedFonts() {
    const F = window.PDF_FONTS; if (!F || !window.FontFace) return;
    const jobs = [];
    for (const fam of Object.keys(F)) for (const w of Object.keys(F[fam])) {
      try {
        const bin = atob(F[fam][w]), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const ff = new FontFace(fam, buf.buffer, { weight: String(w), style: 'normal' });
        jobs.push(ff.load().then(f => document.fonts.add(f)).catch(() => {}));
      } catch (e) { /* גופן לא נטען – נשאר גופן הדפדפן */ }
    }
    await Promise.all(jobs);
  }
  async function init() {
    await loadEmbeddedFonts();
    state = sampleState();
    try { const saved = await DB.get('autosave'); if (saved && saved.state) loadState(saved); } catch (e) { /* ללא שמירה */ }
    renderForm();
    zoomFit();
    if (document.fonts) document.fonts.ready.then(renderPreview);
  }
  window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(zoomFit, 150); });
  init();

  window.__catalog = { get state() { return state; }, normalizeEAN, renderCanvas, goPage, parseRows, groupItems, refineCutout, flattenOnWhite };
})();
