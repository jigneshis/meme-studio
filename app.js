/* Meme Studio — Frontend-only Canvas Editor (PWA)
 * Layers: image | text | emoji | sticker
 * Interactions: select, drag, scale (with Shift), rotate (button/Shift+drag corner), zoom/pan, undo/redo
 * Storage: LocalStorage autosave; project import/export JSON
 * Export: PNG/JPEG/WEBP + quality + optional watermark
 */

(() => {
  // ---------- Helpers ----------
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v,a,b)=>Math.min(Math.max(v,a),b);
  const uid = () => Math.random().toString(36).slice(2,10);
  const toDataURL = (img) => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img,0,0); return c.toDataURL('image/png');
  };

  // ---------- DOM ----------
  const canvas = $('#canvas'); const ctx = canvas.getContext('2d');
  const hud = $('#hud');

  const fileInput = $('#fileInput');
  const newBtn = $('#newBtn'); const saveBtn = $('#saveBtn'); const exportBtn = $('#exportBtn');
  const helpBtn = $('#helpBtn'); const helpDialog = $('#helpDialog'); $('#closeHelp').onclick=()=>helpDialog.close();

  const canvasW = $('#canvasW'); const canvasH = $('#canvasH'); const bgColor = $('#bgColor');
  const aspect = $('#aspect'); const fitBtn = $('#fitBtn'); const resetViewBtn = $('#resetViewBtn');

  const addImageBtn = $('#addImageBtn'); const imageInput = $('#imageInput');
  const flipHBtn = $('#flipHBtn'); const flipVBtn = $('#flipVBtn'); const rotateBtn = $('#rotateBtn');
  const fltBrightness = $('#fltBrightness'); const fltContrast = $('#fltContrast');
  const fltSaturation = $('#fltSaturation'); const fltBlur = $('#fltBlur'); const fltGray = $('#fltGray');

  const addTextBtn = $('#addTextBtn'); const textContent = $('#textContent');
  const fontFamily = $('#fontFamily'); const fontSize = $('#fontSize'); const fontColor = $('#fontColor');
  const strokeColor = $('#strokeColor'); const strokeWidth = $('#strokeWidth');
  const shadow = $('#shadow'); const align = $('#align'); const upper = $('#upper');

  const emojiPanel = $('#emojiPanel'); const stickerInput = $('#stickerInput');

  const exportFormat = $('#exportFormat'); const exportQuality = $('#exportQuality');
  const watermark = $('#watermark'); const downloadBtn = $('#downloadBtn');
  const exportProjectBtn = $('#exportProjectBtn'); const importProjectInput = $('#importProjectInput');

  const layersEl = $('#layers'); const layerUp = $('#layerUp'); const layerDown = $('#layerDown');
  const duplicateLayer = $('#duplicateLayer'); const lockLayer = $('#lockLayer'); const hideLayer = $('#hideLayer');
  const deleteLayer = $('#deleteLayer');

  const undoBtn = $('#undoBtn'); const redoBtn = $('#redoBtn');
  const zoomIn = $('#zoomIn'); const zoomOut = $('#zoomOut'); const zoomLabel = $('#zoomLabel');
  const installBtn = $('#installBtn');

  // ---------- State ----------
  const state = {
    w: 1080, h: 1080, bg: '#000000',
    layers: [], active: null,
    zoom: 1, viewX: 0, viewY: 0, isPanning:false, pointer: {x:0,y:0,down:false},
    hist: [], futur: [],
    filters: {brightness:1, contrast:1, saturation:1, blur:0, gray:0},
  };

  function pushHist() {
    state.hist.push(JSON.stringify(serialize()));
    if (state.hist.length > 100) state.hist.shift();
    state.futur = [];
  }

  function serialize() {
    const layers = state.layers.map(l => {
      if (l.type === 'image' || l.type==='sticker') {
        return {...l, src: l.inlineSrc || l.src};
      }
      return {...l};
    });
    return {w: state.w, h: state.h, bg: state.bg, layers};
  }

  function loadProject(proj) {
    state.w = proj.w; state.h = proj.h; state.bg = proj.bg || '#000000';
    canvas.width = state.w; canvas.height = state.h;
    state.layers = [];
    const promises = [];
    for (const l of proj.layers || []) {
      if (l.type === 'image' || l.type==='sticker') {
        const img = new Image();
        const p = new Promise(res => { img.onload=()=>res(); img.src = l.src; });
        promises.push(p);
        state.layers.push({...l, img, inlineSrc:l.src});
      } else {
        state.layers.push({...l});
      }
    }
    Promise.all(promises).then(()=>{ select(null); render(); refreshLayers(); });
  }

  // ---------- Layers ----------
  function addImageLayer(img, x=state.w/2, y=state.h/2) {
    const ratio = Math.min(state.w*0.8 / img.naturalWidth, state.h*0.8 / img.naturalHeight, 1);
    const w = img.naturalWidth * ratio, h = img.naturalHeight * ratio;
    const layer = { id: uid(), type:'image', x: x-w/2, y: y-h/2, w, h, a:0, img, flipH:false, flipV:false, hidden:false, locked:false };
    state.layers.push(layer); pushHist(); select(layer.id); render(); refreshLayers();
  }

  function addTextLayer(text="YOUR TEXT") {
    const layer = {
      id: uid(), type:'text', x: state.w/2 - 200, y: state.h/2 - 40, w: 400, h: 80, a:0, hidden:false, locked:false,
      text, fontFamily: fontFamily.value, fontSize: parseInt(fontSize.value,10) || 64,
      color: fontColor.value, stroke: strokeColor.value, strokeW: parseInt(strokeWidth.value,10)||6,
      shadow: shadow.checked, align: align.value, upper: upper.checked
    };
    state.layers.push(layer); pushHist(); select(layer.id); render(); refreshLayers();
  }

  function addEmojiLayer(emoji) {
    const layer = {
      id: uid(), type:'emoji', x: state.w/2 - 32, y: state.h/2 - 32, w: 64, h: 64, a: 0,
      emoji, hidden:false, locked:false
    };
    state.layers.push(layer); pushHist(); select(layer.id); render(); refreshLayers();
  }

  function addStickerLayer(img) {
    const ratio = 256 / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * ratio, h = img.naturalHeight * ratio;
    const layer = { id: uid(), type:'sticker', x: state.w/2 - w/2, y: state.h/2 - h/2, w, h, a:0, img, hidden:false, locked:false, flipH:false, flipV:false };
    state.layers.push(layer); pushHist(); select(layer.id); render(); refreshLayers();
  }

  function select(id) {
    state.active = id;
    $$('#layers li').forEach(li => li.classList.toggle('active', li.dataset.id === id));
    fillInspector();
  }

  function activeLayer() { return state.layers.find(l => l.id === state.active) || null; }

  function moveActive(dx, dy) {
    const a = activeLayer(); if (!a || a.locked) return;
    a.x += dx; a.y += dy; render();
  }

  // ---------- Rendering ----------
  function applyFilters() {
    const f = state.filters;
    const css = [
      `brightness(${f.brightness})`,
      `contrast(${f.contrast})`,
      `saturate(${f.saturation})`,
      `grayscale(${f.gray})`,
      f.blur ? `blur(${f.blur}px)` : ''
    ].filter(Boolean).join(' ');
    ctx.filter = css;
  }

  function drawLayer(l) {
    if (l.hidden) return;
    ctx.save();
    ctx.translate(l.x + l.w/2, l.y + l.h/2);
    ctx.rotate(l.a);
    if (l.type === 'image' || l.type === 'sticker') {
      ctx.scale(l.flipH ? -1:1, l.flipV ? -1:1);
      applyFilters();
      ctx.drawImage(l.img, -l.w/2, -l.h/2, l.w, l.h);
      ctx.filter = 'none';
    } else if (l.type === 'text') {
      const text = l.upper ? (l.text||'').toUpperCase() : (l.text||'');
      ctx.textAlign = l.align; // left/center/right
      ctx.textBaseline = 'middle';
      ctx.font = `${l.fontSize || 48}px ${l.fontFamily || 'Anton'}, Impact, Arial, sans-serif`;
      if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; }
      if (l.strokeW) { ctx.lineWidth = l.strokeW; ctx.strokeStyle = l.stroke || '#000'; ctx.strokeText(text, 0, 0); }
      ctx.fillStyle = l.color || '#fff';
      const offset = l.align==='left' ? -l.w/2 : l.align==='right' ? l.w/2 : 0;
      ctx.fillText(text, offset, 0);
      ctx.shadowBlur = 0;
    } else if (l.type === 'emoji') {
      ctx.font = `${Math.max(l.w,l.h)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(l.emoji, 0, 0);
    }
    ctx.restore();

    // selection box
    if (l.id === state.active) {
      ctx.save();
      ctx.translate(l.x + l.w/2, l.y + l.h/2);
      ctx.rotate(l.a);
      ctx.strokeStyle = '#6aa7ff'; ctx.lineWidth = 1.5; ctx.setLineDash([6,4]);
      ctx.strokeRect(-l.w/2, -l.h/2, l.w, l.h);
      ctx.setLineDash([]);
      // handles
      const hs = 8;
      const corners = [[-l.w/2,-l.h/2],[l.w/2,-l.h/2],[l.w/2,l.h/2],[-l.w/2,l.h/2]];
      ctx.fillStyle = '#6aa7ff';
      for (const [cx,cy] of corners) ctx.fillRect(cx-hs/2, cy-hs/2, hs, hs);
      ctx.restore();
    }
  }

  function render() {
    canvas.width = state.w; canvas.height = state.h;
    ctx.save();
    ctx.fillStyle = state.bg; ctx.fillRect(0,0,state.w,state.h);
    for (const l of state.layers) drawLayer(l);
    ctx.restore();
    hud.textContent = `Canvas ${state.w}×${state.h} • Layers ${state.layers.length}`;
  }

  // ---------- Hit testing ----------
  function screenToCanvas(px, py) {
    // We keep canvas not scaled inside element; so map directly
    const rect = canvas.getBoundingClientRect();
    const x = (px - rect.left) / rect.width * canvas.width;
    const y = (py - rect.top) / rect.height * canvas.height;
    return {x,y};
  }

  function pointInLayer(l, x, y) {
    // inverse-rotate point and check in axis-aligned rect
    const cx = l.x + l.w/2, cy = l.y + l.h/2;
    const dx = x - cx, dy = y - cy;
    const ca = Math.cos(-l.a), sa = Math.sin(-l.a);
    const rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
    return (rx >= -l.w/2 && rx <= l.w/2 && ry >= -l.h/2 && ry <= l.h/2);
  }

  function findTopLayerAt(x, y) {
    for (let i = state.layers.length-1; i>=0; i--) {
      const l = state.layers[i];
      if (!l.hidden && pointInLayer(l,x,y)) return l;
    }
    return null;
  }

  // ---------- UI: Layers panel ----------
  function refreshLayers() {
    layersEl.innerHTML = '';
    state.layers.forEach((l, idx) => {
      const li = document.createElement('li'); li.dataset.id = l.id;
      li.innerHTML = `<span>${idx+1}. ${l.type === 'text' ? '🅣' : l.type==='emoji' ? '😊' : '🖼️'} ${l.type==='text' ? (l.text||'Text') : l.type}</span><span>${l.hidden?'🙈':''}${l.locked?'🔒':''}</span>`;
      li.onclick = () => { select(l.id); render(); };
      layersEl.appendChild(li);
    });
    select(state.active); // to update active class
  }

  function fillInspector() {
    const a = activeLayer(); if (!a) return;
    if (a.type==='text') {
      textContent.value = a.text || '';
      fontFamily.value = a.fontFamily || 'Anton';
      fontSize.value = a.fontSize || 64;
      fontColor.value = a.color || '#ffffff';
      strokeColor.value = a.stroke || '#000000';
      strokeWidth.value = a.strokeW || 6;
      shadow.checked = !!a.shadow;
      align.value = a.align || 'center';
      upper.checked = !!a.upper;
    }
  }

  // ---------- Events: Canvas Pointer ----------
  let drag = {mode:null, offsetX:0, offsetY:0, start:{x:0,y:0}, startLayer:null, corner:null};

  function whichCorner(l, x, y) {
    const corners = [
      {name:'tl', x:l.x, y:l.y},
      {name:'tr', x:l.x+l.w, y:l.y},
      {name:'br', x:l.x+l.w, y:l.y+l.h},
      {name:'bl', x:l.x, y:l.y+l.h},
    ];
    // rotate corner points around center
    const res = [];
    for (const c of corners) {
      const cx = l.x + l.w/2, cy = l.y + l.h/2;
      const dx = c.x - cx, dy = c.y - cy;
      const ca = Math.cos(l.a), sa = Math.sin(l.a);
      const rx = dx * ca - dy * sa + cx;
      const ry = dx * sa + dy * ca + cy;
      res.push({name:c.name, x:rx, y:ry});
    }
    const hit = res.find(c => Math.abs(c.x - x) < 10 && Math.abs(c.y - y) < 10);
    return hit ? hit.name : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const {x,y} = screenToCanvas(e.clientX, e.clientY);
    const top = findTopLayerAt(x,y);
    if (top) {
      select(top.id);
      const corner = whichCorner(top,x,y);
      if (corner) {
        drag = {mode:'scale', start:{x,y}, startLayer: {...top}, corner};
      } else {
        drag = {mode:'move', offsetX:x - top.x, offsetY:y - top.y};
      }
    } else {
      select(null);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.active) return;
    const a = activeLayer(); if (!a || a.locked) return;
    const {x,y} = screenToCanvas(e.clientX, e.clientY);
    if (drag.mode === 'move') {
      a.x = x - drag.offsetX; a.y = y - drag.offsetY; render();
    } else if (drag.mode === 'scale') {
      // simple uniform scale from center
      const dx = Math.abs(x - (drag.startLayer.x + drag.startLayer.w/2))*2;
      const dy = Math.abs(y - (drag.startLayer.y + drag.startLayer.h/2))*2;
      a.w = clamp(dx, 8, 8192); a.h = clamp(dy, 8, 8192); render();
    }
  });

  window.addEventListener('pointerup', () => {
    if (drag.mode) { pushHist(); drag = {mode:null}; refreshLayers(); }
  });

  // Rotate 90°
  rotateBtn.onclick = () => {
    const a = activeLayer(); if (!a) return;
    a.a += Math.PI/2; pushHist(); render();
  };

  // Flip
  flipHBtn.onclick = () => { const a = activeLayer(); if (!a) return; a.flipH = !a.flipH; pushHist(); render(); };
  flipVBtn.onclick = () => { const a = activeLayer(); if (!a) return; a.flipV = !a.flipV; pushHist(); render(); };

  // Zoom controls (visual only, canvas draws at native res, we scale via CSS by fitting — simplest approach)
  zoomIn.onclick = () => { setZoom(state.zoom * 1.1); };
  zoomOut.onclick = () => { setZoom(state.zoom / 1.1); };
  function setZoom(z) { state.zoom = clamp(z, 0.2, 5); zoomLabel.textContent = `${Math.round(state.zoom*100)}%`; }

  // ---------- Inputs: Image / Sticker ----------
  function handleImageFile(file, toSticker=false) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        img.crossOrigin = 'anonymous';
        if (toSticker) addStickerLayer(img); else addImageLayer(img);
        // inline store
        const dataURL = toDataURL(img);
        const a = activeLayer(); if (a) a.inlineSrc = dataURL;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  fileInput.onchange = (e) => {
    const f = e.target.files[0]; if (f) handleImageFile(f,false);
    e.target.value = '';
  };
  imageInput.onchange = (e) => {
    const f = e.target.files[0]; if (f) handleImageFile(f,false);
    e.target.value = '';
  };
  stickerInput.onchange = (e) => {
    const f = e.target.files[0]; if (f) handleImageFile(f,true);
    e.target.value = '';
  };
  addImageBtn.onclick = ()=>fileInput.click();

  // ---------- Text panel ----------
  addTextBtn.onclick = () => addTextLayer((textContent.value || 'NEW CAPTION'));
  textContent.addEventListener('input',()=>{ const a=activeLayer(); if (a && a.type==='text'){ a.text=textContent.value; render(); }});
  [fontFamily,fontSize,fontColor,strokeColor,strokeWidth,shadow,align,upper].forEach(el=>{
    el.addEventListener('input',()=>{
      const a=activeLayer(); if (!a || a.type!=='text') return;
      a.fontFamily=fontFamily.value; a.fontSize=parseInt(fontSize.value,10)||a.fontSize;
      a.color=fontColor.value; a.stroke=strokeColor.value; a.strokeW=parseInt(strokeWidth.value,10)||a.strokeW;
      a.shadow=shadow.checked; a.align=align.value; a.upper=upper.checked; render();
    });
  });

  // ---------- Emoji ----------
  emojiPanel.addEventListener('click', (e)=>{
    if (e.target && e.target.nodeType===3) return;
    const em = (e.target.textContent || '').trim();
    if (em) addEmojiLayer(em);
  });

  // ---------- Filters (applied at draw time to image/sticker) ----------
  [fltBrightness, fltContrast, fltSaturation, fltBlur, fltGray].forEach(el=>{
    el.addEventListener('input', ()=>{
      state.filters = {
        brightness: parseFloat(fltBrightness.value),
        contrast: parseFloat(fltContrast.value),
        saturation: parseFloat(fltSaturation.value),
        blur: parseFloat(fltBlur.value),
        gray: parseFloat(fltGray.value),
      };
      render();
    });
  });

  // ---------- Canvas settings ----------
  function updateCanvasSize() {
    state.w = parseInt(canvasW.value,10)||state.w;
    state.h = parseInt(canvasH.value,10)||state.h;
    canvas.width = state.w; canvas.height = state.h;
    render();
  }
  canvasW.onchange = updateCanvasSize; canvasH.onchange = updateCanvasSize;
  bgColor.oninput = ()=>{ state.bg = bgColor.value; render(); };
  aspect.onchange = ()=>{
    const v = aspect.value;
    if (v==='free') return;
    const [a,b] = v.split(':').map(Number);
    const newH = Math.round((state.w / a) * b);
    canvasH.value = newH; updateCanvasSize();
  };
  fitBtn.onclick = ()=> setZoom(1);
  resetViewBtn.onclick = ()=> { setZoom(1); state.viewX=state.viewY=0; render(); };

  // ---------- Layers toolbar ----------
  layerUp.onclick = ()=>{
    const i = state.layers.findIndex(l=>l.id===state.active); if (i<0 || i===state.layers.length-1) return;
    [state.layers[i], state.layers[i+1]] = [state.layers[i+1], state.layers[i]]; pushHist(); refreshLayers(); render();
  };
  layerDown.onclick = ()=>{
    const i = state.layers.findIndex(l=>l.id===state.active); if (i<=0) return;
    [state.layers[i], state.layers[i-1]] = [state.layers[i-1], state.layers[i]]; pushHist(); refreshLayers(); render();
  };
  duplicateLayer.onclick = ()=>{
    const a = activeLayer(); if (!a) return;
    const copy = JSON.parse(JSON.stringify(a)); copy.id = uid(); copy.x += 20; copy.y += 20;
    if (a.type==='image' || a.type==='sticker') {
      const img = new Image(); img.onload=()=>{ state.layers.push({...copy, img}); pushHist(); refreshLayers(); render(); };
      img.src = a.inlineSrc || a.src;
    } else {
      state.layers.push(copy); pushHist(); refreshLayers(); render();
    }
  };
  lockLayer.onclick = ()=>{ const a=activeLayer(); if (!a) return; a.locked=!a.locked; refreshLayers(); };
  hideLayer.onclick = ()=>{ const a=activeLayer(); if (!a) return; a.hidden=!a.hidden; refreshLayers(); render(); };
  deleteLayer.onclick = ()=>{
    const i = state.layers.findIndex(l=>l.id===state.active); if (i<0) return;
    state.layers.splice(i,1); state.active=null; pushHist(); refreshLayers(); render();
  };

  // ---------- History ----------
  undoBtn.onclick = ()=>{
    if (!state.hist.length) return;
    state.futur.push(JSON.stringify(serialize()));
    const snapshot = state.hist.pop();
    loadProject(JSON.parse(snapshot));
  };
  redoBtn.onclick = ()=>{
    if (!state.futur.length) return;
    state.hist.push(JSON.stringify(serialize()));
    const snapshot = state.futur.pop();
    loadProject(JSON.parse(snapshot));
  };

  // ---------- Project export/import ----------
  exportProjectBtn.onclick = ()=>{
    const data = JSON.stringify(serialize(), null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'meme-project.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  importProjectInput.onchange = (e)=>{
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ()=> {
      const proj = JSON.parse(reader.result);
      loadProject(proj); pushHist();
    };
    reader.readAsText(f);
    e.target.value='';
  };

  // ---------- Export image ----------
  function exportImage() {
    // Draw to an offscreen canvas to apply filters/layers exactly as render()
    const off = document.createElement('canvas'); off.width = state.w; off.height = state.h;
    const c = off.getContext('2d');
    c.fillStyle = state.bg; c.fillRect(0,0,state.w,state.h);

    const saveFilter = ctx.filter;
    for (const l of state.layers) {
      if (l.hidden) continue;
      c.save();
      c.translate(l.x + l.w/2, l.y + l.h/2);
      c.rotate(l.a);
      if (l.type === 'image' || l.type==='sticker') {
        c.scale(l.flipH?-1:1, l.flipV?-1:1);
        const f = state.filters;
        c.filter = [
          `brightness(${f.brightness})`,
          `contrast(${f.contrast})`,
          `saturate(${f.saturation})`,
          `grayscale(${f.gray})`,
          f.blur ? `blur(${f.blur}px)` : ''
        ].filter(Boolean).join(' ');
        c.drawImage(l.img, -l.w/2, -l.h/2, l.w, l.h);
        c.filter = 'none';
      } else if (l.type === 'text') {
        const text = l.upper ? (l.text||'').toUpperCase() : (l.text||'');
        c.textAlign = l.align; c.textBaseline = 'middle';
        c.font = `${l.fontSize || 48}px ${l.fontFamily || 'Anton'}, Impact, Arial, sans-serif`;
        if (l.shadow) { c.shadowColor='rgba(0,0,0,.7)'; c.shadowBlur=10; c.shadowOffsetY=2; }
        if (l.strokeW) { c.lineWidth=l.strokeW; c.strokeStyle=l.stroke||'#000'; c.strokeText(text, 0, 0); }
        c.fillStyle = l.color || '#fff';
        const offset = l.align==='left' ? -l.w/2 : l.align==='right' ? l.w/2 : 0;
        c.fillText(text, offset, 0);
        c.shadowBlur=0;
      } else if (l.type === 'emoji') {
        c.font = `${Math.max(l.w,l.h)}px serif`; c.textAlign='center'; c.textBaseline='middle';
        c.fillText(l.emoji, 0, 0);
      }
      c.restore();
    }
    // optional watermark
    if (watermark.checked) {
      c.save();
      c.globalAlpha = 0.25;
      c.fillStyle = '#fff';
      c.font = `bold ${Math.round(state.w*0.04)}px Inter, Arial, sans-serif`;
      c.textAlign='right'; c.textBaseline='bottom';
      c.fillText('Meme Studio', state.w-20, state.h-20);
      c.restore();
    }
    const fmt = exportFormat.value;
    const q = parseFloat(exportQuality.value) || 0.95;
    const url = off.toDataURL(fmt, q);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meme.${fmt.split('/')[1]}`;
    a.click();
    ctx.filter = saveFilter;
  }
  downloadBtn.onclick = exportImage;

  // ---------- Save / Load (autosave last) ----------
  function saveLocal() { localStorage.setItem('meme-studio:last', JSON.stringify(serialize())); }
  function loadLocal() {
    const raw = localStorage.getItem('meme-studio:last');
    if (!raw) return;
    try { loadProject(JSON.parse(raw)); } catch {}
  }
  saveBtn.onclick = ()=>{ saveLocal(); alert('Saved locally.'); };

  // ---------- New project ----------
  function newProject() {
    state.layers = []; state.active=null; state.bg = '#000000';
    state.filters = {brightness:1, contrast:1, saturation:1, blur:0, gray:0};
    canvasW.value = 1080; canvasH.value = 1080; bgColor.value = '#000000';
    updateCanvasSize(); pushHist(); refreshLayers(); render();
  }
  newBtn.onclick = newProject;

  // ---------- Keyboard shortcuts ----------
  window.addEventListener('keydown',(e)=>{
    if (e.key==='/' && !e.ctrlKey) { e.preventDefault(); helpDialog.showModal(); }
    if (e.key.toLowerCase()==='n') { e.preventDefault(); newProject(); }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') { e.preventDefault(); saveLocal(); }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='e') { e.preventDefault(); exportImage(); }
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z') { e.preventDefault(); undoBtn.click(); }
    if ((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==='y' || (e.shiftKey && e.key.toLowerCase()==='z'))) { e.preventDefault(); redoBtn.click(); }
    if (e.key==='Delete' || e.key==='Backspace') { e.preventDefault(); deleteLayer.click(); }
    // arrow nudge
    const step = e.shiftKey ? 10 : 1;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const dx = (e.key==='ArrowLeft'?-step : e.key==='ArrowRight'?step:0);
      const dy = (e.key==='ArrowUp'?-step : e.key==='ArrowDown'?step:0);
      moveActive(dx,dy); pushHist();
    }
  });

  // ---------- Help ----------
  helpBtn.onclick = ()=> helpDialog.showModal();

  // ---------- PWA install ----------
  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; installBtn.hidden=false; });
  installBtn.onclick = async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt=null; installBtn.hidden=true; };

  // ---------- Drag & Drop ----------
  document.addEventListener('dragover', e=>{ e.preventDefault(); });
  document.addEventListener('drop', e=>{
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) handleImageFile(f,false);
  });

  // ---------- Init ----------
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }
  loadLocal();
  if (!state.layers.length) { render(); }
  pushHist();
  refreshLayers();

})();

