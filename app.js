document.addEventListener("DOMContentLoaded", function () {

  /* -----------------------------
     PRO UNLOCK (Gumroad redirect)
  ----------------------------- */

  // After a Gumroad purchase, the buyer is redirected to:
  //   https://stephrawlingscreations.ie/?sas_pro=unlock
  // Set that as your "Redirect URL" in the Gumroad product settings.
  // The parameter is detected here, saved to localStorage, then removed from the URL.

  (function checkProRedirect() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("sas_pro") === "unlock") {
        localStorage.setItem("sas_pro_unlocked", "1");
        const clean = window.location.pathname + window.location.hash;
        history.replaceState({}, "", clean);
        setTimeout(() => openProModal(), 300);
      }
    } catch (_) {}
  })();

  function isPro() {
    try {
      return localStorage.getItem("sas_pro_unlocked") === "1";
    } catch (_) {
      return false;
    }
  }

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

      layers.forEach((layer, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = layer.hidden ? `Layer ${i + 1} (hidden)` : `Layer ${i + 1}`;
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
    syncHideButton();

    const L = layers[activeLayer];

    if ($("color")) $("color").value = L.color;
    if ($("drawColor")) $("drawColor").value = L.color;
    if ($("opacity")) {
      $("opacity").value = L.opacity;
      if ($("opacityVal")) $("opacityVal").textContent = Math.round(L.opacity * 100) + "%";
    }
    if ($("lw")) {
      $("lw").value = L.lw;
      if ($("lwVal")) $("lwVal").textContent = L.lw.toFixed(1);
    }

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
    if ($("opacity")) {
      $("opacity").value = L.opacity ?? 0.35;
      if ($("opacityVal")) $("opacityVal").textContent = Math.round((L.opacity ?? 0.35) * 100) + "%";
    }
    if ($("lw")) {
      $("lw").value = L.lw ?? 0.7;
      if ($("lwVal")) $("lwVal").textContent = (L.lw ?? 0.7).toFixed(1);
    }

    syncLayerSelect();
    syncHideButton();
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

  function deleteLayer() {
    if (layers.length <= 1) {
      showToast("Can't delete the only layer — use Clear layer instead.", true);
      return;
    }
    layers.splice(activeLayer, 1);
    activeLayer = Math.min(activeLayer, layers.length - 1);
    lastNail = null;
    syncLayerSelect();
    syncHideButton();
    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function toggleLayerVisibility() {
    ensureLayerExists();
    layers[activeLayer].hidden = !layers[activeLayer].hidden;
    syncHideButton();
    syncLayerSelect();
    redrawAll();
  }

  function syncHideButton() {
    const btn = $("toggleLayerVis");
    if (!btn) return;
    const isHidden = layers[activeLayer]?.hidden;
    btn.textContent = isHidden ? "👁 Show layer" : "👁 Hide layer";
    btn.style.opacity = isHidden ? "0.6" : "1";
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
      if (layer.hidden) continue;

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
    if (L.edges.length > 0 || L.seq.length > 0) showToast("Line removed.");
  }

  function clearAll() {
    if (!confirm("Clear everything and start over? This cannot be undone.")) return;
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

    // Watermark
    const wmText = "stephrawlingscreations.ie";
    const fontSize = Math.max(12, Math.round(offscreen.width * 0.022));
    const logoHeight = fontSize * 2;
    const padding = 10;

    const triggerDownload = () => {
      const link = document.createElement("a");
      link.download = "string-art-preview.png";
      link.href = offscreen.toDataURL("image/png");
      link.click();
    };

    const drawWatermark = (logo) => {
      offCtx.save();
      offCtx.globalAlpha = 0.45;

      let textX = offscreen.width - padding;

      if (logo) {
        const logoW = Math.round(logo.width * (logoHeight / logo.height));
        const logoX = offscreen.width - padding - logoW;
        const logoY = offscreen.height - padding - logoHeight;
        offCtx.drawImage(logo, logoX, logoY, logoW, logoHeight);
        textX = logoX - 8;
      }

      offCtx.fillStyle = "#444444";
      offCtx.font = `bold ${fontSize}px sans-serif`;
      offCtx.textAlign = "right";
      offCtx.textBaseline = "bottom";
      offCtx.fillText(wmText, textX, offscreen.height - padding);
      offCtx.restore();

      triggerDownload();
    };

    const logoImg = new Image();
    logoImg.onload = () => drawWatermark(logoImg);
    logoImg.onerror = () => drawWatermark(null);
    logoImg.src = "logo.png";
  }

  /* -----------------------------
     SAVE / LOAD  (LOCAL STORAGE)
  ----------------------------- */

  const SAVE_KEY = "sas_design_v1";

  function saveDesign() {
    const hasContent = layers.some(L => L.edges && L.edges.length > 0);
    if (!hasContent) return;
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
    $("deleteLayer")?.addEventListener("click", deleteLayer);
    $("toggleLayerVis")?.addEventListener("click", toggleLayerVisibility);
    $("continuePattern")?.addEventListener("click", continuePattern);
    $("toggleControlsBtn")?.addEventListener("click", toggleControls);
    $("exportSeq")?.addEventListener("click", copySequence);
    $("downloadPng")?.addEventListener("click", downloadPreview);
    $("downloadTemplateBtn")?.addEventListener("click", () => {
      document.getElementById("proModal").style.display = "none";
      downloadPrintableTemplate();
    });
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

    $("opacity")?.addEventListener("input", () => {
      ensureLayerExists();
      const val = parseFloat($("opacity").value);
      layers[activeLayer].opacity = val;
      const pct = Math.round(val * 100) + "%";
      if ($("opacityVal")) $("opacityVal").textContent = pct;
      redrawAll();
    });

    $("lw")?.addEventListener("input", () => {
      ensureLayerExists();
      const val = parseFloat($("lw").value);
      layers[activeLayer].lw = val;
      if ($("lwVal")) $("lwVal").textContent = val.toFixed(1);
      redrawAll();
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

    syncHideButton();

    if (hasSavedDesign()) {
      loadSavedDesign(true);
      showToast("Last design restored.");
    } else {
      redrawAll();
      updateSeqOutput();
      updateDrawModeSeqMini();
    }
  }

  /* -----------------------------
     PRINTABLE TEMPLATE
  ----------------------------- */

  function downloadPrintableTemplate() {
    if (!isPro()) {
      openProModal();
      return;
    }

    ensureLayerExists();

    const hasContent = layers.some((L) => L.edges && L.edges.length > 0);
    if (!hasContent) {
      showToast("Draw some lines first before downloading a template.", true);
      return;
    }

    const board = $("board")?.value || "circle";
    const nailCount = clampInt($("nails")?.value, 10, 8000, 150);
    const numStart = $("numStart")?.value === "1" ? 1 : 0;

    // Fixed SVG coordinate space for the board diagram
    const SZ = 560;
    const CX = SZ / 2;
    const CY = SZ / 2;
    const BRAD = SZ / 2 - 44;

    const svgPts =
      board === "circle"
        ? pointsCircle(nailCount, CX, CY, BRAD)
        : pointsSquarePerimeter(nailCount, CX, CY, BRAD);

    // Board outline
    const outline =
      board === "circle"
        ? `<circle cx="${CX}" cy="${CY}" r="${BRAD}" fill="none" stroke="#ccc" stroke-width="1.5"/>`
        : `<rect x="${CX - BRAD}" y="${CY - BRAD}" width="${BRAD * 2}" height="${BRAD * 2}" fill="none" stroke="#ccc" stroke-width="1.5"/>`;

    // String lines
    let svgLines = "";
    for (const L of layers) {
      if (!L.edges?.length) continue;
      const c = hexToRgb(L.color || "#000000");
      const op = Math.max(0.15, (L.opacity || 0.35) * 0.7).toFixed(2);
      for (const e of L.edges) {
        if (!svgPts[e.a] || !svgPts[e.b]) continue;
        const [x1, y1] = svgPts[e.a];
        const [x2, y2] = svgPts[e.b];
        svgLines += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgb(${c.r},${c.g},${c.b})" stroke-opacity="${op}" stroke-width="${Math.min(L.lw || 0.7, 1)}"/>`;
      }
    }

    // Nail dots and labels
    const showEvery =
      nailCount > 400 ? 50 : nailCount > 200 ? 25 : nailCount > 100 ? 10 : nailCount > 60 ? 5 : 1;
    const labelSize = nailCount > 200 ? 6 : 8;

    let svgNails = "";
    for (let i = 0; i < nailCount; i++) {
      const [x, y] = svgPts[i];
      svgNails += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#2a2a2a"/>`;
      if (i % showEvery === 0) {
        const dx = x - CX;
        const dy = y - CY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const lx = (x + (dx / len) * 14).toFixed(1);
        const ly = (y + (dy / len) * 14).toFixed(1);
        svgNails += `<text x="${lx}" y="${ly}" font-size="${labelSize}" text-anchor="middle" dominant-baseline="middle" fill="#555">${i + numStart}</text>`;
      }
    }

    // Stats
    const totalLines = layers.reduce((s, L) => s + (L.edges?.length || 0), 0);
    const activeLayers = layers.filter((L) => L.edges?.length > 0).length;

    // Thread length estimation
    // Assumes a 30 cm board (150 mm radius). Scale linearly for other sizes.
    const PHYSICAL_RADIUS_MM = 150;
    const mmPerSvgUnit = PHYSICAL_RADIUS_MM / BRAD;
    let totalThreadMm = 0;
    const layerThreadMm = layers.map((L) => {
      if (!L.edges?.length) return 0;
      let mm = 0;
      for (const e of L.edges) {
        if (!svgPts[e.a] || !svgPts[e.b]) continue;
        const [x1, y1] = svgPts[e.a];
        const [x2, y2] = svgPts[e.b];
        const dx = x2 - x1, dy = y2 - y1;
        mm += Math.sqrt(dx * dx + dy * dy) * mmPerSvgUnit;
      }
      totalThreadMm += mm;
      return mm;
    });

    const toMetres = (mm) => (mm / 1000).toFixed(1);

    // Thread requirements section
    let threadRows = "";
    layers.forEach((L, li) => {
      if (!L.edges?.length) return;
      const c = hexToRgb(L.color || "#000000");
      threadRows += `<tr>
        <td><span class="dot" style="background:rgb(${c.r},${c.g},${c.b})"></span>Layer ${li + 1}</td>
        <td class="tv">~${toMetres(layerThreadMm[li])} m</td>
      </tr>`;
    });
    const threadHTML = `
      <div class="section">
        <h2 class="sh">Thread Requirements</h2>
        <p class="sn">Based on a 30 cm board — scale proportionally for other sizes. Add ~10% for tying off.</p>
        <table class="tt">
          ${threadRows}
          <tr class="tt-total"><td>Total</td><td class="tv">~${toMetres(totalThreadMm)} m</td></tr>
        </table>
      </div>`;

    // Start nail
    const firstActiveLayer = layers.find((L) => L.seq?.length > 0);
    const startNailLabel = firstActiveLayer ? firstActiveLayer.seq[0] + numStart : "—";

    // Sequence + layer sections
    let seqHTML = "";
    let isFirst = true;
    layers.forEach((L, li) => {
      if (!L.seq?.length) return;
      const c = hexToRgb(L.color || "#000000");
      const colorRgb = `rgb(${c.r},${c.g},${c.b})`;
      const arrowSeq = L.seq.map((n) => n + numStart).join(" → ");
      const moves = L.seq.length - 1;
      seqHTML += `<section class="ls${isFirst ? " ls-first" : ""}">
        <div class="lh">
          <span class="ldot" style="background:${colorRgb}"></span>
          <div>
            <h2 class="lt">Layer ${li + 1} <span style="color:${colorRgb}">(${L.color || "#000000"})</span> — ${moves} moves</h2>
            <p class="lsub">Follow the full sequence below</p>
          </div>
        </div>
        <p class="arrow-seq">${arrowSeq}</p>
        <div class="step-grid">`;
      L.seq.forEach((nail, i) => {
        seqHTML += `<div class="step"><span class="sl">${i === 0 ? "Start" : "#" + i}</span><span class="sn2">${nail + numStart}</span></div>`;
      });
      seqHTML += `</div></section>`;
      isFirst = false;
    });

    const date = new Date().toLocaleDateString("en-IE", {
      day: "numeric", month: "long", year: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>String Art Build Guide – stephrawlingscreations.ie</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#e5e5e5;color:#1e1e1e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#fff;border-bottom:1px solid #ddd;padding:12px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
.toolbar h2{font-size:14px;font-weight:600;flex:1;margin:0;color:#444}
.btn-print{background:#1e1e1e;color:#fff;border:none;border-radius:6px;padding:9px 20px;font-size:13px;font-weight:500;cursor:pointer}
.page{width:210mm;min-height:297mm;padding:15mm 18mm 20mm;margin:24px auto;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.14);position:relative}
/* Page header */
.ph{margin-bottom:7mm;padding-bottom:5mm;border-bottom:0.75pt solid #e0e0e0}
.ph-label{font-size:7pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#bbb;margin-bottom:2mm}
.ph h1{font-size:22pt;font-weight:700;letter-spacing:-.03em;line-height:1;color:#1e1e1e}
.ph p{font-size:8.5pt;color:#bbb;margin-top:2mm}
/* Board */
.board-wrap{display:flex;justify-content:center;margin:3mm 0 4mm}
.board-wrap svg{width:155mm;height:155mm}
/* Stats */
.stats{display:flex;margin:4mm 0;border:0.5pt solid #ececec;border-radius:8pt;overflow:hidden}
.stat{flex:1;text-align:center;padding:4mm 2mm;border-right:0.5pt solid #ececec}
.stat:last-child{border-right:none}
.stat b{display:block;font-size:16pt;font-weight:700;line-height:1.15}
.stat span{font-size:7pt;color:#bbb;text-transform:uppercase;letter-spacing:.07em}
/* Scale */
.scale-ref{text-align:center;margin-top:4mm}
.scale-bar{display:inline-block;width:37.8pt;height:4pt;background:#333;border-radius:1pt}
.scale-ref p{font-size:7.5pt;color:#bbb;margin-top:2pt}
/* Section dividers */
.section{margin-top:6mm;padding-top:5mm;border-top:0.5pt solid #ececec}
.sh{font-size:9.5pt;font-weight:700;letter-spacing:.03em;margin-bottom:2.5mm;text-transform:uppercase;color:#555}
.sn{font-size:7.5pt;color:#bbb;margin-bottom:3mm}
/* Thread table */
.tt{width:100%;border-collapse:collapse;font-size:9pt}
.tt td{padding:2mm 2.5mm;border-bottom:0.3pt solid #f2f2f2;vertical-align:middle}
.tt tr:last-child td{border-bottom:none}
.tt-total td{font-weight:700;padding-top:3mm;border-top:0.75pt solid #ccc;border-bottom:none}
.tv{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;font-size:10pt}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}
/* Start box */
.start-box{background:#f8f8f8;border-radius:6pt;padding:4mm 5mm;margin-bottom:6mm;border-left:2pt solid #1e1e1e}
.start-box h3{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:2mm}
.start-box ol{padding-left:14pt;font-size:8.5pt;color:#444;line-height:2}
/* Layer sections */
.ls{padding-top:6mm;margin-top:6mm;border-top:0.5pt solid #ececec;break-inside:avoid}
.ls-first{border-top:none;padding-top:0;margin-top:0}
.lh{display:flex;align-items:flex-start;gap:8pt;margin-bottom:3mm}
.ldot{display:inline-block;width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:2pt}
.lt{font-size:11pt;font-weight:700;line-height:1.2;color:#1e1e1e}
.lsub{font-size:8pt;color:#aaa;margin-top:1mm}
.arrow-seq{font-size:7pt;color:#666;margin-bottom:3mm;line-height:1.8;word-break:break-all;background:#f8f8f8;padding:3mm 4mm;border-radius:4pt;border-left:2pt solid #ddd;max-height:20mm;overflow:hidden}
.step-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(28pt,1fr));gap:1.5pt}
.step{border:0.3pt solid #ebebeb;border-radius:3pt;padding:2pt 3pt}
.sl{display:block;font-size:5pt;color:#ccc;letter-spacing:.03em}
.sn2{display:block;font-size:9pt;font-weight:700;color:#1e1e1e}
/* Build tips */
.tips-list{list-style:none;padding:0}
.tips-list li{font-size:8.5pt;color:#555;padding:2mm 0 2mm 12pt;border-bottom:0.3pt solid #f5f5f5;position:relative;line-height:1.4}
.tips-list li::before{content:"·";position:absolute;left:0;color:#bbb;font-size:16pt;line-height:.9}
.tips-list li:last-child{border-bottom:none}
/* Footer */
.pf{position:absolute;bottom:8mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:7.5pt;color:#ccc;border-top:0.3pt solid #f0f0f0;padding-top:3mm}
@page{size:A4;margin:0}
@media print{.toolbar{display:none}body{background:#fff}.page{margin:0;box-shadow:none;break-after:page}}
</style>
</head>
<body>
<div class="toolbar">
  <h2>String Art Build Guide — stephrawlingscreations.ie</h2>
  <button class="btn-print" onclick="setTimeout(() => window.print(), 150)">🖨 Print / Save as PDF</button>
</div>

<!-- PAGE 1: BOARD TEMPLATE -->
<div class="page">
  <div class="ph">
    <div class="ph-label">String Art Studio</div>
    <h1>Board Template</h1>
    <p>Generated ${date} · stephrawlingscreations.ie</p>
  </div>
  <div class="board-wrap">
    <svg viewBox="0 0 ${SZ} ${SZ}" xmlns="http://www.w3.org/2000/svg">
      ${outline}
      <g>${svgLines}</g>
      <g>${svgNails}</g>
    </svg>
  </div>
  <div class="stats">
    <div class="stat"><b>${nailCount}</b><span>Nails</span></div>
    <div class="stat"><b>${board.charAt(0).toUpperCase() + board.slice(1)}</b><span>Shape</span></div>
    <div class="stat"><b>${totalLines}</b><span>Lines</span></div>
    <div class="stat"><b>${activeLayers}</b><span>Layer${activeLayers !== 1 ? "s" : ""}</span></div>
  </div>
  <div class="scale-ref">
    <div class="scale-bar"></div>
    <p>1 cm reference at 100% print scale</p>
  </div>
  ${threadHTML}
  <div class="pf"><span>stephrawlingscreations.ie</span><span>Page 1 of 2 — Board Layout</span></div>
</div>

<!-- PAGE 2: BUILD GUIDE -->
<div class="page">
  <div class="ph">
    <div class="ph-label">String Art Studio</div>
    <h1>Build Guide</h1>
    <p>Generated ${date} · Follow each step in order to wrap your thread</p>
  </div>
  <div class="start-box">
    <h3>Before you begin</h3>
    <ol>
      <li>Start at nail <strong>${startNailLabel}</strong></li>
      <li>Follow the sequence in order, one nail at a time</li>
      <li>Complete one full layer before starting the next</li>
    </ol>
  </div>
  ${seqHTML || '<p style="color:#bbb;text-align:center;margin-top:20mm">No sequence recorded — draw some lines first.</p>'}
  <div class="section">
    <h2 class="sh">Build Tips</h2>
    <ul class="tips-list">
      <li>Keep even tension on the thread throughout</li>
      <li>Do not pull too tight — this can warp the board</li>
      <li>Complete one full layer before starting the next</li>
      <li>Use contrasting colours for clarity between layers</li>
    </ul>
  </div>
  <div class="pf"><span>stephrawlingscreations.ie</span><span>Page 2 of 2 — Build Guide</span></div>
</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      showToast("Popup blocked — allow popups for this site.", true);
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = function () {
      try { win.focus(); } catch (_) {}
    };
  }

  init();
});
