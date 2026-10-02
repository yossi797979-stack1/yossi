/* מעצב דף קטלוג A4 – עורך חופשי עם ייצוא PDF/JPG ב-150dpi */
(() => {
  'use strict';

  // ---------- קבועים ----------
  const PAGE_W = 794;            // A4 ב-96dpi (210 מ"מ)
  const PAGE_H = 1123;           // A4 ב-96dpi (297 מ"מ)
  const EXPORT_DPI = 150;
  const EXPORT_W = 1240;         // 210 מ"מ ב-150dpi
  const EXPORT_H = 1754;         // 297 מ"מ ב-150dpi
  const MAX_IMG = 2000;          // גודל מקסימלי לתמונה שנטענת (פיקסלים)
  const AI_BG_URLS = [
    'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm',
    'https://esm.sh/@imgly/background-removal@1.7.0',
  ];

  const FONTS = [
    ['Heebo', 'Heebo'], ['Assistant', 'Assistant'], ['Rubik', 'Rubik'],
    ['Frank Ruhl Libre', 'פרנק רוהל'], ['Secular One', 'Secular One'],
    ['Varela Round', 'Varela Round'], ['Roboto', 'Roboto'], ['Arial', 'Arial'],
  ];
  const TYPE_NAMES = { text: 'טקסט', image: 'תמונה', barcode: 'ברקוד', rect: 'צורה' };

  // ---------- מצב ----------
  let doc = blankDoc();
  const assets = {};             // assetId -> dataURL (לא נכנס להיסטוריה כדי לחסוך זיכרון)
  let selection = [];            // מזהי רכיבים נבחרים
  let zoom = 1;
  let history = [], future = [];
  let clipboard = null;
  let editingId = null;          // טקסט בעריכה ישירה
  let pendingImageTarget = null; // לאן תיכנס התמונה מבחירת הקובץ

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pageEl = $('#page'), overlayEl = $('#overlay'), stageEl = $('#stage');
  const nodes = new Map();       // id -> DOM node
  const barcodeCache = new Map();

  function blankDoc() {
    return { version: 1, page: { bg: '#ffffff', grid: false, snap: true, margins: false }, elements: [] };
  }
  const uid = (p = 'e') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const byId = id => doc.elements.find(e => e.id === id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = v => Math.round(v * 10) / 10;

  // ---------- ברירות מחדל לרכיבים ----------
  function makeEl(type, props = {}) {
    const base = { id: uid(), type, x: 100, y: 100, w: 200, h: 60, rot: 0, opacity: 1, locked: false, group: null, name: '' };
    const defs = {
      text: {
        text: 'טקסט חדש', font: 'Heebo', size: 20, color: '#1f2937', bold: false, italic: false, underline: false,
        align: 'right', valign: 'top', lineHeight: 1.25, letter: 0, dir: 'rtl',
        bg: '#ffffff', bgOn: false, radius: 0, pad: 0, borderW: 0, borderC: '#1f2937',
      },
      image: { asset: null, orig: null, fit: 'contain', bg: '#ffffff', bgOn: false, radius: 0, borderW: 0, borderC: '#d0d7e2', w: 200, h: 200 },
      barcode: { value: '729000000000', lineColor: '#000000', bg: '#ffffff', showText: true, fontSize: 18, w: 170, h: 80 },
      rect: { fill: '#e5e7eb', fillOn: true, stroke: '#9ca3af', strokeW: 0, radius: 0, w: 200, h: 120 },
    };
    return Object.assign(base, defs[type], props);
  }

  // ---------- תמונת מציין מקום ----------
  function placeholderImage(label = 'תמונת מוצר') {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 450;
    const g = c.getContext('2d');
    g.fillStyle = '#f3f5f8'; g.fillRect(0, 0, 600, 450);
    g.strokeStyle = '#c7cfdb'; g.lineWidth = 6; g.setLineDash([18, 12]); g.strokeRect(10, 10, 580, 430);
    g.setLineDash([]);
    g.fillStyle = '#b8c2d1';
    g.beginPath(); g.moveTo(170, 300); g.lineTo(260, 190); g.lineTo(330, 270); g.lineTo(380, 220); g.lineTo(440, 300); g.closePath(); g.fill();
    g.beginPath(); g.arc(390, 160, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7b8798'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText(label, 300, 360);
    g.font = '24px Arial'; g.fillText('לחיצה כפולה להחלפה', 300, 398);
    return c.toDataURL('image/png');
  }
  function addAsset(dataURL) { const id = uid('a'); assets[id] = dataURL; return id; }
  let PH_PRODUCT, PH_LOGO;
  function ensurePlaceholders() {
    if (!PH_PRODUCT || !assets[PH_PRODUCT]) { PH_PRODUCT = 'ph_product'; assets[PH_PRODUCT] = placeholderImage('תמונת מוצר'); }
    if (!PH_LOGO || !assets[PH_LOGO]) { PH_LOGO = 'ph_logo'; assets[PH_LOGO] = placeholderImage('הלוגו שלך'); }
  }

  // ---------- תבנית קטלוג ----------
  const SAMPLE = [
    ['מוצר לדוגמה 1', 'תיאור קצר של המוצר, חומר, מידות', '1001', '729001111111', '₪49.90'],
    ['מוצר לדוגמה 2', 'תיאור קצר של המוצר, חומר, מידות', '1002', '729001111112', '₪59.90'],
    ['מוצר לדוגמה 3', 'תיאור קצר של המוצר, חומר, מידות', '1003', '729001111113', '₪39.90'],
    ['מוצר לדוגמה 4', 'תיאור קצר של המוצר, חומר, מידות', '1004', '729001111114', '₪89.90'],
    ['מוצר לדוגמה 5', 'תיאור קצר של המוצר, חומר, מידות', '1005', '729001111115', '₪24.90'],
    ['מוצר לדוגמה 6', 'תיאור קצר של המוצר, חומר, מידות', '1006', '729001111116', '₪119.00'],
  ];

  function productCard(x, y, data = SAMPLE[0], w = 355, h = 290) {
    const g = uid('g');
    const [name, desc, sku, ean, price] = data;
    const pad = 12;
    return [
      makeEl('rect', { x, y, w, h, fill: '#ffffff', stroke: '#d6dde8', strokeW: 1.5, radius: 12, group: g, name: 'מסגרת כרטיס' }),
      makeEl('image', { x: x + pad, y: y + pad, w: w - pad * 2, h: 140, asset: PH_PRODUCT, fit: 'contain', radius: 8, group: g, name: 'תמונת מוצר' }),
      makeEl('text', { x: x + pad, y: y + 158, w: w - pad * 2, h: 28, text: name, size: 19, bold: true, color: '#0f2a4a', group: g, name: 'שם מוצר' }),
      makeEl('text', { x: x + pad, y: y + 187, w: w - pad * 2, h: 20, text: desc, size: 13, color: '#5b6573', group: g, name: 'תיאור' }),
      makeEl('text', { x: x + w - pad - 150, y: y + 214, w: 150, h: 20, text: 'מק"ט: ' + sku, size: 13, color: '#374151', group: g, name: 'מק"ט' }),
      makeEl('text', {
        x: x + w - pad - 120, y: y + 240, w: 120, h: 38, text: price, size: 22, bold: true, color: '#ffffff',
        bg: '#e63946', bgOn: true, radius: 19, align: 'center', valign: 'middle', dir: 'ltr', group: g, name: 'מחיר',
      }),
      makeEl('barcode', { x: x + pad, y: y + 208, w: 160, h: 72, value: ean.length === 12 ? ean + eanCheckDigit(ean) : ean, fontSize: 16, group: g, name: 'ברקוד' }),
    ];
  }

  function catalogTemplate() {
    ensurePlaceholders();
    const d = blankDoc();
    const els = d.elements;
    els.push(makeEl('rect', { x: 0, y: 0, w: PAGE_W, h: 135, fill: '#0f2a4a', radius: 0, name: 'פס כותרת' }));
    els.push(makeEl('rect', { x: 0, y: 135, w: PAGE_W, h: 6, fill: '#e63946', radius: 0, name: 'פס הדגשה' }));
    els.push(makeEl('image', { x: 614, y: 22, w: 150, h: 92, asset: PH_LOGO, fit: 'contain', bgOn: true, bg: '#ffffff', radius: 10, name: 'לוגו', isLogo: true }));
    els.push(makeEl('text', { x: 200, y: 26, w: 395, h: 50, text: 'קטלוג מוצרים 2026', size: 38, bold: true, font: 'Heebo', color: '#ffffff', name: 'כותרת' }));
    els.push(makeEl('text', { x: 200, y: 80, w: 395, h: 30, text: 'הקולקציה החדשה – איכות במחיר משתלם', size: 17, color: '#cfe0f5', name: 'כותרת משנה' }));
    els.push(makeEl('text', { x: 30, y: 46, w: 160, h: 44, text: 'עמוד 1', size: 15, color: '#ffffff', align: 'left', valign: 'middle', name: 'מספר עמוד' }));
    const cw = 355, ch = 290, mx = 30, top = 162, gap = 22;
    for (let i = 0; i < 6; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = col === 0 ? PAGE_W - mx - cw : mx;   // מימין לשמאל
      const y = top + row * (ch + gap);
      els.push(...productCard(x, y, SAMPLE[i], cw, ch));
    }
    els.push(makeEl('rect', { x: 0, y: 1073, w: PAGE_W, h: 50, fill: '#0f2a4a', radius: 0, name: 'פס תחתון' }));
    els.push(makeEl('text', {
      x: 30, y: 1080, w: PAGE_W - 60, h: 36, text: 'שם החברה  |  טלפון: 03-0000000  |  www.example.co.il  |  info@example.co.il',
      size: 14, color: '#ffffff', align: 'center', valign: 'middle', name: 'פרטי קשר',
    }));
    return d;
  }

  // ---------- היסטוריה ----------
  const snapshot = () => JSON.stringify(doc);
  function commit() {
    history.push(lastSnap);
    if (history.length > 100) history.shift();
    future = [];
    lastSnap = snapshot();
    scheduleSave();
    updateUndoButtons();
  }
  let lastSnap = snapshot();
  function undo() {
    if (!history.length) return;
    finishEditing(false);
    future.push(snapshot());
    doc = JSON.parse(history.pop());
    lastSnap = snapshot();
    selection = selection.filter(id => byId(id));
    renderAll(); scheduleSave(); updateUndoButtons();
  }
  function redo() {
    if (!future.length) return;
    finishEditing(false);
    history.push(snapshot());
    doc = JSON.parse(future.pop());
    lastSnap = snapshot();
    selection = selection.filter(id => byId(id));
    renderAll(); scheduleSave(); updateUndoButtons();
  }
  function updateUndoButtons() {
    $('#btnUndo').disabled = !history.length;
    $('#btnRedo').disabled = !future.length;
  }

  // ---------- ברקוד EAN-13 ----------
  function eanCheckDigit(d12) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += (+d12[i]) * (i % 2 ? 3 : 1);
    return (10 - (s % 10)) % 10;
  }
  // מחזיר {ok, code, msg}
  function normalizeEAN(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 12) return { ok: true, code: d + eanCheckDigit(d), msg: 'ספרת ביקורת חושבה אוטומטית: ' + eanCheckDigit(d) };
    if (d.length === 13) {
      const c = eanCheckDigit(d.slice(0, 12));
      if (c === +d[12]) return { ok: true, code: d, msg: 'ברקוד תקין ✓' };
      return { ok: false, code: d.slice(0, 12) + c, msg: 'ספרת ביקורת שגויה – הנכונה היא ' + c };
    }
    return { ok: false, code: null, msg: 'יש להזין 12 או 13 ספרות (הוזנו ' + d.length + ')' };
  }
  function barcodeDataURL(el) {
    const key = [el.value, el.lineColor, el.bg, el.showText, el.fontSize, Math.round(el.w), Math.round(el.h)].join('|');
    if (barcodeCache.has(key)) return barcodeCache.get(key);
    const n = normalizeEAN(el.value);
    const c = document.createElement('canvas');
    let url;
    if (!n.ok) {
      c.width = Math.max(1, Math.round(el.w * 3)); c.height = Math.max(1, Math.round(el.h * 3));
      const g = c.getContext('2d');
      g.fillStyle = '#fff4f4'; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#dc2626'; g.lineWidth = 4; g.strokeRect(2, 2, c.width - 4, c.height - 4);
      g.fillStyle = '#dc2626'; g.font = 'bold ' + Math.round(c.height / 5) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ברקוד לא תקין', c.width / 2, c.height / 2);
      url = c.toDataURL();
    } else {
      // רינדור ברזולוציה גבוהה, כך שיחס הגובה/רוחב יתאים בדיוק לתיבה
      const module = 6;
      const fontSize = el.showText ? Math.round(el.fontSize * module / 1.6) : 0;
      const base = { format: 'EAN13', width: module, margin: module * 2, marginTop: module, marginBottom: module,
        displayValue: !!el.showText, fontSize, textMargin: Math.round(module * 0.6), font: 'Arial',
        lineColor: el.lineColor, background: el.bg, flat: false };
      try {
        JsBarcode(c, n.code, Object.assign({}, base, { height: 100 }));
        const totalW = c.width;
        const extra = c.height - 100;
        const wantH = totalW * (el.h / el.w);
        const barH = Math.max(10, Math.round(wantH - extra));
        JsBarcode(c, n.code, Object.assign({}, base, { height: barH }));
        url = c.toDataURL('image/png');
      } catch (err) {
        console.error(err);
        url = placeholderImage('שגיאת ברקוד');
      }
    }
    if (barcodeCache.size > 200) barcodeCache.clear();
    barcodeCache.set(key, url);
    return url;
  }

  // ---------- רינדור ----------
  function applyCommon(node, el, z) {
    Object.assign(node.style, {
      left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h + 'px',
      transform: el.rot ? `rotate(${el.rot}deg)` : '', opacity: el.opacity, zIndex: z,
    });
    node.classList.toggle('locked', !!el.locked);
  }

  function renderNode(el, z) {
    let node = nodes.get(el.id);
    if (!node || node.dataset.type !== el.type) {
      if (node) node.remove();
      node = document.createElement('div');
      node.className = 'el el-' + el.type;
      node.dataset.id = el.id;
      node.dataset.type = el.type;
      if (el.type === 'text') { const t = document.createElement('div'); t.className = 'txt'; node.appendChild(t); }
      if (el.type === 'image' || el.type === 'barcode') { const i = document.createElement('img'); i.alt = ''; i.draggable = false; node.appendChild(i); }
      nodes.set(el.id, node);
    }
    applyCommon(node, el, z);
    const s = node.style;
    if (el.type === 'text') {
      const t = node.firstChild;
      if (editingId !== el.id && t.innerText !== el.text) t.innerText = el.text;
      s.justifyContent = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign] || 'flex-start';
      s.background = el.bgOn ? el.bg : 'transparent';
      s.borderRadius = el.radius + 'px';
      s.padding = el.pad + 'px';
      s.border = el.borderW ? `${el.borderW}px solid ${el.borderC}` : 'none';
      Object.assign(t.style, {
        fontFamily: `"${el.font}", Arial, sans-serif`, fontSize: el.size + 'px', color: el.color,
        fontWeight: el.bold ? '700' : '400', fontStyle: el.italic ? 'italic' : 'normal',
        textDecoration: el.underline ? 'underline' : 'none', textAlign: el.align,
        lineHeight: el.lineHeight, letterSpacing: el.letter + 'px', direction: el.dir,
      });
    } else if (el.type === 'image') {
      const img = node.firstChild;
      const src = assets[el.asset] || '';
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.style.objectFit = el.fit;
      s.background = el.bgOn ? el.bg : 'transparent';
      s.borderRadius = el.radius + 'px';
      s.border = el.borderW ? `${el.borderW}px solid ${el.borderC}` : 'none';
    } else if (el.type === 'barcode') {
      const img = node.firstChild;
      const src = barcodeDataURL(el);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.style.objectFit = 'fill';
      s.background = el.bg;
    } else if (el.type === 'rect') {
      s.background = el.fillOn ? el.fill : 'transparent';
      s.border = el.strokeW ? `${el.strokeW}px solid ${el.stroke}` : 'none';
      s.borderRadius = el.radius + 'px';
    }
    return node;
  }

  function renderAll() {
    ensurePlaceholders();
    const seen = new Set();
    doc.elements.forEach((el, i) => {
      const node = renderNode(el, i + 1);
      seen.add(el.id);
      if (node.parentNode !== pageEl) pageEl.appendChild(node);
    });
    for (const [id, node] of nodes) if (!seen.has(id)) { node.remove(); nodes.delete(id); }
    pageEl.style.backgroundColor = doc.page.bg;
    pageEl.classList.toggle('grid', !!doc.page.grid);
    pageEl.classList.toggle('margins', !!doc.page.margins);
    $('#pageBg').value = doc.page.bg;
    $('#pageGrid').checked = !!doc.page.grid;
    $('#pageSnap').checked = !!doc.page.snap;
    $('#pageMargins').checked = !!doc.page.margins;
    renderOverlay();
    renderLayers();
    renderProps();
  }
  function renderEls(ids) {
    ids.forEach(id => { const el = byId(id); if (el) renderNode(el, doc.elements.indexOf(el) + 1); });
    renderOverlay();
  }

  // ---------- שכבת בחירה ----------
  function selectionBounds(ids) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ids.forEach(id => { const e = byId(id); if (!e) return; x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const HANDLE_POS = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
  const HANDLE_CUR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

  function renderOverlay() {
    overlayEl.innerHTML = '';
    if (!selection.length) return;
    const isGroup = selection.length > 1 && isWholeGroup(selection);
    selection.forEach(id => {
      const e = byId(id); if (!e) return;
      if (selection.length > 1) {
        const b = document.createElement('div');
        b.className = 'selbox multi';
        Object.assign(b.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px', transform: e.rot ? `rotate(${e.rot}deg)` : '', opacity: .5 });
        overlayEl.appendChild(b);
      }
    });
    const b = selection.length === 1 ? byId(selection[0]) : selectionBounds(selection);
    if (!b) return;
    const box = document.createElement('div');
    box.className = 'selbox' + (isGroup ? ' group' : '');
    Object.assign(box.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', transform: b.rot ? `rotate(${b.rot}deg)` : '' });
    const locked = selection.some(id => byId(id)?.locked);
    if (!locked) {
      HANDLES.forEach(h => {
        const hd = document.createElement('div');
        hd.className = 'handle';
        hd.dataset.handle = h;
        hd.style.left = (HANDLE_POS[h][0] * 100) + '%';
        hd.style.top = (HANDLE_POS[h][1] * 100) + '%';
        hd.style.cursor = HANDLE_CUR[h];
        const sz = 10 / zoom;
        hd.style.width = hd.style.height = sz + 'px';
        hd.style.margin = `${-sz / 2}px 0 0 ${-sz / 2}px`;
        box.appendChild(hd);
      });
    }
    box.style.borderWidth = (1.5 / zoom) + 'px';
    overlayEl.appendChild(box);
  }
  function isWholeGroup(ids) {
    const g = byId(ids[0])?.group;
    if (!g) return false;
    const members = doc.elements.filter(e => e.group === g).map(e => e.id);
    return members.length === ids.length && members.every(id => ids.includes(id));
  }

  // ---------- רשימת שכבות ----------
  function elLabel(e) {
    if (e.name) return e.name;
    if (e.type === 'text') return e.text.split('\n')[0].slice(0, 30) || 'טקסט';
    if (e.type === 'barcode') return 'ברקוד ' + e.value;
    return TYPE_NAMES[e.type];
  }
  function renderLayers() {
    const ul = $('#layers');
    ul.innerHTML = '';
    [...doc.elements].reverse().forEach(e => {
      const li = document.createElement('li');
      li.className = selection.includes(e.id) ? 'sel' : '';
      li.innerHTML = `<span class="ln"></span><span class="lt"></span>`;
      li.querySelector('.ln').textContent = (e.locked ? '🔒 ' : '') + elLabel(e);
      li.querySelector('.lt').textContent = TYPE_NAMES[e.type] + (e.group ? ' · קבוצה' : '');
      li.onclick = ev => { select(ev.shiftKey ? toggleIn(selection, e.id) : [e.id]); };
      ul.appendChild(li);
    });
  }
  const toggleIn = (arr, id) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  function select(ids) {
    finishEditing();
    selection = ids.filter(id => byId(id));
    renderOverlay(); renderLayers(); renderProps();
  }

  // ---------- לוח מאפיינים ----------
  function renderProps() {
    const host = $('#props');
    if (editingId) return; // לא לרנדר מחדש בזמן עריכה
    host.innerHTML = '';
    if (!selection.length) {
      host.innerHTML = `<h3>מאפיינים</h3><div class="props-empty">בחרו רכיב בדף כדי לערוך אותו.<br>
        כל רכיב ניתן להזזה, שינוי גודל, סיבוב, צבע, גופן ועוד.<br><br>
        <b>טיפ:</b> לחיצה על כרטיס מוצר בוחרת את כל הכרטיס; לחיצה כפולה בוחרת רכיב בודד בתוכו.</div>`;
      return;
    }
    const els = selection.map(byId).filter(Boolean);
    const one = els.length === 1 ? els[0] : null;
    const H = [];
    H.push(`<h3>${one ? 'מאפייני ' + TYPE_NAMES[one.type] : 'בחירה מרובה (' + els.length + ')'}</h3>`);

    if (one) {
      H.push(`<div class="field"><label>שם הרכיב</label><input type="text" data-p="name" value="${esc(one.name || '')}" placeholder="${esc(elLabel(one))}"></div>`);
      H.push(`<div class="grid2">
        ${num('X', 'x', one.x)}${num('Y', 'y', one.y)}${num('רוחב', 'w', one.w, 1)}${num('גובה', 'h', one.h, 1)}
        ${num('סיבוב (°)', 'rot', one.rot, -360, 360)}${num('שקיפות (%)', 'opacity', Math.round(one.opacity * 100), 0, 100)}
      </div>`);
    }

    if (one && one.type === 'text') {
      H.push(`<h3>טקסט</h3>
        <div class="field"><textarea data-p="text" dir="${one.dir}">${esc(one.text)}</textarea></div>
        <div class="grid2">
          <div class="field"><label>גופן</label><select data-p="font">${FONTS.map(([v, l]) => `<option value="${v}" ${v === one.font ? 'selected' : ''} style="font-family:'${v}'">${l}</option>`).join('')}</select></div>
          ${num('גודל', 'size', one.size, 4, 400)}
        </div>
        <div class="colorrow field"><label>צבע <input type="color" data-p="color" value="${one.color}"></label>
          <div class="seg" style="flex:1">
            ${tog('bold', '<b>B</b>', one.bold)}${tog('italic', '<i>I</i>', one.italic)}${tog('underline', '<u>U</u>', one.underline)}
          </div></div>
        <div class="field"><label>יישור אופקי</label><div class="seg">
          ${seg('align', [['right', 'ימין'], ['center', 'מרכז'], ['left', 'שמאל'], ['justify', 'מיושר']], one.align)}</div></div>
        <div class="field"><label>יישור אנכי</label><div class="seg">
          ${seg('valign', [['top', 'למעלה'], ['middle', 'אמצע'], ['bottom', 'למטה']], one.valign)}</div></div>
        <div class="field"><label>כיוון</label><div class="seg">${seg('dir', [['rtl', 'ימין←שמאל'], ['ltr', 'שמאל→ימין']], one.dir)}</div></div>
        <div class="grid2">${num('גובה שורה', 'lineHeight', one.lineHeight, 0.5, 4, 0.05)}${num('ריווח אותיות', 'letter', one.letter, -10, 50, 0.5)}</div>
        <h3>רקע ומסגרת לטקסט</h3>
        <div class="colorrow field"><label><input type="checkbox" data-p="bgOn" ${one.bgOn ? 'checked' : ''}> רקע</label><input type="color" data-p="bg" value="${one.bg}">
          <label>מסגרת <input type="color" data-p="borderC" value="${one.borderC}"></label></div>
        <div class="grid2">${num('ריפוד', 'pad', one.pad, 0, 200)}${num('עיגול פינות', 'radius', one.radius, 0, 500)}${num('עובי מסגרת', 'borderW', one.borderW, 0, 50)}</div>`);
    }

    if (one && one.type === 'image') {
      H.push(`<h3>תמונה</h3>
        <div class="btns"><button data-act="replaceImage">📂 החלף תמונה</button></div>
        <div class="field"><label>התאמה למסגרת</label><div class="seg">
          ${seg('fit', [['contain', 'הכל בפנים'], ['cover', 'מילוי וחיתוך'], ['fill', 'מתיחה']], one.fit)}</div></div>
        <h3>הסרת רקע ← רקע לבן</h3>
        <div class="hint">מסיר את רקע התמונה ו"צורב" אותה על רקע לבן נקי.</div>
        <div class="field"><label>רגישות (להסרה מהירה): <span id="tolVal">${toleranceVal}</span></label>
          <input type="range" id="tol" min="5" max="120" value="${toleranceVal}"></div>
        <label class="row"><span>חיתוך אוטומטי לגבולות המוצר</span><input type="checkbox" id="autoTrim" ${autoTrim ? 'checked' : ''}></label>
        <div class="btns">
          <button data-act="bgFast" class="primary">⚡ הסרת רקע מהירה</button>
          <button data-act="bgAI" class="primary">✨ הסרת רקע AI</button>
        </div>
        <div class="btns"><button data-act="trim">✂️ חתוך שוליים לבנים</button>
          ${one.orig ? '<button data-act="restore">↺ שחזר מקור</button>' : ''}</div>
        <div class="hint">מהירה – מתאימה לרקע אחיד (לבן/אפור/צבע אחד). AI – לכל רקע, טוענת מודל בפעם הראשונה (דורש אינטרנט).</div>
        <h3>רקע ומסגרת לתמונה</h3>
        <div class="colorrow field"><label><input type="checkbox" data-p="bgOn" ${one.bgOn ? 'checked' : ''}> רקע</label><input type="color" data-p="bg" value="${one.bg}">
          <label>מסגרת <input type="color" data-p="borderC" value="${one.borderC}"></label></div>
        <div class="grid2">${num('עיגול פינות', 'radius', one.radius, 0, 500)}${num('עובי מסגרת', 'borderW', one.borderW, 0, 50)}</div>
        <div class="btns"><button data-act="naturalSize">יחס מקורי של התמונה</button></div>`);
    }

    if (one && one.type === 'barcode') {
      const n = normalizeEAN(one.value);
      H.push(`<h3>ברקוד EAN-13</h3>
        <div class="field"><label>מספר הברקוד (12 ספרות – ספרת ביקורת תחושב, או 13 ספרות)</label>
          <input type="text" data-p="value" value="${esc(one.value)}" inputmode="numeric" dir="ltr" maxlength="13"></div>
        <div class="hint" id="eanMsg"><span class="${n.ok ? 'ok' : 'err'}">${esc(n.msg)}</span>${n.code ? '<br>ברקוד מלא: <b dir="ltr">' + n.code + '</b>' : ''}</div>
        ${!n.ok && n.code ? '<div class="btns"><button data-act="fixEan">תקן ספרת ביקורת</button></div>' : ''}
        <div class="btns"><button data-act="randomEan">צור ברקוד אקראי (729…)</button></div>
        <div class="colorrow field"><label>פסים <input type="color" data-p="lineColor" value="${one.lineColor}"></label>
          <label>רקע <input type="color" data-p="bg" value="${one.bg}"></label></div>
        <label class="row"><span>הצג ספרות מתחת לברקוד</span><input type="checkbox" data-p="showText" ${one.showText ? 'checked' : ''}></label>
        <div class="grid2">${num('גודל ספרות', 'fontSize', one.fontSize, 6, 60)}</div>
        <div class="hint">טיפ: להדפסה וסריקה תקינה מומלץ רוחב של לפחות 140px ופסים כהים על רקע בהיר.</div>`);
    }

    if (one && one.type === 'rect') {
      H.push(`<h3>צורה</h3>
        <div class="colorrow field"><label><input type="checkbox" data-p="fillOn" ${one.fillOn ? 'checked' : ''}> מילוי</label><input type="color" data-p="fill" value="${one.fill}">
          <label>מסגרת <input type="color" data-p="stroke" value="${one.stroke}"></label></div>
        <div class="grid2">${num('עובי מסגרת', 'strokeW', one.strokeW, 0, 100)}${num('עיגול פינות', 'radius', one.radius, 0, 1000)}</div>`);
    }

    if (!one) {
      // עריכה משותפת לבחירה מרובה
      const texts = els.filter(e => e.type === 'text');
      H.push(`<div class="grid2">${num('X', 'x', Math.round(selectionBounds(selection).x))}${num('Y', 'y', Math.round(selectionBounds(selection).y))}</div>`);
      if (texts.length) {
        H.push(`<h3>כל הטקסטים בבחירה (${texts.length})</h3>
        <div class="grid2"><div class="field"><label>גופן</label><select data-multi="font"><option value="">—</option>${FONTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="field"><label>צבע</label><input type="color" data-multi="color" value="${texts[0].color}"></div></div>`);
      }
    }

    H.push(`<h3>סידור</h3>
      <div class="field"><label>יישור ביחס לדף</label><div class="grid3">
        <button data-align="right">⇥ ימין</button><button data-align="hcenter">↔ מרכז</button><button data-align="left">⇤ שמאל</button>
        <button data-align="top">⤒ למעלה</button><button data-align="vcenter">↕ אמצע</button><button data-align="bottom">⤓ למטה</button>
      </div></div>
      <div class="grid2" style="margin-top:6px">
        <button data-act="front">הבא לחזית</button><button data-act="back">שלח לרקע</button>
        <button data-act="forward">קדימה שכבה</button><button data-act="backward">אחורה שכבה</button>
      </div>
      <div class="btns" style="margin-top:8px">
        ${els.length > 1 ? '<button data-act="group">🔗 קבץ</button>' : ''}
        ${els.some(e => e.group) ? '<button data-act="ungroup">⛓️ פרק קבוצה</button>' : ''}
        ${one && one.group ? '<button data-act="selectGroup">בחר את כל הקבוצה</button>' : ''}
        <button data-act="lock">${els.every(e => e.locked) ? '🔓 שחרר נעילה' : '🔒 נעל'}</button>
        <button data-act="duplicate">⧉ שכפל</button>
        <button data-act="delete" class="danger">🗑️ מחק</button>
      </div>`);
    host.innerHTML = H.join('');
  }
  let toleranceVal = 38, autoTrim = true;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (label, p, v, min = -5000, max = 5000, step = 1) =>
    `<div class="field"><label>${label}</label><input type="number" data-p="${p}" value="${round(v)}" min="${min}" max="${max}" step="${step}"></div>`;
  const tog = (p, label, on) => `<button data-toggle="${p}" class="${on ? 'active' : ''}">${label}</button>`;
  const seg = (p, opts, cur) => opts.map(([v, l]) => `<button data-set="${p}" data-v="${v}" class="${v === cur ? 'active' : ''}">${l}</button>`).join('');

  // אירועי לוח המאפיינים
  const propsHost = $('#props');
  let propTimer = null;
  function setProp(p, raw, live) {
    const one = selection.length === 1 ? byId(selection[0]) : null;
    if (!one) {
      if (p === 'x' || p === 'y') {
        const b = selectionBounds(selection), d = (+raw || 0) - b[p];
        selection.forEach(id => { const e = byId(id); if (!e.locked) e[p] += d; });
      }
    } else {
      let v = raw;
      const cur = one[p];
      if (typeof cur === 'number' || ['x', 'y', 'w', 'h', 'rot', 'opacity'].includes(p)) {
        v = parseFloat(raw); if (isNaN(v)) return;
        if (p === 'opacity') v = clamp(v, 0, 100) / 100;
        if (p === 'w' || p === 'h') v = Math.max(1, v);
      }
      if (p === 'value') v = String(raw).replace(/\D/g, '').slice(0, 13);
      one[p] = v;
    }
    renderEls(selection);
    renderLayers();
    if (!live) { commit(); }
    else { clearTimeout(propTimer); propTimer = setTimeout(commit, 500); }
    if (p === 'value') updateEanMsg(one);
  }
  function updateEanMsg(el) {
    const m = $('#eanMsg'); if (!m) return;
    const n = normalizeEAN(el.value);
    m.innerHTML = `<span class="${n.ok ? 'ok' : 'err'}">${esc(n.msg)}</span>${n.code ? '<br>ברקוד מלא: <b dir="ltr">' + n.code + '</b>' : ''}`;
  }
  propsHost.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'tol') { toleranceVal = +t.value; $('#tolVal').textContent = t.value; return; }
    if (t.dataset.p) {
      const v = t.type === 'checkbox' ? t.checked : t.value;
      setProp(t.dataset.p, v, t.type !== 'checkbox');
    }
    if (t.dataset.multi) {
      if (!t.value) return;
      selection.map(byId).filter(x => x.type === 'text').forEach(x => x[t.dataset.multi] = t.value);
      renderEls(selection); clearTimeout(propTimer); propTimer = setTimeout(commit, 400);
    }
  });
  propsHost.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'autoTrim') autoTrim = t.checked;
    if (t.dataset.p && t.type !== 'checkbox') { clearTimeout(propTimer); if (snapshot() !== lastSnap) commit(); renderOverlay(); }
  });
  propsHost.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const one = selection.length === 1 ? byId(selection[0]) : null;
    if (b.dataset.toggle && one) { one[b.dataset.toggle] = !one[b.dataset.toggle]; renderEls(selection); commit(); renderProps(); }
    if (b.dataset.set && one) { one[b.dataset.set] = b.dataset.v; renderEls(selection); commit(); renderProps(); }
    if (b.dataset.align) alignToPage(b.dataset.align);
    if (b.dataset.act) action(b.dataset.act, one);
  });

  function action(act, one) {
    switch (act) {
      case 'delete': deleteSelection(); break;
      case 'duplicate': duplicateSelection(); break;
      case 'front': case 'back': case 'forward': case 'backward': reorder(act); break;
      case 'lock': {
        const all = selection.every(id => byId(id).locked);
        selection.forEach(id => byId(id).locked = !all); commit(); renderAll(); break;
      }
      case 'group': { const g = uid('g'); selection.forEach(id => byId(id).group = g); commit(); renderAll(); break; }
      case 'ungroup': {
        const gs = new Set(selection.map(id => byId(id).group).filter(Boolean));
        doc.elements.forEach(e => { if (gs.has(e.group)) e.group = null; }); commit(); renderAll(); break;
      }
      case 'selectGroup': select(groupMembers(one.id)); break;
      case 'replaceImage': pickImage({ replace: one.id }); break;
      case 'bgFast': processImage(one, 'fast'); break;
      case 'bgAI': processImage(one, 'ai'); break;
      case 'trim': processImage(one, 'trim'); break;
      case 'restore': if (one.orig) { one.asset = one.orig; one.orig = null; commit(); renderAll(); } break;
      case 'naturalSize': {
        const img = new Image();
        img.onload = () => { one.h = Math.round(one.w * img.naturalHeight / img.naturalWidth); commit(); renderAll(); };
        img.src = assets[one.asset]; break;
      }
      case 'fixEan': { const n = normalizeEAN(one.value); one.value = n.code; commit(); renderAll(); break; }
      case 'randomEan': {
        let d = '729'; for (let i = 0; i < 9; i++) d += Math.floor(Math.random() * 10);
        one.value = d + eanCheckDigit(d); commit(); renderAll(); break;
      }
    }
  }

  function alignToPage(how) {
    const movable = selection.filter(id => !byId(id).locked);
    if (!movable.length) return;
    const b = selectionBounds(movable);
    let dx = 0, dy = 0;
    if (how === 'left') dx = -b.x;
    if (how === 'right') dx = PAGE_W - (b.x + b.w);
    if (how === 'hcenter') dx = (PAGE_W - b.w) / 2 - b.x;
    if (how === 'top') dy = -b.y;
    if (how === 'bottom') dy = PAGE_H - (b.y + b.h);
    if (how === 'vcenter') dy = (PAGE_H - b.h) / 2 - b.y;
    movable.forEach(id => { const e = byId(id); e.x = round(e.x + dx); e.y = round(e.y + dy); });
    commit(); renderAll();
  }

  function reorder(how) {
    const sel = doc.elements.filter(e => selection.includes(e.id));
    const rest = doc.elements.filter(e => !selection.includes(e.id));
    if (how === 'front') doc.elements = [...rest, ...sel];
    else if (how === 'back') doc.elements = [...sel, ...rest];
    else {
      const arr = doc.elements;
      const idxs = sel.map(e => arr.indexOf(e));
      if (how === 'forward') {
        for (let i = idxs.length - 1; i >= 0; i--) { const k = idxs[i]; if (k < arr.length - 1 && !selection.includes(arr[k + 1].id)) [arr[k], arr[k + 1]] = [arr[k + 1], arr[k]]; }
      } else {
        for (let i = 0; i < idxs.length; i++) { const k = idxs[i]; if (k > 0 && !selection.includes(arr[k - 1].id)) [arr[k], arr[k - 1]] = [arr[k - 1], arr[k]]; }
      }
    }
    commit(); renderAll();
  }

  function deleteSelection() {
    if (!selection.length) return;
    doc.elements = doc.elements.filter(e => !selection.includes(e.id));
    selection = []; commit(); renderAll();
  }
  function cloneEls(list, dx = 15, dy = 15) {
    const gmap = {};
    return list.map(e => {
      const c = JSON.parse(JSON.stringify(e));
      c.id = uid(); c.x += dx; c.y += dy;
      if (c.group) c.group = gmap[c.group] || (gmap[c.group] = uid('g'));
      return c;
    });
  }
  function duplicateSelection() {
    if (!selection.length) return;
    const src = doc.elements.filter(e => selection.includes(e.id));
    const copies = cloneEls(src);
    doc.elements.push(...copies);
    selection = copies.map(c => c.id); commit(); renderAll();
  }
  const groupMembers = id => { const e = byId(id); return e && e.group ? doc.elements.filter(x => x.group === e.group).map(x => x.id) : [id]; };

  // ---------- הוספת רכיבים ----------
  function addElements(list, selectThem = true) {
    doc.elements.push(...list);
    if (selectThem) selection = list.map(e => e.id);
    commit(); renderAll();
  }
  function freeSpot(w, h) {
    // מיקום במרכז האזור הנראה של הדף
    const ws = $('#workspace'), r = stageEl.getBoundingClientRect(), wr = ws.getBoundingClientRect();
    const cx = ((wr.left + wr.width / 2) - r.left) / zoom, cy = ((wr.top + wr.height / 2) - r.top) / zoom;
    return { x: Math.round(clamp(cx - w / 2, 0, PAGE_W - w)), y: Math.round(clamp(cy - h / 2, 0, PAGE_H - h)) };
  }
  $$('[data-add]').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.add;
    ensurePlaceholders();
    if (t === 'text') { const p = freeSpot(260, 40); addElements([makeEl('text', { ...p, w: 260, h: 40 })]); }
    if (t === 'rect') { const p = freeSpot(200, 120); addElements([makeEl('rect', { ...p })]); }
    if (t === 'line') { const p = freeSpot(300, 3); addElements([makeEl('rect', { ...p, w: 300, h: 3, fill: '#0f2a4a', name: 'קו' })]); }
    if (t === 'barcode') {
      let d = '729'; for (let i = 0; i < 9; i++) d += Math.floor(Math.random() * 10);
      const p = freeSpot(170, 80); addElements([makeEl('barcode', { ...p, value: d + eanCheckDigit(d) })]);
    }
    if (t === 'image') pickImage({ add: 'image' });
    if (t === 'logo') pickImage({ add: 'logo' });
    if (t === 'product') { const p = freeSpot(355, 290); addElements(productCard(p.x, p.y, SAMPLE[0])); }
  }));

  // ---------- טעינת תמונות ----------
  function pickImage(target) { pendingImageTarget = target; $('#fileInput').value = ''; $('#fileInput').click(); }
  $('#fileInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    await placeImageFile(f, pendingImageTarget);
    pendingImageTarget = null;
  });

  function fileToDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  // מקטין תמונות גדולות ושומר על שקיפות אם קיימת
  async function normalizeImage(dataURL) {
    const img = await loadImage(dataURL);
    let w = img.naturalWidth, h = img.naturalHeight;
    const s = Math.min(1, MAX_IMG / Math.max(w, h));
    w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    let alpha = false; for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) { alpha = true; break; }
    return { url: alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.93), w, h };
  }

  async function placeImageFile(file, target = { add: 'image' }, at = null) {
    if (!file || !file.type.startsWith('image/')) return;
    showBusy('טוען תמונה…');
    try {
      const n = await normalizeImage(await fileToDataURL(file));
      const asset = addAsset(n.url);
      if (target && target.replace) {
        const el = byId(target.replace);
        if (el) { el.asset = asset; el.orig = null; selection = [el.id]; commit(); renderAll(); }
      } else if (target && target.add === 'logo') {
        const old = doc.elements.find(e => e.isLogo);
        if (old) { old.asset = asset; old.orig = null; selection = [old.id]; commit(); renderAll(); }
        else {
          const h = 90, w = Math.round(clamp(h * n.w / n.h, 40, 300));
          addElements([makeEl('image', { x: PAGE_W - w - 30, y: 22, w, h, asset, name: 'לוגו', isLogo: true })]);
        }
      } else {
        let w = 260, h = Math.round(w * n.h / n.w);
        if (h > 400) { h = 400; w = Math.round(h * n.w / n.h); }
        const p = at ? { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2) } : freeSpot(w, h);
        addElements([makeEl('image', { ...p, w, h, asset })]);
      }
    } catch (err) {
      console.error(err); toast('לא ניתן לטעון את התמונה');
    } finally { hideBusy(); }
  }

  // גרירת קבצים לדף
  const ws = $('#workspace');
  ws.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); ws.classList.add('dropping'); } });
  ws.addEventListener('dragleave', e => { if (e.target === ws || !ws.contains(e.relatedTarget)) ws.classList.remove('dropping'); });
  ws.addEventListener('drop', e => {
    ws.classList.remove('dropping');
    const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    const pt = toPage(e.clientX, e.clientY);
    const hit = e.target.closest && e.target.closest('.el-image');
    if (hit) placeImageFile(f, { replace: hit.dataset.id });
    else placeImageFile(f, { add: 'image' }, pt);
  });
  // הדבקת תמונה מהלוח
  document.addEventListener('paste', e => {
    if (isTyping()) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      const one = selection.length === 1 && byId(selection[0]);
      placeImageFile(item.getAsFile(), one && one.type === 'image' ? { replace: one.id } : { add: 'image' });
    }
  });

  // ---------- הסרת רקע ----------
  function imageToCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }

  // הסרת רקע מהירה – מילוי הצפה מהשוליים לפי דמיון צבע, עם ריכוך קצוות
  function floodRemove(canvas, tol) {
    const w = canvas.width, h = canvas.height, g = canvas.getContext('2d');
    const im = g.getImageData(0, 0, w, h), d = im.data;
    const N = w * h;
    // צבע רקע דומיננטי – חציון של פיקסלי השוליים
    const rs = [], gs = [], bs = [];
    const pushPx = i => { if (d[i * 4 + 3] > 10) { rs.push(d[i * 4]); gs.push(d[i * 4 + 1]); bs.push(d[i * 4 + 2]); } };
    for (let x = 0; x < w; x++) { pushPx(x); pushPx((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { pushPx(y * w); pushPx(y * w + w - 1); }
    const med = a => { if (!a.length) return 255; a.sort((p, q) => p - q); return a[a.length >> 1]; };
    const ref = [med(rs), med(gs), med(bs)];
    const dist = (i, c) => { const r = d[i * 4] - c[0], gg = d[i * 4 + 1] - c[1], b = d[i * 4 + 2] - c[2]; return Math.sqrt(r * r * 0.9 + gg * gg * 1.2 + b * b * 0.9); };
    const dist2 = (i, j) => { const r = d[i * 4] - d[j * 4], gg = d[i * 4 + 1] - d[j * 4 + 1], b = d[i * 4 + 2] - d[j * 4 + 2]; return Math.sqrt(r * r + gg * gg + b * b); };
    const bg = new Uint8Array(N);
    const q = new Int32Array(N);
    let qh = 0, qt = 0;
    const tryPush = i => {
      if (bg[i]) return;
      if (d[i * 4 + 3] <= 10 || dist(i, ref) < tol) { bg[i] = 1; q[qt++] = i; }
    };
    for (let x = 0; x < w; x++) { tryPush(x); tryPush((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { tryPush(y * w); tryPush(y * w + w - 1); }
    const localTol = Math.max(8, tol * 0.6);
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i - x) / w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j < 0 || bg[j]) continue;
        if (d[j * 4 + 3] <= 10 || (dist(j, ref) < tol * 1.4 && dist2(i, j) < localTol)) { bg[j] = 1; q[qt++] = j; }
      }
    }
    // אלפא + ריכוך קצוות (טשטוש 3x3)
    const a = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = bg[i] ? 0 : d[i * 4 + 3] / 255;
    const soft = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
        for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { s += a[yy * w + xx]; c++; }
      const i = y * w + x;
      soft[i] = a[i] === 0 ? 0 : Math.min(a[i], s / c * 1.15);
    }
    for (let i = 0; i < N; i++) d[i * 4 + 3] = Math.round(soft[i] * 255);
    g.putImageData(im, 0, 0);
    return canvas;
  }

  // גבולות התוכן: לפי שקיפות, או (אם אין שקיפות) לפי מרחק מלבן
  function contentBounds(canvas) {
    const w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    let x1 = w, y1 = h, x2 = -1, y2 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const solid = d[i + 3] > 40 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245 || d[i + 3] < 250);
      if (solid) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    }
    if (x2 < 0) return { x: 0, y: 0, w, h };
    const m = Math.round(Math.max(x2 - x1, y2 - y1) * 0.03);
    x1 = Math.max(0, x1 - m); y1 = Math.max(0, y1 - m); x2 = Math.min(w - 1, x2 + m); y2 = Math.min(h - 1, y2 + m);
    return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
  }

  // "צריבה" על רקע לבן + חיתוך אופציונלי
  function flattenOnWhite(canvas, trim) {
    const b = trim ? contentBounds(canvas) : { x: 0, y: 0, w: canvas.width, h: canvas.height };
    const out = document.createElement('canvas');
    out.width = b.w; out.height = b.h;
    const g = out.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, b.w, b.h);
    g.drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return out.toDataURL('image/jpeg', 0.95);
  }

  let aiModule = null;
  async function loadAI() {
    if (aiModule) return aiModule;
    let lastErr;
    for (const u of AI_BG_URLS) {
      try { aiModule = await import(u); return aiModule; } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  async function processImage(el, mode) {
    if (!el || !el.asset) return;
    if (el.asset === PH_PRODUCT || el.asset === PH_LOGO) { toast('קודם יש להוסיף תמונה (לחיצה כפולה על התמונה או "החלף תמונה")'); return; }
    const srcAsset = el.orig || el.asset;      // תמיד עובדים מהמקור כדי לאפשר ניסיון חוזר ברגישות אחרת
    const src = mode === 'trim' ? assets[el.asset] : assets[srcAsset];
    try {
      let canvas;
      if (mode === 'fast') {
        showBusy('מסיר רקע…');
        await new Promise(r => setTimeout(r, 30));
        canvas = floodRemove(imageToCanvas(await loadImage(src)), toleranceVal);
      } else if (mode === 'ai' && IN_VIEWER) {
        throw new Error('בגרסת הקישור של Claude אין גישה לשרת המודל. הסרת רקע AI עובדת כשפותחים את index.html מהמחשב. כאן אפשר להשתמש ב"הסרת רקע מהירה".');
      } else if (mode === 'ai') {
        showBusy('טוען מודל AI להסרת רקע (בפעם הראשונה עשוי לקחת עד דקה)…');
        const mod = await loadAI();
        const fn = mod.removeBackground || mod.default?.removeBackground || mod.default;
        const blob = await (await fetch(src)).blob();
        const out = await fn(blob, {
          output: { format: 'image/png' },
          progress: (key, cur, total) => { if (total) setBusy(`מוריד מודל… ${Math.round(cur / total * 100)}%`); },
        });
        setBusy('מסיר רקע…');
        const url = URL.createObjectURL(out);
        canvas = imageToCanvas(await loadImage(url));
        URL.revokeObjectURL(url);
      } else {
        showBusy('חותך שוליים…');
        canvas = imageToCanvas(await loadImage(src));
      }
      const result = flattenOnWhite(canvas, mode === 'trim' ? true : autoTrim);
      if (!el.orig) el.orig = el.asset;
      el.asset = addAsset(result);
      if (!el.bgOn) { el.bgOn = true; el.bg = '#ffffff'; }
      commit(); renderAll();
    } catch (err) {
      console.error(err);
      if (mode === 'ai') toast('הסרת רקע AI נכשלה: ' + (err && err.message || err));
      else toast('העיבוד נכשל: ' + (err && err.message || err));
    } finally { hideBusy(); }
  }

  // ---------- אינטראקציה בדף ----------
  function toPage(cx, cy) {
    const r = stageEl.getBoundingClientRect();
    return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };
  }
  const snapV = v => doc.page.snap ? Math.round(v / 5) * 5 : Math.round(v);
  let drag = null;

  stageEl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const handle = e.target.closest('.handle');
    const nodeEl = e.target.closest('.el');
    if (editingId && nodeEl && nodeEl.dataset.id === editingId) return; // לחיצה בתוך טקסט בעריכה
    finishEditing();
    const p = toPage(e.clientX, e.clientY);

    if (handle) {
      const ids = selection.slice();
      drag = { kind: 'resize', handle: handle.dataset.handle, start: p, ids,
        orig: ids.map(id => ({ ...byId(id) })), bounds: ids.length === 1 ? { ...byId(ids[0]) } : selectionBounds(ids) };
    } else if (nodeEl) {
      const id = nodeEl.dataset.id;
      const members = groupMembers(id);
      if (e.shiftKey) {
        const add = members.every(m => selection.includes(m)) ? selection.filter(s => !members.includes(s)) : [...new Set([...selection, ...members])];
        select(add);
        return;
      }
      if (!selection.includes(id)) select(members);
      const ids = selection.filter(i => !byId(i).locked);
      drag = { kind: 'move', start: p, ids, orig: ids.map(i => ({ x: byId(i).x, y: byId(i).y })), moved: false };
    } else {
      if (!e.shiftKey) select([]);
      drag = { kind: 'marquee', start: p, base: selection.slice() };
      const m = document.createElement('div'); m.className = 'marquee'; overlayEl.appendChild(m); drag.box = m;
    }
    stageEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  stageEl.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = toPage(e.clientX, e.clientY);
    let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (drag.kind === 'move') {
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      drag.moved = true;
      if (e.altKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      // הצמדה לפי הפינה של הרכיב הראשון
      const o0 = drag.orig[0]; if (!o0) return;
      const nx = snapV(o0.x + dx), ny = snapV(o0.y + dy);
      dx = nx - o0.x; dy = ny - o0.y;
      drag.ids.forEach((id, k) => { const el = byId(id); el.x = drag.orig[k].x + dx; el.y = drag.orig[k].y + dy; });
      renderEls(drag.ids);
    } else if (drag.kind === 'resize') {
      const h = drag.handle, b = drag.bounds;
      let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
      if (h.includes('w')) x1 = snapV(b.x + dx);
      if (h.includes('e')) x2 = snapV(b.x + b.w + dx);
      if (h.includes('n')) y1 = snapV(b.y + dy);
      if (h.includes('s')) y2 = snapV(b.y + b.h + dy);
      // שמירת יחס כשלוחצים Shift (או תמיד בפינות של תמונה/ברקוד)
      const one = drag.ids.length === 1 ? byId(drag.ids[0]) : null;
      const keep = e.shiftKey !== !!(one && (one.type === 'image') && h.length === 2);
      if (keep && h.length === 2) {
        const ratio = b.w / b.h;
        const nw = Math.max(4, x2 - x1), nh = Math.max(4, y2 - y1);
        if (nw / nh > ratio) { const want = nh * ratio; if (h.includes('w')) x1 = x2 - want; else x2 = x1 + want; }
        else { const want = nw / ratio; if (h.includes('n')) y1 = y2 - want; else y2 = y1 + want; }
      }
      if (x2 - x1 < 4) { if (h.includes('w')) x1 = x2 - 4; else x2 = x1 + 4; }
      if (y2 - y1 < 2) { if (h.includes('n')) y1 = y2 - 2; else y2 = y1 + 2; }
      const sx = (x2 - x1) / b.w, sy = (y2 - y1) / b.h;
      drag.ids.forEach((id, k) => {
        const el = byId(id), o = drag.orig[k];
        el.x = round(x1 + (o.x - b.x) * sx); el.y = round(y1 + (o.y - b.y) * sy);
        el.w = round(Math.max(1, o.w * sx)); el.h = round(Math.max(1, o.h * sy));
        if (drag.ids.length > 1 && el.type === 'text' && e.ctrlKey) el.size = round(o.size * Math.min(sx, sy));
      });
      renderEls(drag.ids);
    } else if (drag.kind === 'marquee') {
      const x = Math.min(p.x, drag.start.x), y = Math.min(p.y, drag.start.y), w = Math.abs(dx), hh = Math.abs(dy);
      Object.assign(drag.box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
      drag.rect = { x, y, w, h: hh };
    }
  });

  stageEl.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'move' && d.moved) { commit(); renderProps(); }
    if (d.kind === 'resize') { commit(); renderProps(); }
    if (d.kind === 'marquee') {
      d.box.remove();
      if (d.rect && d.rect.w > 3 && d.rect.h > 3) {
        const r = d.rect;
        // נבחרים רק רכיבים שנמצאים כולם בתוך המלבן
        const hit = doc.elements.filter(e => e.x >= r.x && e.x + e.w <= r.x + r.w && e.y >= r.y && e.y + e.h <= r.y + r.h);
        select([...new Set([...d.base, ...hit.map(e => e.id)])]);
      } else renderOverlay();
    }
  });

  // לחיצה כפולה: בחירת רכיב בודד / עריכת טקסט / החלפת תמונה
  stageEl.addEventListener('dblclick', e => {
    // בגלל pointer capture היעד של האירוע הוא הבמה – מאתרים את הרכיב לפי מיקום
    const hitEl = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = hitEl && hitEl.closest('.el'); if (!nodeEl) return;
    const id = nodeEl.dataset.id, el = byId(id);
    if (!el) return;
    const individuallySelected = selection.length === 1 && selection[0] === id;
    if (el.group && !individuallySelected) { select([id]); if (el.type !== 'text' && el.type !== 'image') return; }
    if (el.locked) return;
    if (el.type === 'text') startEditing(id);
    if (el.type === 'image') pickImage({ replace: id });
  });

  function startEditing(id) {
    const node = nodes.get(id), el = byId(id);
    if (!node || !el) return;
    selection = [id];
    renderProps();
    editingId = id;
    const t = node.firstChild;
    t.contentEditable = 'true';
    t.focus();
    const r = document.createRange(); r.selectNodeContents(t);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    renderOverlay(); renderLayers();
    t.oninput = () => {
      el.text = t.innerText.replace(/\n$/, '');
      const ta = $('#props textarea[data-p=text]'); if (ta) ta.value = el.text;
    };
    t.onblur = () => { if (editingId === id) finishEditing(); };
  }
  function finishEditing(save = true) {
    if (!editingId) return;
    const node = nodes.get(editingId), el = byId(editingId);
    editingId = null;
    if (node) { node.firstChild.contentEditable = 'false'; node.firstChild.oninput = null; node.firstChild.onblur = null; }
    if (el && node && save) { el.text = node.firstChild.innerText.replace(/\n$/, ''); if (snapshot() !== lastSnap) commit(); }
    getSelection().removeAllRanges();
    if (el) renderNode(el, doc.elements.indexOf(el) + 1);
    renderProps(); renderLayers();
  }

  // ---------- מקלדת ----------
  const isTyping = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable); };
  document.addEventListener('keydown', e => {
    if (editingId) { if (e.key === 'Escape') { finishEditing(); } return; }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
    if (isTyping()) return;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (mod && k === 'a') { e.preventDefault(); select(doc.elements.map(x => x.id)); return; }
    if (mod && k === 'c') { if (selection.length) clipboard = JSON.stringify(doc.elements.filter(x => selection.includes(x.id))); return; }
    if (mod && k === 'x') { if (selection.length) { clipboard = JSON.stringify(doc.elements.filter(x => selection.includes(x.id))); deleteSelection(); } return; }
    if (mod && k === 'v') {
      if (clipboard) { setTimeout(() => { const c = cloneEls(JSON.parse(clipboard), 20, 20); clipboard = JSON.stringify(c); addElements(c); }, 0); }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key === 'Escape') { select([]); return; }
    if (e.key === 'Enter' && selection.length === 1 && byId(selection[0]).type === 'text') { e.preventDefault(); startEditing(selection[0]); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && selection.length) {
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1;
      selection.forEach(id => { const el = byId(id); if (!el.locked) { el.x += arrows[e.key][0] * s; el.y += arrows[e.key][1] * s; } });
      renderEls(selection);
      clearTimeout(propTimer); propTimer = setTimeout(() => { commit(); renderProps(); }, 350);
    }
  });

  // ---------- הגדרות דף ----------
  $('#pageBg').addEventListener('input', e => { doc.page.bg = e.target.value; pageEl.style.backgroundColor = doc.page.bg; });
  $('#pageBg').addEventListener('change', () => commit());
  $('#pageGrid').addEventListener('change', e => { doc.page.grid = e.target.checked; commit(); renderAll(); });
  $('#pageSnap').addEventListener('change', e => { doc.page.snap = e.target.checked; commit(); });
  $('#pageMargins').addEventListener('change', e => { doc.page.margins = e.target.checked; commit(); renderAll(); });

  // ---------- זום ----------
  function setZoom(z) {
    zoom = clamp(Math.round(z * 100) / 100, 0.2, 3);
    stageEl.style.transform = `scale(${zoom})`;
    stageEl.style.width = PAGE_W + 'px';
    // שמירת מקום בגלילה לפי הגודל המוקטן
    stageEl.style.marginBottom = (PAGE_H * (zoom - 1)) + 'px';
    stageEl.style.marginLeft = '0';
    stageEl.style.marginRight = (PAGE_W * (zoom - 1)) + 'px';
    $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
    renderOverlay();
  }
  function zoomFit() {
    const w = $('#workspace');
    setZoom(Math.min((w.clientWidth - 60) / PAGE_W, (w.clientHeight - 60) / PAGE_H));
  }
  $('#zoomIn').onclick = () => setZoom(zoom + 0.1);
  $('#zoomOut').onclick = () => setZoom(zoom - 0.1);
  $('#zoomFit').onclick = zoomFit;
  $('#workspace').addEventListener('wheel', e => {
    if (e.ctrlKey) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }
  }, { passive: false });

  // ---------- ייצוא ----------
  async function renderPageCanvas() {
    finishEditing();
    const prevSel = selection; selection = []; renderOverlay();
    try {
      await document.fonts.ready;
      await Promise.all($$('img', pageEl).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
      const scale = EXPORT_W / PAGE_W;
      const c = await window.html2canvas(pageEl, {
        scale, width: PAGE_W, height: PAGE_H, backgroundColor: doc.page.bg, useCORS: true, logging: false,
        windowWidth: PAGE_W + 200, windowHeight: PAGE_H + 200, scrollX: 0, scrollY: 0,
        onclone: (cd) => {
          const st = cd.getElementById('stage'); if (st) { st.style.transform = 'none'; st.style.margin = '0'; }
          const pg = cd.getElementById('page'); if (pg) pg.classList.remove('grid', 'margins');
          // html2canvas מאבד רווחים בין מילים בעברית; ריווח אותיות זעיר גורם לו לצייר כל אות במיקומה המדויק
          cd.querySelectorAll('.el-text .txt').forEach(t => { if (!parseFloat(t.style.letterSpacing)) t.style.letterSpacing = '0.01px'; });
        },
      });
      // קנבס סופי במידות A4 מדויקות ב-150dpi
      const out = document.createElement('canvas');
      out.width = EXPORT_W; out.height = EXPORT_H;
      const g = out.getContext('2d');
      g.fillStyle = doc.page.bg; g.fillRect(0, 0, EXPORT_W, EXPORT_H);
      g.drawImage(c, 0, 0, EXPORT_W, EXPORT_H);
      return out;
    } finally { selection = prevSel; renderOverlay(); }
  }

  // כתיבת 150dpi לכותרת JFIF של ה-JPG
  function setJpegDpi(bytes, dpi) {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF && bytes[3] === 0xE0 &&
        bytes[6] === 0x4A && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46) {
      bytes[13] = 1;
      bytes[14] = dpi >> 8; bytes[15] = dpi & 255;
      bytes[16] = dpi >> 8; bytes[17] = dpi & 255;
      return bytes;
    }
    // אין APP0 – מוסיפים אחד
    const app0 = new Uint8Array([0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0]);
    const out = new Uint8Array(bytes.length + app0.length);
    out.set(bytes.subarray(0, 2), 0); out.set(app0, 2); out.set(bytes.subarray(2), 2 + app0.length);
    return out;
  }
  const canvasToBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
  // בתוך מציג Artifacts של Claude הורדה ישירה חסומה – משתמשים ביכולת downloads
  const IN_VIEWER = !!(window.claude && typeof window.claude.use === 'function');
  let downloadsCap;
  async function download(blob, name) {
    if (IN_VIEWER) {
      if (downloadsCap === undefined) { try { downloadsCap = await window.claude.use('downloads'); } catch (e) { downloadsCap = null; } }
      if (downloadsCap) {
        try { await downloadsCap.save({ filename: name, data: blob }); toast('הקובץ נשמר: ' + name, 'ok'); }
        catch (err) {
          if (err && err.code === 'declined') toast('השמירה בוטלה');
          else if (err && err.code === 'rate_limited') toast('חלון שמירה כבר פתוח – נסו שוב בעוד רגע');
          else toast('לא ניתן לשמור קובץ כאן: ' + (err && (err.message || err.code) || err));
        }
        return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const fileBase = () => {
    const t = doc.elements.find(e => e.name === 'כותרת' && e.type === 'text');
    return (t ? t.text.split('\n')[0] : 'catalog').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'catalog';
  };

  async function exportJPG() {
    showBusy('מייצא JPG ‏(150dpi)…');
    try {
      const c = await renderPageCanvas();
      const blob = await canvasToBlob(c, 'image/jpeg', 0.95);
      const bytes = setJpegDpi(new Uint8Array(await blob.arrayBuffer()), EXPORT_DPI);
      download(new Blob([bytes], { type: 'image/jpeg' }), fileBase() + '.jpg');
    } catch (err) { console.error(err); toast('הייצוא נכשל: ' + err.message); }
    finally { hideBusy(); }
  }
  async function exportPDF() {
    showBusy('מייצא PDF ‏(150dpi)…');
    try {
      const c = await renderPageCanvas();
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      pdf.setProperties({ title: fileBase(), creator: 'A4 Catalog Designer' });
      pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297, undefined, 'NONE');
      download(pdf.output('blob'), fileBase() + '.pdf');
    } catch (err) { console.error(err); toast('הייצוא נכשל: ' + err.message); }
    finally { hideBusy(); }
  }
  $('#btnExportJpg').onclick = exportJPG;
  $('#btnExportPdf').onclick = exportPDF;

  // ---------- פרויקט: שמירה/טעינה ----------
  function usedAssets() {
    const out = {};
    doc.elements.forEach(e => { [e.asset, e.orig].forEach(a => { if (a && assets[a] && !a.startsWith('ph_')) out[a] = assets[a]; }); });
    return out;
  }
  function saveProject() {
    const data = JSON.stringify({ app: 'a4-catalog', doc, assets: usedAssets() });
    download(new Blob([data], { type: 'application/json' }), fileBase() + '.catalog.json');
  }
  function loadProjectData(obj) {
    if (!obj || !obj.doc || !Array.isArray(obj.doc.elements)) throw new Error('קובץ פרויקט לא תקין');
    Object.assign(assets, obj.assets || {});
    doc = obj.doc;
    doc.page = Object.assign(blankDoc().page, doc.page || {});
    selection = []; history = []; future = []; lastSnap = snapshot();
    renderAll(); updateUndoButtons(); scheduleSave();
  }
  $('#btnSave').onclick = saveProject;
  $('#btnOpen').onclick = () => { $('#projectInput').value = ''; $('#projectInput').click(); };
  $('#projectInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { loadProjectData(JSON.parse(await f.text())); } catch (err) { toast('לא ניתן לפתוח: ' + err.message); }
  });
  $('#btnNew').onclick = () => {
    doc = catalogTemplate(); selection = []; commit(); renderAll();
    toast('נטענה תבנית הקטלוג. לחזרה לעבודה הקודמת: ↶ ביטול');
  };
  $('#btnBlank').onclick = () => {
    doc = blankDoc(); selection = []; commit(); renderAll();
    toast('הדף נוקה. לחזרה לעבודה הקודמת: ↶ ביטול');
  };
  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;

  // שמירה אוטומטית בדפדפן (IndexedDB)
  const DB = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('a4-catalog', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    },
    async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
    async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  };
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      DB.set('autosave', { doc, assets: usedAssets() }).catch(() => {});
    }, 800);
  }

  // ---------- חלון עיבוד ----------
  let toastTimer;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (kind === 'ok' ? ' ok' : kind === undefined ? '' : '');
    if (/נכשל|לא ניתן|שגו|קודם/.test(msg)) t.classList.add('bad');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, Math.min(12000, 3500 + msg.length * 40));
  }
  function showBusy(t) { $('#busyText').textContent = t; $('#busy').hidden = false; }
  function setBusy(t) { $('#busyText').textContent = t; }
  function hideBusy() { $('#busy').hidden = true; }

  // ---------- אתחול ----------
  async function init() {
    ensurePlaceholders();
    let restored = false;
    try {
      const saved = await DB.get('autosave');
      if (saved && saved.doc && saved.doc.elements && saved.doc.elements.length) { loadProjectData(saved); restored = true; }
    } catch (e) { /* אין גישה ל-IndexedDB */ }
    if (!restored) { doc = catalogTemplate(); lastSnap = snapshot(); renderAll(); }
    updateUndoButtons();
    zoomFit();
    // טעינת גופנים מאוחרת – עדכון ברקודים/טקסט
    document.fonts && document.fonts.ready.then(() => renderAll());
  }
  window.addEventListener('resize', () => renderOverlay());
  init();

  // חשיפה לבדיקות
  window.__catalog = { get doc() { return doc; }, normalizeEAN, eanCheckDigit, renderPageCanvas, select, assets, floodRemove, flattenOnWhite };
})();
