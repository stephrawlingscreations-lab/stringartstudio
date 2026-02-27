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

// Pointer tracking (helps mobile)
let isPointerDown = false;

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

/* -----------------------------
   Canvas sizing (mobile-safe)
   (Your CSS now makes canvas square via aspect-ratio)
----------------------------- */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;

  // Force square based on rendered width (works with aspect-ratio)
  const cssW = cv.clientWidth || 800;
  const size = cssW;

  cv.width = Math.floor(size * dpr);
  cv.height = Math.floor(size * dpr);

  // Draw in CSS pixel coordinates
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW: size, cssH: size };
}

/* -----------------------------
   Zoom / “Preview size”
----------------------------- */
function getZoomInput() {
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
  el.value = String(clampInt(el.value, 80, 5000, 320));
  redrawAll();
  updateSeqOutput();
}
function nudgeZoom(dir) {
  const el = getZoomInput();
  if (!el) return;

  const step = clampInt(el.step || 10, 1, 200, 10);
  const min = clampInt(el.min || 80, 50, 5000, 80);
  const max = clampInt(el.max || 4000, min, 8000, 4000);

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
  const perim = 8 * size;
  for (let i = 0; i < n; i++) {
    const d = (perim * i) / n;
    let x, y;

    if (d < 2 * size) {
      x = cx - size + d;
      y = cy - size;
    } else if (d < 4 * size) {
      x = cx + size;
      y = cy - size + (d - 2 * size);
    } else if (d < 6 * size) {
      x = cx + size - (d - 4 * size);
      y = cy + size;
    } else {
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

// never show the last label (e.g. 150)
function isLabelShown(label, every, nails) {
  if (label === nails) return false;
  if (label === 1) return true;
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
  const offset = clampInt($("numOffset")?.value, 6, 120, 22);

  ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < nails; i++) {
    const label = i + startAt;
    if (!isLabelShown(label, every, nails)) continue;

    const t = (Math.PI * 2 * i) / nails;
    const baseA = t - Math.PI / 2;

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
  const offset = clampInt($("numOffset")?.value, 6, 120, 22);

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
  const tol = clampFloat($("snap")?.value, 6, 200, 18);
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
   Pointer -> canvas coords
----------------------------- */
function canvasXYFromPointerEvent(ev) {
  const rect = cv.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  return { x, y };
}

/* -----------------------------
   Hover handling (pointer-safe)
----------------------------- */
function updateHoverAt(x, y) {
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
  const radius = clampInt(getZoomInput()?.value, 80, 5000, 320);
  const nails = clampInt($("nails")?.value, 10, 8000, 150);
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

  // hover highlight + label
  if (hoverNail !== null && pts[hoverNail]) {
    const [hx, hy] = pts[hoverNail];
    const startAt2 = getStartAt();
    const label = hoverNail + startAt2;

    ctx.save();

    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const text = String(label);
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const padX = 6;
    const textW = ctx.measureText(text).width;

    const bx = hx + 10;
    const by = hy - 12;
    const bw = textW + padX * 2;
    const bh = 18;

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;

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
  const margin = 28;
  const r = Math.floor(Math.min(cssW, cssH) / 2 - margin);
  const el = getZoomInput();
  if (el) el.value = String(Math.max(80, r));
}

function addNailToSequence(idx) {
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
   Tooltip system for "?"
   Works on mobile (tap) + desktop (hover)
----------------------------- */
function initHelpTooltips() {
  // Build tooltip element
  const tip = document.createElement("div");
  tip.id = "helpTip";
  tip.style.position = "fixed";
  tip.style.zIndex = "9999";
  tip.style.maxWidth = "260px";
  tip.style.padding = "10px 12px";
  tip.style.borderRadius = "12px";
  tip.style.border = "1px solid rgba(0,0,0,0.18)";
  tip.style.background = "rgba(255,255,255,0.96)";
  tip.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
  tip.style.fontSize = "12px";
  tip.style.lineHeight = "1.35";
  tip.style.color = "#111";
  tip.style.display = "none";

  document.body.appendChild(tip);

  let openFor = null;

  function showTip(el, clientX, clientY) {
    const text = el.getAttribute("data-tip") || el.getAttribute("title") || "";
    if (!text) return;

    tip.textContent = text;
    tip.style.display = "block";

    // Position near the "?"
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Measure after display
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;

    let x = clientX + 12;
    let y = clientY + 12;

    if (x + tw + pad > vw) x = vw - tw - pad;
    if (y + th + pad > vh) y = vh - th - pad;

    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    openFor = el;
  }

  function hideTip() {
    tip.style.display = "none";
    openFor = null;
  }

  // Convert existing title="" into data-tip="" so we can control it
  document.querySelectorAll(".q[title]").forEach((el) => {
    el.setAttribute("data-tip", el.getAttribute("title"));
    el.removeAttribute("title");
  });

  // Desktop hover
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest(".q");
    if (!el) return;
    if (e.pointerType === "touch") return; // touch uses tap behaviour
    showTip(el, e.clientX, e.clientY);
  });

  document.addEventListener("pointermove", (e) => {
    if (tip.style.display !== "block") return;
    if (e.pointerType === "touch") return;
    // keep tip following the pointer a bit
    showTip(openFor, e.clientX, e.clientY);
  });

  document.addEventListener("pointerout", (e) => {
    const el = e.target.closest(".q");
    if (!el) return;
    if (e.pointerType === "touch") return;
    hideTip();
  });

  // Mobile tap (toggle)
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target.closest(".q");
      if (el) {
        // toggle same one
        if (openFor === el && tip.style.display === "block") {
          hideTip();
          return;
        }
        showTip(el, e.clientX, e.clientY);
        return;
      }

      // tap anywhere else closes it
      if (tip.style.display === "block") hideTip();
    },
    { passive: true },
  );

  // Close on scroll/resize
  window.addEventListener("scroll", hideTip, { passive: true });
  window.addEventListener("resize", hideTip);
}

/* -----------------------------
   Pointer-based canvas interactions
   (Fixes mobile tap issues + double triggering)
----------------------------- */
function initCanvasPointerControls() {
  // Prevent gestures on canvas
  cv.style.touchAction = "none";

  cv.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    isPointerDown = true;
    try {
      cv.setPointerCapture(ev.pointerId);
    } catch (_) {}

    const { x, y } = canvasXYFromPointerEvent(ev);
    updateHoverAt(x, y);

    const idx = nearestNail(x, y);
    if (idx === null) return;

    addNailToSequence(idx);
    redrawAll();
    updateSeqOutput();
  });

  cv.addEventListener("pointermove", (ev) => {
    if (!pts.length) return;
    const { x, y } = canvasXYFromPointerEvent(ev);
    updateHoverAt(x, y);
  });

  function endPointer(ev) {
    isPointerDown = false;
    hoverNail = null;
    redrawAll();
    try {
      cv.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  }

  cv.addEventListener("pointerup", endPointer);
  cv.addEventListener("pointercancel", endPointer);
  cv.addEventListener("pointerleave", () => {
    if (!isPointerDown) {
      hoverNail = null;
      redrawAll();
    }
  });
}

/* -----------------------------
   Init / Wiring
----------------------------- */
function init() {
  ensureLayerExists();
  syncLayerSelect();

  // Tooltips for ?
  initHelpTooltips();

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

  // Canvas interactions (pointer events)
  initCanvasPointerControls();

  // Zoom buttons
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
    "radius",
  ].forEach((id) => {
    $(id)?.addEventListener("change", onAnyChangeRedraw);
    $(id)?.addEventListener("input", () => {
      // live feedback without breaking performance
      redrawAll();
    });
  });

  // Redraw when draw style changes
  ["color", "opacity", "lw"].forEach((id) => {
    $(id)?.addEventListener("change", () => {
      currentLayer();
      redrawAll();
    });
  });

  // Resize
  window.addEventListener("resize", () => {
    redrawAll();
  });

  // First draw
  redrawAll();
  updateSeqOutput();
}

init();

// Auto-fit on first load
window.addEventListener("load", () => {
  fitToScreen();
  redrawAll();
});
