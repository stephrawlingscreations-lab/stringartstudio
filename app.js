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
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        k,
      );
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
  let boardColor = localStorage.getItem("sas_board_color") || "#ffffff";

  // ---- Custom Nail Layout State ----
  let nailPlacementMode = 'perimeter'; // 'perimeter' | 'partial-edge' | 'manual' | 'template'
  let nailTemplateShape = 'circle';    // 'circle'|'square'|'diamond'|'hexagon'|'heart'|'star'
  let rectAspect = { w: 3, h: 2 };    // for rectangle board
  let manualGrid = { show: false, divisions: 8 }; // grid overlay for manual placement
  let customNails    = [];       // [{nx, ny}] normalised by radius
  let edgesEnabled   = { top: true, right: true, bottom: true, left: true };
  let arcRange       = { start: -90, end: 270 };
  let customNailHistory = [];
  let undoStack = [];
  let redoStack = [];
  const UNDO_MAX = 200;
  let isDraggingCustom  = false;
  let dragCustomIdx     = null;
  let dragStartPos      = null;
  let uiMode       = 'beginner';
  let lastCx = 0, lastCy = 0, lastRx = 320, lastRy = 320;

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
  function drawWrappedThread(
    ctx,
    x1,
    y1,
    x2,
    y2,
    nailRadius = 6,
    wrapSize = 0.35,
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (!dist) return;

    const ux = dx / dist;
    const uy = dy / dist;

    // Perpendicular direction for a slight bend
    const px = -uy;
    const py = ux;

    // Pull line ends back from the nail centres
    const sx = x1 + ux * nailRadius;
    const sy = y1 + uy * nailRadius;
    const ex = x2 - ux * nailRadius;
    const ey = y2 - uy * nailRadius;

    // Midpoint with a tiny sideways bend to fake wrapping
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const bend = nailRadius * wrapSize;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx + px * bend, my + py * bend, ex, ey);
  }
  /* -----------------------------
     MOBILE CONTROL PANEL TOGGLE
  ----------------------------- */

  function toggleControls() {
    const panel = document.getElementById("controlsPanel");
    const btn = document.getElementById("toggleControlsBtn");
    if (!panel || !btn) return;

    panel.classList.toggle("hidden");
    btn.textContent = panel.classList.contains("hidden")
      ? "▼ Show settings"
      : "▲ Hide settings";
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
    const startRad =
      startAngleDeg !== undefined
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

  function computeBoardDimensions() {
    const board  = $('board')?.value || 'circle';
    const radius = clampInt(getZoomInput()?.value, 80, 5000, 320);
    if (board === 'rectangle') {
      const rx = radius;
      const ry = Math.round(radius * rectAspect.h / rectAspect.w);
      return { rx, ry };
    }
    return { rx: radius, ry: radius };
  }

  function pointsRectPerimeter(n, cx, cy, rx, ry) {
    const out = [];
    const perim = 2 * (2 * rx + 2 * ry);
    for (let i = 0; i < n; i++) {
      const d = (perim * i) / n;
      let x, y;
      if      (d < 2 * rx)              { x = cx - rx + d;                        y = cy - ry; }
      else if (d < 2 * rx + 2 * ry)    { x = cx + rx;                            y = cy - ry + (d - 2 * rx); }
      else if (d < 4 * rx + 2 * ry)    { x = cx + rx - (d - 2 * rx - 2 * ry);   y = cy + ry; }
      else                              { x = cx - rx;                            y = cy + ry - (d - 4 * rx - 2 * ry); }
      out.push([x, y]);
    }
    return out;
  }

  function nailPositionsFromTemplate(shape, nails, cx, cy, rx, ry) {
    const pts = [];

    if (shape === 'circle') {
      for (let i = 0; i < nails; i++) {
        const a = (i / nails) * Math.PI * 2 - Math.PI / 2;
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
    } else if (shape === 'square') {
      const perimeter = 2 * (2 * rx + 2 * ry);
      const step = perimeter / nails;
      const sides = [
        { len: 2 * rx, fn: (t) => [cx - rx + t, cy - ry] },
        { len: 2 * ry, fn: (t) => [cx + rx, cy - ry + t] },
        { len: 2 * rx, fn: (t) => [cx + rx - t, cy + ry] },
        { len: 2 * ry, fn: (t) => [cx - rx, cy + ry - t] },
      ];
      let d = 0;
      for (let i = 0; i < nails; i++) {
        let pos = d;
        let acc = 0;
        for (const side of sides) {
          if (pos <= acc + side.len) {
            const t = pos - acc;
            const [x, y] = side.fn(t);
            pts.push([x, y]);
            break;
          }
          acc += side.len;
        }
        d += step;
      }
    } else if (shape === 'diamond') {
      const corners = [
        [cx, cy - ry],
        [cx + rx, cy],
        [cx, cy + ry],
        [cx - rx, cy],
      ];
      const sideLen = Math.sqrt(rx * rx + ry * ry);
      const perim = 4 * sideLen;
      const step = perim / nails;
      for (let i = 0; i < nails; i++) {
        let d = i * step;
        const sideIdx = Math.floor(d / sideLen) % 4;
        const t = (d % sideLen) / sideLen;
        const a = corners[sideIdx];
        const b = corners[(sideIdx + 1) % 4];
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    } else if (shape === 'hexagon') {
      const corners = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        corners.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      const sideLen = Math.sqrt(
        (corners[1][0] - corners[0][0]) ** 2 + (corners[1][1] - corners[0][1]) ** 2
      );
      const perim = 6 * sideLen;
      const step = perim / nails;
      for (let i = 0; i < nails; i++) {
        let d = i * step;
        const sideIdx = Math.floor(d / sideLen) % 6;
        const t = (d % sideLen) / sideLen;
        const a = corners[sideIdx];
        const b = corners[(sideIdx + 1) % 6];
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    } else if (shape === 'heart') {
      const samples = 2000;
      const heartPts = [];
      for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        heartPts.push([hx, hy]);
      }
      let maxHx = 0, maxHy = 0;
      for (const p of heartPts) {
        if (Math.abs(p[0]) > maxHx) maxHx = Math.abs(p[0]);
        if (Math.abs(p[1]) > maxHy) maxHy = Math.abs(p[1]);
      }
      const arcLen = [];
      let total = 0;
      arcLen.push(0);
      for (let i = 1; i < heartPts.length; i++) {
        const dx = heartPts[i][0] - heartPts[i - 1][0];
        const dy = heartPts[i][1] - heartPts[i - 1][1];
        total += Math.sqrt(dx * dx + dy * dy);
        arcLen.push(total);
      }
      for (let i = 0; i < nails; i++) {
        const target = (i / nails) * total;
        let lo = 0, hi = heartPts.length - 1;
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1;
          if (arcLen[mid] < target) lo = mid;
          else hi = mid;
        }
        const t2 = (target - arcLen[lo]) / (arcLen[hi] - arcLen[lo] || 1);
        const hx = heartPts[lo][0] + (heartPts[hi][0] - heartPts[lo][0]) * t2;
        const hy = heartPts[lo][1] + (heartPts[hi][1] - heartPts[lo][1]) * t2;
        pts.push([cx + hx * (rx / maxHx), cy + hy * (ry / maxHy)]);
      }
    } else if (shape === 'star') {
      const corners = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 1 : 0.4;
        corners.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]);
      }
      const sideLens = corners.map((c, i) => {
        const n2 = corners[(i + 1) % 10];
        return Math.sqrt((n2[0] - c[0]) ** 2 + (n2[1] - c[1]) ** 2);
      });
      const perim = sideLens.reduce((a, b) => a + b, 0);
      const step = perim / nails;
      const cumLen = [0];
      sideLens.forEach((l, i) => cumLen.push(cumLen[i] + l));
      for (let i = 0; i < nails; i++) {
        const d = i * step;
        let sideIdx = 0;
        while (sideIdx < 9 && cumLen[sideIdx + 1] < d) sideIdx++;
        const t = (d - cumLen[sideIdx]) / (sideLens[sideIdx] || 1);
        const a = corners[sideIdx];
        const b = corners[(sideIdx + 1) % 10];
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }

    return pts;
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
        opt.textContent = layer.hidden
          ? `Layer ${i + 1} (hidden)`
          : `Layer ${i + 1}`;
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
      if ($("opacityVal"))
        $("opacityVal").textContent = Math.round(L.opacity * 100) + "%";
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
      if ($("opacityVal"))
        $("opacityVal").textContent =
          Math.round((L.opacity ?? 0.35) * 100) + "%";
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
    const nails = clampInt($("nails")?.value, 10, 8000, 150);

    const cx = cssW / 2;
    const cy = cssH / 2;
    const { rx, ry } = computeBoardDimensions();
    lastCx = cx; lastCy = cy; lastRx = rx; lastRy = ry;

    if (nailPlacementMode === 'perimeter') {
      if (board === 'circle') {
        pts = pointsCircle(nails, cx, cy, rx, nail1AngleDeg());
      } else if (board === 'square') {
        pts = rotatePts(pointsSquarePerimeter(nails, cx, cy, rx), nail1SquareOffset(nails));
      } else {
        pts = pointsRectPerimeter(nails, cx, cy, rx, ry);
      }
    } else if (nailPlacementMode === 'partial-edge' || nailPlacementMode === 'manual') {
      pts = customNails.length > 0
        ? customNails.map(n => [cx + n.nx * rx, cy + n.ny * ry])
        : [];
    } else if (nailPlacementMode === 'template') {
      pts = nailPositionsFromTemplate(nailTemplateShape, nails, cx, cy, rx, ry);
    }

    // Board background fill
    ctx.save();
    ctx.beginPath();
    if (board === 'circle') ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    else ctx.rect(cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.fillStyle = boardColor;
    ctx.fill();
    ctx.restore();

    // Grid overlay — manual placement mode only
    if (nailPlacementMode === 'manual' && manualGrid.show) {
      const div = manualGrid.divisions;
      ctx.save();
      // Clip to board shape
      ctx.beginPath();
      if (board === 'circle') ctx.arc(cx, cy, rx, 0, Math.PI * 2);
      else ctx.rect(cx - rx, cy - ry, rx * 2, ry * 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.lineWidth = 0.7;
      // Vertical lines
      for (let i = -div; i <= div; i++) {
        const x = cx + (i / div) * rx;
        ctx.beginPath();
        ctx.moveTo(x, cy - ry);
        ctx.lineTo(x, cy + ry);
        ctx.stroke();
      }
      // Horizontal lines
      for (let i = -div; i <= div; i++) {
        const y = cy + (i / div) * ry;
        ctx.beginPath();
        ctx.moveTo(cx - rx, y);
        ctx.lineTo(cx + rx, y);
        ctx.stroke();
      }
      // Centre crosshair slightly stronger
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy - ry); ctx.lineTo(cx, cy + ry); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.lineTo(cx + rx, cy); ctx.stroke();
      ctx.restore();
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();

    if (board === 'circle') ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    else ctx.rect(cx - rx, cy - ry, rx * 2, ry * 2);

    ctx.stroke();

    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = (nailPlacementMode === 'manual')
        ? "rgba(184,137,46,0.85)" : "rgba(0,0,0,0.6)";
      ctx.fill();
    }

    if (nailPlacementMode === 'manual' && pts.length === 0) {
      ctx.save();
      ctx.font = '13px Inter, system-ui';
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click anywhere on the board to place a nail', cx, cy);
      ctx.restore();
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

      for (let i = 0; i < pts.length; i++) {
        const label = i + start;
        if (label === pts.length) continue;
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

        drawWrappedThread(ctx, x1, y1, x2, y2, 6, 0.35);
        ctx.stroke();
      }
    }

    if (lastNail !== null && hoverNail !== null && hoverNail !== lastNail) {
      const [x1, y1] = pts[lastNail];
      const [x2, y2] = pts[hoverNail];
      const L = layers[activeLayer];

      ctx.lineWidth = L.lw;
      ctx.strokeStyle = rgba(L.color, 0.45);
      ctx.shadowColor = rgba(L.color, 0.35);
      ctx.shadowBlur = 6;
      ctx.setLineDash([6, 4]);

      drawWrappedThread(ctx, x1, y1, x2, y2, 6, 0.35);
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
    pushUndoSnapshot();

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

  function pushUndoSnapshot() {
    undoStack.push({
      layers: JSON.parse(JSON.stringify(layers)),
      activeLayer,
      lastNail
    });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack = [];
  }

  function getUndoCount() {
    const inDrawMode = document.body.classList.contains('draw-mode-open');
    const val = (inDrawMode ? $('drawUndoCount') : $('undoCount'))?.value || '1';
    return val === 'all' ? Infinity : parseInt(val, 10);
  }

  function undo() {
    if (nailPlacementMode === 'manual') {
      undoCustomNail();
      return;
    }

    if (undoStack.length === 0) {
      showToast('Nothing to undo.', true);
      return;
    }

    const n = Math.min(getUndoCount(), undoStack.length);

    // Save current state to redo stack before restoring
    redoStack.push({
      layers: JSON.parse(JSON.stringify(layers)),
      activeLayer,
      lastNail
    });

    let snapshot;
    for (let i = 0; i < n; i++) {
      snapshot = undoStack.pop();
    }

    layers = snapshot.layers;
    activeLayer = snapshot.activeLayer;
    lastNail = snapshot.lastNail;

    syncLayerSelect();
    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
    showToast(`Undone ${n} step${n !== 1 ? 's' : ''}.`);
  }

  function redo() {
    if (redoStack.length === 0) {
      showToast('Nothing to redo.', true);
      return;
    }

    // Save current state to undo stack before re-applying
    undoStack.push({
      layers: JSON.parse(JSON.stringify(layers)),
      activeLayer,
      lastNail
    });

    const snapshot = redoStack.pop();
    layers = snapshot.layers;
    activeLayer = snapshot.activeLayer;
    lastNail = snapshot.lastNail;

    syncLayerSelect();
    redrawAll();
    updateSeqOutput();
    updateDrawModeSeqMini();
    showToast('Redone.');
  }

  function clearAll() {
    if (!confirm("Clear everything and start over? This cannot be undone."))
      return;
    layers = [];
    activeLayer = 0;
    lastNail = null;
    undoStack = [];
    redoStack = [];
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_) {}

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
    cv.onpointerup   = null;

    cv.onpointermove = (ev) => {
      const { x, y } = canvasXYFromPointerEvent(ev);

      // Handle custom nail drag (works for all pointer types)
      if (isDraggingCustom && dragCustomIdx !== null) {
        if (isInsideBoard(x, y)) {
          customNails[dragCustomIdx] = {
            nx: (x - lastCx) / lastRx,
            ny: (y - lastCy) / lastRy
          };
          redrawAll();
        }
        return;
      }

      if (ev.pointerType === "touch") return;
      hoverNail = nearestNail(x, y);
      redrawAll();
    };

    cv.onpointerleave = () => {
      if (!isDraggingCustom) {
        hoverNail = null;
        redrawAll();
      }
    };

    cv.onpointerdown = (ev) => {
      const { x, y } = canvasXYFromPointerEvent(ev);

      if (nailPlacementMode === 'manual') {
        handleCustomPointerDown(ev, x, y);
        return;
      }

      const idx = nearestNail(x, y);
      if (idx === null) return;

      addNailToSequence(idx);
      redrawAll();
      updateSeqOutput();
      updateDrawModeSeqMini();
      panDrawModeToLastNail();
    };

    cv.onpointerup = (ev) => {
      if (!isDraggingCustom) return;
      const { x, y } = canvasXYFromPointerEvent(ev);
      // If barely moved, treat as a click → remove nail
      if (dragStartPos && Math.hypot(x - dragStartPos.x, y - dragStartPos.y) < 6) {
        if (dragCustomIdx !== null) {
          saveCustomNailHistory();
          const removed = dragCustomIdx;
          isDraggingCustom = false;
          dragCustomIdx = null;
          dragStartPos = null;
          customNails.splice(removed, 1);
          cleanEdgesForRemovedNail(removed);
          updateCustomNailCount();
          redrawAll();
          showToast('Nail removed.');
          return;
        }
      }
      isDraggingCustom = false;
      dragCustomIdx = null;
      dragStartPos = null;
      try { ev.target?.releasePointerCapture(ev.pointerId); } catch(_) {}
      redrawAll();
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
    const hasContent = layers.some((L) => L.edges && L.edges.length > 0);
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
          boardColor,
          nailPlacementMode,
          nailTemplateShape,
          rectAspect,
          customNails,
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
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (_) {
      return false;
    }
  }

  function loadSavedDesign(silent) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        if (!silent) showToast("No saved design found.", true);
        return false;
      }
      const state = JSON.parse(raw);
      if (!Array.isArray(state.layers) || state.layers.length === 0)
        return false;

      layers = state.layers;
      activeLayer = Math.min(state.activeLayer || 0, layers.length - 1);

      const s = state.settings || {};
      if (s.board != null && $("board")) $("board").value = s.board;
      if (s.nails != null && $("nails")) $("nails").value = s.nails;
      if (s.radius != null && $("radius")) $("radius").value = s.radius;
      if (s.showNums != null && $("showNums"))
        $("showNums").checked = s.showNums;
      if (s.numEvery != null && $("numEvery")) $("numEvery").value = s.numEvery;
      if (s.numStart != null && $("numStart")) $("numStart").value = s.numStart;
      if (s.numSize != null && $("numSize")) $("numSize").value = s.numSize;
      if (s.numOffset != null && $("numOffset"))
        $("numOffset").value = s.numOffset;
      if (s.nail1pos != null && $("nail1pos")) $("nail1pos").value = s.nail1pos;
      if (s.boardColor != null) {
        boardColor = s.boardColor;
        localStorage.setItem("sas_board_color", boardColor);
        if ($("boardColor")) $("boardColor").value = boardColor;
      }
      // Migration: old nailLayoutMode/customSubMode → nailPlacementMode
      if (s.nailPlacementMode != null) {
        nailPlacementMode = s.nailPlacementMode;
      } else if (s.nailLayoutMode != null) {
        if (s.nailLayoutMode === 'auto') nailPlacementMode = 'perimeter';
        else if (s.customSubMode === 'manual') nailPlacementMode = 'manual';
        else nailPlacementMode = 'partial-edge';
      }
      if (s.nailTemplateShape != null) nailTemplateShape = s.nailTemplateShape;
      if (s.rectAspect != null) {
        rectAspect = s.rectAspect;
        if ($('rectAspectSelect')) $('rectAspectSelect').value = s.rectAspect.w + ':' + s.rectAspect.h;
      }
      if (Array.isArray(s.customNails)) customNails = s.customNails;

      syncLayerSelect();
      switchLayer(activeLayer);
      updateNailPlacementUI();
      updateCustomNailCount();
      if (!silent) showToast("Design loaded.");
      return true;
    } catch (_) {
      return false;
    }
  }

  /* -----------------------------
     EXPORT / IMPORT DESIGN FILE
  ----------------------------- */

  function exportDesignFile() {
    const hasContent = layers.some((L) => L.edges && L.edges.length > 0);
    if (!hasContent) {
      showToast("Nothing to export — draw something first.", true);
      return;
    }
    try {
      const state = {
        _type: "sas_design",
        _version: 2,
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
          boardColor,
          nailPlacementMode,
          nailTemplateShape,
          rectAspect,
          customNails,
        },
      };
      const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `string-art-design-${stamp}.sas`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Design exported.");
    } catch (_) {
      showToast("Export failed — please try again.", true);
    }
  }

  function importDesignFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const state = JSON.parse(e.target.result);
        if (!Array.isArray(state.layers) || state.layers.length === 0) {
          showToast("Invalid design file.", true);
          return;
        }

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
        if (s.boardColor != null) {
          boardColor = s.boardColor;
          localStorage.setItem("sas_board_color", boardColor);
          if ($("boardColor")) $("boardColor").value = boardColor;
        }
        // Migration: old nailLayoutMode/customSubMode → nailPlacementMode
        if (s.nailPlacementMode != null) {
          nailPlacementMode = s.nailPlacementMode;
        } else if (s.nailLayoutMode != null) {
          if (s.nailLayoutMode === 'auto') nailPlacementMode = 'perimeter';
          else if (s.customSubMode === 'manual') nailPlacementMode = 'manual';
          else nailPlacementMode = 'partial-edge';
        }
        if (s.nailTemplateShape != null) nailTemplateShape = s.nailTemplateShape;
        if (s.rectAspect != null) {
          rectAspect = s.rectAspect;
          if ($('rectAspectSelect')) $('rectAspectSelect').value = s.rectAspect.w + ':' + s.rectAspect.h;
        }
        if (Array.isArray(s.customNails)) customNails = s.customNails;

        syncLayerSelect();
        switchLayer(activeLayer);
        updateNailPlacementUI();
        updateCustomNailCount();
        redrawAll();
        updateSeqOutput();
        showToast("Design loaded from file.");
      } catch (_) {
        showToast("Could not read file — is it a valid .sas design?", true);
      }
    };
    reader.readAsText(file);
  }

  /* -----------------------------
     LOAD TEMPLATE
  ----------------------------- */

  function applyTemplateDesign(state, name) {
    if (!Array.isArray(state.layers) || state.layers.length === 0) {
      showToast("Invalid template.", true);
      return;
    }
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
    if (s.boardColor != null) {
      boardColor = s.boardColor;
      localStorage.setItem("sas_board_color", boardColor);
      if ($("boardColor")) $("boardColor").value = boardColor;
    }
    if (s.nailPlacementMode != null) {
      nailPlacementMode = s.nailPlacementMode;
    } else if (s.nailLayoutMode != null) {
      if (s.nailLayoutMode === 'auto') nailPlacementMode = 'perimeter';
      else if (s.customSubMode === 'manual') nailPlacementMode = 'manual';
      else nailPlacementMode = 'partial-edge';
    }
    if (s.nailTemplateShape != null) nailTemplateShape = s.nailTemplateShape;
    if (s.rectAspect != null) {
      rectAspect = s.rectAspect;
      if ($('rectAspectSelect')) $('rectAspectSelect').value = s.rectAspect.w + ':' + s.rectAspect.h;
    }
    if (Array.isArray(s.customNails)) customNails = s.customNails;
    syncLayerSelect();
    switchLayer(activeLayer);
    updateNailPlacementUI();
    updateCustomNailCount();
    redrawAll();
    updateSeqOutput();
    showToast("Template \u201c" + name + "\u201d loaded.");
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

      pushUndoSnapshot();

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

    pushUndoSnapshot();
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

  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }
  function findCoprime(target, total) {
    for (let delta = 0; delta < total; delta++) {
      const hi = target + delta;
      const lo = target - delta;
      if (hi < total && gcd(hi, total) === 1) return hi;
      if (lo >= 2 && gcd(lo, total) === 1) return lo;
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
     CUSTOM NAIL LAYOUT
  ----------------------------- */

  function isInsideBoard(x, y) {
    const board = $('board')?.value || 'circle';
    const dx = x - lastCx, dy = y - lastCy;
    if (board === 'circle') return Math.hypot(dx, dy) <= lastRx;
    return Math.abs(dx) <= lastRx && Math.abs(dy) <= lastRy;
  }

  function saveCustomNailHistory() {
    customNailHistory.push(customNails.map(n => ({ ...n })));
    if (customNailHistory.length > 40) customNailHistory.shift();
  }

  function undoCustomNail() {
    if (customNailHistory.length === 0) {
      showToast('Nothing to undo.', true);
      return;
    }
    customNails = customNailHistory.pop();
    updateCustomNailCount();
    redrawAll();
    showToast('Nail change undone.');
  }

  function handleCustomPointerDown(ev, x, y) {
    const snapR = 22;
    let nearestIdx = null, nearestDist = snapR;
    for (let i = 0; i < customNails.length; i++) {
      const nx = lastCx + customNails[i].nx * lastRx;
      const ny = lastCy + customNails[i].ny * lastRy;
      const d = Math.hypot(nx - x, ny - y);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    dragStartPos = { x, y };
    if (nearestIdx !== null) {
      isDraggingCustom = true;
      dragCustomIdx = nearestIdx;
      try { ev.target.setPointerCapture(ev.pointerId); } catch(_) {}
    } else if (isInsideBoard(x, y)) {
      saveCustomNailHistory();
      customNails.push({
        nx: (x - lastCx) / lastRx,
        ny: (y - lastCy) / lastRy
      });
      updateCustomNailCount();
      redrawAll();
    }
  }

  function cleanEdgesForRemovedNail(removedIdx) {
    layers.forEach(L => {
      L.edges = L.edges
        .filter(e => e.a !== removedIdx && e.b !== removedIdx)
        .map(e => ({ a: e.a > removedIdx ? e.a - 1 : e.a,
                     b: e.b > removedIdx ? e.b - 1 : e.b }));
      L.seq = L.seq
        .filter(i => i !== removedIdx)
        .map(i => i > removedIdx ? i - 1 : i);
      if (lastNail === removedIdx) lastNail = null;
      else if (lastNail !== null && lastNail > removedIdx) lastNail--;
    });
    updateSeqOutput();
    updateDrawModeSeqMini();
  }

  function updateCustomNailCount() {
    const n = customNails.length;
    const text = n + ' nail' + (n === 1 ? '' : 's');
    const el = $('customNailCount');
    if (el) el.textContent = text;
    const elManual = $('customNailCountManual');
    if (elManual) elManual.textContent = text;
  }

  function generateEdgeNails() {
    const n = parseInt($('nails')?.value || '120', 10);
    const board = $('board')?.value || 'circle';
    const result = [];
    if (board === 'circle') {
      const span = arcRange.end - arcRange.start;
      if (n < 1 || Math.abs(span) < 1) return result;
      const full = Math.abs(span) >= 359.9;
      for (let i = 0; i < n; i++) {
        const frac = full ? i / n : i / (n - 1);
        const a = (arcRange.start + frac * span) * Math.PI / 180;
        result.push({ nx: Math.cos(a), ny: Math.sin(a) });
      }
    } else {
      const enabled = ['top','right','bottom','left'].filter(e => edgesEnabled[e]);
      if (!enabled.length) return result;
      const base = Math.floor(n / enabled.length);
      const extra = n - base * enabled.length;
      enabled.forEach((edge, idx) => {
        const count = base + (idx < extra ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const t = count > 1 ? i / (count - 1) : 0.5;
          let nx = 0, ny = 0;
          if      (edge === 'top')    { nx = -1 + 2*t; ny = -1; }
          else if (edge === 'right')  { nx = 1;        ny = -1 + 2*t; }
          else if (edge === 'bottom') { nx = 1 - 2*t;  ny = 1; }
          else if (edge === 'left')   { nx = -1;       ny = 1 - 2*t; }
          result.push({ nx, ny });
        }
      });
    }
    return result;
  }

  function applyEdgeLayout() {
    saveCustomNailHistory();
    customNails = generateEdgeNails();
    updateCustomNailCount();
    redrawAll();
  }

  function switchNailPlacementMode(mode) {
    // When switching from perimeter to manual, seed customNails from current pts
    if (mode === 'manual' && nailPlacementMode === 'perimeter' && pts.length > 0) {
      customNails = pts.map(([x, y]) => ({
        nx: (x - lastCx) / lastRx,
        ny: (y - lastCy) / lastRy
      }));
    }
    nailPlacementMode = mode;
    updateNailPlacementUI();
    updateCustomNailCount();
    redrawAll();
  }

  function updateNailPlacementUI() {
    // 4-tab bar buttons
    ['perimeter','partial-edge','manual','template'].forEach(mode => {
      $('npmBtn_' + mode)?.classList.toggle('active', nailPlacementMode === mode);
    });

    const board = $('board')?.value || 'circle';

    // Panel visibility
    const panels = {
      'perimeterPanel':    nailPlacementMode === 'perimeter',
      'partialEdgePanel':  nailPlacementMode === 'partial-edge',
      'manualPanel':       nailPlacementMode === 'manual',
      'templatePanel':     nailPlacementMode === 'template',
    };
    Object.entries(panels).forEach(([id, show]) => {
      const el = $(id);
      if (el) el.style.display = show ? 'block' : 'none';
    });

    // Within partial-edge: show correct sub-panel for board shape
    const edgeSq  = $('edgeSelectSquare');
    const edgeCir = $('edgeSelectCircle');
    if (nailPlacementMode === 'partial-edge') {
      const squareLike = board === 'square' || board === 'rectangle';
      if (edgeSq)  edgeSq.style.display  = squareLike     ? 'block' : 'none';
      if (edgeCir) edgeCir.style.display = board === 'circle' ? 'block' : 'none';
    }

    const squareLike = board === 'square' || board === 'rectangle';
    if ($('squarePresets')) $('squarePresets').style.display = squareLike     ? 'flex' : 'none';
    if ($('circlePresets')) $('circlePresets').style.display = board === 'circle' ? 'flex' : 'none';

    if (cv) cv.style.cursor = nailPlacementMode === 'manual' ? 'crosshair' : '';

    updateEdgeToggleVisuals();
  }

  function updateEdgeToggleVisuals() {
    ['top','right','bottom','left'].forEach(edge => {
      const btn = document.querySelector(`.edge-btn[data-edge="${edge}"]`);
      if (btn) btn.classList.toggle('active', !!edgesEnabled[edge]);
    });
  }

  function updateArcSliderDisplay() {
    const s = $('arcStart'), e = $('arcEnd');
    const sl = $('arcStartVal'), el = $('arcEndVal');
    if (s)  s.value  = arcRange.start;
    if (e)  e.value  = arcRange.end;
    if (sl) sl.textContent = arcRange.start + '°';
    if (el) el.textContent = arcRange.end + '°';
  }

  function applyCustomLayoutPreset(key) {
    const board = $('board')?.value || 'circle';
    const sq = {
      'full':        { top:true,  right:true,  bottom:true,  left:true  },
      'top':         { top:true,  right:false, bottom:false, left:false },
      'bottom':      { top:false, right:false, bottom:true,  left:false },
      'left-right':  { top:false, right:true,  bottom:false, left:true  },
      'top-bottom':  { top:true,  right:false, bottom:true,  left:false },
      'left':        { top:false, right:false, bottom:false, left:true  },
      'right':       { top:false, right:true,  bottom:false, left:false },
      'l-shape':     { top:true,  right:false, bottom:false, left:true  },
      'opposing':    { top:true,  right:false, bottom:true,  left:false },
    };
    const ci = {
      'full':          { start: -90,  end: 270  },
      'top-half':      { start: -180, end: 0    },
      'bottom-half':   { start: 0,    end: 180  },
      'left-half':     { start: 90,   end: 270  },
      'right-half':    { start: -90,  end: 90   },
      'quarter':       { start: -90,  end: 0    },
      'three-quarter': { start: -90,  end: 180  },
    };
    if (board === 'circle') {
      const p = ci[key]; if (!p) return;
      arcRange.start = p.start; arcRange.end = p.end;
      updateArcSliderDisplay();
    } else {
      const p = sq[key]; if (!p) return;
      edgesEnabled = { ...p };
      updateEdgeToggleVisuals();
    }
    applyEdgeLayout();
    showToast('Preset applied.');
  }

  function clearCustomNails() {
    if (!confirm('Clear all custom nails? Thread lines will also be cleared.')) return;
    saveCustomNailHistory();
    customNails = [];
    layers.forEach(L => { L.edges = []; L.seq = []; });
    lastNail = null;
    updateCustomNailCount();
    updateSeqOutput();
    updateDrawModeSeqMini();
    redrawAll();
    showToast('Custom nails cleared.');
  }

  function resetToFullPerimeter() {
    const board = $('board')?.value || 'circle';
    if (board === 'circle') {
      arcRange = { start: -90, end: 270 };
      updateArcSliderDisplay();
    } else {
      edgesEnabled = { top:true, right:true, bottom:true, left:true };
      updateEdgeToggleVisuals();
    }
    applyEdgeLayout();
    showToast('Reset to full perimeter.');
  }

  function distributeCustomNails() {
    if (customNails.length < 2) { showToast('Add nails first.', true); return; }
    saveCustomNailHistory();
    const board = $('board')?.value || 'circle';
    const n = customNails.length;
    if (board === 'circle') {
      customNails = Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI * i / n) - Math.PI / 2;
        return { nx: Math.cos(a), ny: Math.sin(a) };
      });
    } else {
      customNails = Array.from({ length: n }, (_, i) => {
        const d = (4 * i) / n;
        let nx = 0, ny = 0;
        if      (d < 1) { nx = -1 + 2*d;    ny = -1; }
        else if (d < 2) { nx = 1;            ny = -1 + 2*(d-1); }
        else if (d < 3) { nx = 1 - 2*(d-2); ny = 1; }
        else            { nx = -1;           ny = 1 - 2*(d-3); }
        return { nx, ny };
      });
    }
    updateCustomNailCount();
    redrawAll();
    showToast('Nails distributed evenly.');
  }

  function mirrorCustomNails() {
    if (!customNails.length) { showToast('No custom nails to mirror.', true); return; }
    saveCustomNailHistory();
    const mirrored = customNails.map(n => ({ nx: -n.nx, ny: n.ny }));
    mirrored.forEach(m => {
      const dup = customNails.some(n =>
        Math.abs(n.nx - m.nx) < 0.015 && Math.abs(n.ny - m.ny) < 0.015
      );
      if (!dup) customNails.push(m);
    });
    updateCustomNailCount();
    redrawAll();
    showToast('Nails mirrored horizontally.');
  }

  function setUiMode(mode) {
    uiMode = mode;
    document.body.classList.toggle('mode-advanced', mode === 'advanced');
    document.body.classList.toggle('mode-beginner', mode !== 'advanced');
    $('modeBeginner')?.classList.toggle('active', mode !== 'advanced');
    $('modeAdvanced')?.classList.toggle('active', mode === 'advanced');
    try { localStorage.setItem('sas_ui_mode', mode); } catch(_) {}
    showOnboardingIfUnseen();
  }

  function initPanelTabs() {
    const tabs = document.querySelectorAll('.panel-tab');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
        contents.forEach(c => c.classList.toggle('active', c.id === 'tab-' + target));
      });
    });
  }

  function initModeToggles() {
    try {
      const saved = localStorage.getItem('sas_ui_mode');
      setUiMode(saved === 'advanced' ? 'advanced' : 'beginner');
    } catch(_) { setUiMode('beginner'); }
    $('modeBeginner')?.addEventListener('click', () => setUiMode('beginner'));
    $('modeAdvanced')?.addEventListener('click', () => setUiMode('advanced'));
  }

  function initNailPlacement() {
    // 4-tab mode buttons
    ['perimeter','partial-edge','manual','template'].forEach(mode => {
      $('npmBtn_' + mode)?.addEventListener('click', () => switchNailPlacementMode(mode));
    });

    document.querySelectorAll('.edge-btn[data-edge]').forEach(btn => {
      btn.addEventListener('click', () => {
        const edge = btn.dataset.edge;
        edgesEnabled[edge] = !edgesEnabled[edge];
        updateEdgeToggleVisuals();
        applyEdgeLayout();
      });
    });

    $('arcStart')?.addEventListener('input', e => {
      arcRange.start = parseInt(e.target.value, 10);
      if ($('arcStartVal')) $('arcStartVal').textContent = arcRange.start + '°';
      applyEdgeLayout();
    });
    $('arcEnd')?.addEventListener('input', e => {
      arcRange.end = parseInt(e.target.value, 10);
      if ($('arcEndVal')) $('arcEndVal').textContent = arcRange.end + '°';
      applyEdgeLayout();
    });

    // Template shape grid
    document.querySelectorAll('[data-template-shape]').forEach(btn => {
      btn.addEventListener('click', () => {
        nailTemplateShape = btn.dataset.templateShape;
        document.querySelectorAll('[data-template-shape]').forEach(b =>
          b.classList.toggle('active', b === btn));
        redrawAll();
      });
    });

    $('distributeNails')?.addEventListener('click',  distributeCustomNails);
    $('mirrorNails')?.addEventListener('click',      mirrorCustomNails);
    $('clearCustomNails')?.addEventListener('click', clearCustomNails);
    $('resetToPerimeter')?.addEventListener('click', resetToFullPerimeter);

    document.querySelectorAll('[data-custom-preset]').forEach(btn => {
      btn.addEventListener('click', () => applyCustomLayoutPreset(btn.dataset.customPreset));
    });

    // When board type changes, re-sync the nail placement UI panels
    $('board')?.addEventListener('change', () => {
      if (nailPlacementMode === 'partial-edge' || nailPlacementMode === 'manual') {
        customNails = [];
        updateNailPlacementUI();
        applyEdgeLayout();
      } else {
        updateNailPlacementUI();
      }
      redrawAll();
    });

    // Manual grid toggle + divisions
    $('manualGridToggle')?.addEventListener('click', () => {
      manualGrid.show = !manualGrid.show;
      const btn = $('manualGridToggle');
      if (btn) btn.classList.toggle('active', manualGrid.show);
      redrawAll();
    });
    $('manualGridDivisions')?.addEventListener('change', e => {
      manualGrid.divisions = clampInt(e.target.value, 2, 32, 8);
      if (manualGrid.show) redrawAll();
    });

    // Rectangle aspect ratio
    $('rectAspectSelect')?.addEventListener('change', e => {
      const [w, h] = e.target.value.split(':').map(Number);
      rectAspect = { w, h };
      redrawAll();
    });


    updateNailPlacementUI();
    updateArcSliderDisplay();
    updateCustomNailCount();
  }

  /* -----------------------------
     INIT
  ----------------------------- */

  function init() {
    ensureLayerExists();
    syncLayerSelect();
    initActiveCanvasPointerControls();
    initQuickPatterns();
    initPanelTabs();
    initModeToggles();
    initNailPlacement();
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
      downloadPrintableTemplate().then(() => {
        showToast("✅ Download started — check your downloads folder.");
      }).catch((err) => {
        console.error("PDF generation failed:", err);
        showToast("PDF generation failed — please try again.", true);
      });
    });
    $("saveDesignBtn")?.addEventListener("click", () => {
      saveDesign();
      showToast("Design saved.");
    });
    $("loadDesignBtn")?.addEventListener("click", () => loadSavedDesign(false));
    $("exportDesignBtn")?.addEventListener("click", exportDesignFile);
    $("importDesignBtn")?.addEventListener("click", () => $("importDesignInput")?.click());
    $("importDesignInput")?.addEventListener("change", (e) => {
      importDesignFile(e.target.files?.[0]);
      e.target.value = "";
    });
    $("zoomIn")?.addEventListener("click", () => nudgeZoom(1));
    $("zoomOut")?.addEventListener("click", () => nudgeZoom(-1));

    document.addEventListener("keydown", function (e) {
      // Escape closes draw mode or pro modal
      if (e.key === "Escape") {
        const overlay = $("drawModeOverlay");
        if (overlay && overlay.classList.contains("active")) {
          closeDrawMode();
          return;
        }
        const proModal = $("proModal");
        if (proModal && proModal.style.display !== "none") {
          proModal.style.display = "none";
          return;
        }
      }
      // Ignore if focus is on an input/select/textarea
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveDesign();
        showToast("Design saved.");
      } else if (e.key === "+" || e.key === "=") nudgeZoom(1);
      else if (e.key === "-") nudgeZoom(-1);
      else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fitToScreen();
        redrawAll();
      }
    });

    $("openDrawMode")?.addEventListener("click", openDrawMode);
    $("closeDrawMode")?.addEventListener("click", closeDrawMode);
    $("drawUndo")?.addEventListener("click", undo);
    $("drawRedo")?.addEventListener("click", redo);
    $("redo")?.addEventListener("click", redo);

    // Keep both undo count selects in sync
    $("undoCount")?.addEventListener("change", (e) => {
      const drawSel = $("drawUndoCount");
      if (drawSel) drawSel.value = e.target.value;
    });
    $("drawUndoCount")?.addEventListener("change", (e) => {
      const sel = $("undoCount");
      if (sel) sel.value = e.target.value;
    });

    $("drawNewLayer")?.addEventListener("click", addLayer);
    $("drawContinue")?.addEventListener("click", continuePattern);
    $("drawZoomIn")?.addEventListener("click", () => nudgeZoom(1));
    $("drawZoomOut")?.addEventListener("click", () => nudgeZoom(-1));

    getZoomInput()?.addEventListener("change", applyZoomFromUI);

    [
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

    // Board colour picker
    if ($("boardColor")) $("boardColor").value = boardColor;
    $("boardColor")?.addEventListener("input", (e) => {
      boardColor = e.target.value;
      localStorage.setItem("sas_board_color", boardColor);
      redrawAll();
    });
    document.querySelectorAll(".color-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        boardColor = btn.dataset.color;
        if ($("boardColor")) $("boardColor").value = boardColor;
        localStorage.setItem("sas_board_color", boardColor);
        redrawAll();
      });
    });

    // Board shape change: show/hide rectAspectRow and update pro modal label
    function syncBoardUI() {
      const board = $("board")?.value || "circle";
      const rectRow = $("rectAspectRow");
      if (rectRow) rectRow.style.display = board === "rectangle" ? "block" : "none";
      const tmplLabel = $("templateBoardSizeLabel");
      if (tmplLabel) {
        tmplLabel.textContent = board === "circle"
          ? "Board diameter (cm)"
          : "Board width (cm)";
      }
    }
    $("board")?.addEventListener("change", syncBoardUI);
    syncBoardUI();

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

    // Check for shared design or preset in URL
    if (loadSharedDesign()) {
      // loaded from URL param — don't also load saved
    } else if (loadTemplateFromURL()) {
      // loaded template from patterns page
    } else if (loadPresetFromURL()) {
      // loaded preset from patterns page
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
    showOnboardingIfUnseen();
  }

  function showOnboardingIfUnseen() {
    try {
      const key = "_sas_onboard_" + uiMode;
      // If legacy key is set, treat beginner as already seen
      const legacySeen = localStorage.getItem("_sas_onboard");
      if (uiMode === 'beginner' && legacySeen) return;
      if (!localStorage.getItem(key)) {
        const tip = document.getElementById("onboardingTip");
        if (tip) tip.style.display = "block";
      }
    } catch (_) {}
  }

  function dismissOnboarding() {
    try {
      localStorage.setItem("_sas_onboard_" + uiMode, "1");
      // legacy key so old dismissed users aren't reshown the beginner tip
      localStorage.setItem("_sas_onboard", "1");
    } catch (_) {}
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
      const hasContent = layers.some((L) => L.seq && L.seq.length > 0);
      if (!hasContent) {
        showToast("Draw something first before sharing.", true);
        return;
      }

      const state = {
        b: $("board")?.value || "circle",
        n: parseInt($("nails")?.value, 10) || 120,
        p: $("nail1pos")?.value || "top",
        npm: nailPlacementMode,
        nts: nailTemplateShape,
        ra: rectAspect,
        cn: nailPlacementMode === 'manual' || nailPlacementMode === 'partial-edge' ? customNails : [],
        l: layers.map((L) => ({
          c: L.color || "#000000",
          o: +(L.opacity ?? 0.35).toFixed(2),
          w: +(L.lw ?? 0.7).toFixed(1),
          s: L.seq || [],
        })),
      };

      const encoded = btoa(JSON.stringify(state));
      const url =
        window.location.origin + window.location.pathname + "?d=" + encoded;

      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(url)
          .then(() => {
            showToast("Share link copied to clipboard!");
          })
          .catch(() => {
            fallbackCopy(url);
          });
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
    try {
      document.execCommand("copy");
      showToast("Share link copied!");
    } catch (_) {
      showToast("Could not copy link.", true);
    }
    document.body.removeChild(ta);
  }

  function loadTemplateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("template");
    if (!templateId) return false;
    history.replaceState({}, "", window.location.pathname);
    fetch("templates/templates.json")
      .then((r) => r.json())
      .then((list) => {
        const t = list.find((x) => x.id === templateId);
        if (!t || !t.file) return;
        return fetch(t.file).then((r) => r.json()).then((data) => {
          applyTemplateDesign(data, t.name);
        });
      })
      .catch(() => showToast("Could not load template.", true));
    return true;
  }

  function loadPresetFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const preset = params.get("preset");
      if (!preset) return false;

      const board = params.get("board") || "circle";
      const nails = parseInt(params.get("nails"), 10) || 120;

      history.replaceState({}, "", window.location.pathname);

      if ($("board")) $("board").value = board;
      if ($("nails")) $("nails").value = nails;

      ensureLayerExists();
      redrawAll();
      generatePreset(preset, 0);
      syncLayerSelect();
      switchLayer(activeLayer);
      updateSeqOutput();
      updateDrawModeSeqMini();

      const name = preset.charAt(0).toUpperCase() + preset.slice(1);
      showToast(name + " pattern loaded — customise it below.");
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadSharedDesign() {
    try {
      const params = new URLSearchParams(window.location.search);
      const d = params.get("d");
      if (!d) return false;

      const state = JSON.parse(atob(d));
      if (!state || !Array.isArray(state.l) || state.l.length === 0)
        return false;

      // Clear URL param without reload
      const clean = window.location.pathname;
      history.replaceState({}, "", clean);

      // Restore settings
      if (state.b && $("board")) $("board").value = state.b;
      if (state.n && $("nails")) $("nails").value = state.n;
      if (state.p && $("nail1pos")) $("nail1pos").value = state.p;
      if (state.npm) nailPlacementMode = state.npm;
      if (state.nts) nailTemplateShape = state.nts;
      if (state.ra) {
        rectAspect = state.ra;
        if ($('rectAspectSelect')) $('rectAspectSelect').value = state.ra.w + ':' + state.ra.h;
      }
      if (Array.isArray(state.cn)) customNails = state.cn;

      // Rebuild layers with edges from seq
      layers = state.l.map((L) => ({
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
      updateNailPlacementUI();
      updateCustomNailCount();
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

  async function downloadPrintableTemplate() {
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

    showToast("Generating PDF…");

    // Load pdf-lib on demand
    if (!window.PDFLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("Failed to load pdf-lib"));
        document.head.appendChild(s);
      });
    }

    const CONTACT = "stephrawlingscreations.ie";

    const board = $("board")?.value || "circle";
    const nailCount = clampInt($("nails")?.value, 10, 8000, 150);
    const numStart = $("numStart")?.value === "1" ? 1 : 0;
    const boardSizeCm = parseFloat($("templateBoardSize")?.value) || 30;
    const D_mm = boardSizeCm * 10; // width dimension in mm

    // SVG coordinate space (same layout as the canvas — do not change)
    const SZ = 560,
      CX = 280,
      CY = 280,
      BRAD = 236;

    // For rectangle boards, compute SVG ry from aspect ratio
    const svgRy = board === 'rectangle'
      ? Math.round(BRAD * rectAspect.h / rectAspect.w)
      : BRAD;
    // Physical height in mm for rectangle
    const D_mm_h = board === 'rectangle'
      ? Math.round(D_mm * rectAspect.h / rectAspect.w)
      : D_mm;

    let svgPts;
    if (nailPlacementMode === 'template') {
      svgPts = nailPositionsFromTemplate(nailTemplateShape, nailCount, CX, CY, BRAD, svgRy);
    } else if (nailPlacementMode === 'manual' || nailPlacementMode === 'partial-edge') {
      svgPts = customNails.map(n => [CX + n.nx * BRAD, CY + n.ny * svgRy]);
    } else if (board === "circle") {
      svgPts = pointsCircle(nailCount, CX, CY, BRAD, nail1AngleDeg());
    } else if (board === "rectangle") {
      svgPts = pointsRectPerimeter(nailCount, CX, CY, BRAD, svgRy);
    } else {
      svgPts = rotatePts(pointsSquarePerimeter(nailCount, CX, CY, BRAD), nail1SquareOffset(nailCount));
    }

    // ── PDF constants ──
    // 1 pt = 1/72 inch; 1 mm = 72/25.4 pt
    const PT = 72 / 25.4;
    const A4W = 210 * PT; // 595.28 pt
    const A4H = 297 * PT; // 841.89 pt
    const MG = 10 * PT; // 10 mm margin
    const CW = 190 * PT; // content width

    // Board scaling: BRAD*2 SVG units = D_mm physical mm
    const mmPerSVG = D_mm / (BRAD * 2); // physical mm per SVG unit (for true-size pages)
    const svgPerMm = (BRAD * 2) / D_mm; // SVG units per mm

    // SVG bounding box for the board (width × height in SVG units)
    const boardSVG_W = BRAD * 2;
    const boardSVG_H = svgRy * 2;

    // PDF nail positions — inset 15 mm from the board edge so nails sit
    // realistically inside the board, not right at the physical boundary.
    // Manual / partial-edge placements are left as-is (user-defined positions).
    const NAIL_INSET_MM = 15;
    const insetSvg = NAIL_INSET_MM * svgPerMm; // 15 mm expressed in SVG units
    let pdfNailPts;
    if (nailPlacementMode === 'manual' || nailPlacementMode === 'partial-edge') {
      pdfNailPts = svgPts; // no inset for manually placed nails
    } else if (nailPlacementMode === 'template') {
      pdfNailPts = nailPositionsFromTemplate(nailTemplateShape, nailCount, CX, CY, BRAD - insetSvg, svgRy - insetSvg);
    } else if (board === "circle") {
      pdfNailPts = pointsCircle(nailCount, CX, CY, BRAD - insetSvg, nail1AngleDeg());
    } else if (board === "rectangle") {
      pdfNailPts = pointsRectPerimeter(nailCount, CX, CY, BRAD - insetSvg, svgRy - insetSvg);
    } else {
      pdfNailPts = rotatePts(pointsSquarePerimeter(nailCount, CX, CY, BRAD - insetSvg), nail1SquareOffset(nailCount));
    }

    // Tile layout for true-size nail placement pages
    // A4 (297mm) minus 10mm top/bottom margins = 277mm content height.
    // Header (9mm) + footer (9mm) leaves 259mm for the SVG drill area per tile.
    const TILE_HDR_MM = 9;
    const TILE_FTR_MM = 9;
    const TILE_W_MM = 190; // printed SVG area width per tile (mm)
    const TILE_H_MM = 277 - TILE_HDR_MM - TILE_FTR_MM; // 259 mm SVG area height

    // Overlap: each tile prints OVERLAP_MM of extra content shared with its neighbour.
    // STRIDE is the unique (non-repeated) advance between tile origins.
    const OVERLAP_MM  = 12;
    const STRIDE_W_MM = TILE_W_MM - OVERLAP_MM; // 178 mm unique content per column step
    const STRIDE_H_MM = TILE_H_MM - OVERLAP_MM; // 247 mm unique content per row step

    // Number of tiles needed so the full board fits, keeping things centred so
    // seams fall symmetrically rather than near nail 1 at the top of the circle.
    const totalCols = Math.max(1, Math.ceil((D_mm   - OVERLAP_MM) / STRIDE_W_MM));
    const totalRows = Math.max(1, Math.ceil((D_mm_h - OVERLAP_MM) / STRIDE_H_MM));
    const boardPageCount = totalCols * totalRows;

    // Centre offset: how far the first tile's left/top edge is from the board's
    // physical left/top edge (may be negative — tile starts before the board edge).
    const tileOffset_X_mm = (D_mm   - (TILE_W_MM + STRIDE_W_MM * (totalCols - 1))) / 2;
    const tileOffset_Y_mm = (D_mm_h - (TILE_H_MM + STRIDE_H_MM * (totalRows - 1))) / 2;

    // SVG coordinates of the board's physical top-left corner
    const boardLeft_svg = CX - BRAD;
    const boardTop_svg  = CY - svgRy;

    const activeLayers = layers.filter((L) => L.edges?.length > 0);
    const totalLines = layers.reduce((s, L) => s + (L.edges?.length || 0), 0);

    // ── Sequence pagination constants ──
    // These are used both for pre-calculating totalPages and for rendering.
    const SCOLS_SEQ = 3;
    const SEQ_ROW_H_MM = 8; // mm per step row (7 mm cell + 1 mm breathing gap)
    const CELL_H_MM = 7; // drawn cell height in mm
    const COL_GAP_MM = 1.5; // gap between columns in mm
    const COL_W_MM = (190 - COL_GAP_MM * (SCOLS_SEQ - 1)) / SCOLS_SEQ; // ≈62.3 mm
    const SEQ_MAX_Y_MM = 267; // mm — stay above footer (footer rule is at 273mm)
    // Layer preview page: sequence header labels end at sqTop+15 = (46+118+8)+15 = 187mm
    const SEQ_FIRST_START_MM = 187;
    const firstPageRows = Math.floor(
      (SEQ_MAX_Y_MM - SEQ_FIRST_START_MM) / SEQ_ROW_H_MM,
    ); // 10
    const firstPageSteps = firstPageRows * SCOLS_SEQ; // 30
    // Continuation pages: compact 22mm header + 6mm gap before first row = 28mm start
    const CONT_HDR_MM = 22;
    const CONT_STEPS_START_MM = CONT_HDR_MM + 6; // 28mm
    const contPageRows = Math.floor(
      (SEQ_MAX_Y_MM - CONT_STEPS_START_MM) / SEQ_ROW_H_MM,
    ); // 29
    const contPageSteps = contPageRows * SCOLS_SEQ; // 87

    const extraSeqPages = activeLayers.reduce((sum, L) => {
      if (!L.seq?.length || L.seq.length <= 1) return sum;
      const totalSteps = L.seq.length - 1;
      if (totalSteps <= firstPageSteps) return sum;
      return sum + Math.ceil((totalSteps - firstPageSteps) / contPageSteps);
    }, 0);

    const totalPages =
      1 + boardPageCount + activeLayers.length + 1 + extraSeqPages;

    // Thread length estimates
    const physRadMm = D_mm / 2;
    const mmPerSVGt = physRadMm / ((BRAD + svgRy) / 2);
    let totalThreadMm = 0;
    const layerThreadMm = layers.map((L) => {
      if (!L.edges?.length) return 0;
      let mm = 0;
      for (const e of L.edges) {
        if (!svgPts[e.a] || !svgPts[e.b]) continue;
        const [x1, y1] = svgPts[e.a],
          [x2, y2] = svgPts[e.b];
        mm += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * mmPerSVGt;
      }
      totalThreadMm += mm;
      return mm;
    });
    const toM = (mm) => (mm / 1000).toFixed(1);

    const date = new Date().toLocaleDateString("en-IE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // ── Create PDF document ──
    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const fBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Colour palette
    const C_BLACK = rgb(0.12, 0.12, 0.12);
    const C_GRAY = rgb(0.55, 0.55, 0.55);
    const C_LGRAY = rgb(0.82, 0.82, 0.82);
    const C_RED = rgb(0.75, 0.22, 0.17);
    const C_WHITE = rgb(1, 1, 1);

    // Print-safe colour helpers.
    // Light colours (luminance > 0.50) are too faint on paper — map them to the
    // nearest entry in a curated dark palette before drawing anything in the PDF.
    const PRINT_PALETTE = [
      [198, 40, 40], // #C62828 red
      [239, 108, 0], // #EF6C00 orange
      [184, 134, 11], // #B8860B gold
      [46, 125, 50], // #2E7D32 green
      [0, 109, 119], // #006D77 teal
      [21, 101, 192], // #1565C0 blue
      [106, 27, 154], // #6A1B9A purple
      [173, 20, 87], // #AD1457 magenta
    ];

    // Returns a full-strength pdf-lib rgb colour that is guaranteed dark enough to print.
    function printSafeRgb(hexColor) {
      const c = hexToRgb(hexColor || "#000000");
      const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
      if (lum < 0.5) return rgb(c.r / 255, c.g / 255, c.b / 255);
      // Too light — substitute closest dark palette entry (by Euclidean RGB distance)
      let best = PRINT_PALETTE[0],
        bestDist = Infinity;
      for (const p of PRINT_PALETTE) {
        const d = (c.r - p[0]) ** 2 + (c.g - p[1]) ** 2 + (c.b - p[2]) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return rgb(best[0] / 255, best[1] / 255, best[2] / 255);
    }

    // Like printSafeRgb but blended with white at the given opacity.
    // Used for the cover overview where many lines overlap and full opacity is too heavy.
    function blendPrintSafe(hexColor, opacity) {
      const c = hexToRgb(hexColor || "#000000");
      const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
      let r = c.r,
        g = c.g,
        b = c.b;
      if (lum >= 0.5) {
        let best = PRINT_PALETTE[0],
          bestDist = Infinity;
        for (const p of PRINT_PALETTE) {
          const d = (c.r - p[0]) ** 2 + (c.g - p[1]) ** 2 + (c.b - p[2]) ** 2;
          if (d < bestDist) {
            bestDist = d;
            best = p;
          }
        }
        [r, g, b] = best;
      }
      return rgb(
        1 - (1 - r / 255) * opacity,
        1 - (1 - g / 255) * opacity,
        1 - (1 - b / 255) * opacity,
      );
    }

    // ── Page coordinate helpers ──
    // All layout values expressed as mm from top-left of content area (inside 10mm margins).
    // pdf-lib y=0 is bottom of page, increasing upward.
    const xL = (mm) => MG + mm * PT;
    const yT = (mm) => A4H - MG - mm * PT; // PDF y for a point mm below content top

    function txt(page, text, x_mm, y_mm, opts = {}) {
      const { size = 9, font = fReg, color = C_BLACK, align = "left" } = opts;
      let x = xL(x_mm);
      if (align === "right") x -= font.widthOfTextAtSize(text, size);
      if (align === "center") x -= font.widthOfTextAtSize(text, size) / 2;
      try {
        page.drawText(text, { x, y: yT(y_mm), size, font, color });
      } catch (_) {}
    }

    function hRule(page, y_mm, thick = 0.4, color = C_LGRAY) {
      page.drawLine({
        start: { x: MG, y: yT(y_mm) },
        end: { x: MG + CW, y: yT(y_mm) },
        thickness: thick,
        color,
      });
    }

    function stdFooter(page, left, right) {
      hRule(page, 273, 0.3);
      txt(page, left, 0, 275, { size: 7, color: C_GRAY });
      txt(page, right, 190, 275, { size: 7, color: C_GRAY, align: "right" });
    }

    const boardDimLabel = board === 'rectangle'
      ? `${boardSizeCm}×${(D_mm_h/10).toFixed(1)} cm`
      : `${boardSizeCm} cm`;

    // ── PAGE 1: COVER / DESIGN OVERVIEW ──
    {
      const page = pdfDoc.addPage([A4W, A4H]);

      txt(page, "STRING ART STUDIO", 0, 7, {
        size: 7,
        font: fBold,
        color: C_LGRAY,
      });
      txt(page, "Build Pack", 0, 18, { size: 26, font: fBold });
      txt(
        page,
        `Generated ${date}  \u00b7  ${boardDimLabel} board  \u00b7  ${nailCount} nails  \u00b7  ${activeLayers.length} layer${activeLayers.length !== 1 ? "s" : ""}`,
        0,
        25,
        { size: 8, color: C_GRAY },
      );
      hRule(page, 28);

      // Preview diagram — scaled to fit, reference only (not true-size)
      const PW = 120,
        PH = 110,
        PX = 35,
        PTOP = 31;
      const sc = Math.min(PW / SZ, PH / SZ) * PT; // points per SVG unit
      // SVG (0,0) maps to top-left of preview box
      const pvX = (sx) => xL(PX) + sx * sc;
      const pvY = (sy) => A4H - MG - PTOP * PT - sy * sc;

      if (board === "circle") {
        page.drawCircle({
          x: pvX(CX),
          y: pvY(CY),
          size: BRAD * sc,
          color: undefined,
          borderColor: C_LGRAY,
          borderWidth: 1,
        });
      } else {
        page.drawRectangle({
          x: pvX(CX - BRAD),
          y: pvY(CY + svgRy),
          width: BRAD * 2 * sc,
          height: svgRy * 2 * sc,
          color: undefined,
          borderColor: C_LGRAY,
          borderWidth: 1,
        });
      }

      // All string lines — print-safe colour, blended at 0.5 so overlapping lines
      // don't saturate. Much more visible on paper than the old 0.08–0.18 blend.
      for (const L of layers) {
        if (!L.edges?.length) continue;
        const lc = blendPrintSafe(L.color, 0.5);
        for (const e of L.edges) {
          if (!svgPts[e.a] || !svgPts[e.b]) continue;
          const [x1, y1] = svgPts[e.a],
            [x2, y2] = svgPts[e.b];
          page.drawLine({
            start: { x: pvX(x1), y: pvY(y1) },
            end: { x: pvX(x2), y: pvY(y2) },
            thickness: 0.45,
            color: lc,
          });
        }
      }

      // Nail dots (preview size)
      for (let i = 0; i < nailCount; i++) {
        const [x, y] = svgPts[i];
        page.drawCircle({
          x: pvX(x),
          y: pvY(y),
          size: Math.max(1.2 * sc, 1),
          color: C_BLACK,
        });
      }

      txt(
        page,
        "Completed design — all layers combined",
        PX + PW / 2,
        PTOP + PH + 3,
        { size: 7.5, color: C_GRAY, align: "center" },
      );
      hRule(page, PTOP + PH + 7);

      // Stats row
      const sY = PTOP + PH + 12;
      const stats = [
        [String(nailCount), "NAILS"],
        [board.charAt(0).toUpperCase() + board.slice(1), "SHAPE"],
        [String(totalLines), "LINES"],
        [String(activeLayers.length), "LAYERS"],
        [boardDimLabel, "BOARD"],
      ];
      stats.forEach(([v, l], i) => {
        const x = i * 38 + 19;
        txt(page, v, x, sY, { size: 14, font: fBold, align: "center" });
        txt(page, l, x, sY + 7, { size: 6.5, color: C_GRAY, align: "center" });
      });
      hRule(page, sY + 11);

      // Thread requirements table
      let ry = sY + 16;
      txt(page, "THREAD REQUIREMENTS", 0, ry, {
        size: 8,
        font: fBold,
        color: C_GRAY,
      });
      hRule(page, ry + 2.5, 0.3);
      ry += 7;
      layers.forEach((L, li) => {
        if (!L.edges?.length) return;
        page.drawCircle({
          x: xL(1.5),
          y: yT(ry - 1.5),
          size: 2.5,
          color: printSafeRgb(L.color),
        });
        txt(page, `Layer ${li + 1}`, 4, ry, { size: 9 });
        txt(page, `~${toM(layerThreadMm[li])} m`, 190, ry, {
          size: 9,
          font: fBold,
          align: "right",
        });
        ry += 6;
      });
      hRule(page, ry, 0.75, rgb(0.75, 0.75, 0.75));
      ry += 4;
      txt(page, "Total", 0, ry, { size: 9, font: fBold });
      txt(page, `~${toM(totalThreadMm)} m`, 190, ry, {
        size: 9,
        font: fBold,
        align: "right",
      });
      ry += 5;
      txt(
        page,
        `Based on a ${boardDimLabel} board. Add ~10% extra for tying off.`,
        0,
        ry,
        { size: 7.5, color: C_GRAY },
      );

      stdFooter(page, CONTACT, `Page 1 of ${totalPages} — Design Overview`);
    }

    // ── TILE PAGES: true-size nail placement template ──
    // Each SVG unit = mmPerSVG physical mm = mmPerSVG * PT PDF points.
    // This guarantees every nail dot lands at its exact physical position on A4.
    let pageIdx = 1;
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        pageIdx++;
        const page = pdfDoc.addPage([A4W, A4H]);

        // Physical mm of this tile's left/top edge relative to board physical edge,
        // then converted to SVG units so the true-size transform stays exact.
        const physOX_mm = col * STRIDE_W_MM + tileOffset_X_mm;
        const physOY_mm = row * STRIDE_H_MM + tileOffset_Y_mm;
        const ox = boardLeft_svg + physOX_mm * svgPerMm; // SVG x-origin of this tile
        const oy = boardTop_svg  + physOY_mm * svgPerMm; // SVG y-origin of this tile
        const tileW_svg = TILE_W_MM * svgPerMm;
        const tileH_svg = TILE_H_MM * svgPerMm;
        // Stride boundary in SVG units — trim line falls here
        const strideX_svg = ox + STRIDE_W_MM * svgPerMm;
        const strideY_svg = oy + STRIDE_H_MM * svgPerMm;
        const tileLabel = `${String.fromCharCode(65 + row)}${col + 1}`;
        const tileNote =
          boardPageCount > 1
            ? `Tile ${tileLabel} of ${boardPageCount} — align marks and tape sheets before drilling`
            : `Single-sheet template — print at 100%, do not scale`;

        // Header
        txt(
          page,
          `Nail Placement Template  \u00b7  ${boardDimLabel} board  \u00b7  Tile ${tileLabel}` +
            (boardPageCount > 1
              ? ` (col ${col + 1}/${totalCols}, row ${row + 1}/${totalRows})`
              : ""),
          0,
          5.5,
          { size: 6.5, font: fBold, color: C_GRAY },
        );
        txt(
          page,
          `Page ${pageIdx} of ${totalPages}  \u00b7  PRINT AT 100% -- no scaling, no fit-to-page`,
          190,
          5.5,
          { size: 6.5, font: fBold, color: C_RED, align: "right" },
        );
        hRule(page, 8, 0.4);

        // ── True-size coordinate transform ──
        // The SVG area starts at TILE_HDR_MM below the content top.
        // Each SVG unit maps to exactly mmPerSVG * PT PDF points — no scaling anywhere.
        const SVG_TOP_PT = A4H - MG - TILE_HDR_MM * PT; // PDF y of SVG area top
        const tpX = (sx) => MG + (sx - ox) * mmPerSVG * PT;
        const tpY = (sy) => SVG_TOP_PT - (sy - oy) * mmPerSVG * PT;

        const txMax = ox + tileW_svg;
        const tyMax = oy + tileH_svg;

        // Outer dotted guide — board edge (nails are 15mm inset from this line)
        const guideR_pt  = BRAD  * mmPerSVG * PT; // exact board edge, circle/square
        const guideRy_pt = svgRy * mmPerSVG * PT; // vertical radius for rectangle
        const guideDash = 2 * PT; // 2 mm dot
        const guideGap  = 2 * PT; // 2 mm gap  → tight dotted look
        const guideThick = 0.5;
        if (board === "circle") {
          const cx_pt = tpX(CX);
          const cy_pt = tpY(CY);
          const circ   = 2 * Math.PI * guideR_pt;
          const period = guideDash + guideGap;
          let dist = 0;
          while (dist < circ) {
            const a1 = (dist / circ) * 2 * Math.PI;
            const a2 = (Math.min(dist + guideDash, circ) / circ) * 2 * Math.PI;
            page.drawLine({
              start: { x: cx_pt + Math.cos(a1) * guideR_pt, y: cy_pt + Math.sin(a1) * guideR_pt },
              end:   { x: cx_pt + Math.cos(a2) * guideR_pt, y: cy_pt + Math.sin(a2) * guideR_pt },
              thickness: guideThick, color: C_LGRAY,
            });
            dist += period;
          }
        } else {
          const rx_pt = tpX(CX) - guideR_pt;
          const ry_pt = tpY(CY) - guideRy_pt; // bottom-left in PDF coords
          const rw_pt = guideR_pt  * 2;
          const rh_pt = guideRy_pt * 2;
          const period = guideDash + guideGap;
          const sides = [
            [rx_pt,          ry_pt,          1,  0, rw_pt],
            [rx_pt + rw_pt,  ry_pt,          0,  1, rh_pt],
            [rx_pt + rw_pt,  ry_pt + rh_pt, -1,  0, rw_pt],
            [rx_pt,          ry_pt + rh_pt,  0, -1, rh_pt],
          ];
          for (const [sx, sy, dx, dy, len] of sides) {
            let d = 0;
            while (d < len) {
              const d2 = Math.min(d + guideDash, len);
              page.drawLine({
                start: { x: sx + dx * d,  y: sy + dy * d  },
                end:   { x: sx + dx * d2, y: sy + dy * d2 },
                thickness: guideThick, color: C_LGRAY,
              });
              d += period;
            }
          }
        }

        // ── Overlap zone shading — drawn before nail dots so dots sit on top ──
        const SVG_AREA_TOP_PT    = A4H - MG - TILE_HDR_MM * PT;
        const SVG_AREA_BOTTOM_PT = A4H - MG - (TILE_HDR_MM + TILE_H_MM) * PT;
        const trimX_pt = tpX(strideX_svg);
        const trimY_pt = tpY(strideY_svg);
        if (col < totalCols - 1) {
          const overlapW = OVERLAP_MM * PT;
          page.drawRectangle({
            x: trimX_pt,
            y: SVG_AREA_BOTTOM_PT,
            width: overlapW,
            height: SVG_AREA_TOP_PT - SVG_AREA_BOTTOM_PT,
            color: rgb(0.93, 0.93, 0.93),
          });
        }
        if (row < totalRows - 1) {
          const overlapH = OVERLAP_MM * PT;
          page.drawRectangle({
            x: MG,
            y: trimY_pt - overlapH,
            width: CW,
            height: overlapH,
            color: rgb(0.93, 0.93, 0.93),
          });
        }

        // Nail dots — centred at exact physical position, for drilling
        const nailR_pt = Math.max(0.35 * PT, 0.8); // ~0.35 mm radius
        const lblSz = nailCount > 400 ? 4 : nailCount > 200 ? 4.5 : nailCount > 100 ? 5.5 : 6.5;
        const offMm = nailCount > 200 ? 3.5 : 5; // mm offset outward for label

        for (let i = 0; i < nailCount; i++) {
          const [sx, sy] = pdfNailPts[i];
          if (sx < ox - 6 || sx > txMax + 6 || sy < oy - 6 || sy > tyMax + 6)
            continue;
          const px = tpX(sx),
            py = tpY(sy);

          // Drill-point dot (solid circle centred on nail position)
          page.drawCircle({ x: px, y: py, size: nailR_pt, color: C_BLACK });

          // Number label — suppress in overlap zone (adjacent tile shows it cleanly)
          const inColOverlap = col < totalCols - 1 && sx >= strideX_svg;
          const inRowOverlap = row < totalRows - 1 && sy >= strideY_svg;
          if (!inColOverlap && !inRowOverlap) {
            const dx = sx - CX,
              dy = sy - CY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const offPt = offMm * PT;
            const lx = px + (dx / len) * offPt;
            const ly = py - (dy / len) * offPt;
            const label = String(i + numStart);
            const lw = fReg.widthOfTextAtSize(label, lblSz);
            try {
              page.drawText(label, {
                x: lx - lw / 2,
                y: ly - lblSz / 2,
                size: lblSz,
                font: fReg,
                color: C_GRAY,
              });
            } catch (_) {}
          }
        }

        // ── Trim lines + registration crosshairs ──
        const mkPt = 6 * PT; // 6 mm crosshair arm
        const areaH = SVG_AREA_TOP_PT - SVG_AREA_BOTTOM_PT;

        // Right trim line + crosshairs: shown on non-last-column tiles
        if (col < totalCols - 1) {
          // Full-height red trim line at stride boundary
          page.drawLine({
            start: { x: trimX_pt, y: SVG_AREA_TOP_PT },
            end:   { x: trimX_pt, y: SVG_AREA_BOTTOM_PT },
            thickness: 0.6, color: C_RED,
          });
          // Two crosshairs at 25% and 75% of tile height
          for (const frac of [0.25, 0.75]) {
            const xhY = SVG_AREA_TOP_PT - areaH * frac;
            page.drawLine({ start: { x: trimX_pt - mkPt, y: xhY }, end: { x: trimX_pt + mkPt, y: xhY }, thickness: 0.6, color: C_RED });
            page.drawLine({ start: { x: trimX_pt, y: xhY - mkPt }, end: { x: trimX_pt, y: xhY + mkPt }, thickness: 0.6, color: C_RED });
          }
          // Label on the trim line
          txt(page, "TRIM", (trimX_pt - MG) / PT + 1, TILE_HDR_MM + 3, { size: 5, color: C_RED });
        }

        // Bottom trim line + crosshairs: shown on non-last-row tiles
        if (row < totalRows - 1) {
          page.drawLine({
            start: { x: MG,      y: trimY_pt },
            end:   { x: MG + CW, y: trimY_pt },
            thickness: 0.6, color: C_RED,
          });
          for (const frac of [0.25, 0.75]) {
            const xhX = MG + CW * frac;
            page.drawLine({ start: { x: xhX - mkPt, y: trimY_pt }, end: { x: xhX + mkPt, y: trimY_pt }, thickness: 0.6, color: C_RED });
            page.drawLine({ start: { x: xhX, y: trimY_pt - mkPt }, end: { x: xhX, y: trimY_pt + mkPt }, thickness: 0.6, color: C_RED });
          }
        }

        // Left tab crosshairs: matching marks on the non-first-column tiles
        if (col > 0) {
          const tabX = tpX(ox);
          for (const frac of [0.25, 0.75]) {
            const xhY = SVG_AREA_TOP_PT - areaH * frac;
            page.drawLine({ start: { x: tabX - mkPt, y: xhY }, end: { x: tabX + mkPt, y: xhY }, thickness: 0.6, color: C_RED });
            page.drawLine({ start: { x: tabX, y: xhY - mkPt }, end: { x: tabX, y: xhY + mkPt }, thickness: 0.6, color: C_RED });
          }
        }

        // Top tab crosshairs: matching marks on non-first-row tiles
        if (row > 0) {
          const tabY = tpY(oy);
          for (const frac of [0.25, 0.75]) {
            const xhX = MG + CW * frac;
            page.drawLine({ start: { x: xhX - mkPt, y: tabY }, end: { x: xhX + mkPt, y: tabY }, thickness: 0.6, color: C_RED });
            page.drawLine({ start: { x: xhX, y: tabY - mkPt }, end: { x: xhX, y: tabY + mkPt }, thickness: 0.6, color: C_RED });
          }
        }

        // Footer: 1 cm scale-check bar + reference text
        const fY = 277 - TILE_FTR_MM;
        hRule(page, fY, 0.4);

        // Scale bar: exactly 10 mm wide — must measure 1 cm when printed at 100%
        const ONE_CM_PT = 10 * PT;
        page.drawRectangle({
          x: MG,
          y: yT(fY + 5.5),
          width: ONE_CM_PT,
          height: 3.5,
          color: C_BLACK,
        });
        txt(page, "< 1 cm \u00b7 Board edge = dotted line \u00b7 Nails 15mm inset \u00b7 Grey = overlap tab \u00b7 Trim at red line \u00b7 Match crosshairs \u00b7 Tape, then drill", 12, fY + 5, {
          size: 6,
          color: C_GRAY,
        });
        txt(page, `${tileNote}  \u00b7  ${CONTACT}`, 190, fY + 5, {
          size: 6,
          color: C_LGRAY,
          align: "right",
        });
      }
    }

    // ── LAYER PAGES: one per active layer ──
    layers.forEach((L, li) => {
      if (!L.edges?.length) return;
      pageIdx++;
      const page = pdfDoc.addPage([A4W, A4H]);

      const lc = printSafeRgb(L.color);
      const moves = L.seq?.length ? L.seq.length - 1 : L.edges.length;
      const startNail = L.seq?.length ? L.seq[0] + numStart : "\u2014";
      const activeIdx = activeLayers.indexOf(L) + 1;

      // Colour accent bar
      page.drawRectangle({
        x: MG,
        y: yT(25),
        width: 4,
        height: 25 * PT,
        color: lc,
      });
      txt(page, `LAYER ${activeIdx} OF ${activeLayers.length}`, 7, 6.5, {
        size: 7,
        font: fBold,
        color: C_LGRAY,
      });
      txt(page, `Layer ${li + 1}`, 7, 18, { size: 20, font: fBold });
      txt(page, L.color || "", 7, 23.5, { size: 9, color: lc });
      hRule(page, 27);

      // KPI strip
      const kpis = [
        [String(moves), "MOVES"],
        [String(startNail), "START NAIL"],
        [`~${toM(layerThreadMm[li])} m`, "THREAD"],
      ];
      kpis.forEach(([v, l], i) => {
        const x = i * 63.3 + 31.7;
        txt(page, v, x, 34, { size: 13, font: fBold, align: "center" });
        txt(page, l, x, 40, { size: 6, color: C_GRAY, align: "center" });
      });
      hRule(page, 43);

      // Layer preview diagram (scaled to fit, not true-size)
      const PW2 = 130,
        PH2 = 118,
        PX2 = 30,
        PTOP2 = 46;
      const sc2 = Math.min(PW2 / SZ, PH2 / SZ) * PT;
      const lpX = (sx) => xL(PX2) + sx * sc2;
      const lpY = (sy) => A4H - MG - PTOP2 * PT - sy * sc2;

      if (board === "circle") {
        page.drawCircle({
          x: lpX(CX),
          y: lpY(CY),
          size: BRAD * sc2,
          color: undefined,
          borderColor: C_LGRAY,
          borderWidth: 1,
        });
      } else {
        page.drawRectangle({
          x: lpX(CX - BRAD),
          y: lpY(CY + svgRy),
          width: BRAD * 2 * sc2,
          height: svgRy * 2 * sc2,
          color: undefined,
          borderColor: C_LGRAY,
          borderWidth: 1,
        });
      }

      // This layer's lines — full print-safe colour, thicker stroke for clear printing
      const lPrint = printSafeRgb(L.color);
      for (const e of L.edges) {
        if (!svgPts[e.a] || !svgPts[e.b]) continue;
        const [x1, y1] = svgPts[e.a],
          [x2, y2] = svgPts[e.b];
        page.drawLine({
          start: { x: lpX(x1), y: lpY(y1) },
          end: { x: lpX(x2), y: lpY(y2) },
          thickness: 1.4,
          color: lPrint,
        });
      }

      // Nail dots
      for (let i = 0; i < nailCount; i++) {
        const [x, y] = svgPts[i];
        page.drawCircle({
          x: lpX(x),
          y: lpY(y),
          size: Math.max(1.2 * sc2, 1),
          color: C_BLACK,
        });
      }

      txt(page, `Layer ${li + 1} isolated`, PX2 + PW2 / 2, PTOP2 + PH2 + 3, {
        size: 7.5,
        color: C_GRAY,
        align: "center",
      });

      // Sequence grid — fully paginated, no truncation
      if (L.seq?.length > 1) {
        const sqTop = PTOP2 + PH2 + 8; // 172mm
        const totalSteps = L.seq.length - 1;
        hRule(page, sqTop);
        txt(page, `SEQUENCE — LAYER ${li + 1}`, 0, sqTop + 4.5, {
          size: 8.5,
          font: fBold,
          color: C_GRAY,
        });
        txt(
          page,
          `Start at nail ${startNail}  \u00b7  ${totalSteps} moves  \u00b7  follow each step in order`,
          0,
          sqTop + 9,
          { size: 7.5, color: C_GRAY },
        );

        // Render steps on the layer preview page
        let si = 0;
        while (si < totalSteps) {
          const sc3 = si % SCOLS_SEQ;
          const sr = Math.floor(si / SCOLS_SEQ);
          const cx = sc3 * (COL_W_MM + COL_GAP_MM);
          const cy = sqTop + 15 + sr * SEQ_ROW_H_MM;

          if (cy > SEQ_MAX_Y_MM) break;

          const fromNail = L.seq[si] + numStart;
          const toNail = L.seq[si + 1] + numStart;
          page.drawRectangle({
            x: xL(cx),
            y: yT(cy + CELL_H_MM),
            width: COL_W_MM * PT,
            height: CELL_H_MM * PT,
            color: rgb(0.985, 0.985, 0.985),
            borderColor: C_LGRAY,
            borderWidth: 0.4,
          });

          // Step label near top
          txt(page, "Step " + (si + 1), cx + 3, cy + 2.8, {
            size: 6,
            color: C_GRAY,
          });

          // Move text INSIDE the card
          txt(
            page,
            String(fromNail) + " -> " + String(toNail),
            cx + COL_W_MM / 2,
            cy + 5.5,
            {
              size: 10,
              font: fBold,
              align: "center",
            },
          );
          si++;
        }

        stdFooter(
          page,
          CONTACT,
          `Page ${pageIdx} of ${totalPages} - Layer ${li + 1} of ${activeLayers.length}`,
        );

        // Continuation pages for remaining steps
        while (si < totalSteps) {
          pageIdx++;
          const contPage = pdfDoc.addPage([A4W, A4H]);
          const rangeStart = si + 1;
          const stepsStartOnThisPage = si;

          // Compact header
          contPage.drawRectangle({
            x: MG,
            y: yT(CONT_HDR_MM),
            width: 4,
            height: CONT_HDR_MM * PT,
            color: lc,
          });
          txt(
            contPage,
            `LAYER ${activeIdx} OF ${activeLayers.length}`,
            7,
            6.5,
            { size: 7, font: fBold, color: C_LGRAY },
          );
          txt(contPage, `Layer ${li + 1} - Sequence continued`, 7, 17, {
            size: 16,
            font: fBold,
          });
          txt(contPage, L.color || "", 7, 22, { size: 9, color: lc });
          hRule(contPage, CONT_HDR_MM);

          // Fill this page with steps
          while (si < totalSteps) {
            const relIdx = si - stepsStartOnThisPage;
            const sc3 = relIdx % SCOLS_SEQ;
            const sr = Math.floor(relIdx / SCOLS_SEQ);
            const cx = sc3 * (COL_W_MM + COL_GAP_MM);
            const cy = CONT_STEPS_START_MM + sr * SEQ_ROW_H_MM;

            if (cy > SEQ_MAX_Y_MM) break;

            const fromNail = L.seq[si] + numStart;
            const toNail = L.seq[si + 1] + numStart;

            contPage.drawRectangle({
              x: xL(cx),
              y: yT(cy + CELL_H_MM),
              width: COL_W_MM * PT,
              height: CELL_H_MM * PT,
              color: rgb(0.985, 0.985, 0.985),
              borderColor: C_LGRAY,
              borderWidth: 0.4,
            });

            txt(contPage, "#" + (si + 1), cx + 2, cy + 2.8, {
              size: 5.8,
              font: fBold,
              color: C_GRAY,
            });

            txt(
              contPage,
              String(fromNail) + " -> " + String(toNail),
              cx + COL_W_MM / 2,
              cy + 5.5,
              {
                size: 9.5,
                font: fBold,
                align: "center",
              },
            );

            si++;
          }

          const rangeEnd = si;
          txt(
            contPage,
            `Steps ${rangeStart}-${rangeEnd} of ${totalSteps} - Layer ${li + 1}`,
            0,
            CONT_HDR_MM + 3.5,
            { size: 7.5, color: C_GRAY },
          );
          stdFooter(
            contPage,
            CONTACT,
            `Page ${pageIdx} of ${totalPages} - Layer ${li + 1} of ${activeLayers.length} (steps ${rangeStart}-${rangeEnd})`,
          );
        }
      } else {
        stdFooter(
          page,
          CONTACT,
          `Page ${pageIdx} of ${totalPages} - Layer ${li + 1} of ${activeLayers.length}`,
        );
      }
    });

    // ── BUILD GUIDE PAGE ──
    pageIdx++;
    {
      const page = pdfDoc.addPage([A4W, A4H]);

      txt(page, "STRING ART STUDIO", 0, 7, {
        size: 7,
        font: fBold,
        color: C_LGRAY,
      });
      txt(page, "How To Build", 0, 19, { size: 22, font: fBold });
      hRule(page, 23);

      const steps = [
        [
          "1",
          "Start at the listed nail",
          "Each layer page shows the start nail — tie a knot here before you begin.",
        ],
        [
          "2",
          "Follow the sequence in order",
          "Each step shows one nail move. Work through the list exactly as shown, nail by nail.",
        ],
        [
          "3",
          "Keep even tension on the thread",
          "Thread should be snug but not so tight it bows the board.",
        ],
        [
          "4",
          "Complete one full layer before stopping",
          "Finish the entire sequence for a layer before moving to the next colour.",
        ],
      ];

      let sy = 28;
      for (const [num, title, desc] of steps) {
        const cx2 = xL(4.5),
          cy2 = yT(sy + 3);
        page.drawCircle({ x: cx2, y: cy2, size: 4.5 * PT, color: C_BLACK });
        const nw = fBold.widthOfTextAtSize(num, 11);
        try {
          page.drawText(num, {
            x: cx2 - nw / 2,
            y: cy2 - 4.5,
            size: 11,
            font: fBold,
            color: C_WHITE,
          });
        } catch (_) {}
        txt(page, title, 12, sy + 1.5, { size: 10, font: fBold });
        txt(page, desc, 12, sy + 7, { size: 8, color: C_GRAY });
        hRule(page, sy + 12, 0.3, rgb(0.92, 0.92, 0.92));
        sy += 15;
      }

      sy += 3;
      txt(page, "TIPS", 0, sy, { size: 8.5, font: fBold, color: C_GRAY });
      hRule(page, sy + 2.5, 0.3);
      sy += 7;

      const tips = [
        "Do not pull the thread too tight — this can warp the board",
        "Use contrasting colours to make each layer visually distinct",
        "Mark your start nail with a small piece of tape while you work",
      ];
      for (const tip of tips) {
        txt(page, ". " + tip, 0, sy, { size: 8.5, color: C_GRAY });
        hRule(page, sy + 4.5, 0.3, rgb(0.92, 0.92, 0.92));
        sy += 7.5;
      }

      stdFooter(
        page,
        CONTACT,
        `Page ${pageIdx} of ${totalPages} — Build Guide`,
      );
    }

    // ── SAVE & DOWNLOAD ──
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "string-art-template.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  window.applyTemplateDesign = applyTemplateDesign;

  init();
});
