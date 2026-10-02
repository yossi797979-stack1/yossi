/* מחולל דפי קטלוג A4 – טופס שדות + תצוגה מקדימה בעיצוב קבוע לפי הדוגמה,
   מספר מוצרים משתנה בעמוד, עורך תמונה ידני, ייבוא/ייצוא אקסל */
(() => {
  'use strict';

  // ---------- קבועים ----------
  const PAGE_W = 794, PAGE_H = 1123;          // A4 ב-96dpi
  const EXPORT_W = 1240, EXPORT_H = 1754;     // A4 ב-150dpi
  const EXPORT_DPI = 150;
  const MAX_IMG = 1800;
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
    return { show: true, title: '', name: '', code: '', pack: '', ean: '', img: null, orig: null, imgName: '', imgScale: 100, imgY: 0 };
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
  function barcodeURL(value, w, h, fontPx) {
    w = Math.round(w * 10) / 10; h = Math.round(h * 10) / 10;
    const key = [value, w, h, fontPx].join('|');
    if (bcCache.has(key)) return bcCache.get(key);
    const n = normalizeEAN(value);
    if (!n.ok) return null;
    const c = document.createElement('canvas');
    const module = 8;
    let font = 60;
    const opts = h2 => ({ format: 'EAN13', width: module, height: h2, margin: 0, marginLeft: module * 2, marginRight: 0, marginTop: 0, marginBottom: 0,
      displayValue: true, font: 'Arial', fontSize: font, textMargin: Math.round(module * 0.4), background: '#ffffff', lineColor: '#000000' });
    try {
      for (let i = 0; i < 3; i++) { JsBarcode(c, n.code, opts(100)); font = Math.max(8, Math.round(fontPx * c.width / w)); }
      JsBarcode(c, n.code, opts(100));
      const extra = c.height - 100;
      const barH = Math.max(20, Math.round(c.width * h / w - extra));
      JsBarcode(c, n.code, opts(barH));
      const url = c.toDataURL('image/png');
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
    H.push(`<div class="abs c-title" style="${box(R.x, R.y, R.w, titleH)}color:${s.titleColor};font-family:'${s.titleFont}',Arial,sans-serif;font-size:${(s.titleSize * k).toFixed(2)}px;">${esc(p.title)}</div>`);
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

  function buildPage(pg, index, interactive) {
    const s = state.settings;
    const el = document.createElement('div');
    el.className = 'cpage';
    el.style.background = s.pageBg;
    const H = [];
    H.push(`<div class="abs" style="${box(0, 0, PAGE_W, L.grayH)}background:linear-gradient(to right, ${s.grayFrom} 0%, ${s.grayFrom} 45%, ${s.grayTo} 100%);"></div>`);
    H.push(`<div class="abs" style="${box(0, 0, L.redW, L.redH)}background:${s.accent};"></div>`);
    H.push(`<div class="abs" style="${box(L.redW - L.redSlant, 0, L.redSlant * 2, L.redH)}background:${s.accent};transform:skewX(${-Math.atan(L.redSlant / L.redH) * 180 / Math.PI}deg);transform-origin:0 0;"></div>`);
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
    H.push(`<div class="abs" style="${box(0, L.botRed.y, L.botRed.w, L.botRed.h)}background:${s.accent};"></div>`);
    H.push(`<div class="abs" style="${box(L.botRed.w - L.botRed.slant, L.botRed.y, L.botRed.slant * 2, L.botRed.h)}background:${s.accent};transform:skewX(${-Math.atan(L.botRed.slant / L.botRed.h) * 180 / Math.PI}deg);transform-origin:0 0;"></div>`);
    el.innerHTML = H.join('');
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
    return alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
  }
  async function loadImageInto(key, file) {
    if (!file.type.startsWith('image/')) { toast('הקובץ אינו תמונה', 'bad'); return; }
    showBusy('טוען תמונה…');
    try {
      const url = await normalizeImage(await fileToDataURL(file));
      const r = imgRef(key);
      r.obj[r.k] = addAsset(url);
      if (!r.logo) { r.obj.orig = null; r.obj.imgName = file.name; }
      renderForm(); renderPreview(); scheduleSave();
    } catch (e) { console.error(e); toast('לא ניתן לטעון את התמונה', 'bad'); }
    finally { hideBusy(); }
  }

  async function imageAction(key, act) {
    const r = imgRef(key);
    if (act === 'pick') { pickKey = key; $('#fileInput').value = ''; $('#fileInput').click(); return; }
    if (act === 'clear') { r.obj[r.k] = null; if (!r.logo) r.obj.orig = null; renderForm(); schedulePreview(); return; }
    if (act === 'restore') { if (r.obj.orig) { r.obj[r.k] = r.obj.orig; r.obj.orig = null; renderForm(); schedulePreview(); } return; }
    if (act === 'edit') { openEditor(key); return; }
    const id = r.obj[r.k]; if (!id || !assets[id]) return;
    const srcId = (!r.logo && r.obj.orig && act !== 'trim') ? r.obj.orig : id;
    try {
      let canvas;
      if (act === 'bgFast') {
        showBusy('מסיר רקע…'); await new Promise(z => setTimeout(z, 30));
        canvas = floodRemove(toCanvas(await loadImg(assets[srcId])), tolerance);
      } else if (act === 'bgAI') {
        if (IN_VIEWER) throw new Error('בגרסת הקישור אין גישה לשרת המודל. הסרת רקע AI עובדת כשפותחים את index.html מהמחשב. כאן השתמשו ב"הסר רקע" או ב"עריכה ידנית".');
        showBusy('טוען מודל AI (בפעם הראשונה עד דקה)…');
        const mod = await loadAI();
        const fn = mod.removeBackground || mod.default?.removeBackground || mod.default;
        const blob = await (await fetch(assets[srcId])).blob();
        const out = await fn(blob, { output: { format: 'image/png' }, progress: (k, c, t) => { if (t) setBusy(`מוריד מודל… ${Math.round(c / t * 100)}%`); } });
        setBusy('מסיר רקע…');
        const u = URL.createObjectURL(out); canvas = toCanvas(await loadImg(u)); URL.revokeObjectURL(u);
      } else if (act === 'trim') {
        showBusy('חותך שוליים…'); canvas = toCanvas(await loadImg(assets[id]));
      } else return;
      setImageResult(r, canvas, id);
      toast(act === 'trim' ? 'השוליים נחתכו' : r.logo ? 'הרקע הוסר (שקוף)' : 'הרקע הוסר והתמונה נצרבה על רקע לבן', 'ok');
    } catch (e) {
      console.error(e);
      toast((act === 'bgAI' ? 'הסרת רקע AI נכשלה: ' : 'העיבוד נכשל: ') + (e && e.message || e), 'bad');
    } finally { hideBusy(); }
  }
  // שמירת תוצאה: לוגו – PNG שקוף; מוצר – "צריבה" על רקע לבן
  function setImageResult(r, canvas, prevId) {
    const url = r.logo ? trimmed(canvas, true).toDataURL('image/png') : flattenOnWhite(trimmed(canvas, true));
    if (!r.logo && !r.obj.orig) r.obj.orig = prevId;
    r.obj[r.k] = addAsset(url);
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
      if (b.dataset.pv === 'pdf') { m.close(); exportPDF(); return; }
      mode = b.dataset.pv; draw();
    });
    requestAnimationFrame(draw);
  };

  // ---------- עורך תמונה ידני ----------
  async function openEditor(key) {
    const r = imgRef(key);
    const id = r.obj[r.k]; if (!id || !assets[id]) return;
    const img = await loadImg(assets[id]);
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
    const src = document.createElement('canvas'); src.width = W; src.height = H; src.getContext('2d').drawImage(img, 0, 0, W, H);

    const m = openModal(`<div class="modal-head"><h2>עריכת תמונה – מחיקת רקע ידנית</h2>
        <button class="close-x" data-close aria-label="סגור">✕</button></div>
      <div class="ed-wrap">
        <div class="ed-tools">
          <div class="f"><label>כלי</label><div class="tool-btns">
            <button data-tool="erase" class="on">🧽 מחק</button><button data-tool="restore">🖌 שחזר</button>
            <button data-tool="wand">🪄 מטה קסם</button><button data-tool="pan">✋ הזזה</button></div></div>
          <div class="f"><label for="edSize">גודל מברשת: <span id="edSizeOut">40</span></label><input type="range" id="edSize" min="4" max="200" value="40"></div>
          <div class="f"><label for="edTol">רגישות מטה קסם / אוטומטי: <span id="edTolOut">${tolerance}</span></label><input type="range" id="edTol" min="4" max="120" value="${tolerance}"></div>
          <div class="hint"><b>מחק</b> – מעבירים על אזורי הרקע. <b>שחזר</b> – מחזיר חלקים שנמחקו בטעות. <b>מטה קסם</b> – לחיצה על צבע הרקע מוחקת את כל האזור הדומה הרציף.</div>
          <div class="tool-btns"><button data-ed="auto">⚡ הסרה אוטומטית</button><button data-ed="undo">↶ בטל</button>
            <button data-ed="reset">↺ התחל מחדש</button><button data-ed="zin">🔍＋</button><button data-ed="zout">🔍−</button><button data-ed="fit">התאם</button></div>
          <label class="check"><input type="checkbox" id="edWhite"> הצג על רקע לבן</label>
        </div>
        <div class="ed-stage" id="edStage"><div class="ed-canvas-box" id="edBox"><canvas id="edCanvas"></canvas><div class="ed-cursor" id="edCursor" hidden></div></div></div>
      </div>
      <div class="modal-foot"><button class="primary" data-ed="save">💾 שמור ${r.logo ? '(רקע שקוף)' : '(צריבה על רקע לבן)'}</button><button data-close>ביטול</button></div>`, { wide: true });

    const el = m.el, stage = $('#edStage', el), boxEl = $('#edBox', el), cv = $('#edCanvas', el), cursor = $('#edCursor', el);
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0);
    let tool = 'erase', size = 40, tol = tolerance, disp = 1;
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
      if (a === 'auto') { pushUndo(); floodRemove(cv, tol); }
      if (a === 'zin') setDisp(disp * 1.25);
      if (a === 'zout') setDisp(disp / 1.25);
      if (a === 'fit') fit();
      if (a === 'save') { setImageResult(r, cv, id); m.close(); toast(r.logo ? 'התמונה נשמרה עם רקע שקוף' : 'התמונה נשמרה על רקע לבן', 'ok'); }
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

  // ---------- ייצוא תמונה / PDF ----------
  async function renderCanvas(index) {
    const hostEl = $('#exportHost');
    const el = buildPage(state.pages[index], index, false);
    hostEl.replaceChildren(el);
    await document.fonts.ready;
    await Promise.all($$('img', el).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
    try {
      const c = await window.html2canvas(el, {
        scale: EXPORT_W / PAGE_W, width: PAGE_W, height: PAGE_H, backgroundColor: state.settings.pageBg, logging: false, useCORS: true,
        onclone: (cd, cel) => {
          // html2canvas מאבד רווחים בעברית; ריווח אותיות זעיר גורם לציור אות-אות במקום המדויק
          const win = cd.defaultView;
          (cel || cd.body).querySelectorAll('*').forEach(n => {
            if (n.children.length === 0 && n.textContent.trim() && !parseFloat(win.getComputedStyle(n).letterSpacing)) n.style.letterSpacing = '0.01px';
          });
        },
      });
      const out = document.createElement('canvas'); out.width = EXPORT_W; out.height = EXPORT_H;
      const g = out.getContext('2d'); g.fillStyle = state.settings.pageBg; g.fillRect(0, 0, EXPORT_W, EXPORT_H);
      g.drawImage(c, 0, 0, EXPORT_W, EXPORT_H);
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
  $('#btnExportJpg').onclick = async () => {
    showBusy('מייצא JPG ‏(150dpi)…');
    try {
      const c = await renderCanvas(cur);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
      const bytes = setJpegDpi(new Uint8Array(await blob.arrayBuffer()), EXPORT_DPI);
      hideBusy();
      await download(new Blob([bytes], { type: 'image/jpeg' }), `${fileBase()} - עמוד ${(+state.settings.firstPage || 1) + cur}.jpg`);
    } catch (e) { console.error(e); toast('הייצוא נכשל: ' + e.message, 'bad'); } finally { hideBusy(); }
  };
  async function exportPDF() {
    showBusy('מייצא PDF ‏(150dpi)…');
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < state.pages.length; i++) {
        setBusy(`מייצא PDF ‏(150dpi)… עמוד ${i + 1} מתוך ${state.pages.length}`);
        const c = await renderCanvas(i);
        if (i > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297, undefined, 'NONE');
      }
      pdf.setProperties({ title: fileBase() });
      hideBusy();
      await download(pdf.output('blob'), fileBase() + '.pdf');
    } catch (e) { console.error(e); toast('הייצוא נכשל: ' + e.message, 'bad'); } finally { hideBusy(); }
  }
  $('#btnExportPdf').onclick = exportPDF;

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
              let url = await normalizeImage(await fileToDataURL(f));
              if (autoBg) { const c = floodRemove(toCanvas(await loadImg(url)), tolerance); url = flattenOnWhite(trimmed(c, true)); }
              cache.set(f, addAsset(url));
            }
            p.img = cache.get(f); p.imgName = f.name;
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
    state.pages.forEach(p => { add(p.logo); p.products.forEach(x => { add(x.img); add(x.orig); }); });
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
  async function init() {
    state = sampleState();
    try { const saved = await DB.get('autosave'); if (saved && saved.state) loadState(saved); } catch (e) { /* ללא שמירה */ }
    renderForm();
    zoomFit();
    if (document.fonts) document.fonts.ready.then(renderPreview);
  }
  window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(zoomFit, 150); });
  init();

  window.__catalog = { get state() { return state; }, normalizeEAN, renderCanvas, goPage, parseRows, groupItems };
})();
