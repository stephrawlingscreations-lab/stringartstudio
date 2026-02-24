const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const $ = (id) => document.getElementById(id);

let pts = [];
let layers = [];
let activeLayer = 0;
let lastNail = null;

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function clampFloat(v, min, max, fallback) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function normMod(a, n) { return ((a % n) + n) % n; }

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return {r:0,g:0,b:0};
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgba(hex, a) {
  const {r,g,b} = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = cv.clientWidth;
  const cssH = cv.clientHeight;
  cv.width = Math.floor(cssW * dpr);
  cv.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
}

function fitToScreen() {
  const { cssW, cssH } = resizeCanvas();
  const margin = 28; // extra because we now draw numbers outside
  const r = Math.floor(Math.min(cssW, cssH) / 2 - margin);
  $("radius").value = Math.max(80, r);
}

function pointsCircle(n, cx, cy, r) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = (Math.PI * 2 * i) / n;
    const a = t - Math.PI/2;
    out[i] = [cx + r*Math.cos(a), cy + r*Math.sin(a)];
  }
  return out;
}

function pointsSquarePerimeter(n, cx, cy, size) {
  const out = [];
  const perim = 8 * size;
  for (let i = 0; i < n; i++) {
    const d = (perim * i) / n;
    let x, y;
    if (d < 2 * size) { x = cx - size + d; y = cy - size; }
    else if (d < 4 * size) { x = cx + size; y = cy - size + (d - 2 * size); }
    else if (d < 6 * size) { x = cx + size - (d - 4 * size); y = cy + size; }
    else { x = cx - size; y = cy + size - (d - 6 * size); }
    out.push([x, y]);
  }
  return out;
}

function ensureLayerExists() {
  if (layers.length === 0) {
    layers.push({
      color: $("color").value || "#000000",
      opacity: clampFloat($("opacity").value, 0, 1, 0.35),
      lw: clampFloat($("lw").value, 0.1, 10, 0.7),
      edges: [],
      seq: []
    });
    activeLayer = 0;
  }
}

function syncLayerSelect() {
  const sel = $("layerSel");
  sel.innerHTML = "";
  layers.forEach((_, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Layer ${i+1}`;
    sel.appendChild(opt);
  });
  sel.value = String(activeLayer);
}

function currentLayer() {
  ensureLayerExists();
  layers[activeLayer].color = $("color").value || "#000000";
  layers[activeLayer].opacity = clampFloat($("opacity").value, 0, 1, 0.35);
  layers[activeLayer].lw = clampFloat($("lw").value, 0.1, 10, 0.7);
  return layers[activeLayer];
}

function drawNumbersCircle(nails, cx, cy, r) {
  if (!$("showNums").checked) return;
  const every = clampInt($("numEvery").value, 1, nails, 10);
  const startAt = $("numStart").value === "1" ? 1 : 0;
  const fontSize = clampInt($("numSize").value, 8, 40, 12);
  const offset = clampInt($("numOffset").value, 6, 80, 16);

  ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < nails; i++) {
    const label = i + startAt;
    const isShown = (i % every === 0) || (i === 0);
    if (!isShown) continue;
    const t = (Math.PI * 2 * i) / nails;
    const a = t - Math.PI/2;
    const x = cx + (r + offset) * Math.cos(a);
    const y = cy + (r + offset) * Math.sin(a);
    ctx.fillText(String(label), x, y);
  }
}

function drawNumbersSquare(nails, cx, cy, size) {
  if (!$("showNums").checked) return;
  const every = clampInt($("numEvery").value, 1, nails, 10);
  const startAt = $("numStart").value === "1" ? 1 : 0;
  const fontSize = clampInt($("numSize").value, 8, 40, 12);
  const offset = clampInt($("numOffset").value, 6, 80, 16);

  ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Compute normal direction from centre for each nail point
  for (let i = 0; i < nails; i++) {
    const isShown = (i % every === 0) || (i === 0);
    if (!isShown) continue;
    const [x0, y0] = pts[i];
    const dx = x0 - cx;
    const dy = y0 - cy;
    const len = Math.hypot(dx, dy) || 1;
    const x = x0 + (dx/len) * offset;
    const y = y0 + (dy/len) * offset;
    ctx.fillText(String(i + startAt), x, y);
  }
}

function redrawAll() {
  const { cssW, cssH } = resizeCanvas();
  ctx.clearRect(0, 0, cssW, cssH);

  const board = $("board").value;
  const radius = clampInt($("radius").value, 80, 4000, 320);
  const nails = clampInt($("nails").value, 10, 5000, 150);
  const cx = cssW/2, cy = cssH/2;

  pts = (board === "circle") ? pointsCircle(nails, cx, cy, radius) : pointsSquarePerimeter(nails, cx, cy, radius);

  // outline
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  if (board === "circle") ctx.arc(cx, cy, radius, 0, Math.PI*2);
  else ctx.rect(cx-radius, cy-radius, radius*2, radius*2);
  ctx.stroke();

  // nails dots
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const dotStep = Math.max(1, Math.floor(nails/250));
  for (let i = 0; i < nails; i += dotStep) {
    const [x,y] = pts[i];
    ctx.beginPath();
    ctx.arc(x,y,1.3,0,Math.PI*2);
    ctx.fill();
  }

  // numbers outside
  if (board === "circle") drawNumbersCircle(nails, cx, cy, radius);
  else drawNumbersSquare(nails, cx, cy, radius);

  // draw layers
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    ctx.lineWidth = L.lw;
    ctx.strokeStyle = rgba(L.color, L.opacity);
    for (const e of L.edges) {
      const [x1,y1] = pts[e.a];
      const [x2,y2] = pts[e.b];
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
  }

  // highlight last nail
  if (lastNail !== null && pts[lastNail]) {
    const [x,y] = pts[lastNail];
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.beginPath(); ctx.arc(x,y,3.2,0,Math.PI*2); ctx.fill();
  }
}

function nearestNail(x, y) {
  const tol = clampFloat($("snap").value, 6, 150, 18);
  let best = { idx: null, d2: Infinity };
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i][0] - x;
    const dy = pts[i][1] - y;
    const d2 = dx*dx + dy*dy;
    if (d2 < best.d2) best = { idx: i, d2 };
  }
  if (best.idx === null) return null;
  if (Math.sqrt(best.d2) > tol) return null;
  return best.idx;
}

function updateSeqOutput() {
  const startAt = $("numStart").value === "1" ? 1 : 0;
  const lines = [];
  layers.forEach((L, i) => {
    if (L.seq.length === 0) return;
    lines.push(`Layer ${i+1}: ${L.seq.map(n=>n+startAt).join(" → ")}`);
  });
  $("seqOut").textContent = lines.length ? lines.join("\n\n") : "Nothing yet — start tapping nails.";
}

function onTap(ev) {
  ev.preventDefault();
  const rect = cv.getBoundingClientRect();
  const clientX = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
  const clientY = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const idx = nearestNail(x, y);
  if (idx === null) return;

  ensureLayerExists();
  const L = currentLayer();

  if (lastNail === null) {
    lastNail = idx;
    if (L.seq.length === 0) L.seq.push(idx);
  } else {
    if (L.seq.length === 0) L.seq.push(lastNail);
    L.edges.push({ a: lastNail, b: idx });
    L.seq.push(idx);
    lastNail = idx;
  }

  redrawAll();
  updateSeqOutput();
}

function undo() {
  ensureLayerExists();
  const L = layers[activeLayer];
  if (L.edges.length > 0) {
    L.edges.pop();
    if (L.seq.length > 1) L.seq.pop();
    lastNail = L.seq.length ? L.seq[L.seq.length-1] : null;
  } else {
    lastNail = null;
    L.seq = [];
  }
  redrawAll();
  updateSeqOutput();
}

function newLayer() {
  ensureLayerExists();
  layers.push({
    color: $("color").value || "#000000",
    opacity: clampFloat($("opacity").value, 0, 1, 0.35),
    lw: clampFloat($("lw").value, 0.1, 10, 0.7),
    edges: [],
    seq: []
  });
  activeLayer = layers.length - 1;
  lastNail = null;
  syncLayerSelect();
  redrawAll();
  updateSeqOutput();
}

function clearLayer() {
  ensureLayerExists();
  layers[activeLayer].edges = [];
  layers[activeLayer].seq = [];
  lastNail = null;
  redrawAll();
  updateSeqOutput();
}

function clearAll() {
  layers = [];
  activeLayer = 0;
  lastNail = null;
  ensureLayerExists();
  syncLayerSelect();
  redrawAll();
  updateSeqOutput();
}

function copySequence() {
  updateSeqOutput();
  navigator.clipboard.writeText($("seqOut").textContent).then(()=> alert("Copied sequence."));
}

function downloadPNG() {
  const link = document.createElement("a");
  link.download = "string_art_manual_numbered.png";
  link.href = cv.toDataURL("image/png");
  link.click();
}

function onAnyChangeRedraw() { redrawAll(); updateSeqOutput(); }

// Wire up
$("fit").addEventListener("click", ()=>{ fitToScreen(); redrawAll(); });
$("redraw").addEventListener("click", ()=>{ lastNail = null; redrawAll(); });

$("newLayer").addEventListener("click", newLayer);
$("undo").addEventListener("click", undo);
$("clearLayer").addEventListener("click", clearLayer);
$("clearAll").addEventListener("click", clearAll);

$("exportSeq").addEventListener("click", copySequence);
$("downloadPng").addEventListener("click", downloadPNG);

// Layer select
$("layerSel").addEventListener("change", (ev)=>{
  activeLayer = clampInt(ev.target.value, 0, layers.length-1, 0);
  // load chosen layer style into UI
  const L = layers[activeLayer];
  $("color").value = L.color;
  $("opacity").value = L.opacity;
  $("lw").value = L.lw;
  lastNail = null;
  redrawAll();
  updateSeqOutput();
});

// Tap/click
cv.addEventListener("click", onTap);
cv.addEventListener("touchstart", onTap, { passive: false });

// Redraw when numbering controls change
["board","nails","radius","snap","showNums","numEvery","numStart","numSize","numOffset"].forEach(id=>{
  $(id).addEventListener("change", onAnyChangeRedraw);
});
["color","opacity","lw"].forEach(id=>{
  $(id).addEventListener("change", ()=>{ currentLayer(); redrawAll(); });
});

window.addEventListener("resize", ()=>{ fitToScreen(); redrawAll(); });

// init
fitToScreen();
ensureLayerExists();
syncLayerSelect();
redrawAll();
updateSeqOutput();
