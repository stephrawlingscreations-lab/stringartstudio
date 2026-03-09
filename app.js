document.addEventListener("DOMContentLoaded", function () {
  console.log("JS LOADED");

  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let pts = [];
  let layers = [];
  let activeLayer = 0;
  let lastNail = null;

  let hoverNail = null;
  let rafHover = 0;
  let hoverX = 0;
  let hoverY = 0;
  let isPointerDown = false;

  /* -----------------------------
START HINT CONTROL
----------------------------- */

  function hideStartHint() {
    const hint = document.getElementById("startHint");
    if (hint) hint.style.display = "none";
  }

  /* -----------------------------
STATUS BAR
----------------------------- */

  function updateStatusBar() {
    const el = $("statusBar");
    if (!el) return;

    const board = $("board")?.value || "circle";
    const nails = $("nails")?.value || 0;

    let lines = 0;

    layers.forEach((l) => {
      lines += l.edges.length;
    });

    el.textContent = `Board: ${board} | Nails: ${nails} | Lines: ${lines}`;
  }

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
Mobile control panel toggle
----------------------------- */

  function toggleControls() {
    const panel = document.getElementById("controlsPanel");
    const btn = document.getElementById("toggleControlsBtn");

    panel.classList.toggle("hidden");

    if (panel.classList.contains("hidden")) {
      btn.textContent = "▼ Show";
    } else {
      btn.textContent = "▲ Hide";
    }
  }

  /* -----------------------------
Canvas sizing
----------------------------- */

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;

    const cssW = cv.clientWidth || 800;
    const size = cssW;

    cv.width = Math.floor(size * dpr);
    cv.height = Math.floor(size * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { cssW: size, cssH: size };
  }

  /* -----------------------------
Zoom
----------------------------- */

  function getZoomInput() {
    return $("radius");
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

  /* -----------------------------
Sequence output
----------------------------- */

  function updateSeqOutput() {
    const el = $("seqOut");
    if (!el) return;

    const lines = [];

    layers.forEach((L, i) => {
      if (!L.seq || L.seq.length === 0) return;

      const start = $("numStart")?.value === "1" ? 1 : 0;
      lines.push(`Layer ${i + 1}: ` + L.seq.map((n) => n + start).join(" → "));
    });

    el.textContent = lines.length
      ? lines.join("\n\n")
      : "Nothing yet — click two nails to begin.";
  }

  /* -----------------------------
Redraw
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

    /* outline */

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();

    if (board === "circle") ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    else ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);

    ctx.stroke();

    /* nail dots */

    for (let i = 0; i < nails; i++) {
      const [x, y] = pts[i];

      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fill();
    }
    /* numbers around board */

    if ($("showNums")?.checked) {
      const every = parseInt($("numEvery")?.value || 10);
      const start = $("numStart")?.value === "1" ? 1 : 0;
      const size = parseInt($("numSize")?.value || 12);
      const offset = parseInt($("numOffset")?.value || 22);

      ctx.font = size + "px system-ui";
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = 0; i < nails; i++) {
        const label = i + start;
        if (label === nails) continue;

        if (every > 1 && label % every !== 0 && label !== start) continue;

        const [x, y] = pts[i];

        const dx = x - cx;
        const dy = y - cy;

        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        const nx = dx / len;
        const ny = dy / len;

        const lx = x + nx * offset;
        const ly = y + ny * offset;

        ctx.fillText(label.toString(), lx, ly);
      }
    }

    /* layers */

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
    /* hover nail highlight */

    if (hoverNail !== null && hoverNail < pts.length) {
      const [x, y] = pts[hoverNail];

      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fill();
    }
    /* hover nail number label */

    if (hoverNail !== null) {
      const [x, y] = pts[hoverNail];

      const start = $("numStart")?.value === "1" ? 1 : 0;
      const label = `${hoverNail + start}`;

      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillText(label, x, y - 10);
    }
    updateStatusBar();
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
    hideStartHint();

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

  function clearAll() {
    layers = [];
    activeLayer = 0;
    lastNail = null;

    ensureLayerExists();
    syncLayerSelect();

    redrawAll();
    updateSeqOutput();
  }

  /* -----------------------------
Reset board button
----------------------------- */

  function resetBoard() {
    $("nails").value = 150;
    $("radius").value = 320;

    clearAll();

    redrawAll();
    updateSeqOutput();
  }
  /* -----------------------------
Canvas interaction
----------------------------- */

  function nearestNail(x, y) {
    const tol = 35; // simple and reliable hover distance

    let bestIdx = null;
    let bestD2 = tol * tol;

    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - x;
      const dy = pts[i][1] - y;

      const d2 = dx * dx + dy * dy;

      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  function canvasXYFromPointerEvent(ev) {
    const rect = cv.getBoundingClientRect();

    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    };
  }

  function initCanvasPointerControls() {
    function handleHover(ev) {
      if (ev.pointerType === "touch") return;

      const { x, y } = canvasXYFromPointerEvent(ev);

      hoverX = x;
      hoverY = y;

      hoverNail = nearestNail(x, y);

      redrawAll();
    }

    // hover detection
    cv.addEventListener("pointermove", handleHover);

    cv.addEventListener("mouseleave", () => {
      hoverNail = null;
      redrawAll();
    });

    // clicking nails
    cv.addEventListener("pointerdown", (ev) => {
      const { x, y } = canvasXYFromPointerEvent(ev);
      const idx = nearestNail(x, y);

      if (idx === null) return;

      addNailToSequence(idx);

      redrawAll();
      updateSeqOutput();
    });
  }
  /* -----------------------------
Init
----------------------------- */

  function init() {
    ensureLayerExists();
    syncLayerSelect();
    initCanvasPointerControls();
    $("fit")?.addEventListener("click", () => {
      fitToScreen();
      redrawAll();
    });

    $("undo")?.addEventListener("click", undo);
    $("clearAll")?.addEventListener("click", clearAll);
    $("continuePattern")?.addEventListener("click", continuePattern);
    $("toggleControlsBtn")?.addEventListener("click", toggleControls);
    $("exportSeq")?.addEventListener("click", copySequence);
    $("downloadPng")?.addEventListener("click", downloadPreview);
    $("zoomIn")?.addEventListener("click", () => nudgeZoom(1));
    $("zoomOut")?.addEventListener("click", () => nudgeZoom(-1));

    getZoomInput()?.addEventListener("change", applyZoomFromUI);
    $("undoFloating")?.addEventListener("click", undo);
    ["board", "nails", "radius"].forEach((id) => {
      $(id)?.addEventListener("change", () => {
        lastNail = null;
        redrawAll();
        updateSeqOutput();
      });
    });

    window.addEventListener("resize", redrawAll);

    redrawAll();
    updateSeqOutput();
  }
  function copySequence() {
    const text = $("seqOut")?.textContent || "";

    navigator.clipboard.writeText(text).then(() => {
      alert("Sequence copied to clipboard");
    });
  }
  function downloadPreview() {
    const link = document.createElement("a");
    link.download = "string-art-preview.png";
    link.href = cv.toDataURL("image/png");
    link.click();
  }
  function continuePattern() {
    ensureLayerExists();

    const L = layers[activeLayer];
    if (!L || !L.seq || L.seq.length < 6) {
      alert("Draw at least 6 nails first.");
      return;
    }

    const nails = pts.length;
    const seq = L.seq;

    // split into left / right sequences
    const left = [];
    const right = [];

    for (let i = 0; i < seq.length; i += 2) left.push(seq[i]);
    for (let i = 1; i < seq.length; i += 2) right.push(seq[i]);

    // helper: convert step to shortest direction
    function normaliseStep(step) {
      if (step > nails / 2) step -= nails;
      if (step < -nails / 2) step += nails;
      return step;
    }

    // build step list
    function getSteps(arr) {
      const steps = [];

      for (let i = 1; i < arr.length; i++) {
        steps.push(normaliseStep(arr[i] - arr[i - 1]));
      }

      return steps;
    }

    // detect repeating step cycle
    function detectCycle(steps) {
      for (let size = 1; size <= steps.length; size++) {
        let ok = true;

        for (let i = 0; i < steps.length; i++) {
          if (steps[i] !== steps[i % size]) {
            ok = false;
            break;
          }
        }

        if (ok) return steps.slice(0, size);
      }

      return steps;
    }

    const leftSteps = detectCycle(getSteps(left));
    const rightSteps = detectCycle(getSteps(right));

    let a = left[left.length - 1];
    let b = right[right.length - 1];

    const startA = left[0];
    const startB = right[0];

    let li = 0;
    let ri = 0;
    let safety = 0;

    while (safety < nails) {
      a = (a + leftSteps[li] + nails) % nails;
      b = (b + rightSteps[ri] + nails) % nails;

      if (a === startA && b === startB) break;

      L.edges.push({ a, b });
      L.seq.push(a, b);

      li = (li + 1) % leftSteps.length;
      ri = (ri + 1) % rightSteps.length;

      safety++;
    }

    lastNail = b;

    redrawAll();
    updateSeqOutput();
  }
  init();

  window.addEventListener("load", () => {
    fitToScreen();
    redrawAll();
  });
});
