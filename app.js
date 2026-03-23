document.addEventListener("DOMContentLoaded", function () {

  let cv = document.getElementById("cv");
  let ctx = cv.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let pts = [];
  let layers = [];
  let activeLayer = 0;
  let lastNail = null;
  let hoverNail = null;

  /* -----------------------------
     CANVAS SWITCHING
  ----------------------------- */

  function setActiveCanvas(id) {
    const nextCanvas = document.getElementById(id);
    if (!nextCanvas) return;

    cv = nextCanvas;
    ctx = cv.getContext("2d");
  }

  /* -----------------------------
     TOAST
  ----------------------------- */

  let toastTimer = null;

  function showToast(msg, isError = false) {
    let el = document.getElementById("toastEl");
    if (!el) {
      el = document.createElement("div");
      el.id = "toastEl";
      el.className = "toast";
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.classList.toggle("toast-error", isError);

    clearTimeout(toastTimer);
    el.classList.add("visible");
    toastTimer = setTimeout(() => el.classList.remove("visible"), 2800);
  }

  /* -----------------------------
     HELPERS
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
     MOBILE CONTROL PANEL TOGGLE
  ----------------------------- */

  function toggleControls() {
    const panel = document.getElementById("controlsPanel");
    const btn = document.getElementById("toggleControlsBtn");
    if (!panel || !btn) return;

    panel.classList.toggle("hidden");
    btn.textContent = panel.classList.contains("hidden") ? "▼ Show settings" : "▲ Hide settings";
  }

  /* -----------------------------
     DRAW MODE
  ----------------------------- */

  function openDrawMode() {
    const overlay = $("drawModeOverlay");
    if (!overlay) return;

    ensureLayerExists();

    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("draw-mode-open");

    setActiveCanvas("drawModeCanvas");
    initActiveCanvasPointerControls();
    hoverNail = null;

    if ($("drawColor")) {
      const L = layers[activeLayer];
      $("drawColor").value = L.color || "#000000";
    }

    syncLayerSelect();
    fitToScreen();
    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function closeDrawMode() {
    const overlay = $("drawModeOverlay");
    if (!overlay) return;

    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("draw-mode-open");

    setActiveCanvas("cv");
    initActiveCanvasPointerControls();
    hoverNail = null;

    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  /* -----------------------------
     CANVAS SIZING
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
     ZOOM
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
    updateDrawModeSeqMini();
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
     BOARD POINTS
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
     LAYERS
  ----------------------------- */

  function ensureLayerExists() {
    if (layers.length === 0) {
      layers.push({
        color: $("color")?.value || "#000000",
        opacity: clampFloat($("opacity")?.value, 0, 1, 0.35),
        lw: clampFloat($("lw")?.value, 0.1, 10, 0.7),
        edges: [],
        seq: [],
        step: null,
      });

      activeLayer = 0;
    }
  }

  function syncLayerSelect() {
    const selects = [$("layerSel"), $("drawLayerSel")];

    selects.forEach((sel) => {
      if (!sel) return;

      sel.innerHTML = "";

      layers.forEach((_, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = `Layer ${i + 1}`;
        sel.appendChild(opt);
      });

      sel.value = String(activeLayer);
    });
  }

  function currentLayer() {
    ensureLayerExists();

    const L = layers[activeLayer];

    if ($("color")) L.color = $("color").value || "#000000";
    if ($("opacity")) L.opacity = clampFloat($("opacity").value, 0, 1, 0.35);
    if ($("lw")) L.lw = clampFloat($("lw").value, 0.1, 10, 0.7);

    return L;
  }

  function addLayer() {
    layers.push({
      color: $("color")?.value || "#000000",
      opacity: clampFloat($("opacity")?.value, 0, 1, 0.35),
      lw: clampFloat($("lw")?.value, 0.1, 10, 0.7),
      edges: [],
      seq: [],
      step: null,
    });

    activeLayer = layers.length - 1;
    lastNail = null;

    syncLayerSelect();

    const L = layers[activeLayer];

    if ($("color")) $("color").value = L.color;
    if ($("drawColor")) $("drawColor").value = L.color;
    if ($("opacity")) $("opacity").value = L.opacity;
    if ($("lw")) $("lw").value = L.lw;

    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function switchLayer(index) {
    if (index < 0 || index >= layers.length) return;

    activeLayer = index;
    lastNail = null;

    const L = layers[activeLayer];

    if ($("color")) $("color").value = L.color || "#000000";
    if ($("drawColor")) $("drawColor").value = L.color || "#000000";
    if ($("opacity")) $("opacity").value = L.opacity ?? 0.35;
    if ($("lw")) $("lw").value = L.lw ?? 0.7;

    syncLayerSelect();
    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function clearLayer() {
    ensureLayerExists();

    layers[activeLayer] = {
      color: $("color")?.value || "#000000",
      opacity: clampFloat($("opacity")?.value, 0, 1, 0.35),
      lw: clampFloat($("lw")?.value, 0.1, 10, 0.7),
      edges: [],
      seq: [],
      step: null,
    };

    lastNail = null;

    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  /* -----------------------------
     SEQUENCE OUTPUT
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
  function updateDrawModeSeqMini() {
    const el = $("drawModeSeqMini");
    if (!el) return;

    ensureLayerExists();

    const L = layers[activeLayer];
    const start = $("numStart")?.value === "1" ? 1 : 0;

    if (!L.seq || L.seq.length === 0) {
      el.textContent = "Nothing yet — start tapping nails.";
      return;
    }

    const tail = L.seq
      .slice(-8)
      .map((n) => n + start)
      .join(" → ");
    el.textContent = `Layer ${activeLayer + 1}: … ${tail}`;
  }
  /* -----------------------------
     REDRAW
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

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();

    if (board === "circle") ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    else ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);

    ctx.stroke();

    for (let i = 0; i < nails; i++) {
      const [x, y] = pts[i];
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fill();
    }

    if ($("showNums")?.checked) {
      const every = parseInt($("numEvery")?.value || 10, 10);
      const start = $("numStart")?.value === "1" ? 1 : 0;
      const size = parseInt($("numSize")?.value || 12, 10);
      const offset = parseInt($("numOffset")?.value || 22, 10);

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

    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];

      ctx.lineWidth = layer.lw;
      ctx.strokeStyle = rgba(layer.color, layer.opacity);

      for (const e of layer.edges) {
        if (!pts[e.a] || !pts[e.b]) continue;

        const [x1, y1] = pts[e.a];
        const [x2, y2] = pts[e.b];

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    if (lastNail !== null && hoverNail !== null && hoverNail !== lastNail) {
      const [x1, y1] = pts[lastNail];
      const [x2, y2] = pts[hoverNail];
      const L = layers[activeLayer];

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      ctx.lineWidth = L.lw;
      ctx.strokeStyle = rgba(L.color, 0.45);
      ctx.shadowColor = rgba(L.color, 0.35);
      ctx.shadowBlur = 6;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

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

    saveDesign();
  }

  /* -----------------------------
     ACTIONS
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
    L.generatedPreset = false;
    if (lastNail === null) {
      lastNail = idx;
      if (L.seq.length === 0) L.seq.push(idx);
    } else {
      if (L.seq.length === 0) L.seq.push(lastNail);

      L.edges.push({ a: lastNail, b: idx });
      L.seq.push(idx);
      lastNail = idx;
    }
    updateDrawModeSeqMini();
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
      L.step = null;
    }

    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function clearAll() {
    layers = [];
    activeLayer = 0;
    lastNail = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}

    ensureLayerExists();
    delete layers[activeLayer].step;
    syncLayerSelect();

    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function panDrawModeToLastNail() {
    const wrap = document.querySelector(".draw-mode-canvas-wrap");

    if (!wrap || lastNail === null || !pts[lastNail]) return;

    const [x, y] = pts[lastNail];

    const targetLeft = Math.max(0, x - wrap.clientWidth / 2);
    const targetTop = Math.max(0, y - wrap.clientHeight / 2);

    wrap.scrollTo({
      left: targetLeft,
      top: targetTop,
      behavior: "smooth",
    });
  }
  /* -----------------------------
     CANVAS INTERACTION
  ----------------------------- */

  function nearestNail(x, y) {
    const tol = clampInt($("snap")?.value, 6, 100, 22);

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

  function initActiveCanvasPointerControls() {
    if (!cv) return;

    cv.onpointermove = null;
    cv.onpointerleave = null;
    cv.onpointerdown = null;

    function handleHover(ev) {
      if (ev.pointerType === "touch") return;

      const { x, y } = canvasXYFromPointerEvent(ev);
      hoverNail = nearestNail(x, y);
      redrawAll();
    }

    cv.onpointermove = handleHover;

    cv.onpointerleave = () => {
      hoverNail = null;
      redrawAll();
    };

    cv.onpointerdown = (ev) => {
      const { x, y } = canvasXYFromPointerEvent(ev);
      const idx = nearestNail(x, y);

      if (idx === null) return;

      addNailToSequence(idx);
      redrawAll();
      updateSeqOutput();
      updateDrawModeSeqMini();
      panDrawModeToLastNail();
    };
  }

  /* -----------------------------
     COPY / DOWNLOAD
  ----------------------------- */

  function copySequence() {
    const text = $("seqOut")?.textContent || "";

    navigator.clipboard.writeText(text).then(() => {
      showToast("Sequence copied to clipboard");
    });
  }

  function downloadPreview() {
    const offscreen = document.createElement("canvas");
    offscreen.width = cv.width;
    offscreen.height = cv.height;
    const offCtx = offscreen.getContext("2d");
    offCtx.drawImage(cv, 0, 0);

    // Free-tier watermark
    const wmText = "StringArtStudio.com";
    const fontSize = Math.max(12, Math.round(offscreen.width * 0.022));
    offCtx.save();
    offCtx.globalAlpha = 0.38;
    offCtx.fillStyle = "#444444";
    offCtx.font = `bold ${fontSize}px sans-serif`;
    offCtx.textAlign = "right";
    offCtx.textBaseline = "bottom";
    offCtx.fillText(wmText, offscreen.width - 10, offscreen.height - 10);
    offCtx.restore();

    const link = document.createElement("a");
    link.download = "string-art-preview.png";
    link.href = offscreen.toDataURL("image/png");
    link.click();
  }

  /* -----------------------------
     SAVE / LOAD  (LOCAL STORAGE)
  ----------------------------- */

  const SAVE_KEY = "sas_design_v1";

  function saveDesign() {
    try {
      const state = {
        layers,
        activeLayer,
        settings: {
          board: $("board")?.value,
          nails: $("nails")?.value,
          radius: $("radius")?.value,
          showNums: $("showNums")?.checked,
          numEvery: $("numEvery")?.value,
          numStart: $("numStart")?.value,
          numSize: $("numSize")?.value,
          numOffset: $("numOffset")?.value,
        },
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function hasSavedDesign() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
  }

  function loadSavedDesign(silent) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { if (!silent) showToast("No saved design found.", true); return false; }
      const state = JSON.parse(raw);
      if (!Array.isArray(state.layers) || state.layers.length === 0) return false;

      layers = state.layers;
      activeLayer = Math.min(state.activeLayer || 0, layers.length - 1);

      const s = state.settings || {};
      if (s.board != null && $("board")) $("board").value = s.board;
      if (s.nails != null && $("nails")) $("nails").value = s.nails;
      if (s.radius != null && $("radius")) $("radius").value = s.radius;
      if (s.showNums != null && $("showNums")) $("showNums").checked = s.showNums;
      if (s.numEvery != null && $("numEvery")) $("numEvery").value = s.numEvery;
      if (s.numStart != null && $("numStart")) $("numStart").value = s.numStart;
      if (s.numSize != null && $("numSize")) $("numSize").value = s.numSize;
      if (s.numOffset != null && $("numOffset")) $("numOffset").value = s.numOffset;

      syncLayerSelect();
      switchLayer(activeLayer);
      if (!silent) showToast("Design loaded.");
      return true;
    } catch (_) {
      return false;
    }
  }

  /* -----------------------------
     CONTINUE PATTERN
  ----------------------------- */

  function continuePattern() {
    ensureLayerExists();

    const L = layers[activeLayer];
    const seq = L.seq;
    if (L.generatedPreset === true) {
      showToast("Continue only works on manually drawn patterns.", true);
      return;
    }
    if (seq.length < 4) {
      showToast("Draw at least two lines to detect a pattern.", true);
      return;
    }

    const nails = pts.length;
    const maxSteps = clampInt($("continueSteps")?.value, 1, 500, 20);

    const stepA = (seq[2] - seq[0] + nails) % nails;
    const stepB = (seq[3] - seq[1] + nails) % nails;

    if (stepA === 0 || stepB === 0) {
      showToast("Could not detect a repeat pattern.", true);
      return;
    }

    let a = seq[seq.length - 2];
    let b = seq[seq.length - 1];

    for (let i = 0; i < maxSteps; i++) {
      const nextA = (a + stepA) % nails;
      const nextB = (b + stepB) % nails;

      L.edges.push({ a: b, b: nextA });
      L.seq.push(nextA);

      L.edges.push({ a: nextA, b: nextB });
      L.seq.push(nextB);

      a = nextA;
      b = nextB;
    }

    lastNail = b;

    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
    panDrawModeToLastNail();
  }
  /* -----------------------------
     QUICK PATTERNS
  ----------------------------- */

  let selectedPreset = "flower";

  function initQuickPatterns() {
    const allPresetButtons = document.querySelectorAll("[data-preset]");
    const offsetSlider = document.getElementById("presetOffset");
    const offsetValue = document.getElementById("presetOffsetValue");
    const generateBtn = document.getElementById("generatePresetBtn");

    if (offsetSlider && offsetValue) {
      offsetValue.textContent = offsetSlider.value;

      offsetSlider.addEventListener("input", () => {
        offsetValue.textContent = offsetSlider.value;
        generatePreset(selectedPreset, getPresetOffset());
      });
    }

    allPresetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPreset = btn.dataset.preset || "spiral";
        setActivePresetButton(selectedPreset);

        // Mobile = instant generate
        if (window.innerWidth < 900) {
          const offset = getPresetOffset();
          generatePreset(selectedPreset, offset);
        }
      });
    });

    if (generateBtn) {
      generateBtn.addEventListener("click", () => {
        const offset = getPresetOffset();
        generatePreset(selectedPreset, offset);
      });
    }

    setActivePresetButton(selectedPreset);
  }

  function setActivePresetButton(presetName) {
    document.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === presetName);
    });

    const slider = document.getElementById("presetOffset");
    const value = document.getElementById("presetOffsetValue");

    if (slider) {
      if (presetName === "flower") slider.value = 10;
      if (presetName === "cardioid") slider.value = 3;
      if (presetName === "web") slider.value = 0;
      if (presetName === "spiral") slider.value = 15;
      if (presetName === "star") slider.value = 12;
    }

    if (slider && value) value.textContent = slider.value;
  }

  function getPresetOffset() {
    const slider = document.getElementById("presetOffset");
    if (!slider) return 18;
    return parseInt(slider.value, 10) || 18;
  }

  function clearActiveLayerForPreset() {
    ensureLayerExists();

    layers[activeLayer].edges = [];
    layers[activeLayer].seq = [];
    layers[activeLayer].step = null;

    lastNail = null;
  }

  function addPresetEdge(a, b) {
    ensureLayerExists();

    if (a === b) return;
    if (a < 0 || b < 0) return;
    if (a >= pts.length || b >= pts.length) return;

    layers[activeLayer].edges.push({ a, b });
  }

  function wrapIndex(index, total) {
    return ((index % total) + total) % total;
  }

  function buildSeqFromEdges(edges) {
    if (!edges.length) return [];

    const seq = [edges[0].a, edges[0].b];

    for (let i = 1; i < edges.length; i++) {
      seq.push(edges[i].b);
    }

    return seq;
  }
  function buildEdgesFromSeq(seq) {
    const edges = [];

    if (!seq || seq.length < 2) return edges;

    for (let i = 0; i < seq.length - 1; i++) {
      edges.push({ a: seq[i], b: seq[i + 1] });
    }

    return edges;
  }

  function generatePreset(presetName, offset) {
    if (!pts || pts.length < 3) return;

    clearActiveLayerForPreset();

    const total = pts.length;
    let generatedEdges = [];
    let generatedSeq = [];

    switch (presetName) {
      case "cardioid":
        generatedEdges = generateCardioidPattern(total, offset);
        generatedSeq = buildSeqFromEdges(generatedEdges);
        break;

      case "web":
        generatedEdges = generateWebPattern(total, offset);
        generatedSeq = buildSeqFromEdges(generatedEdges);
        break;

      case "flower":
        generatedEdges = generateFlowerPattern(total, offset);
        generatedSeq = buildSeqFromEdges(generatedEdges);
        break;

      case "spiral":
        generatedSeq = generateSpiralSequence(total, offset);
        generatedEdges = buildEdgesFromSeq(generatedSeq);
        break;

      case "star":
        generatedEdges = generateStarPattern(total, offset);
        generatedSeq = buildSeqFromEdges(generatedEdges);
        break;

      default:
        generatedEdges = generateFlowerPattern(total, offset);
        generatedSeq = buildSeqFromEdges(generatedEdges);
        break;
    }

    layers[activeLayer].edges = generatedEdges;
    layers[activeLayer].seq = generatedSeq;
    layers[activeLayer].generatedPreset = true;

    if (generatedSeq.length) {
      lastNail = generatedSeq[generatedSeq.length - 1];
    }

    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function generateFlowerPattern(total, offset) {
    const edges = [];

    for (let i = 0; i < total; i++) {
      const a = i;
      const b = wrapIndex(i * 2 + offset, total);
      edges.push({ a, b });
    }

    return edges;
  }

  function generateCardioidPattern(total, offset) {
    const edges = [];
    const multiplier = Math.max(2, Math.min(20, offset));

    for (let i = 0; i < total; i++) {
      const b = (i * multiplier) % total;
      if (i !== b) edges.push({ a: i, b });
    }

    return edges;
  }

  function generateWebPattern(total, offset) {
    const edges = [];
    const skip = Math.max(2, Math.floor(total / 3) + offset);

    for (let i = 0; i < total; i++) {
      edges.push({ a: i, b: wrapIndex(i + skip, total) });
      edges.push({ a: i, b: wrapIndex(i + total - skip, total) });
    }

    return edges;
  }

  function generateSpiralSequence(total, offset) {
    const seq = [];
    const baseStep = Math.max(2, offset);
    let current = 0;
    seq.push(current);

    for (let i = 0; i < total * 3; i++) {
      const step = baseStep + Math.floor(i / total);
      current = wrapIndex(current + step, total);
      seq.push(current);
    }

    return seq;
  }

  function generateStarPattern(total, offset) {
    const edges = [];
    const skip = Math.max(2, Math.floor(total / 2) - offset);

    for (let i = 0; i < total; i++) {
      edges.push({ a: i, b: wrapIndex(i + skip, total) });
    }

    return edges;
  }
  /* -----------------------------
     INIT
  ----------------------------- */

  function init() {
    ensureLayerExists();
    syncLayerSelect();
    initActiveCanvasPointerControls();
    initQuickPatterns();
    $("fit")?.addEventListener("click", () => {
      fitToScreen();
      redrawAll();
    });

    $("undo")?.addEventListener("click", undo);
    $("clearAll")?.addEventListener("click", clearAll);
    $("clearLayer")?.addEventListener("click", clearLayer);
    $("newLayer")?.addEventListener("click", addLayer);
    $("continuePattern")?.addEventListener("click", continuePattern);
    $("toggleControlsBtn")?.addEventListener("click", toggleControls);
    $("exportSeq")?.addEventListener("click", copySequence);
    $("downloadPng")?.addEventListener("click", downloadPreview);
    $("saveDesignBtn")?.addEventListener("click", () => { saveDesign(); showToast("Design saved."); });
    $("loadDesignBtn")?.addEventListener("click", () => loadSavedDesign(false));
    $("zoomIn")?.addEventListener("click", () => nudgeZoom(1));
    $("zoomOut")?.addEventListener("click", () => nudgeZoom(-1));

    $("openDrawMode")?.addEventListener("click", openDrawMode);
    $("closeDrawMode")?.addEventListener("click", closeDrawMode);
    $("drawUndo")?.addEventListener("click", undo);
    $("drawNewLayer")?.addEventListener("click", addLayer);
    $("drawContinue")?.addEventListener("click", continuePattern);
    $("drawZoomIn")?.addEventListener("click", () => nudgeZoom(1));
    $("drawZoomOut")?.addEventListener("click", () => nudgeZoom(-1));

    getZoomInput()?.addEventListener("change", applyZoomFromUI);

    [
      "board",
      "nails",
      "radius",
      "snap",
      "showNums",
      "numEvery",
      "numStart",
      "numSize",
      "numOffset",
    ].forEach((id) => {
      $(id)?.addEventListener("change", () => {
        lastNail = null;
        redrawAll();
        updateSeqOutput();
        updateDrawModeSeqMini();
      });
    });

    $("layerSel")?.addEventListener("change", (e) => {
      switchLayer(parseInt(e.target.value, 10));
    });

    $("drawLayerSel")?.addEventListener("change", (e) => {
      switchLayer(parseInt(e.target.value, 10));
    });

    $("color")?.addEventListener("input", () => {
      ensureLayerExists();
      layers[activeLayer].color = $("color").value;

      if ($("drawColor")) {
        $("drawColor").value = $("color").value;
      }

      redrawAll();
      updateDrawModeSeqMini();
    });

    $("drawColor")?.addEventListener("input", (e) => {
      ensureLayerExists();
      layers[activeLayer].color = e.target.value;

      if ($("color")) {
        $("color").value = e.target.value;
      }

      redrawAll();
      updateDrawModeSeqMini();
    });
    if (window.innerWidth <= 900) {
      $("controlsPanel")?.classList.add("hidden");
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(redrawAll, 100);
    });

    if (hasSavedDesign()) {
      loadSavedDesign(true);
      showToast("Last design restored.");
    } else {
      redrawAll();
      updateSeqOutput();
      updateDrawModeSeqMini();
    }
  }

  init();
});
