document.addEventListener("DOMContentLoaded", function () {

  /* -----------------------------
     PRO UNLOCK (Gumroad redirect)
  ----------------------------- */

  // After a Gumroad purchase, the buyer is redirected to:
  //   https://stephrawlingscreations.ie/?sas_pro=unlock
  // Set that as your "Redirect URL" in the Gumroad product settings.
  // The modal opens so the buyer can paste their Gumroad license key to activate.
  //
  // Dev override (any host, secret passphrase):
  //   https://stephrawlingscreations.ie/designer.html?sas_dev=YOUR_SECRET

  (function checkProRedirect() {
    try {
      const params = new URLSearchParams(window.location.search);
      // Dev override — secret passphrase
      if (params.get("sas_dev") === "sdr22uk") {
        localStorage.setItem("_sask", "00000000-0000-0000-0000-000000000000");
        const clean = window.location.pathname + window.location.hash;
        history.replaceState({}, "", clean);
        setTimeout(() => openProModal(), 300);
        return;
      }

      // Gumroad redirect — open the modal with key entry expanded
      if (params.get("sas_pro") === "unlock") {
        const clean = window.location.pathname + window.location.hash;
        history.replaceState({}, "", clean);
        setTimeout(() => openProModal(), 300);
      }
    } catch (_) {}
  })();

  function isPro() {
    try {
      const k = localStorage.getItem("_sask") || "";
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k);
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

  function pointsCircle(n, cx, cy, r, startAngleDeg) {
    const startRad = startAngleDeg !== undefined
      ? (startAngleDeg * Math.PI) / 180
      : -Math.PI / 2;
    const out = new Array(n);

    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + startRad;
      out[i] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }

    return out;
  }

  // Returns the start angle (degrees) for the circle based on nail1pos select.
  // Top = -90° (12 o'clock), Right = 0°, Bottom = 90°, Left = 180°.
  function nail1AngleDeg() {
    const pos = $("nail1pos")?.value || "top";
    return { top: -90, right: 0, bottom: 90, left: 180 }[pos] ?? -90;
  }

  // Returns how many positions to rotate the square pts array.
  function nail1SquareOffset(n) {
    const pos = $("nail1pos")?.value || "top";
    const frac = { top: 0, right: 0.25, bottom: 0.5, left: 0.75 }[pos] ?? 0;
    return Math.round(n * frac);
  }

  // Rotate an array of points by offset positions (wrapping).
  function rotatePts(arr, offset) {
    if (!offset) return arr;
    const n = arr.length;
    const o = ((offset % n) + n) % n;
    return arr.slice(o).concat(arr.slice(0, o));
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

  let _saveTimer = null;
  function debouncedSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveDesign, 500);
  }

  function redrawAll() {
    const { cssW, cssH } = resizeCanvas();

    ctx.clearRect(0, 0, cssW, cssH);

    const board = $("board")?.value || "circle";
    const radius = clampInt(getZoomInput()?.value, 80, 5000, 320);
    const nails = clampInt($("nails")?.value, 10, 8000, 150);

    const cx = cssW / 2;
    const cy = cssH / 2;

    if (board === "circle") {
      pts = pointsCircle(nails, cx, cy, radius, nail1AngleDeg());
    } else {
      pts = rotatePts(pointsSquarePerimeter(nails, cx, cy, radius), nail1SquareOffset(nails));
    }

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

    debouncedSave();
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
          nail1pos: $("nail1pos")?.value,
        },
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      if (e && e.name === "QuotaExceededError") {
        showToast("Could not save — browser storage is full.", true);
      }
    }
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
      if (s.nail1pos != null && $("nail1pos")) $("nail1pos").value = s.nail1pos;

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

  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
  function findCoprime(target, total) {
    for (let delta = 0; delta < total; delta++) {
      const hi = target + delta;
      const lo = target - delta;
      if (hi < total && gcd(hi, total) === 1) return hi;
      if (lo >= 2   && gcd(lo, total) === 1) return lo;
    }
    return target;
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

  // Cardioid — times-3 nephroid with a shift so it looks distinct from flower (times-2)
  function generateCardioidPattern(total, offset) {
    const shift = Math.round((offset / 60) * Math.floor(total / 3));
    const edges = [];
    for (let i = 0; i < total; i++) {
      const b = wrapIndex(i * 3 + shift, total);
      if (i !== b) edges.push({ a: i, b });
    }
    return edges;
  }

  // Web — single starburst chord; skip near n/2 means long chords that cross the centre
  function generateWebPattern(total, offset) {
    const half = Math.round(total / 2);
    const spread = Math.round((offset / 60) * Math.floor(total / 4));
    const skip = Math.max(2, Math.min(total - 2, half - spread));
    const edges = [];
    for (let i = 0; i < total; i++) {
      edges.push({ a: i, b: wrapIndex(i + skip, total) });
    }
    return edges;
  }

  // Spiral — coprime step guarantees the path visits every nail in one continuous loop
  function generateSpiralSequence(total, offset) {
    const half = Math.round(total / 2);
    const spread = Math.round((offset / 60) * Math.floor(total / 4));
    const targetStep = Math.max(3, half - spread);
    const step = findCoprime(targetStep, total);
    const seq = [0];
    let current = 0;
    for (let i = 0; i < total - 1; i++) {
      current = wrapIndex(current + step, total);
      seq.push(current);
    }
    return seq;
  }

  // Star — coprime skip creates a single connected star polygon
  function generateStarPattern(total, offset) {
    const quarter = Math.round(total / 4);
    const spread = Math.round((offset / 60) * Math.floor(total / 4));
    const targetSkip = Math.max(2, quarter + spread);
    const skip = findCoprime(targetSkip, total);
    const edges = [];
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

    document.addEventListener("keydown", function (e) {
      // Escape closes draw mode or pro modal
      if (e.key === "Escape") {
        const overlay = $("drawModeOverlay");
        if (overlay && overlay.classList.contains("active")) { closeDrawMode(); return; }
        const proModal = $("proModal");
        if (proModal && proModal.style.display !== "none") { proModal.style.display = "none"; return; }
      }
      // Ignore if focus is on an input/select/textarea
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveDesign(); showToast("Design saved."); }
      else if (e.key === "+" || e.key === "=") nudgeZoom(1);
      else if (e.key === "-") nudgeZoom(-1);
      else if (e.key === "0" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fitToScreen(); redrawAll(); }
    });

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
      "nail1pos",
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

    // Share design button
    $("shareDesignBtn")?.addEventListener("click", shareDesign);

    // First-time onboarding tip
    initOnboarding();

    // Check for shared design in URL
    if (loadSharedDesign()) {
      // loaded from URL param — don't also load saved
    } else if (hasSavedDesign()) {
      loadSavedDesign(true);
      showToast("Last design restored.");
    } else {
      redrawAll();
      updateSeqOutput();
      updateDrawModeSeqMini();
    }
  }

  /* -----------------------------
     ONBOARDING TIP
  ----------------------------- */

  function initOnboarding() {
    try {
      const seen = localStorage.getItem("_sas_onboard");
      if (!seen) {
        const tip = document.getElementById("onboardingTip");
        if (tip) tip.style.display = "block";
      }
    } catch (_) {}
  }

  function dismissOnboarding() {
    try { localStorage.setItem("_sas_onboard", "1"); } catch (_) {}
    const tip = document.getElementById("onboardingTip");
    if (tip) tip.style.display = "none";
  }

  // Make dismissOnboarding globally accessible for the inline onclick
  window.dismissOnboarding = dismissOnboarding;

  /* -----------------------------
     SHARE DESIGN (URL encoding)
  ----------------------------- */

  function shareDesign() {
    try {
      const hasContent = layers.some(L => L.seq && L.seq.length > 0);
      if (!hasContent) { showToast("Draw something first before sharing.", true); return; }

      const state = {
        b: $("board")?.value || "circle",
        n: parseInt($("nails")?.value, 10) || 120,
        p: $("nail1pos")?.value || "top",
        l: layers.map(L => ({
          c: L.color || "#000000",
          o: +(L.opacity ?? 0.35).toFixed(2),
          w: +(L.lw ?? 0.7).toFixed(1),
          s: L.seq || [],
        })),
      };

      const encoded = btoa(JSON.stringify(state));
      const url = window.location.origin + window.location.pathname + "?d=" + encoded;

      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showToast("Share link copied to clipboard!");
        }).catch(() => { fallbackCopy(url); });
      } else {
        fallbackCopy(url);
      }
    } catch (e) {
      showToast("Could not generate share link.", true);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;top:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showToast("Share link copied!"); } catch (_) { showToast("Could not copy link.", true); }
    document.body.removeChild(ta);
  }

  function loadSharedDesign() {
    try {
      const params = new URLSearchParams(window.location.search);
      const d = params.get("d");
      if (!d) return false;

      const state = JSON.parse(atob(d));
      if (!state || !Array.isArray(state.l) || state.l.length === 0) return false;

      // Clear URL param without reload
      const clean = window.location.pathname;
      history.replaceState({}, "", clean);

      // Restore settings
      if (state.b && $("board")) $("board").value = state.b;
      if (state.n && $("nails")) $("nails").value = state.n;
      if (state.p && $("nail1pos")) $("nail1pos").value = state.p;

      // Rebuild layers with edges from seq
      layers = state.l.map(L => ({
        color: L.c || "#000000",
        opacity: L.o ?? 0.35,
        lw: L.w ?? 0.7,
        seq: L.s || [],
        edges: seqToEdges(L.s || []),
        step: null,
      }));
      activeLayer = 0;
      lastNail = null;

      syncLayerSelect();
      switchLayer(0);
      showToast("Shared design loaded!");
      return true;
    } catch (_) {
      return false;
    }
  }

  function seqToEdges(seq) {
    const edges = [];
    for (let i = 0; i + 1 < seq.length; i++) {
      edges.push({ a: seq[i], b: seq[i + 1] });
    }
    return edges;
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

    const CONTACT = "stephrawlingscreations.ie";

    const board = $("board")?.value || "circle";
    const nailCount = clampInt($("nails")?.value, 10, 8000, 150);
    const numStart = $("numStart")?.value === "1" ? 1 : 0;
    const boardSizeCm = parseFloat($("templateBoardSize")?.value) || 30;
    const D_mm = boardSizeCm * 10;

    // Fixed SVG coordinate space for the board diagram
    const SZ = 560;
    const CX = SZ / 2;
    const CY = SZ / 2;
    const BRAD = SZ / 2 - 44;

    const svgPts =
      board === "circle"
        ? pointsCircle(nailCount, CX, CY, BRAD, nail1AngleDeg())
        : rotatePts(pointsSquarePerimeter(nailCount, CX, CY, BRAD), nail1SquareOffset(nailCount));

    // Board outline
    const outline =
      board === "circle"
        ? `<circle cx="${CX}" cy="${CY}" r="${BRAD}" fill="none" stroke="#ccc" stroke-width="1.5"/>`
        : `<rect x="${CX - BRAD}" y="${CY - BRAD}" width="${BRAD * 2}" height="${BRAD * 2}" fill="none" stroke="#ccc" stroke-width="1.5"/>`;

    // String lines — all layers combined
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

    // Thread length estimation based on actual board size
    const PHYSICAL_RADIUS_MM = D_mm / 2;
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

    const date = new Date().toLocaleDateString("en-IE", {
      day: "numeric", month: "long", year: "numeric",
    });

    // Start nail
    const firstActiveLayer = layers.find((L) => L.seq?.length > 0);
    const startNailLabel = firstActiveLayer ? firstActiveLayer.seq[0] + numStart : "—";

    // ── PAGE 1: COVER / COMPLETED DESIGN PREVIEW ──
    let threadRows = "";
    layers.forEach((L, li) => {
      if (!L.edges?.length) return;
      const c = hexToRgb(L.color || "#000000");
      threadRows += `<tr>
        <td><span class="dot" style="background:rgb(${c.r},${c.g},${c.b})"></span>Layer ${li + 1}</td>
        <td class="tv">~${toMetres(layerThreadMm[li])} m</td>
      </tr>`;
    });

    const coverPageHTML = `
<div class="page preview-page">
  <div class="cover-header">
    <div class="cover-brand">String Art Studio</div>
    <h1 class="cover-title">Build Pack</h1>
    <p class="cover-meta">Generated ${date} &nbsp;·&nbsp; ${boardSizeCm} cm board &nbsp;·&nbsp; ${nailCount} nails &nbsp;·&nbsp; ${activeLayers} layer${activeLayers !== 1 ? "s" : ""}</p>
  </div>
  <div class="preview-svg-wrap">
    <svg viewBox="0 0 ${SZ} ${SZ}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:125mm;max-height:110mm;height:auto;display:block;margin:0 auto">
      ${outline}
      <g>${svgLines}</g>
      <g>${svgNails}</g>
    </svg>
    <p class="preview-caption">Completed design — all layers combined</p>
  </div>
  <div class="stats">
    <div class="stat"><b>${nailCount}</b><span>Nails</span></div>
    <div class="stat"><b>${board.charAt(0).toUpperCase() + board.slice(1)}</b><span>Shape</span></div>
    <div class="stat"><b>${totalLines}</b><span>Lines</span></div>
    <div class="stat"><b>${activeLayers}</b><span>Layer${activeLayers !== 1 ? "s" : ""}</span></div>
    <div class="stat"><b>${boardSizeCm} cm</b><span>Board</span></div>
  </div>
  <div class="section">
    <h2 class="sh">Thread Requirements</h2>
    <table class="tt">
      ${threadRows}
      <tr class="tt-total"><td>Total</td><td class="tv">~${toMetres(totalThreadMm)} m</td></tr>
    </table>
    <p class="sn" style="margin-top:2mm">Based on a ${boardSizeCm} cm board. Add ~10% extra for tying off.</p>
  </div>
  <div class="pf"><span>${CONTACT}</span><span>Page 1 — Design Overview</span></div>
</div>`;

    // ── PAGES 2+: TRUE-SIZE NAIL PLACEMENT TEMPLATE (tiled, not scaled) ──
    // BRAD*2 = 472 SVG units spans the board diameter D_mm
    const svgPerMm = (BRAD * 2) / D_mm;    // SVG units per physical mm
    const PAGE_W_MM = 190;                   // A4 usable width (10mm margins each side)
    const FOOTER_MM = 20;                    // hdr (~9mm) + footer (~9mm) + borders
    const SVG_H_MM = 297 - FOOTER_MM;       // SVG area height per tile page
    const tileW_svg = PAGE_W_MM * svgPerMm;
    const tileH_svg = SVG_H_MM * svgPerMm;
    const totalCols = Math.ceil(SZ / tileW_svg);
    const totalRows = Math.ceil(SZ / tileH_svg);
    const boardPageCount = totalCols * totalRows;
    const totalPages = 1 + boardPageCount + activeLayers + 1;

    let boardPagesHTML = "";
    let pageIdx = 1; // cover is page 1
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        pageIdx++;
        const sx = col * tileW_svg;
        const sy = row * tileH_svg;
        const contentW_mm = Math.min(PAGE_W_MM, (SZ - sx) / svgPerMm);
        const contentH_mm = Math.min(SVG_H_MM, (SZ - sy) / svgPerMm);
        const tileLabel = `${String.fromCharCode(65 + row)}${col + 1}`;

        // Alignment marks at tile cut edges
        let alignMarks = "";
        const mk = 10; // mark arm length in SVG units
        if (col < totalCols - 1) {
          const ex = sx + tileW_svg;
          alignMarks += `<line x1="${ex.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${Math.min(sy + tileH_svg, SZ).toFixed(1)}" stroke="#ccc" stroke-width="0.5" stroke-dasharray="4,3"/>`;
          alignMarks += `<line x1="${(ex - mk).toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${sy.toFixed(1)}" stroke="#aaa" stroke-width="1"/>`;
          alignMarks += `<line x1="${ex.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${(sy + mk).toFixed(1)}" stroke="#aaa" stroke-width="1"/>`;
        }
        if (row < totalRows - 1) {
          const ey = sy + tileH_svg;
          alignMarks += `<line x1="${sx.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${Math.min(sx + tileW_svg, SZ).toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#ccc" stroke-width="0.5" stroke-dasharray="4,3"/>`;
          alignMarks += `<line x1="${sx.toFixed(1)}" y1="${(ey - mk).toFixed(1)}" x2="${sx.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#aaa" stroke-width="1"/>`;
          alignMarks += `<line x1="${sx.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${(sx + mk).toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#aaa" stroke-width="1"/>`;
        }

        const tileAssemblyNote = boardPageCount > 1
          ? `Tile ${tileLabel} of ${boardPageCount} — align marks and tape sheets together before drilling`
          : `Single-sheet template — print at 100%, do not scale`;

        boardPagesHTML += `
<div class="page tile-page">
  <div class="tile-hdr">
    <span class="tile-hdr-left">Nail Placement Template · ${boardSizeCm} cm board · Tile ${tileLabel}${boardPageCount > 1 ? ` (col ${col + 1}/${totalCols}, row ${row + 1}/${totalRows})` : ""}</span>
    <span class="tile-hdr-right">Page ${pageIdx} of ${totalPages} · ⚠ PRINT AT 100% — no scaling, no "fit to page"</span>
  </div>
  <div class="board-wrap">
    <svg viewBox="${sx.toFixed(2)} ${sy.toFixed(2)} ${tileW_svg.toFixed(2)} ${tileH_svg.toFixed(2)}"
         xmlns="http://www.w3.org/2000/svg"
         style="width:${contentW_mm.toFixed(1)}mm;height:${contentH_mm.toFixed(1)}mm;display:block">
      ${outline}
      <g>${svgLines}</g>
      <g>${svgNails}</g>
      ${alignMarks}
    </svg>
  </div>
  <div class="tile-footer">
    <div class="scale-check">
      <div style="width:1cm;height:5pt;background:#333;border-radius:1pt;display:inline-block;vertical-align:middle"></div>
      <span class="scale-lbl">← 1 cm scale check — must measure exactly 1 cm when printed at 100%</span>
    </div>
    <span class="tile-ref">${tileAssemblyNote} · ${CONTACT}</span>
  </div>
</div>`;
      }
    }

    // ── LAYER PAGES: one per active layer (reference scale, not true-size) ──
    let layerPagesHTML = "";
    layers.forEach((L, li) => {
      if (!L.edges?.length) return;
      pageIdx++;
      const c = hexToRgb(L.color || "#000000");
      const colorRgb = `rgb(${c.r},${c.g},${c.b})`;
      const moves = L.seq?.length ? L.seq.length - 1 : L.edges.length;
      const threadEst = toMetres(layerThreadMm[li]);
      const layerStartNail = L.seq?.length ? L.seq[0] + numStart : "—";

      // SVG lines for this layer only — slightly bolder for isolation view
      let layerSvgLines = "";
      for (const e of L.edges) {
        if (!svgPts[e.a] || !svgPts[e.b]) continue;
        const [x1, y1] = svgPts[e.a];
        const [x2, y2] = svgPts[e.b];
        layerSvgLines += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgb(${c.r},${c.g},${c.b})" stroke-opacity="${Math.max(0.25, (L.opacity || 0.45)).toFixed(2)}" stroke-width="${Math.min((L.lw || 0.7) * 1.3, 1.5)}"/>`;
      }

      // Step-pair rows — each move shown as "N → M", never breaks mid-number
      const hasSeq = L.seq?.length > 1;
      let seqRowsHTML = "";
      if (hasSeq) {
        const MAX_STEPS = 100;
        const totalMoves = L.seq.length - 1;
        const showMoves = Math.min(totalMoves, MAX_STEPS);
        for (let i = 0; i < showMoves; i++) {
          seqRowsHTML += `<div class="seq-step"><span class="seq-num">${i + 1}</span><span class="seq-move">${L.seq[i] + numStart}&thinsp;&rarr;&thinsp;${L.seq[i + 1] + numStart}</span></div>`;
        }
        if (totalMoves > MAX_STEPS) {
          seqRowsHTML += `<div class="seq-more">+${totalMoves - MAX_STEPS} more moves — refer to the designer for full sequence</div>`;
        }
      }

      layerPagesHTML += `
<div class="page preview-page layer-page">
  <div class="layer-page-hdr" style="border-left:4pt solid ${colorRgb}">
    <div class="layer-title-row">
      <span class="ldot" style="background:${colorRgb};width:16px;height:16px;border-radius:50%;flex-shrink:0;display:inline-block"></span>
      <div>
        <div class="ph-label">Layer ${li + 1} of ${activeLayers}</div>
        <h1 class="cover-title" style="font-size:20pt">Layer ${li + 1} <span style="color:${colorRgb};font-size:14pt;font-weight:500">${L.color || ""}</span></h1>
      </div>
    </div>
    <div class="layer-kpis">
      <div class="kpi"><b>${moves}</b><span>Moves</span></div>
      <div class="kpi"><b>${layerStartNail}</b><span>Start Nail</span></div>
      <div class="kpi"><b>~${threadEst} m</b><span>Thread</span></div>
    </div>
  </div>
  <div class="preview-svg-wrap" style="padding:3mm 0">
    <svg viewBox="0 0 ${SZ} ${SZ}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:135mm;max-height:130mm;height:auto;display:block;margin:0 auto">
      ${outline}
      <g opacity="0.18">${svgLines}</g>
      <g>${layerSvgLines}</g>
      <g>${svgNails}</g>
    </svg>
    <p class="preview-caption">Layer ${li + 1} isolated · other layers shown faded for context</p>
  </div>
  ${hasSeq ? `<div class="section">
    <h2 class="sh">Sequence — Layer ${li + 1}</h2>
    <p class="lsub" style="margin-bottom:3mm">Start at nail <b>${layerStartNail}</b> &nbsp;·&nbsp; ${moves} moves &nbsp;·&nbsp; follow each step in order</p>
    <div class="seq-grid">${seqRowsHTML}</div>
  </div>` : ""}
  <div class="pf"><span>${CONTACT}</span><span>Page ${pageIdx} of ${totalPages} — Layer ${li + 1} of ${activeLayers}</span></div>
</div>`;
    });

    // ── BUILD GUIDE PAGE ──
    pageIdx++;
    const buildGuidePageHTML = `
<div class="page">
  <div class="ph">
    <div class="ph-label">String Art Studio</div>
    <h1>How To Build</h1>
  </div>
  <div class="guide-steps">
    <div class="guide-step"><span class="gs-num">1</span><div class="gs-text"><b>Start at the listed nail</b><p>Each layer page shows the start nail — tie a knot here before you begin.</p></div></div>
    <div class="guide-step"><span class="gs-num">2</span><div class="gs-text"><b>Follow the sequence in order</b><p>Each step shows one nail move. Work through the list exactly as shown, nail by nail.</p></div></div>
    <div class="guide-step"><span class="gs-num">3</span><div class="gs-text"><b>Keep even tension on the thread</b><p>Thread should be snug but not so tight it bows the board.</p></div></div>
    <div class="guide-step"><span class="gs-num">4</span><div class="gs-text"><b>Complete one full layer before stopping</b><p>Finish the entire sequence for a layer before moving to the next colour.</p></div></div>
  </div>
  <div class="section">
    <h2 class="sh">Tips</h2>
    <ul class="tips-list">
      <li>Do not pull the thread too tight — this can warp the board</li>
      <li>Use contrasting colours to make each layer visually distinct</li>
      <li>Mark your start nail with a small piece of tape while you work</li>
    </ul>
  </div>
  <div class="pf"><span>${CONTACT}</span><span>Page ${pageIdx} of ${totalPages} — Build Guide</span></div>
</div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>String Art Build Pack – ${CONTACT}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#e5e5e5;color:#1e1e1e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{background:#fff;border-bottom:1px solid #ddd;padding:12px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
.toolbar h2{font-size:14px;font-weight:600;flex:1;margin:0;color:#444}
.toolbar .print-warn{font-size:12px;color:#c0392b;font-weight:500}
.btn-print{background:#1e1e1e;color:#fff;border:none;border-radius:6px;padding:9px 20px;font-size:13px;font-weight:500;cursor:pointer}

/* ── ALL PAGES ── */
.page{width:190mm;min-height:277mm;padding:12mm 12mm 10mm;margin:24px auto;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.14);position:relative}

/* ── PREVIEW PAGES (cover + layer pages) — scaled reference, not true-size ── */
.preview-page{display:flex;flex-direction:column}
.preview-page .pf{margin-top:auto;padding-top:4mm}

/* Cover page */
.cover-header{margin-bottom:5mm;padding-bottom:5mm;border-bottom:0.75pt solid #e0e0e0}
.cover-brand{font-size:7pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#bbb;margin-bottom:2mm}
.cover-title{font-size:26pt;font-weight:700;letter-spacing:-.03em;line-height:1;color:#1e1e1e}
.cover-meta{font-size:8.5pt;color:#bbb;margin-top:2mm}
.preview-svg-wrap{display:flex;flex-direction:column;align-items:center;padding:4mm 0}
.preview-caption{font-size:7.5pt;color:#aaa;text-align:center;margin-top:2mm;letter-spacing:.04em}

/* Layer pages */
.layer-page-hdr{padding:4mm 5mm;border-radius:6pt;background:#fafafa;margin-bottom:4mm;border-left:4pt solid #1e1e1e}
.layer-title-row{display:flex;align-items:center;gap:8pt;margin-bottom:3mm}
.layer-kpis{display:flex;border:0.5pt solid #ececec;border-radius:6pt;overflow:hidden;margin-top:2mm}
.kpi{flex:1;text-align:center;padding:2.5mm 2mm;border-right:0.5pt solid #ececec}
.kpi:last-child{border-right:none}
.kpi b{display:block;font-size:13pt;font-weight:700;line-height:1.2}
.kpi span{font-size:7pt;color:#bbb;text-transform:uppercase;letter-spacing:.07em}
.step-more{opacity:.5}

/* ── TILE PAGES — true-size drill template, never scaled ── */
.tile-page{padding:0;display:flex;flex-direction:column;min-height:unset}
.tile-hdr{display:flex;justify-content:space-between;align-items:baseline;padding:3.5mm 5mm;border-bottom:0.5pt solid #ebebeb;flex-shrink:0}
.tile-hdr-left{font-size:6.5pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#bbb}
.tile-hdr-right{font-size:6.5pt;color:#c0392b;font-weight:600;text-align:right;white-space:nowrap;margin-left:4mm}
.board-wrap{flex:1;display:flex;justify-content:center;align-items:flex-start;padding:3mm 5mm 2mm;overflow:hidden}
.tile-footer{display:flex;justify-content:space-between;align-items:center;padding:3mm 5mm;border-top:0.5pt solid #ebebeb;flex-shrink:0;gap:8mm}
.scale-check{display:flex;align-items:center;gap:5pt;flex-shrink:0}
.scale-lbl{font-size:7pt;color:#888}
.tile-ref{font-size:6.5pt;color:#bbb;text-align:right}

/* ── GUIDE PAGES ── */
.ph{margin-bottom:6mm;padding-bottom:4mm;border-bottom:0.75pt solid #e0e0e0}
.ph-label{font-size:7pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#bbb;margin-bottom:2mm}
.ph h1{font-size:22pt;font-weight:700;letter-spacing:-.03em;line-height:1;color:#1e1e1e}
.ph p{font-size:8.5pt;color:#bbb;margin-top:2mm}
.stats{display:flex;margin:4mm 0;border:0.5pt solid #ececec;border-radius:8pt;overflow:hidden}
.stat{flex:1;text-align:center;padding:3mm 2mm;border-right:0.5pt solid #ececec}
.stat:last-child{border-right:none}
.stat b{display:block;font-size:14pt;font-weight:700;line-height:1.15}
.stat span{font-size:7pt;color:#bbb;text-transform:uppercase;letter-spacing:.07em}
.section{margin-top:5mm;padding-top:4mm;border-top:0.5pt solid #ececec}
.sh{font-size:9.5pt;font-weight:700;letter-spacing:.03em;margin-bottom:2.5mm;text-transform:uppercase;color:#555}
.sn{font-size:7.5pt;color:#bbb}
.tt{width:100%;border-collapse:collapse;font-size:9pt}
.tt td{padding:2mm 2.5mm;border-bottom:0.3pt solid #f2f2f2;vertical-align:middle}
.tt tr:last-child td{border-bottom:none}
.tt-total td{font-weight:700;padding-top:3mm;border-top:0.75pt solid #ccc;border-bottom:none}
.tv{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;font-size:10pt}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}
.ldot{display:inline-block;width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:2pt}
.lsub{font-size:8pt;color:#aaa;margin-top:1mm}
.seq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(38mm,1fr));gap:0 3pt;margin-top:2mm}
.seq-step{display:flex;align-items:baseline;gap:4pt;padding:2pt 3pt;border-bottom:0.2pt solid #f5f5f5}
.seq-num{font-size:5.5pt;color:#bbb;min-width:16pt;flex-shrink:0;text-align:right;font-variant-numeric:tabular-nums}
.seq-move{font-size:8.5pt;font-weight:600;color:#1e1e1e;white-space:nowrap;font-variant-numeric:tabular-nums}
.seq-more{font-size:7pt;color:#aaa;padding:2mm;border-top:0.3pt solid #ececec;margin-top:2mm;grid-column:1/-1;text-align:center}
.guide-steps{margin:6mm 0}
.guide-step{display:flex;gap:5mm;padding:4.5mm 0;border-bottom:0.5pt solid #f0f0f0;align-items:flex-start}
.guide-step:last-child{border-bottom:none}
.gs-num{width:9mm;height:9mm;border-radius:50%;background:#1e1e1e;color:#fff;font-size:11pt;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gs-text b{font-size:10pt;font-weight:700;color:#1e1e1e;display:block;margin-bottom:1.5mm}
.gs-text p{font-size:8pt;color:#888;margin:0;line-height:1.5}
.tips-list{list-style:none;padding:0}
.tips-list li{font-size:8.5pt;color:#555;padding:2mm 0 2mm 12pt;border-bottom:0.3pt solid #f5f5f5;position:relative;line-height:1.4}
.tips-list li::before{content:"·";position:absolute;left:0;color:#bbb;font-size:16pt;line-height:.9}
.tips-list li:last-child{border-bottom:none}
.pf{display:flex;justify-content:space-between;font-size:7.5pt;color:#ccc;border-top:0.3pt solid #f0f0f0;padding-top:3mm;margin-top:6mm}

/* ── PRINT RULES ── */
@page{size:A4 portrait;margin:10mm}
@media print{
  .toolbar{display:none}
  body{background:#fff}
  /* Each .page gets its own printed page */
  .page{margin:0;box-shadow:none;break-after:page;width:190mm}
  /* FIX: break-after:page on the very last element creates a blank final page.
     Cancelling it on :last-child prevents that phantom page. */
  .page:last-child{break-after:auto}

  /* ── TILE PAGES ── */
  /* Tile pages must be exactly 277mm (A4 minus 10mm margins each side). */
  .tile-page{height:297mm;max-height:297mm;overflow:hidden;padding:0;box-sizing:border-box;display:flex;flex-direction:column}
  /* FIX (vertical crop): JS sets SVG_H_MM = 277 - FOOTER_MM (13mm), so it expects
     only 13mm of non-SVG chrome. Screen CSS uses padding:3.5mm on tile-hdr and
     padding:3mm on tile-footer — together ~19mm — so the flex:1 board-wrap gets
     only 258mm and clips the bottom 6mm of the SVG. Tightening padding here to
     bring header+footer combined to ~13mm matches the JS budget exactly.
     Borders removed: they're decorative and add ~1pt each, enough to push
     content over the page boundary and generate a blank page after every tile. */
  .tile-page .tile-hdr{padding-top:1.5mm;padding-bottom:1.5mm;border-bottom:none}
  .tile-page .tile-footer{padding-top:2mm;padding-bottom:2mm;border-top:none}
  /* FIX (horizontal crop): board-wrap has padding:5mm on each side in screen CSS,
     making its content box 180mm wide. SVG is drawn to 190mm (PAGE_W_MM). With
     overflow:hidden that clips 5mm off each side of every tile. Removing padding
     and switching to overflow:visible lets tile-page handle any edge clipping at
     the 277mm boundary instead. */
  .tile-page .board-wrap{flex:1;overflow:hidden;min-height:0;padding:0}

  /* ── PREVIEW PAGES (cover + layer pages) ── */
  /* Reduced from 10mm to 8mm top/bottom: gives 4mm more content budget, preventing
     layer pages with long sequences from spilling a few px onto a phantom next page. */
  .preview-page{padding:8mm 12mm;min-height:unset}

  /* ── GUIDE PAGES ── */
  .page:not(.tile-page):not(.preview-page){padding:8mm 10mm;min-height:unset}
  .page:not(.tile-page):not(.preview-page) .ph{margin-bottom:4mm;padding-bottom:4mm}
  .page:not(.tile-page):not(.preview-page) .pf{margin-top:4mm}
}
</style>
</head>
<body>
<div class="toolbar">
  <h2>String Art Build Pack — ${CONTACT}</h2>
  <span class="print-warn">⚠ Drill template pages: set printer scale to 100% — no "Fit to page"</span>
  <button class="btn-print" onclick="setTimeout(() => window.print(), 150)">🖨 Print / Save as PDF</button>
</div>

<!-- PAGE 1: COMPLETED DESIGN PREVIEW + COVER -->
${coverPageHTML}

<!-- PAGES 2–${1 + boardPageCount}: TRUE-SIZE NAIL PLACEMENT TEMPLATE (tiled, not scaled) -->
${boardPagesHTML}

<!-- PAGES ${2 + boardPageCount}–${1 + boardPageCount + activeLayers}: INDIVIDUAL LAYER PAGES -->
${layerPagesHTML}

<!-- PAGE ${totalPages}: BUILD GUIDE -->
${buildGuidePageHTML}

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
