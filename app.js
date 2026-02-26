console.log("JS LOADED");

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const $ = (id) => document.getElementById(id);

let pts = [];
let layers = [];
let activeLayer = 0;
let lastNail = null;

// Hover highlight
let hoverNail = null;
let rafHover = 0;

/* -----------------------------
   Helpers
----------------------------- */
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
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = cv.clientWidth || 800;
  const cssH = cv.clientHeight || 650;

  cv.width = Math.floor(cssW * dpr);
  cv.height = Math.floor(cssH * dpr);

  // Draw using CSS pixel coords
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
}

/* -----------------------------
   Zoom / “Preview size”
   (board size inside canvas, does NOT shrink canvas box)
----------------------------- */
function getZoomInput() {
  // Your HTML uses id="radius"
  return (
    $("radius") ||
    $("zoom") ||
    $("preview") ||
    $("previewSize") ||
    $("prevSize")
  );
}
function applyZoomFromUI() {
  const el = getZoomInput();
  if (!el) return;
  el.value = String(clampInt(el.value, 80, 4000, 320));
  redrawAll();
  updateSeqOutput();
}
function nudgeZoom(dir) {
  const el = getZoomInput();
  if (!el) return;

  const step = clampInt(el.step || 10, 1, 200, 10);
  const min = clampInt(el.min || 80, 50, 5000, 80);
  const max = clampInt(el.max || 4000, min, 5000, 4000);

  const cur = clampInt(el.value, min, max, min);
  const next = Math.max(min, Math.min(max, cur + dir * step));

  el.value = String(next);
  applyZoomFromUI();
}

/* -----------------------------
   Board points
----------------------------- */
function pointsCircle(n, cx, cy, r) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = (Math.PI * 2 * i) / n;
    const a = t - Math.PI / 2;
    out[i] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  return out;
}

function pointsSquarePerimeter(n, cx, cy, size) {
  const out = [];
  const perim = 8 * size; // 4 sides * length(2*size)
  for (let i = 0; i < n; i++) {
    const d = (perim * i) / n;
    let x, y;

    if (d < 2 * size) {
      // top, left -> right
      x = cx - size + d;
      y = cy - size;
    } else if (d < 4 * size) {
      // right, top -> bottom
      x = cx + size;
      y = cy - size + (d - 2 * size);
    } else if (d < 6 * size) {
      // bottom, right -> left
      x = cx + size - (d - 4 * size);
      y = cy + size;
    } else {
      // left, bottom -> top
      x = cx - size;
      y = cy + size - (d - 6 * size);
    }
    out.push([x, y]);
  }
  return out;
}

/* -----------------------------
   Layers
----------------------------- */
function ensureLayerExists() {
  if (layers.length === 0) {
    layers.push({
      color: $("color")?.value || "#000000",
      opacity: clampFloat($("opacity")?.value, 0, 1, 0.35),
      lw: clampFloat($("lw")?.value, 0.1, 10, 0.7),
      edges: [],
      seq: [],
    });
    activeLayer = 0;
  }
}

function syncLayerSelect() {
  const sel = $("layerSel");
  if (!sel) return;
  sel.innerHTML = "";
  layers.forEach((_, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Layer ${i + 1}`;
    sel.appendChild(opt);
  });
  sel.value = String(activeLayer);
}

function currentLayer() {
  ensureLayerExists();
  const L = layers[activeLayer];
  if ($("color")) L.color = $("color").value || "#000000";
  if ($("opacity")) L.opacity = clampFloat($("opacity").value, 0, 1, 0.35);
  if ($("lw")) L.lw = clampFloat($("lw").value, 0.1, 10, 0.7);
  return L;
}

function getStartAt() {
  return $("numStart")?.value === "1" ? 1 : 0;
}

// ✅ FIX: never show the last label (e.g. 150)
function isLabelShown(label, every, nails) {
  if (label === nails) return false; // always hide last number
  if (label === 1) return true; // always show 1
  return every > 1 && label % every === 0;
}

/* -----------------------------
   Numbers outside
----------------------------- */
function drawNumbersCircle(nails, cx, cy, r) {
  if (!$("showNums")?.checked) return;

  const every = clampInt($("numEvery")?.value, 1, nails, 10);
  const startAt = getStartAt();
  const fontSize = clampInt($("numSize")?.value, 8, 40, 12);
  const offset = clampInt($("numOffset")?.value, 6, 80, 22);

  ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < nails; i++) {
    const label = i + startAt;
    if (!isLabelShown(label, every, nails)) continue;

    const t = (Math.PI * 2 * i) / nails;
    const baseA = t - Math.PI / 2;

    // Slight nudge near the top so 1 doesn't feel cramped with nearby label
    let a = baseA;
    if (label === 1) a -= 0.02;

    const x = cx + (r + offset) * Math.cos(a);
    const y = cy + (r + offset) * Math.sin(a);

    ctx.fillText(String(label), x, y);
  }
}

function drawNumbersSquare(nails, cx, cy, size) {
  if (!$("showNums")?.checked) return;

  const every = clampInt($("numEvery")?.value, 1, nails, 10);
  const startAt = getStartAt();
  const fontSize = clampInt($("numSize")?.value, 8, 40, 12);
  const offset = clampInt($("numOffset")?.value, 6, 80, 22);

  ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < nails; i++) {
    const label = i + startAt;
    if (!isLabelShown(label, every, nails)) continue;

    const [x0, y0] = pts[i];
    const dx = x0 - cx;
    const dy = y0 - cy;

    // outward normal
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    const x = x0 + nx * offset;
    const y = y0 + ny * offset;

    ctx.fillText(String(label), x, y);
  }
}

/* -----------------------------
   Nail picking
----------------------------- */
function nearestNail(x, y) {
  const tol = clampFloat($("snap")?.value, 6, 150, 18);
  let bestIdx = null;
  let bestD2 = Infinity;

  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i][0] - x;
    const dy = pts[i][1] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
    }
  }
  if (bestIdx === null) return null;
  if (Math.sqrt(bestD2) > tol) return null;
  return bestIdx;
}

/* -----------------------------
   Hover handling (✅ FIX)
----------------------------- */
function updateHoverFromEvent(ev) {
  const rect = cv.getBoundingClientRect();
  const clientX =
    ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
  const clientY =
    ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const idx = nearestNail(x, y);
  if (idx === hoverNail) return;
  hoverNail = idx;

  if (!rafHover) {
    rafHover = requestAnimationFrame(() => {
      rafHover = 0;
      redrawAll();
    });
  }
}

/* -----------------------------
   Sequence output
----------------------------- */
function updateSeqOutput() {
  const el = $("seqOut");
  if (!el) return;

  const startAt = getStartAt();
  const lines = [];

  layers.forEach((L, i) => {
    if (!L.seq || L.seq.length === 0) return;
    lines.push(`Layer ${i + 1}: ${L.seq.map((n) => n + startAt).join(" → ")}`);
  });

  el.textContent = lines.length
    ? lines.join("\n\n")
    : "Nothing yet — start tapping nails.";
}

/* -----------------------------
   Main redraw
----------------------------- */
function redrawAll() {
  const { cssW, cssH } = resizeCanvas();
  ctx.clearRect(0, 0, cssW, cssH);

  const board = $("board")?.value || "circle";
  const radius = clampInt(getZoomInput()?.value, 80, 4000, 320);
  const nails = clampInt($("nails")?.value, 10, 5000, 150);
  const cx = cssW / 2;
  const cy = cssH / 2;

  pts =
    board === "circle"
      ? pointsCircle(nails, cx, cy, radius)
      : pointsSquarePerimeter(nails, cx, cy, radius);

  // outline
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  if (board === "circle") ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  else ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.stroke();

  // which nails to make bold?
  ensureLayerExists();
  const L = layers[activeLayer] || { seq: [] };
  const activeSeqSet = new Set(L.seq || []);

  // nail dots
  const dotStep = Math.max(1, Math.floor(nails / 250));
  const every = clampInt($("numEvery")?.value, 1, nails, 10);
  const startAt = getStartAt();

  for (let i = 0; i < nails; i += dotStep) {
    const [x, y] = pts[i];
    const label = i + startAt;

    const numbered = $("showNums")?.checked
      ? isLabelShown(label, every, nails)
      : false;

    const selected = activeSeqSet.has(i);
    const isLast = lastNail === i;

    // make selected nails stand out
    let rDot = 1.35;
    let alpha = 0.55;

    if (numbered) {
      rDot = 2.2;
      alpha = 0.75;
    }
    if (selected) {
      rDot = Math.max(rDot, 2.6);
      alpha = Math.max(alpha, 0.85);
    }
    if (isLast) {
      rDot = 3.2;
      alpha = 0.95;
    }

    ctx.beginPath();
    ctx.arc(x, y, rDot, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fill();
  }

  // ✅ hover highlight + number label
  if (hoverNail !== null && pts[hoverNail]) {
    const [hx, hy] = pts[hoverNail];
    const startAt = getStartAt();
    const label = hoverNail + startAt;

    ctx.save();

    // ring
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // label bubble (white background)
    const text = String(label);
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const padX = 6;
    const padY = 4;
    const textW = ctx.measureText(text).width;

    // position bubble slightly up/right of nail
    const bx = hx + 10;
    const by = hy - 12;
    const bw = textW + padX * 2;
    const bh = 18;

    // bubble
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;

    // rounded rect (simple)
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(bx + r, by - bh / 2);
    ctx.lineTo(bx + bw - r, by - bh / 2);
    ctx.quadraticCurveTo(bx + bw, by - bh / 2, bx + bw, by - bh / 2 + r);
    ctx.lineTo(bx + bw, by + bh / 2 - r);
    ctx.quadraticCurveTo(bx + bw, by + bh / 2, bx + bw - r, by + bh / 2);
    ctx.lineTo(bx + r, by + bh / 2);
    ctx.quadraticCurveTo(bx, by + bh / 2, bx, by + bh / 2 - r);
    ctx.lineTo(bx, by - bh / 2 + r);
    ctx.quadraticCurveTo(bx, by - bh / 2, bx + r, by - bh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // text
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillText(text, bx + padX, by);

    ctx.restore();
  }

  // numbers outside
  if (board === "circle") drawNumbersCircle(nails, cx, cy, radius);
  else drawNumbersSquare(nails, cx, cy, radius);

  // draw layers
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    ctx.lineWidth = layer.lw;
    ctx.strokeStyle = rgba(layer.color, layer.opacity);

    for (const e of layer.edges) {
      const [x1, y1] = pts[e.a];
      const [x2, y2] = pts[e.b];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

/* -----------------------------
   Actions
----------------------------- */
function fitToScreen() {
  const { cssW, cssH } = resizeCanvas();
  const margin = 28; // room for outside labels
  const r = Math.floor(Math.min(cssW, cssH) / 2 - margin);
  const el = getZoomInput();
  if (el) el.value = String(Math.max(80, r));
}

function onTap(ev) {
  ev.preventDefault();

  const rect = cv.getBoundingClientRect();
  const clientX =
    ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
  const clientY =
    ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;

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
    lastNail = L.seq.length ? L.seq[L.seq.length - 1] : null;
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
    color: $("color")?.value || "#000000",
    opacity: clampFloat($("opacity")?.value, 0, 1, 0.35),
    lw: clampFloat($("lw")?.value, 0.1, 10, 0.7),
    edges: [],
    seq: [],
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
  const text = $("seqOut")?.textContent || "";
  navigator.clipboard.writeText(text).then(() => alert("Copied sequence."));
}

function downloadPNG() {
  const link = document.createElement("a");
  link.download = "string_art_layout.png";
  link.href = cv.toDataURL("image/png");
  link.click();
}

function onAnyChangeRedraw() {
  lastNail = null;
  redrawAll();
  updateSeqOutput();
}

/* -----------------------------
   Init / Wiring
----------------------------- */
function init() {
  ensureLayerExists();
  syncLayerSelect();

  // Buttons
  $("fit")?.addEventListener("click", () => {
    fitToScreen();
    redrawAll();
  });
  $("redraw")?.addEventListener("click", () => {
    lastNail = null;
    redrawAll();
  });

  $("newLayer")?.addEventListener("click", newLayer);
  $("undo")?.addEventListener("click", undo);
  $("clearLayer")?.addEventListener("click", clearLayer);
  $("clearAll")?.addEventListener("click", clearAll);

  $("exportSeq")?.addEventListener("click", copySequence);
  $("downloadPng")?.addEventListener("click", downloadPNG);

  // Layer select
  $("layerSel")?.addEventListener("change", (ev) => {
    activeLayer = clampInt(ev.target.value, 0, layers.length - 1, 0);
    const L = layers[activeLayer];
    if ($("color")) $("color").value = L.color;
    if ($("opacity")) $("opacity").value = String(L.opacity);
    if ($("lw")) $("lw").value = String(L.lw);
    lastNail = null;
    redrawAll();
    updateSeqOutput();
  });

  // Canvas interactions
  cv.addEventListener("click", onTap);
  cv.addEventListener("touchstart", onTap, { passive: false });

  // ✅ Hover highlight wiring
  cv.addEventListener("mousemove", updateHoverFromEvent);
  cv.addEventListener("mouseleave", () => {
    hoverNail = null;
    redrawAll();
  });

  cv.addEventListener(
    "touchmove",
    (ev) => {
      ev.preventDefault();
      updateHoverFromEvent(ev);
    },
    { passive: false },
  );

  cv.addEventListener("touchend", () => {
    hoverNail = null;
    redrawAll();
  });

  // Zoom buttons (optional, only if you add them in HTML)
  $("zoomIn")?.addEventListener("click", () => nudgeZoom(1));
  $("zoomOut")?.addEventListener("click", () => nudgeZoom(-1));
  getZoomInput()?.addEventListener("change", applyZoomFromUI);

  // Redraw when board controls change
  [
    "board",
    "nails",
    "snap",
    "showNums",
    "numEvery",
    "numStart",
    "numSize",
    "numOffset",
  ].forEach((id) => {
    $(id)?.addEventListener("change", onAnyChangeRedraw);
  });

  // Redraw when draw style changes
  ["color", "opacity", "lw"].forEach((id) => {
    $(id)?.addEventListener("change", () => {
      currentLayer();
      redrawAll();
    });
  });

  window.addEventListener("resize", () => {
    redrawAll();
  });

  // First draw
  redrawAll();
  updateSeqOutput();
}

init();
