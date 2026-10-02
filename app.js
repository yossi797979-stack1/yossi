/* מחולל דפי קטלוג A4 – טופס שדות למילוי + תצוגה מקדימה בעיצוב קבוע לפי הדוגמה */
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

  // מידות העמוד (בפיקסלים של A4 ב-96dpi), נמדדו מעמוד הדוגמה
  const L = {
    grayH: 42.5, redH: 55.4, redW: 372, redSlant: 50,
    logo: { x: 40, y: 10, w: 146, h: 36 },
    hdrText: { right: 60, cy: 28.3 },
    colX: [425, 87], colW: 308, rowDY: [0, 490.3],
    title: { y: 82, h: 30 }, bar: { y: 112, h: 3, w: 154 },
    panel: { y: 116.6, h: 435.6 },
    img: { x: 20, y: 15.4, w: 268, h: 274 },
    info: { x: 109, w: 90.5 },
    name: { y: 306.4, h: 30 }, code: { y: 340, h: 15.5 }, pack: { y: 359, h: 15.5 },
    barcode: { y: 381.4, h: 43 },
    foot: { cy: 1098, numX: 74, webRight: 60, logo: { x: 350, y: 1063, w: 95, h: 46 } },
    botRed: { y: 1109.5, h: 13.5, w: 140, slant: 10 },
  };
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
    return { show: true, title: '', name: '', code: '', pack: '', ean: '', img: null, orig: null, imgScale: 100, imgY: 0 };
  }
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
    const st = { version: 2, settings: defaultSettings(), pages: [] };
    st.settings.logoFooter = a('logoFooter');
    const P = (title, name, code, pack, ean, img) => Object.assign(emptyProduct(), { title, name, code, pack, ean, img: a(img) });
    st.pages.push({
      brand: 'פיברקולור', category: 'טושים', logo: a('logo'), logoScale: 100,
      products: [
        P('טוש ארגונומי 12 פיברקולור', 'טוש ארגונומי\n12 פיברקולור', '7010152', '96/12', '8008621025817', 'product1'),
        P("טוש הדגשה  צבעי  פסטל 6 יח'", "טוש הדגשה\nצבעי  פסטל 6 יח'", '4012483', '144/12', '8008621025770', 'product2'),
        P("טוש פיברקולור דו צדדי 10 יח'", "טוש פיברקולור\nדו צדדי 10 יח'", '1910110', '72/12', '8008621000845', 'product3'),
        P("טוש פיברקולור דו צדדי 12 יח'", "טוש פיברקולור\nדו צדדי 12 יח'", '1910244', '72/12', '8008621000067', 'product4'),
      ],
    });
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
      for (let i = 0; i < 3; i++) {
        JsBarcode(c, n.code, opts(100));
        font = Math.round(fontPx * c.width / w);
      }
      JsBarcode(c, n.code, opts(100));
      const extra = c.height - 100;
      const barH = Math.max(20, Math.round(c.width * h / w - extra));
      JsBarcode(c, n.code, opts(barH));
      const url = c.toDataURL('image/png');
      if (bcCache.size > 300) bcCache.clear();
      bcCache.set(key, url);
      return url;
    } catch (e) { console.error(e); return null; }
  }

  // ---------- בניית עמוד ----------
  function px(v) { return Math.round(v * 100) / 100 + 'px'; }
  function box(x, y, w, h) { return `left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)};`; }

  function buildPage(pg, index, interactive) {
    const s = state.settings;
    const el = document.createElement('div');
    el.className = 'cpage';
    el.style.background = s.pageBg;
    const H = [];
    // כותרת עליונה: פס אפור + צורת אדומה משופעת + לוגו + טקסט
    H.push(`<div class="abs" style="${box(0, 0, PAGE_W, L.grayH)}background:linear-gradient(to right, ${s.grayFrom} 0%, ${s.grayFrom} 45%, ${s.grayTo} 100%);"></div>`);
    H.push(`<div class="abs" style="${box(0, 0, L.redW, L.redH)}background:${s.accent};"></div>`);
    H.push(`<div class="abs" style="${box(L.redW - L.redSlant, 0, L.redSlant * 2, L.redH)}background:${s.accent};transform:skewX(${-Math.atan(L.redSlant / L.redH) * 180 / Math.PI}deg);transform-origin:0 0;"></div>`);
    if (pg.logo && assets[pg.logo]) {
      const k = (pg.logoScale || 100) / 100, w = L.logo.w * k, h = L.logo.h * k;
      H.push(`<img class="abs c-logo" data-go="header" src="${assets[pg.logo]}" style="${box(L.logo.x, L.logo.y + (L.logo.h - h) / 2, w, h)}object-position:left center;">`);
    }
    H.push(`<div class="abs c-hdr-text" data-go="header" style="right:${px(L.hdrText.right)};top:${px(L.hdrText.cy - 14)};width:400px;height:28px;font-size:${s.hdrSize}px;letter-spacing:${(s.hdrSize * 0.2).toFixed(2)}px;">
      <span>${esc(pg.brand)}</span>${pg.brand && pg.category ? `<span class="sep" style="color:${s.accent}">|</span>` : ''}<span>${esc(pg.category)}</span></div>`);

    // מוצרים 2×2 (מימין לשמאל)
    pg.products.forEach((p, i) => {
      if (!p.show) return;
      const x = L.colX[i % 2], dy = L.rowDY[Math.floor(i / 2)];
      H.push(`<div data-slot="${i}">`);
      H.push(`<div class="abs c-title" style="${box(x, L.title.y + dy, L.colW, L.title.h)}color:${s.titleColor};font-family:'${s.titleFont}',Arial,sans-serif;font-size:${s.titleSize}px;">${esc(p.title)}</div>`);
      H.push(`<div class="abs" style="${box(x, L.bar.y + dy, L.bar.w, L.bar.h)}background:${s.accent};"></div>`);
      const py = L.panel.y + dy;
      H.push(`<div class="abs c-panel" style="${box(x, py, L.colW, L.panel.h)}background:${s.panel};">`);
      if (p.img && assets[p.img]) {
        const k = (p.imgScale || 100) / 100, w = L.img.w * k, h = L.img.h * k;
        H.push(`<img class="c-img" src="${assets[p.img]}" style="${box(L.img.x + (L.img.w - w) / 2, L.img.y + (L.img.h - h) / 2 + (+p.imgY || 0), w, h)}">`);
      }
      const ix = L.info.x, iw = L.info.w;
      H.push(`<div class="abs c-name" style="${box(ix, L.name.y, iw, L.name.h)}font-size:${s.nameSize}px;line-height:${(s.nameSize * 1.1).toFixed(2)}px;color:${s.textColor};">${esc(p.name)}</div>`);
      if (p.code || s.codeLabel) H.push(`<div class="abs c-row" style="${box(ix, L.code.y, iw, L.code.h)}font-size:${s.rowSize}px;color:${s.textColor};"><span>${esc(s.codeLabel)}</span><span class="v" style="font-size:${(s.rowSize * 0.96).toFixed(2)}px">${esc(p.code)}</span></div>`);
      if (p.pack || s.packLabel) H.push(`<div class="abs c-row" style="${box(ix, L.pack.y, iw, L.pack.h)}font-size:${s.rowSize}px;color:${s.textColor};"><span>${esc(s.packLabel)}</span><span class="v" style="font-size:${(s.rowSize * 0.96).toFixed(2)}px">${esc(p.pack)}</span></div>`);
      const bc = barcodeURL(p.ean, iw, L.barcode.h, 8);
      if (bc) H.push(`<img class="abs c-barcode" src="${bc}" style="${box(ix, L.barcode.y, iw, L.barcode.h)}">`);
      H.push(`</div></div>`);
    });

    // כותרת תחתונה
    if (s.showPageNum) H.push(`<div class="abs c-foot-num" data-go="footer" style="${box(L.foot.numX - 25, L.foot.cy - 10, 50, 20)}font-size:15px;line-height:20px;">${(+s.firstPage || 1) + index}</div>`);
    if (s.showFooterLogo && s.logoFooter && assets[s.logoFooter]) H.push(`<img class="abs c-logo" data-go="footer" src="${assets[s.logoFooter]}" style="${box(L.foot.logo.x, L.foot.logo.y, L.foot.logo.w, L.foot.logo.h)}">`);
    H.push(`<div class="abs c-foot-web" data-go="footer" style="right:${px(L.foot.webRight)};top:${px(L.foot.cy - 10)};width:300px;height:20px;font-size:13.5px;line-height:20px;letter-spacing:2.6px;">${esc(s.website)}</div>`);
    H.push(`<div class="abs" style="${box(0, L.botRed.y, L.botRed.w, L.botRed.h)}background:${s.accent};"></div>`);
    H.push(`<div class="abs" style="${box(L.botRed.w - L.botRed.slant, L.botRed.y, L.botRed.slant * 2, L.botRed.h)}background:${s.accent};transform:skewX(${-Math.atan(L.botRed.slant / L.botRed.h) * 180 / Math.PI}deg);transform-origin:0 0;"></div>`);
    el.innerHTML = H.join('');
    if (!interactive) $$('[data-slot],[data-go]', el).forEach(n => { n.removeAttribute('data-slot'); n.removeAttribute('data-go'); });
    return el;
  }

  // ---------- תצוגה מקדימה ----------
  let previewTimer = null;
  function renderPreview() {
    const host = $('#previewScale');
    const el = buildPage(page(), cur, true);
    el.style.transform = `scale(${zoom})`;
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
    const slot = e.target.closest('[data-slot]');
    const go = e.target.closest('[data-go]');
    const target = slot ? 'sec-p' + slot.dataset.slot : go ? 'sec-' + go.dataset.go : null;
    if (!target) return;
    const sec = document.getElementById(target);
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
  const txt = (label, path, val, extra = '') => `<div class="f"><label for="${idOf(path)}">${label}</label><input type="text" id="${idOf(path)}" data-path="${path}" value="${esc(val)}" ${extra}></div>`;
  const area = (label, path, val, hint = '') => `<div class="f"><label for="${idOf(path)}">${label}</label><textarea id="${idOf(path)}" data-path="${path}" rows="2">${esc(val)}</textarea>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  const numf = (label, path, val, min, max, step = 1) => `<div class="f"><label for="${idOf(path)}">${label}</label><input type="number" id="${idOf(path)}" data-path="${path}" value="${val}" min="${min}" max="${max}" step="${step}"></div>`;
  const color = (label, path, val) => `<div class="f"><label for="${idOf(path)}">${label}</label><input type="color" id="${idOf(path)}" data-path="${path}" value="${val}"></div>`;
  const range = (label, path, val, min, max) => `<div class="f"><label for="${idOf(path)}">${label}: <span data-out="${path}">${val}</span></label><input type="range" id="${idOf(path)}" data-path="${path}" value="${val}" min="${min}" max="${max}"></div>`;
  const check = (label, path, val) => `<label class="check"><input type="checkbox" id="${idOf(path)}" data-path="${path}" ${val ? 'checked' : ''}> ${label}</label>`;
  const idOf = path => 'fld-' + path.replace(/\./g, '-');

  function imgField(key, assetId, opts = {}) {
    const has = assetId && assets[assetId];
    return `<div class="imgfield" data-imgkey="${key}">
      <div class="thumb ${opts.logo ? 'logo' : ''}" data-act="pick" title="לחצו לבחירת תמונה או גררו קובץ לכאן">${has ? `<img src="${assets[assetId]}" alt="">` : 'לחצו או גררו<br>תמונה לכאן'}</div>
      <div class="imgbtns">
        <button class="small" data-act="pick">📂 ${has ? 'החלף' : 'הוסף'} תמונה</button>
        ${has ? `<button class="small" data-act="bgFast">⚡ הסר רקע</button>
        <button class="small" data-act="bgAI">✨ הסר רקע AI</button>
        <button class="small" data-act="trim">✂️ חתוך שוליים</button>
        ${opts.orig ? '<button class="small" data-act="restore">↺ מקור</button>' : ''}
        <button class="small" data-act="clear">🗑 הסר</button>` : ''}
      </div>
    </div>`;
  }

  let tolerance = 38;
  function renderForm() {
    const s = state.settings, pg = page();
    const H = [];
    H.push(`<details class="sec" id="sec-header" open><summary>כותרת העמוד <span class="badge">עמוד ${cur + 1}</span></summary><div class="sec-body">
      <div class="f"><label>לוגו (בפס האדום)</label>${imgField('logo', pg.logo, { logo: true })}</div>
      ${range('גודל הלוגו (%)', 'page.logoScale', pg.logoScale || 100, 40, 160)}
      <div class="f2">${txt('שם המותג (בכותרת)', 'page.brand', pg.brand)}${txt('קטגוריה', 'page.category', pg.category)}</div>
    </div></details>`);

    pg.products.forEach((p, i) => {
      const n = normalizeEAN(p.ean);
      H.push(`<details class="sec" id="sec-p${i}" ${i === 0 ? 'open' : ''}><summary>מוצר ${i + 1} <span class="badge" data-badge="${i}">${esc(p.title || '—')}</span></summary><div class="sec-body">
        ${check('הצג את המוצר בדף', `p.${i}.show`, p.show)}
        ${txt('כותרת המוצר (באדום)', `p.${i}.title`, p.title)}
        <div class="f"><label>תמונת המוצר</label>${imgField('p.' + i, p.img, { orig: !!p.orig })}</div>
        <div class="f2">${range('גודל תמונה (%)', `p.${i}.imgScale`, p.imgScale || 100, 40, 160)}${range('הזזה אנכית', `p.${i}.imgY`, p.imgY || 0, -120, 120)}</div>
        ${area('תיאור קצר (מתחת לתמונה)', `p.${i}.name`, p.name, 'אפשר לרדת שורה עם Enter – כמו בדוגמה (2 שורות)')}
        <div class="f2">${txt(esc(s.codeLabel || 'קוד פריט'), `p.${i}.code`, p.code, 'dir="ltr"')}${txt(esc(s.packLabel || 'אריזה'), `p.${i}.pack`, p.pack, 'dir="ltr"')}</div>
        <div class="f"><label for="${idOf(`p.${i}.ean`)}">ברקוד EAN-13 (12 ספרות – ספרת ביקורת תחושב, או 13 ספרות)</label>
          <input type="text" id="${idOf(`p.${i}.ean`)}" data-path="p.${i}.ean" value="${esc(p.ean)}" dir="ltr" inputmode="numeric" maxlength="13">
          <div class="ean-msg ${n.empty ? '' : n.ok ? 'ok' : 'bad'}" data-eanmsg="${i}">${esc(n.msg)}</div>
          <div class="imgbtns"><button class="small" data-fix="${i}">תקן ספרת ביקורת</button><button class="small" data-clearp="${i}">נקה מוצר</button></div>
        </div>
      </div></details>`);
    });

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
    if (key === 'ean') { v = String(v).replace(/\D/g, '').slice(0, 13); }
    obj[key] = v;
    const out = formPanel.querySelector(`[data-out="${path}"]`); if (out) out.textContent = v;
    if (key === 'title') { const b = formPanel.querySelector(`[data-badge="${path.split('.')[1]}"]`); if (b) b.textContent = v || '—'; }
    if (key === 'ean') {
      const i = path.split('.')[1], n = normalizeEAN(v), m = formPanel.querySelector(`[data-eanmsg="${i}"]`);
      m.textContent = n.msg; m.className = 'ean-msg ' + (n.empty ? '' : n.ok ? 'ok' : 'bad');
    }
    schedulePreview();
  });
  formPanel.addEventListener('change', e => {
    const k = e.target.dataset.path || '';
    if (k === 's.codeLabel' || k === 's.packLabel') renderForm();
  });
  formPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-act],[data-fix],[data-clearp]'); if (!b) return;
    e.preventDefault();
    if (b.dataset.fix !== undefined) {
      const p = page().products[+b.dataset.fix], n = normalizeEAN(p.ean);
      if (n.code) { p.ean = n.code; renderForm(); schedulePreview(); } else toast('יש להזין לפחות 12 ספרות', 'bad');
      return;
    }
    if (b.dataset.clearp !== undefined) {
      page().products[+b.dataset.clearp] = emptyProduct(); renderForm(); schedulePreview();
      toast('המוצר נוקה'); return;
    }
    const act = b.dataset.act;
    if (act === 'resetDesign') {
      const keep = { website: state.settings.website, logoFooter: state.settings.logoFooter, firstPage: state.settings.firstPage, codeLabel: state.settings.codeLabel, packLabel: state.settings.packLabel };
      state.settings = Object.assign(defaultSettings(), keep); renderForm(); schedulePreview(); return;
    }
    const key = b.closest('[data-imgkey]')?.dataset.imgkey; if (!key) return;
    imageAction(key, act);
  });
  // גרירת תמונה לשדה
  formPanel.addEventListener('dragover', e => { const t = e.target.closest('.thumb'); if (t) { e.preventDefault(); t.classList.add('drag'); } });
  formPanel.addEventListener('dragleave', e => { const t = e.target.closest('.thumb'); if (t) t.classList.remove('drag'); });
  formPanel.addEventListener('drop', e => {
    const t = e.target.closest('.thumb'); if (!t) return;
    e.preventDefault(); t.classList.remove('drag');
    const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (f) loadImageInto(t.closest('[data-imgkey]').dataset.imgkey, f);
  });
  // גרירת תמונה ישירות על מוצר בתצוגה המקדימה
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

  // ---------- תמונות ----------
  function imgRef(key) {
    if (key === 'logo') return { obj: page(), k: 'logo', logo: true };
    if (key === 'logoFooter') return { obj: state.settings, k: 'logoFooter', logo: true };
    const i = +key.split('.')[1];
    return { obj: page().products[i], k: 'img', logo: false };
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
      if (!r.logo) r.obj.orig = null;
      renderForm(); renderPreview(); scheduleSave();
    } catch (e) { console.error(e); toast('לא ניתן לטעון את התמונה', 'bad'); }
    finally { hideBusy(); }
  }

  async function imageAction(key, act) {
    const r = imgRef(key);
    if (act === 'pick') { pickKey = key; $('#fileInput').value = ''; $('#fileInput').click(); return; }
    if (act === 'clear') { r.obj[r.k] = null; if (!r.logo) r.obj.orig = null; renderForm(); schedulePreview(); return; }
    if (act === 'restore') { if (r.obj.orig) { r.obj[r.k] = r.obj.orig; r.obj.orig = null; renderForm(); schedulePreview(); } return; }
    const id = r.obj[r.k]; if (!id || !assets[id]) return;
    // לוגו – רקע שקוף; מוצר – "צריבה" על רקע לבן
    const srcId = (!r.logo && r.obj.orig && act !== 'trim') ? r.obj.orig : id;
    try {
      let canvas;
      if (act === 'bgFast') {
        showBusy('מסיר רקע…'); await new Promise(z => setTimeout(z, 30));
        canvas = floodRemove(toCanvas(await loadImg(assets[srcId])), tolerance);
      } else if (act === 'bgAI') {
        if (IN_VIEWER) throw new Error('בגרסת הקישור אין גישה לשרת המודל. הסרת רקע AI עובדת כשפותחים את index.html מהמחשב. כאן השתמשו ב"הסר רקע".');
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
      const url = r.logo ? trimmed(canvas, true).toDataURL('image/png') : flattenOnWhite(trimmed(canvas, true));
      if (!r.logo && !r.obj.orig) r.obj.orig = id;
      r.obj[r.k] = addAsset(url);
      renderForm(); renderPreview(); scheduleSave();
      toast(act === 'trim' ? 'השוליים נחתכו' : r.logo ? 'הרקע הוסר (שקוף)' : 'הרקע הוסר והתמונה נצרבה על רקע לבן', 'ok');
    } catch (e) {
      console.error(e);
      toast((act === 'bgAI' ? 'הסרת רקע AI נכשלה: ' : 'העיבוד נכשל: ') + (e && e.message || e), 'bad');
    } finally { hideBusy(); }
  }
  function toCanvas(img) { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c; }

  // הסרת רקע מהירה – מילוי הצפה מהשוליים לפי צבע הרקע הדומיננטי
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
    const a = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = bg[i] ? 0 : d[i * 4 + 3] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (a[i] === 0) { d[i * 4 + 3] = 0; continue; }
      let s = 0, c = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { s += a[yy * w + xx]; c++; }
      d[i * 4 + 3] = Math.round(Math.min(a[i], s / c * 1.15) * 255);
    }
    g.putImageData(im, 0, 0);
    return canvas;
  }
  // חיתוך לגבולות התוכן (לפי שקיפות או מרחק מלבן)
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

  // ---------- עמודים ----------
  function goPage(i) { cur = clamp(i, 0, state.pages.length - 1); renderForm(); renderPreview(); scheduleSave(); }
  $('#prevPage').onclick = () => goPage(cur - 1);
  $('#nextPage').onclick = () => goPage(cur + 1);
  $('#addPage').onclick = () => {
    const p = page();
    state.pages.splice(cur + 1, 0, { brand: p.brand, category: p.category, logo: p.logo, logoScale: p.logoScale, products: [0, 1, 2, 3].map(emptyProduct) });
    goPage(cur + 1); toast('נוסף עמוד חדש (עם אותו לוגו וכותרת)');
  };
  $('#dupPage').onclick = () => { state.pages.splice(cur + 1, 0, JSON.parse(JSON.stringify(page()))); goPage(cur + 1); toast('העמוד שוכפל'); };
  let delArmed = 0;
  $('#delPage').onclick = () => {
    if (state.pages.length < 2) return;
    if (Date.now() - delArmed > 3000) { delArmed = Date.now(); toast('לחצו שוב על "מחק עמוד" כדי לאשר מחיקה'); return; }
    delArmed = 0; state.pages.splice(cur, 1); goPage(Math.min(cur, state.pages.length - 1)); toast('העמוד נמחק');
  };

  // ---------- ייצוא ----------
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
  const fileBase = () => ('קטלוג ' + [page().brand, page().category].filter(Boolean).join(' ')).replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'catalog';
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
  $('#btnExportPdf').onclick = async () => {
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
  };

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
    state.pages.forEach(p => { p.products = [0, 1, 2, 3].map(i => Object.assign(emptyProduct(), (p.products || [])[i] || {})); });
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

  // שמירה אוטומטית בדפדפן
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

  window.__catalog = { get state() { return state; }, normalizeEAN, renderCanvas, goPage };
})();
