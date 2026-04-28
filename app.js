// Stamp generator — SVG-based, dimensions in mm.
// 1 user-unit in SVG === 1 mm. Preview applies CSS transform: scale() for zoom.

const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);

const els = {
  shape: $("shape"), size: $("size"), color: $("color"),
  font: $("font"), weight: $("weight"), case: $("case"),
  preset: $("preset"),
  topFont: $("topFont"), bottomFont: $("bottomFont"), midFont: $("midFont"),
  topStarMul: $("topStarMul"), bottomStarMul: $("bottomStarMul"),

  topText: $("topText"), topSize: $("topSize"), topSpacing: $("topSpacing"), topOffset: $("topOffset"),
  bottomText: $("bottomText"), bottomSize: $("bottomSize"), bottomSpacing: $("bottomSpacing"), bottomOffset: $("bottomOffset"),
  midText: $("midText"), midSize: $("midSize"), midRadius: $("midRadius"), midPos: $("midPos"),

  centerLines: $("centerLines"),
  addLine: $("addLine"),

  showStars: $("showStars"), showTrident: $("showTrident"),
  separator: $("separator"),

  outerWidth: $("outerWidth"), outerStyle: $("outerStyle"),
  outerPatternText: $("outerPatternText"),
  outerPatternTextLabel: $("outerPatternTextLabel"),
  ring2Enabled: $("ring2Enabled"),
  ring2Diameter: $("ring2Diameter"),
  ring2Width: $("ring2Width"),
  ring2Style: $("ring2Style"),
  innerRingStyle: $("innerRingStyle"),
  innerWidth: $("innerWidth"),
  innerDiameter: $("innerDiameter"),
  innerPatternHeight: $("innerPatternHeight"),
  guillochePattern: $("guillochePattern"),
  guillocheOpacity: $("guillocheOpacity"),
  guillocheDensity: $("guillocheDensity"),
  distress: $("distress"), distressLevel: $("distressLevel"),
  bgFile: $("bgFile"), bgClear: $("bgClear"),
  bgOpacity: $("bgOpacity"), bgScale: $("bgScale"),
  bgX: $("bgX"), bgY: $("bgY"), bgRotate: $("bgRotate"),
  bgOnTop: $("bgOnTop"), bgImage: $("bgImage"),
  exportAsCurves: $("exportAsCurves"),

  stage: $("stage"),
  previewArea: $("previewArea"),
  previewCanvas: $("previewCanvas"),
  zoomSlider: $("zoomSlider"), zoomLabel: $("zoomLabel"),
  zoomIn: $("zoomIn"), zoomOut: $("zoomOut"),
  zoomFit: $("zoomFit"), zoom100: $("zoom100"),
  showPaper: $("showPaper"), showRuler: $("showRuler"),
  dimsLabel: $("dimsLabel"),
};

// Default center lines — нейтральний приклад для першого завантаження
const DEFAULT_LINES = [
  { text: "ОСНОВНА", size: 2.6, weight: "bold", style: "normal" },
  { text: "ПЕЧАТКА", size: 2.6, weight: "bold", style: "normal" },
];

// Presets are loaded asynchronously from `presets.json` (public, committed)
// and `presets.local.json` (private, gitignored). User presets stored in
// localStorage are also merged in. All three sources show up in the dropdown.
let PRESETS = {};

const LS_AUTORESUME_KEY  = "stamp.autoresume.v1";
const LS_USER_PRESETS_KEY = "stamp.userPresets.v1";

function lsGetUserPresets() {
  try { return JSON.parse(localStorage.getItem(LS_USER_PRESETS_KEY) || "{}"); }
  catch { return {}; }
}

function lsSaveUserPresets(map) {
  try { localStorage.setItem(LS_USER_PRESETS_KEY, JSON.stringify(map)); return true; }
  catch { return false; }
}

async function loadPresets() {
  for (const url of ["presets.json", "presets.local.json"]) {
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (r.ok) Object.assign(PRESETS, await r.json());
    } catch { /* presets.local.json is optional — ignore failure */ }
  }
  // User-named presets saved from the «Файл → Зберегти як пресет» menu
  const user = lsGetUserPresets();
  for (const [key, data] of Object.entries(user)) {
    PRESETS[`__user__${key}`] = { ...data, label: `★ ${data.label || key}` };
  }
  populatePresetDropdown();
}

function populatePresetDropdown() {
  if (!els.preset) return;
  Array.from(els.preset.options).forEach(o => { if (o.value) o.remove(); });
  // Built-in presets first, user presets afterward (recognised by `__user__` prefix)
  const sorted = Object.entries(PRESETS).sort(([a], [b]) => {
    const aUser = a.startsWith("__user__"), bUser = b.startsWith("__user__");
    if (aUser !== bUser) return aUser ? 1 : -1;
    return 0;
  });
  for (const [key, p] of sorted) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = p.label || key;
    els.preset.appendChild(opt);
  }
}

// ===== Auto-save current form state to localStorage =====
let _lsSaveTimer = null;
function lsScheduleAutosave() {
  clearTimeout(_lsSaveTimer);
  _lsSaveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_AUTORESUME_KEY, JSON.stringify(getStampJson())); }
    catch { /* quota / privacy mode — ignore */ }
  }, 250);
}

function lsRestoreAutosave() {
  try {
    const raw = localStorage.getItem(LS_AUTORESUME_KEY);
    if (!raw) return false;
    loadStampJson(JSON.parse(raw));
    return true;
  } catch { return false; }
}

function lsClearAutosave() {
  try { localStorage.removeItem(LS_AUTORESUME_KEY); } catch {}
}

// ===== Save current state as a named user preset =====
function saveAsUserPreset() {
  const name = prompt("Назва пресета (як буде показано у списку):");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const all = lsGetUserPresets();
  if (all[trimmed] && !confirm(`Пресет "${trimmed}" вже існує. Перезаписати?`)) return;
  const data = getStampJson();
  data.label = trimmed;
  all[trimmed] = data;
  if (!lsSaveUserPresets(all)) {
    alert("Не вдалося зберегти у браузері (можливо, заповнено сховище).");
    return;
  }
  PRESETS[`__user__${trimmed}`] = { ...data, label: `★ ${trimmed}` };
  populatePresetDropdown();
  els.preset.value = `__user__${trimmed}`;
  alert(`Пресет "${trimmed}" збережено в браузері.`);
}

function deleteUserPresetUi() {
  const all = lsGetUserPresets();
  const names = Object.keys(all);
  if (!names.length) { alert("У браузері немає збережених пресетів."); return; }
  const list = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
  const ans = prompt(`Який пресет видалити? Введи номер:\n\n${list}`);
  if (!ans) return;
  const idx = parseInt(ans, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= names.length) { alert("Невірний номер."); return; }
  const name = names[idx];
  if (!confirm(`Видалити пресет "${name}"?`)) return;
  delete all[name];
  lsSaveUserPresets(all);
  delete PRESETS[`__user__${name}`];
  populatePresetDropdown();
}

// ============================================================
// CENTER LINES UI
// ============================================================
function makeLineRow(line = { text: "", size: 3.0, weight: "", style: "normal", font: "" }) {
  const tpl = document.getElementById("line-row-template");
  const row = tpl.content.firstElementChild.cloneNode(true);
  row.querySelector(".line-text").value = line.text;
  row.querySelector(".line-size").value = line.size;
  row.querySelector(".line-weight").value = line.weight || "";
  row.querySelector(".line-style").value = line.style || "normal";
  row.querySelector(".line-font").value = line.font || "";

  row.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  row.querySelector(".line-remove").addEventListener("click", () => {
    row.remove();
    render();
  });
  row.querySelector(".line-up").addEventListener("click", () => {
    if (row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
    render();
  });
  row.querySelector(".line-down").addEventListener("click", () => {
    if (row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
    render();
  });
  return row;
}

function setLines(lines) {
  els.centerLines.innerHTML = "";
  for (const l of lines) els.centerLines.appendChild(makeLineRow(l));
}

function getLines() {
  return Array.from(els.centerLines.children).map(row => ({
    text: row.querySelector(".line-text").value,
    size: parseFloat(row.querySelector(".line-size").value) || 3,
    weight: row.querySelector(".line-weight").value,
    style: row.querySelector(".line-style").value,
    font: row.querySelector(".line-font").value || "",
  })).filter(l => l.text);
}

// ============================================================
// SHAPE / SIZE SYNC
// ============================================================
function syncSizeOptions() {
  const shape = els.shape.value;
  let firstVisible = null;
  for (const opt of els.size.options) {
    const visible = opt.dataset.shape === shape;
    opt.hidden = !visible;
    if (visible && firstVisible === null) firstVisible = opt.value;
  }
  const cur = els.size.options[els.size.selectedIndex];
  if (!cur || cur.hidden) els.size.value = firstVisible;
}

function applyCase(s) {
  return els.case.value === "upper" ? s.toLocaleUpperCase("uk-UA") : s;
}

function getDimensions() {
  const shape = els.shape.value;
  const v = els.size.value;
  if (shape === "circle") return { width: parseFloat(v), height: parseFloat(v) };
  if (shape === "ellipse" || shape === "rect") {
    const [w, h] = v.split("x").map(parseFloat);
    return { width: w, height: h };
  }
  if (shape === "triangle") {
    const a = parseFloat(v);
    return { width: a, height: a * Math.sqrt(3) / 2 };
  }
}

// ============================================================
// SVG BUILD
// ============================================================
function buildSvg() {
  const shape = els.shape.value;
  const { width, height } = getDimensions();
  const margin = 2;
  const vbW = width + margin * 2;
  const vbH = height + margin * 2;
  const cx = vbW / 2;
  const cy = vbH / 2;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  svg.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  svg.setAttribute("width", `${vbW}mm`);
  svg.setAttribute("height", `${vbH}mm`);

  if (els.distress.checked) {
    const lvl = parseInt(els.distressLevel.value, 10) / 100;
    const defs = document.createElementNS(SVG_NS, "defs");
    defs.innerHTML = `
      <filter id="distress" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="${1.6 + lvl * 1.6}" numOctaves="2" seed="7" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="${0.15 + lvl * 0.6}"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 1 ${0.95 - lvl * 0.4} 1 ${0.85 - lvl * 0.5} 1"/></feComponentTransfer>
      </filter>`;
    svg.appendChild(defs);
  }

  const root = document.createElementNS(SVG_NS, "g");
  root.setAttribute("fill", els.color.value);
  root.setAttribute("stroke", els.color.value);
  root.setAttribute("font-family", els.font.value);
  root.setAttribute("font-weight", els.weight.value);
  if (els.distress.checked) root.setAttribute("filter", "url(#distress)");
  svg.appendChild(root);

  if (shape === "circle") drawCircle(root, cx, cy, width / 2);
  else if (shape === "ellipse") drawEllipse(root, cx, cy, width / 2, height / 2);
  else if (shape === "rect") drawRect(root, cx, cy, width, height);
  else if (shape === "triangle") drawTriangle(root, cx, cy, width);

  return svg;
}

function strokeAttrs(width, style) {
  const out = { "stroke-width": width, fill: "none" };
  if (style === "dashed") out["stroke-dasharray"] = `${width * 4} ${width * 2}`;
  return out;
}
function setAttrs(el, obj) { for (const k in obj) el.setAttribute(k, obj[k]); }

// ----- CIRCULAR -----
// Geometry contract:
//   ringOuterR   = r                          (radius of the main outer ring)
//   ring2R       = ring2Diameter / 2          (optional thin secondary ring)
//   innerR       = innerDiameter / 2          (decorative inner ring)
//   Top arc text sits between ring2 (or outer) and inner ring, glyphs extending OUTWARD
//   Bottom arc text — same band, glyphs extending OUTWARD
function drawCircle(root, cx, cy, r) {
  const outerW = parseFloat(els.outerWidth.value);
  const innerW = parseFloat(els.innerWidth.value);
  const innerR = parseFloat(els.innerDiameter.value) / 2;
  const ring2On = els.ring2Enabled.checked;
  const ring2R = parseFloat(els.ring2Diameter.value) / 2;
  const ring2W = parseFloat(els.ring2Width.value);

  // 1. Guilloche background, clipped to inside of outer ring
  drawGuilloche(root, cx, cy, r - outerW / 2);

  // 2. Main outer ring
  drawOuterRing(root, cx, cy, r, outerW);

  // 3. Optional secondary thin ring just inside outer
  if (ring2On && ring2W > 0 && ring2R > 0) {
    const c = document.createElementNS(SVG_NS, "circle");
    setAttrs(c, { cx, cy, r: ring2R, ...strokeAttrs(ring2W, els.ring2Style.value) });
    root.appendChild(c);
  }

  // 4. Decorative inner ring (the 28mm one by default)
  drawInnerDecorativeRing(root, cx, cy, innerR, innerW);

  // 5. Arc text band: between the inner ring and ring2 (or outer if ring2 off).
  //    Top arc: glyphs extend OUTWARD from path → baseline radius = bandOuter - fontSize - gap.
  //    Bottom arc: glyphs extend INWARD from path → baseline radius = bandOuter - gap.
  const bandOuter = ring2On ? (ring2R - ring2W / 2) : (r - outerW / 2);
  const bandInner = innerR + innerW / 2;
  const topH = parseFloat(els.topSize.value);
  const botH = parseFloat(els.bottomSize.value);
  const gap = 0.3;
  const topPathR = bandOuter - topH - gap + parseFloat(els.topOffset.value || 0);
  const botPathR = bandOuter - gap + parseFloat(els.bottomOffset.value || 0);

  const topMul = parseFloat(els.topStarMul?.value || 1.6);
  const botMul = parseFloat(els.bottomStarMul?.value || 1.6);
  drawArcText(root, cx, cy, topPathR, applyCase(els.topText.value),
    topH, parseFloat(els.topSpacing.value), "top", topMul, els.topFont?.value);
  drawArcText(root, cx, cy, botPathR, applyCase(els.bottomText.value),
    botH, parseFloat(els.bottomSpacing.value), "bottom", botMul, els.bottomFont?.value);

  // 6. Mid arc (e.g. "Код 12345678") — radius is user-defined diameter / 2
  if (els.midText.value) {
    const midR = parseFloat(els.midRadius.value) / 2;
    drawArcText(root, cx, cy, midR, applyCase(els.midText.value),
      parseFloat(els.midSize.value), 0.1, els.midPos.value, 1, els.midFont?.value);
  }

  // 7. Center content fits inside innerR
  drawCenterContent(root, cx, cy, innerR - 1);
}

// ----- ELLIPSE -----
function drawEllipse(root, cx, cy, rx, ry) {
  const outerW = parseFloat(els.outerWidth.value);
  const innerW = parseFloat(els.innerWidth.value);
  const offset = parseFloat(els.innerOffset.value);
  const innerStyle = els.innerStyle.value;

  if (outerW > 0) {
    const e = document.createElementNS(SVG_NS, "ellipse");
    setAttrs(e, { cx, cy, rx, ry, ...strokeAttrs(outerW, "solid") });
    root.appendChild(e);
  }
  if (innerStyle !== "none" && innerW > 0) {
    const e = document.createElementNS(SVG_NS, "ellipse");
    setAttrs(e, { cx, cy, rx: rx - offset, ry: ry - offset, ...strokeAttrs(innerW, innerStyle) });
    root.appendChild(e);
  }

  const tH = parseFloat(els.topSize.value);
  drawCenteredText(root, applyCase(els.topText.value), cx, cy - ry + offset + tH * 1.1, tH, "middle");
  const bH = parseFloat(els.bottomSize.value);
  drawCenteredText(root, applyCase(els.bottomText.value), cx, cy + ry - offset - bH * 0.4, bH, "middle");

  drawCenterContent(root, cx, cy, Math.min(rx, ry) * 0.75);
}

// ----- RECT -----
function drawRect(root, cx, cy, w, h) {
  const outerW = parseFloat(els.outerWidth.value);
  const innerW = parseFloat(els.innerWidth.value);
  const offset = parseFloat(els.innerOffset.value);
  const innerStyle = els.innerStyle.value;
  const x = cx - w / 2, y = cy - h / 2;

  if (outerW > 0) {
    const r = document.createElementNS(SVG_NS, "rect");
    setAttrs(r, { x, y, width: w, height: h, rx: 0.5, ...strokeAttrs(outerW, "solid") });
    root.appendChild(r);
  }
  if (innerStyle !== "none" && innerW > 0) {
    const r = document.createElementNS(SVG_NS, "rect");
    setAttrs(r, {
      x: x + offset, y: y + offset,
      width: w - offset * 2, height: h - offset * 2,
      rx: 0.3, ...strokeAttrs(innerW, innerStyle)
    });
    root.appendChild(r);
  }
  drawStackedLines(root, cx, cy);
}

// ----- TRIANGLE -----
function drawTriangle(root, cx, cy, side) {
  const h = side * Math.sqrt(3) / 2;
  const outerW = parseFloat(els.outerWidth.value);
  const innerW = parseFloat(els.innerWidth.value);
  const offset = parseFloat(els.innerOffset.value);
  const innerStyle = els.innerStyle.value;

  const top = [cx, cy - h * 2 / 3];
  const bl = [cx - side / 2, cy + h / 3];
  const br = [cx + side / 2, cy + h / 3];
  const points = `${top.join(",")} ${bl.join(",")} ${br.join(",")}`;

  if (outerW > 0) {
    const t = document.createElementNS(SVG_NS, "polygon");
    setAttrs(t, { points, ...strokeAttrs(outerW, "solid") });
    root.appendChild(t);
  }
  if (innerStyle !== "none" && innerW > 0) {
    const k = (side - offset * 2) / side;
    const sh = (p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k];
    const innerP = [sh(top), sh(bl), sh(br)].map(p => p.join(",")).join(" ");
    const t = document.createElementNS(SVG_NS, "polygon");
    setAttrs(t, { points: innerP, ...strokeAttrs(innerW, innerStyle) });
    root.appendChild(t);
  }
  drawStackedLines(root, cx, cy);
}

// ============================================================
// OUTER RING STYLES
// ============================================================
function drawOuterRing(root, cx, cy, r, baseW) {
  const style = els.outerStyle.value;
  if (baseW <= 0 && style !== "text") return;

  if (style === "solid") {
    const c = document.createElementNS(SVG_NS, "circle");
    setAttrs(c, { cx, cy, r, ...strokeAttrs(baseW, "solid") });
    root.appendChild(c);
  } else if (style === "thin") {
    const c = document.createElementNS(SVG_NS, "circle");
    setAttrs(c, { cx, cy, r, ...strokeAttrs(Math.max(0.2, baseW * 0.5), "solid") });
    root.appendChild(c);
  } else if (style === "double") {
    [r, r - baseW * 2].forEach(rr => {
      const c = document.createElementNS(SVG_NS, "circle");
      setAttrs(c, { cx, cy, r: rr, ...strokeAttrs(baseW * 0.6, "solid") });
      root.appendChild(c);
    });
  } else if (style === "text") {
    // outer line + inner line + text in between
    const gap = Math.max(2, baseW * 5);
    [r, r - gap].forEach(rr => {
      const c = document.createElementNS(SVG_NS, "circle");
      setAttrs(c, { cx, cy, r: rr, ...strokeAttrs(baseW * 0.8, "solid") });
      root.appendChild(c);
    });
    const tr = r - gap / 2;
    const txt = (els.outerPatternText.value || "").repeat(1);
    if (txt) {
      // Repeat text enough times to fill the circumference
      const repeats = Math.max(1, Math.ceil((2 * Math.PI * tr) / (txt.length * gap * 0.45)));
      const full = (txt + " ").repeat(repeats);
      drawArcText(root, cx, cy, tr, full, gap * 0.55, 0, "top");
    }
  }
}

// ============================================================
// INNER DECORATIVE RING
// ============================================================
function drawInnerDecorativeRing(root, cx, cy, r, w) {
  const style = els.innerRingStyle.value;
  if (style === "none" || r <= 0) return;
  const h = parseFloat(els.innerPatternHeight.value);
  const sw = Math.max(0.2, w);

  if (style === "simple") {
    const c = document.createElementNS(SVG_NS, "circle");
    setAttrs(c, { cx, cy, r, ...strokeAttrs(sw, "solid") });
    root.appendChild(c);
    return;
  }
  if (style === "dashed") {
    const c = document.createElementNS(SVG_NS, "circle");
    setAttrs(c, { cx, cy, r, ...strokeAttrs(sw, "dashed") });
    root.appendChild(c);
    return;
  }
  if (style === "dots") {
    const count = Math.max(20, Math.round(2 * Math.PI * r / (h * 0.9)));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const dot = document.createElementNS(SVG_NS, "circle");
      setAttrs(dot, { cx: x, cy: y, r: h * 0.3, fill: root.getAttribute("fill"), stroke: "none" });
      root.appendChild(dot);
    }
    return;
  }
  if (style === "zigzag") {
    drawZigzagRing(root, cx, cy, r, h, sw);
    return;
  }
  if (style === "meander") {
    drawMeanderRing(root, cx, cy, r, h, sw);
    return;
  }
  if (style === "chain") {
    drawChainRing(root, cx, cy, r, h, sw);
    return;
  }
  if (style === "rope") {
    drawWaveRing(root, cx, cy, r, h, sw, 1, 60);
    return;
  }
  if (style === "braid") {
    drawWaveRing(root, cx, cy, r, h, sw, 1, 80);
    drawWaveRing(root, cx, cy, r, h, sw, -1, 80);
    return;
  }
  if (style === "cable") {
    drawWaveRing(root, cx, cy, r, h, sw * 1.4, 1, 40);
    drawWaveRing(root, cx, cy, r, h * 0.5, sw * 0.8, -1, 80);
    return;
  }
}

function drawZigzagRing(root, cx, cy, r, h, sw) {
  const teeth = Math.max(40, Math.round(2 * Math.PI * r / (h * 1.2)));
  const pts = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = r + (i % 2 === 0 ? h / 2 : -h / 2);
    pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
  }
  const p = document.createElementNS(SVG_NS, "polyline");
  setAttrs(p, {
    points: pts.join(" "),
    fill: "none",
    stroke: root.getAttribute("stroke"),
    "stroke-width": sw,
    "stroke-linejoin": "miter",
    "stroke-linecap": "butt",
  });
  root.appendChild(p);
}

// Greek key / meander pattern: small repeating squared-spiral motif tiled along a circle.
function drawMeanderRing(root, cx, cy, r, h, sw) {
  const cellArc = h * 2.4; // arc length per cell
  const count = Math.max(20, Math.round((2 * Math.PI * r) / cellArc));
  const angStep = (Math.PI * 2) / count;

  // Motif in local coordinates (along arc tangent x, radial y where +y goes outward from center)
  // Drawn as a squared-spiral. Coordinates are in mm relative to cell center.
  const motif = [
    [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.3, 0.5],
    [-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.1, 0.3],
    [-0.1, -0.1], [0.1, -0.1],
  ];

  for (let i = 0; i < count; i++) {
    const a = i * angStep;
    const cosA = Math.cos(a), sinA = Math.sin(a);
    // tangent direction
    const tx = -sinA, ty = cosA;
    // radial direction (outward)
    const nx = cosA, ny = sinA;
    const baseX = cx + nx * r, baseY = cy + ny * r;
    const pts = motif.map(([mx, my]) => {
      const lx = mx * h * 1.1;
      const ly = my * h;
      const x = baseX + tx * lx + nx * ly;
      const y = baseY + ty * lx + ny * ly;
      return `${x},${y}`;
    });
    const p = document.createElementNS(SVG_NS, "polyline");
    setAttrs(p, {
      points: pts.join(" "),
      fill: "none",
      stroke: root.getAttribute("stroke"),
      "stroke-width": sw,
      "stroke-linejoin": "miter",
    });
    root.appendChild(p);
  }
}

function drawChainRing(root, cx, cy, r, h, sw) {
  const links = Math.max(24, Math.round((2 * Math.PI * r) / (h * 1.6)));
  const angStep = (Math.PI * 2) / links;
  for (let i = 0; i < links; i++) {
    const a = i * angStep;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const e = document.createElementNS(SVG_NS, "ellipse");
    setAttrs(e, {
      cx: x, cy: y, rx: h * 0.5, ry: h * 0.25,
      transform: `rotate(${(a * 180 / Math.PI) + 90} ${x} ${y})`,
      fill: "none",
      stroke: root.getAttribute("stroke"),
      "stroke-width": sw,
    });
    root.appendChild(e);
  }
}

// Sine wave along a circle (rope/braid)
function drawWaveRing(root, cx, cy, r, h, sw, direction, freq) {
  const steps = 360;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wave = Math.sin(a * freq) * (h / 2) * direction;
    const rr = r + wave;
    pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
  }
  const p = document.createElementNS(SVG_NS, "polyline");
  setAttrs(p, {
    points: pts.join(" "),
    fill: "none",
    stroke: root.getAttribute("stroke"),
    "stroke-width": sw,
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
  });
  root.appendChild(p);
}

// ============================================================
// GUILLOCHE BACKGROUND PATTERNS
// ============================================================
function drawGuilloche(root, cx, cy, r) {
  const kind = els.guillochePattern.value;
  if (kind === "none") return;

  const opacity = parseInt(els.guillocheOpacity.value, 10) / 100;
  const density = parseInt(els.guillocheDensity.value, 10) / 100;
  const color = root.getAttribute("fill");
  const id = `guilloche-${Math.random().toString(36).slice(2, 8)}`;

  // Build a <pattern> in the SVG defs
  const svg = root.ownerSVGElement || root.closest("svg");
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  const pat = document.createElementNS(SVG_NS, "pattern");
  pat.setAttribute("id", id);
  pat.setAttribute("patternUnits", "userSpaceOnUse");

  let cell = 1.4 / density;
  let inner = "";

  if (kind === "dots" || kind === "dotsDense") {
    cell = (kind === "dotsDense" ? 0.9 : 1.4) / density;
    pat.setAttribute("width", cell);
    pat.setAttribute("height", cell);
    inner = `<circle cx="${cell/2}" cy="${cell/2}" r="${cell*0.18}" fill="${color}"/>`;
  } else if (kind === "diagonal") {
    cell = 1.2 / density;
    pat.setAttribute("width", cell);
    pat.setAttribute("height", cell);
    inner = `<path d="M0,${cell} L${cell},0" stroke="${color}" stroke-width="${cell*0.12}"/>`;
  } else if (kind === "crosshatch") {
    cell = 1.2 / density;
    pat.setAttribute("width", cell);
    pat.setAttribute("height", cell);
    inner = `
      <path d="M0,${cell} L${cell},0" stroke="${color}" stroke-width="${cell*0.10}"/>
      <path d="M0,0 L${cell},${cell}" stroke="${color}" stroke-width="${cell*0.10}"/>`;
  } else if (kind === "waves") {
    cell = 3 / density;
    pat.setAttribute("width", cell);
    pat.setAttribute("height", cell * 0.6);
    const h = cell * 0.6;
    inner = `<path d="M0,${h/2} Q${cell/4},0 ${cell/2},${h/2} T${cell},${h/2}"
      stroke="${color}" stroke-width="${cell*0.06}" fill="none"/>`;
  } else if (kind === "mesh") {
    cell = 2.2 / density;
    pat.setAttribute("width", cell);
    pat.setAttribute("height", cell);
    inner = `<circle cx="${cell/2}" cy="${cell/2}" r="${cell*0.42}"
      stroke="${color}" stroke-width="${cell*0.08}" fill="none"/>`;
  } else if (kind === "weave") {
    cell = 2 / density;
    pat.setAttribute("width", cell);
    pat.setAttribute("height", cell);
    inner = `
      <path d="M0,${cell/2} Q${cell/4},0 ${cell/2},${cell/2} T${cell},${cell/2}"
        stroke="${color}" stroke-width="${cell*0.07}" fill="none"/>
      <path d="M${cell/2},0 Q${cell*0.75},${cell/4} ${cell/2},${cell/2} T${cell/2},${cell}"
        stroke="${color}" stroke-width="${cell*0.07}" fill="none"/>`;
  } else if (kind === "moire") {
    cell = 1.8 / density;
    pat.setAttribute("width", cell);
    pat.setAttribute("height", cell);
    inner = `
      <circle cx="0" cy="0" r="${cell*0.7}" stroke="${color}" stroke-width="${cell*0.05}" fill="none"/>
      <circle cx="${cell}" cy="${cell}" r="${cell*0.7}" stroke="${color}" stroke-width="${cell*0.05}" fill="none"/>`;
  }

  pat.innerHTML = inner;
  defs.appendChild(pat);

  // Background circle filled with the pattern, slightly inset to leave the outer ring visible
  const bg = document.createElementNS(SVG_NS, "circle");
  setAttrs(bg, {
    cx, cy, r: r - 0.2,
    fill: `url(#${id})`,
    stroke: "none",
    opacity: opacity.toFixed(2),
  });
  root.appendChild(bg);
}

// ============================================================
// TEXT HELPERS
// ============================================================

function drawArcText(root, cx, cy, r, text, fontSize, letterSpacing, position, starMul, fontFamily) {
  if (!text) return;
  const id = `arc-${position}-${Math.random().toString(36).slice(2, 8)}`;
  const path = document.createElementNS(SVG_NS, "path");
  // Use a FULL circle as path so long text isn't clipped at semicircle endpoints.
  // - "top": start at bottom, sweep CW (sweep=1) → 50% lands on top, glyphs read upright with tops outward
  // - "bottom": start at top, sweep CCW (sweep=0) → 50% lands on bottom, glyphs read upright with tops inward
  let d;
  if (position === "top") {
    d = `M ${cx} ${cy + r} A ${r} ${r} 0 0 1 ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`;
  } else {
    d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${r} ${r} 0 0 0 ${cx} ${cy - r}`;
  }
  path.setAttribute("d", d);
  path.setAttribute("id", id);
  // Place the helper path in <defs> so it doesn't render even if some renderer
  // ignores fill="none"+stroke="none". textPath can still reference it by id.
  const svg = root.ownerSVGElement || root.closest("svg");
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  defs.appendChild(path);

  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("font-size", fontSize);
  if (letterSpacing) t.setAttribute("letter-spacing", letterSpacing);
  if (fontFamily) t.setAttribute("font-family", fontFamily);
  t.setAttribute("fill", root.getAttribute("fill"));
  t.setAttribute("stroke", "none");

  const tp = document.createElementNS(SVG_NS, "textPath");
  tp.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${id}`);
  tp.setAttribute("href", `#${id}`);
  tp.setAttribute("startOffset", "50%");
  tp.setAttribute("text-anchor", "middle");

  // Render every "*" as a larger tspan (decorative star) — preserves alignment along the path.
  const mul = (typeof starMul === "number" && starMul > 0) ? starMul : 1;
  if (mul !== 1 && text.includes("*")) {
    const parts = text.split(/(\*)/);
    for (const part of parts) {
      if (!part) continue;
      const ts = document.createElementNS(SVG_NS, "tspan");
      if (part === "*") {
        ts.setAttribute("font-size", (fontSize * mul).toFixed(3));
        ts.setAttribute("dy", "0.05em");
      }
      ts.textContent = part;
      tp.appendChild(ts);
    }
  } else {
    tp.textContent = text;
  }
  t.appendChild(tp);
  root.appendChild(t);
}

function drawCenteredText(root, text, x, y, size, anchor = "middle", weight = null, style = null, fontFamily = null) {
  if (!text) return;
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("font-size", size);
  t.setAttribute("text-anchor", anchor);
  t.setAttribute("fill", root.getAttribute("fill"));
  t.setAttribute("stroke", "none");
  if (weight) t.setAttribute("font-weight", weight);
  if (style && style !== "normal") t.setAttribute("font-style", style);
  if (fontFamily) t.setAttribute("font-family", fontFamily);
  t.textContent = text;
  root.appendChild(t);
}

function drawSeparator(root, x, y, size) {
  const sep = els.separator.value;
  if (sep === "*") return drawStar(root, x, y, size);
  // Render as a text glyph for non-star separators
  const t = document.createElementNS(SVG_NS, "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y + size * 0.5);
  t.setAttribute("font-size", size * 2.4);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("fill", root.getAttribute("fill"));
  t.setAttribute("stroke", "none");
  t.textContent = sep;
  root.appendChild(t);
}

function drawStar(root, x, y, size) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? size : size * 0.45;
    pts.push(`${x + Math.cos(ang) * rr},${y + Math.sin(ang) * rr}`);
  }
  const star = document.createElementNS(SVG_NS, "polygon");
  star.setAttribute("points", pts.join(" "));
  star.setAttribute("fill", root.getAttribute("fill"));
  star.setAttribute("stroke", "none");
  root.appendChild(star);
}

function drawTrident(root, cx, cy, size) {
  const s = size;
  const path = document.createElementNS(SVG_NS, "path");
  const d = `
    M ${cx - 0.04*s} ${cy - 0.5*s}
    L ${cx + 0.04*s} ${cy - 0.5*s}
    L ${cx + 0.04*s} ${cy + 0.5*s}
    L ${cx - 0.04*s} ${cy + 0.5*s} Z
    M ${cx - 0.42*s} ${cy - 0.5*s}
    L ${cx - 0.32*s} ${cy - 0.5*s}
    L ${cx - 0.32*s} ${cy + 0.15*s}
    L ${cx - 0.18*s} ${cy + 0.15*s}
    L ${cx - 0.18*s} ${cy - 0.25*s}
    L ${cx - 0.10*s} ${cy - 0.25*s}
    L ${cx - 0.10*s} ${cy + 0.5*s}
    L ${cx - 0.18*s} ${cy + 0.5*s}
    L ${cx - 0.18*s} ${cy + 0.25*s}
    L ${cx - 0.42*s} ${cy + 0.25*s} Z
    M ${cx + 0.42*s} ${cy - 0.5*s}
    L ${cx + 0.32*s} ${cy - 0.5*s}
    L ${cx + 0.32*s} ${cy + 0.15*s}
    L ${cx + 0.18*s} ${cy + 0.15*s}
    L ${cx + 0.18*s} ${cy - 0.25*s}
    L ${cx + 0.10*s} ${cy - 0.25*s}
    L ${cx + 0.10*s} ${cy + 0.5*s}
    L ${cx + 0.18*s} ${cy + 0.5*s}
    L ${cx + 0.18*s} ${cy + 0.25*s}
    L ${cx + 0.42*s} ${cy + 0.25*s} Z
  `;
  path.setAttribute("d", d);
  path.setAttribute("fill", root.getAttribute("fill"));
  path.setAttribute("stroke", "none");
  root.appendChild(path);
}

function drawCenterContent(root, cx, cy, maxR) {
  if (els.showTrident.checked) {
    drawTrident(root, cx, cy, maxR * 1.1);
    return;
  }
  drawStackedLines(root, cx, cy);
}

function drawStackedLines(root, cx, cy) {
  const lines = getLines();
  if (!lines.length) return;
  // Compute total height with line gaps proportional to size
  const gap = 0.18;
  let totalH = 0;
  for (const l of lines) totalH += l.size * (1 + gap);
  totalH -= lines[0].size * gap; // no trailing gap on last

  let y = cy - totalH / 2 + lines[0].size * 0.85;
  for (const l of lines) {
    drawCenteredText(root, applyCase(l.text), cx, y, l.size, "middle",
      l.weight || null, l.style, l.font || null);
    y += l.size * (1 + gap);
  }
}

// ============================================================
// PRESETS
// ============================================================
// Baseline applied before each preset so that fields the user previously customised
// don't bleed into the new preset. Every key here corresponds to a form input id.
const PRESET_DEFAULTS = {
  shape: "circle", size: "38", color: "#1a4fa3",
  font: "Arial, sans-serif", weight: "bold", case: "normal",
  topText: "", topSize: 2.6, topSpacing: 0.3, topOffset: 0, topStarMul: 1.6, topFont: "",
  bottomText: "", bottomSize: 1.8, bottomSpacing: 0.15, bottomOffset: 0, bottomStarMul: 1.6, bottomFont: "",
  midText: "", midSize: 1.7, midRadius: 24, midPos: "bottom", midFont: "",
  outerWidth: 1.0, outerStyle: "solid", outerPatternText: "* ЗРАЗОК * ПЕЧАТКА *",
  ring2Enabled: true, ring2Diameter: 36, ring2Width: 0.5, ring2Style: "solid",
  innerRingStyle: "simple", innerDiameter: 28, innerWidth: 0.5, innerPatternHeight: 1.2,
  guillochePattern: "none", guillocheOpacity: 20, guillocheDensity: 100,
  showTrident: false,
  distress: false, distressLevel: 40,
};

function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  const merged = { ...PRESET_DEFAULTS, ...p };

  // Shape first so size <option>s sync before size is applied.
  if (merged.shape) {
    els.shape.value = merged.shape;
    syncSizeOptions();
  }

  for (const [k, v] of Object.entries(merged)) {
    if (k === "lines" || k === "shape") continue;
    const el = document.getElementById(k);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = v;
  }

  if (Array.isArray(merged.lines)) setLines(merged.lines);
  else setLines([]);

  render();
}

// ============================================================
// JSON EXPORT / IMPORT
// ============================================================
function getStampJson() {
  // Collect every form value plus center lines
  const data = {
    version: 1,
    savedAt: new Date().toISOString(),
    fields: {},
    lines: getLines(),
  };
  document.querySelectorAll("aside.controls input, aside.controls select").forEach(el => {
    if (!el.id) return;
    if (el.type === "file") return;
    if (el.id.startsWith("bg")) return; // skip background image fields — image data not portable
    if (el.type === "checkbox") data.fields[el.id] = el.checked;
    else data.fields[el.id] = el.value;
  });
  return data;
}

function loadStampJson(data) {
  if (!data || !data.fields) throw new Error("Невалідний JSON печатки");
  for (const [id, val] of Object.entries(data.fields)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el === els.shape) {
      el.value = val;
      syncSizeOptions();
    } else if (el.type === "checkbox") {
      el.checked = !!val;
    } else {
      el.value = val;
    }
  }
  if (Array.isArray(data.lines)) setLines(data.lines);
  render();
}

function exportJson() {
  const json = JSON.stringify(getStampJson(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  download(blob, `stamp-${Date.now()}.json`);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      loadStampJson(data);
    } catch (e) {
      alert("Не вдалося прочитати JSON: " + e.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================
// BACKGROUND IMAGE OVERLAY
// ============================================================
const bgState = { url: null, dragging: false, dragStartX: 0, dragStartY: 0, baseX: 0, baseY: 0 };

function updateBgImage() {
  const img = els.bgImage;
  if (!bgState.url) {
    img.classList.remove("visible");
    img.removeAttribute("src");
    return;
  }
  if (img.getAttribute("src") !== bgState.url) img.setAttribute("src", bgState.url);
  img.classList.add("visible");
  img.classList.toggle("on-top", els.bgOnTop.checked);

  const opacity = parseInt(els.bgOpacity.value, 10) / 100;
  const scale = parseInt(els.bgScale.value, 10) / 100;
  const rot = parseFloat(els.bgRotate.value);
  const tx = parseFloat(els.bgX.value);
  const ty = parseFloat(els.bgY.value);
  const px = 3.7795275591 * (currentZoom / 100); // 1 mm at current preview zoom

  img.style.opacity = opacity;
  // Translate centers the image, then offset by tx/ty mm (converted to px), then scale, then rotate.
  img.style.transform =
    `translate(-50%, -50%) translate(${tx * px}px, ${ty * px}px) scale(${scale}) rotate(${rot}deg)`;
}

function onBgFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (bgState.url) URL.revokeObjectURL(bgState.url);
  bgState.url = URL.createObjectURL(file);
  updateBgImage();
}

function clearBg() {
  if (bgState.url) URL.revokeObjectURL(bgState.url);
  bgState.url = null;
  els.bgFile.value = "";
  updateBgImage();
}

function bindBgDrag() {
  // Hold Shift + drag to move the photo around the canvas (translates X/Y).
  els.bgImage.addEventListener("mousedown", (e) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    bgState.dragging = true;
    bgState.dragStartX = e.clientX;
    bgState.dragStartY = e.clientY;
    bgState.baseX = parseFloat(els.bgX.value);
    bgState.baseY = parseFloat(els.bgY.value);
    els.bgImage.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!bgState.dragging) return;
    const px = 3.7795275591 * (currentZoom / 100);
    const dx = (e.clientX - bgState.dragStartX) / px;
    const dy = (e.clientY - bgState.dragStartY) / px;
    els.bgX.value = (bgState.baseX + dx).toFixed(1);
    els.bgY.value = (bgState.baseY + dy).toFixed(1);
    updateBgImage();
  });
  window.addEventListener("mouseup", () => {
    if (bgState.dragging) {
      bgState.dragging = false;
      els.bgImage.classList.remove("dragging");
    }
  });
}

// ============================================================
// ZOOM
// ============================================================
let currentZoom = 200;

function applyZoom() {
  const svg = els.stage.querySelector("svg");
  if (!svg) return;
  const vb = svg.getAttribute("viewBox").split(" ");
  const mmW = parseFloat(vb[2]);
  const mmH = parseFloat(vb[3]);
  const px = 3.7795275591; // 1 mm at 96 dpi
  const k = currentZoom / 100;
  svg.setAttribute("width", mmW * px * k);
  svg.setAttribute("height", mmH * px * k);
  els.zoomLabel.textContent = `${currentZoom}%`;
  els.zoomSlider.value = currentZoom;
  els.dimsLabel.textContent =
    `${(mmW - 4).toFixed(1)} × ${(mmH - 4).toFixed(1)} мм · зум ${currentZoom}%`;
  if (typeof updateBgImage === "function") updateBgImage();
}

function zoomFit() {
  const svg = els.stage.querySelector("svg");
  if (!svg) return;
  const vb = svg.getAttribute("viewBox").split(" ");
  const mmW = parseFloat(vb[2]);
  const mmH = parseFloat(vb[3]);
  const px = 3.7795275591;
  const pad = 80;
  const aw = els.previewArea.clientWidth - pad;
  const ah = els.previewArea.clientHeight - pad;
  const kw = aw / (mmW * px);
  const kh = ah / (mmH * px);
  const k = Math.min(kw, kh, 6);
  currentZoom = Math.max(50, Math.round(k * 100));
  applyZoom();
}

// ============================================================
// RENDER
// ============================================================
function render() {
  els.stage.innerHTML = "";
  const svg = buildSvg();
  els.stage.appendChild(svg);
  applyZoom();

  // Paper / ruler toggles
  els.previewCanvas.classList.toggle("no-paper", !els.showPaper.checked);
  els.previewCanvas.classList.toggle("with-ruler", els.showRuler.checked);

  // Outer pattern text field is only relevant for the "text" outer style
  els.outerPatternTextLabel.style.display =
    els.outerStyle.value === "text" ? "" : "none";

  // Background photo follows zoom changes too
  updateBgImage();

  // Auto-save current state to localStorage (debounced)
  lsScheduleAutosave();
}

// ============================================================
// EXPORT
// ============================================================
// ============================================================
// TEXT → CURVES (opentype.js)
// ============================================================
// Lazily loads opentype.js + open-source TTFs from a CDN, then converts every
// <text> in the SVG (including textPath arc text and <tspan>s) into <path>.
// Fonts shipped from system don't always carry over to other apps (Inkscape
// won't synthesize bold/italic), so this guarantees identical look anywhere.

// opentype.js stays on CDN (small, stable, immutable URL with CORS).
const OPENTYPE_URL = "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js";

// Fonts are served locally from ./fonts/. Run setup-fonts.sh once to populate.
const FONT_BASE = "fonts";
const FONT_URLS = {
  sans: {
    "0,0": `${FONT_BASE}/Roboto-Regular.ttf`,
    "1,0": `${FONT_BASE}/Roboto-Bold.ttf`,
    "0,1": `${FONT_BASE}/Roboto-Italic.ttf`,
    "1,1": `${FONT_BASE}/Roboto-BoldItalic.ttf`,
  },
  serif: {
    "0,0": `${FONT_BASE}/RobotoSlab-Regular.ttf`,
    "1,0": `${FONT_BASE}/RobotoSlab-Bold.ttf`,
    "0,1": `${FONT_BASE}/RobotoSlab-Regular.ttf`,
    "1,1": `${FONT_BASE}/RobotoSlab-Bold.ttf`,
  },
  mono: {
    "0,0": `${FONT_BASE}/RobotoMono-Regular.ttf`,
    "1,0": `${FONT_BASE}/RobotoMono-Bold.ttf`,
    "0,1": `${FONT_BASE}/RobotoMono-Italic.ttf`,
    "1,1": `${FONT_BASE}/RobotoMono-BoldItalic.ttf`,
  },
  display: {
    "0,0": `${FONT_BASE}/Anton-Regular.ttf`,
    "1,0": `${FONT_BASE}/Anton-Regular.ttf`,
    "0,1": `${FONT_BASE}/Anton-Regular.ttf`,
    "1,1": `${FONT_BASE}/Anton-Regular.ttf`,
  },
  black: {
    "0,0": `${FONT_BASE}/Roboto-Black.ttf`,
    "1,0": `${FONT_BASE}/Roboto-Black.ttf`,
    "0,1": `${FONT_BASE}/Roboto-BlackItalic.ttf`,
    "1,1": `${FONT_BASE}/Roboto-BlackItalic.ttf`,
  },
  condensed: {
    "0,0": `${FONT_BASE}/RobotoCondensed-Regular.ttf`,
    "1,0": `${FONT_BASE}/RobotoCondensed-Bold.ttf`,
    "0,1": `${FONT_BASE}/RobotoCondensed-Italic.ttf`,
    "1,1": `${FONT_BASE}/RobotoCondensed-BoldItalic.ttf`,
  },
  // Antonio has Regular + Bold static files. Italic is synthesised via skewX
  // because no Italic file exists.
  antonio: {
    "0,0": `${FONT_BASE}/Antonio-Regular.ttf`,
    "1,0": `${FONT_BASE}/Antonio-Bold.ttf`,
    "0,1": `${FONT_BASE}/Antonio-Regular.ttf`,
    "1,1": `${FONT_BASE}/Antonio-Bold.ttf`,
  },
  // Microsoft Core Fonts — copied from /usr/share/fonts/TTF by setup-fonts.sh.
  // If files are missing the converter falls back to Roboto-equivalents.
  arial: {
    "0,0": `${FONT_BASE}/Arial-Regular.ttf`,
    "1,0": `${FONT_BASE}/Arial-Bold.ttf`,
    "0,1": `${FONT_BASE}/Arial-Italic.ttf`,
    "1,1": `${FONT_BASE}/Arial-BoldItalic.ttf`,
  },
  times: {
    "0,0": `${FONT_BASE}/Times-Regular.ttf`,
    "1,0": `${FONT_BASE}/Times-Bold.ttf`,
    "0,1": `${FONT_BASE}/Times-Italic.ttf`,
    "1,1": `${FONT_BASE}/Times-BoldItalic.ttf`,
  },
  verdana: {
    "0,0": `${FONT_BASE}/Verdana-Regular.ttf`,
    "1,0": `${FONT_BASE}/Verdana-Bold.ttf`,
    "0,1": `${FONT_BASE}/Verdana-Italic.ttf`,
    "1,1": `${FONT_BASE}/Verdana-BoldItalic.ttf`,
  },
  georgia: {
    "0,0": `${FONT_BASE}/Georgia-Regular.ttf`,
    "1,0": `${FONT_BASE}/Georgia-Bold.ttf`,
    "0,1": `${FONT_BASE}/Georgia-Italic.ttf`,
    "1,1": `${FONT_BASE}/Georgia-BoldItalic.ttf`,
  },
  tahoma: {
    "0,0": `${FONT_BASE}/Tahoma-Regular.ttf`,
    "1,0": `${FONT_BASE}/Tahoma-Bold.ttf`,
    "0,1": `${FONT_BASE}/Tahoma-Regular.ttf`,
    "1,1": `${FONT_BASE}/Tahoma-Bold.ttf`,
  },
  trebuchet: {
    "0,0": `${FONT_BASE}/Trebuchet-Regular.ttf`,
    "1,0": `${FONT_BASE}/Trebuchet-Bold.ttf`,
    "0,1": `${FONT_BASE}/Trebuchet-Italic.ttf`,
    "1,1": `${FONT_BASE}/Trebuchet-BoldItalic.ttf`,
  },
  courier: {
    "0,0": `${FONT_BASE}/Courier-Regular.ttf`,
    "1,0": `${FONT_BASE}/Courier-Bold.ttf`,
    "0,1": `${FONT_BASE}/Courier-Italic.ttf`,
    "1,1": `${FONT_BASE}/Courier-BoldItalic.ttf`,
  },
  impact: {
    "0,0": `${FONT_BASE}/Impact-Regular.ttf`,
    "1,0": `${FONT_BASE}/Impact-Regular.ttf`,
    "0,1": `${FONT_BASE}/Impact-Regular.ttf`,
    "1,1": `${FONT_BASE}/Impact-Regular.ttf`,
  },
};

// If a "real" font group's file 404s (user didn't run setup-fonts.sh or has no
// system MS fonts), fall back to the closest open-source Roboto variant.
const FALLBACK_GROUP = {
  arial: "sans",
  times: "serif",
  verdana: "sans",
  georgia: "serif",
  tahoma: "sans",
  trebuchet: "sans",
  courier: "mono",
  impact: "black",
};

// Set of group keys whose italic variant is faked with skewX(-12°).
const SYNTH_ITALIC_GROUPS = new Set(["antonio"]);

function pickFontGroup(family) {
  if (!family) return "sans";
  const f = family.toLowerCase();
  // Specific Microsoft Core Fonts route to their own groups (real Arial/Times/etc.
  // copied by setup-fonts.sh from /usr/share/fonts). Fallback handled in loader.
  if (f.includes("antonio")) return "antonio";
  if (f.includes("arial narrow") || f.includes("narrow") || f.includes("condensed")) return "condensed";
  if (f.includes("arial black")) return "black";
  if (f.includes("arial")) return "arial";
  if (f.includes("times new roman") || f.includes("times")) return "times";
  if (f.includes("verdana")) return "verdana";
  if (f.includes("georgia")) return "georgia";
  if (f.includes("tahoma")) return "tahoma";
  if (f.includes("trebuchet")) return "trebuchet";
  if (f.includes("courier")) return "courier";
  if (f.includes("impact")) return "impact";
  if (f.includes("mono")) return "mono";
  // BUG FIX: "Arial, sans-serif" used to match `serif` because the literal
  // substring "serif" appears inside "sans-serif". Strip "sans-serif" first.
  const noSans = f.replace(/sans[-\s]?serif/g, "");
  const isSerifFamily =
    noSans.includes("garamond") ||
    noSans.includes("pt serif") ||
    noSans.includes("roboto slab") ||
    /\bserif\b/.test(noSans);
  if (isSerifFamily) return "serif";
  if (f.includes("black")) return "black";
  return "sans";
}

// Build the SVG transform string for an italic-synthesised glyph at (cx, cy)
// rotated by `angle` rad, baseline-centered for advance `adv`. When the chosen
// font group has no real italic, we add a skewX(-12°) so glyphs visually slant.
function glyphTransform(point, angle, advance, italic, group) {
  const synth = italic && SYNTH_ITALIC_GROUPS.has(group);
  const skew = synth ? " skewX(-12)" : "";
  return `translate(${point.x.toFixed(4)} ${point.y.toFixed(4)}) ` +
         `rotate(${(angle * 180 / Math.PI).toFixed(4)})` +
         ` translate(${(-advance / 2).toFixed(4)} 0)${skew}`;
}

let _opentypeLoaded = null;
function loadOpentype() {
  if (_opentypeLoaded) return _opentypeLoaded;
  _opentypeLoaded = new Promise((resolve, reject) => {
    if (window.opentype) return resolve();
    const s = document.createElement("script");
    s.src = OPENTYPE_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Не вдалося завантажити opentype.js з CDN"));
    document.head.appendChild(s);
  });
  return _opentypeLoaded;
}

const _fontCache = new Map();
async function loadConvertFont(family, weight, style) {
  const isBold = (weight === "bold" || parseInt(weight, 10) >= 600) ? 1 : 0;
  const isItalic = style === "italic" ? 1 : 0;
  const initialGroup = pickFontGroup(family);
  const variant = `${isBold},${isItalic}`;

  // Try the requested group first, then walk the fallback chain (e.g. arial → sans).
  const tried = new Set();
  let group = initialGroup;
  while (group && !tried.has(group)) {
    tried.add(group);
    const cacheKey = `${group}|${variant}`;
    if (_fontCache.has(cacheKey)) {
      return { font: _fontCache.get(cacheKey), group, italic: isItalic === 1 };
    }
    const url = (FONT_URLS[group] || {})[variant];
    if (url) {
      try {
        const r = await fetch(url);
        if (r.ok) {
          const buf = await r.arrayBuffer();
          const font = window.opentype.parse(buf);
          _fontCache.set(cacheKey, font);
          return { font, group, italic: isItalic === 1 };
        }
      } catch { /* network or parse error — try fallback */ }
    }
    group = FALLBACK_GROUP[group] || (group === "sans" ? null : "sans");
  }
  throw new Error(
    `Не вдалося завантажити жоден шрифт. Запусти ./setup-fonts.sh у директорії проєкту.`
  );
}

function getInheritedAttr(el, name) {
  while (el && el.getAttribute) {
    const v = el.getAttribute(name);
    if (v) return v;
    el = el.parentNode;
  }
  return null;
}

async function convertSvgTextToCurves(svg) {
  await loadOpentype();
  // Place SVG in DOM temporarily so getPointAtLength / getTotalLength work
  const holder = document.createElement("div");
  holder.style.cssText = "position:absolute;left:-9999px;top:0;opacity:0;pointer-events:none;";
  holder.appendChild(svg);
  document.body.appendChild(holder);
  try {
    const texts = Array.from(svg.querySelectorAll("text"));
    for (const t of texts) await convertOneText(t, svg);
    // CAD apps (Fusion 360, AutoCAD) ignore stroke-width — convert all strokes
    // to filled regions so they keep their visual thickness.
    convertStrokesToFills(svg);
  } finally {
    holder.removeChild(svg);
    document.body.removeChild(holder);
  }
}

// Replace every stroked element with an equivalent filled outline so that
// CAD/CNC importers that drop stroke-width still see the line as a region.
// Currently handles: <circle>, <ellipse>, <rect>. Polyline/polygon strokes
// (decorative inner rings) are left as-is — most stamp work uses simple rings.
function convertStrokesToFills(svg) {
  const stroked = Array.from(svg.querySelectorAll("circle, ellipse, rect"));
  for (const el of stroked) {
    const sw = parseFloat(el.getAttribute("stroke-width") || "0");
    if (sw <= 0) continue;
    const stroke = el.getAttribute("stroke")
      || getInheritedAttr(el.parentNode, "stroke")
      || "#000";
    if (stroke === "none") continue;
    const dashed = el.getAttribute("stroke-dasharray");
    const replacement = strokeToFill(el, sw, stroke, dashed);
    if (replacement) el.parentNode.replaceChild(replacement, el);
  }
}

function strokeToFill(el, sw, color, dashed) {
  const tag = el.tagName.toLowerCase();
  if (tag === "circle") {
    const cx = parseFloat(el.getAttribute("cx"));
    const cy = parseFloat(el.getAttribute("cy"));
    const r = parseFloat(el.getAttribute("r"));
    if (dashed) return dashedRingPath(cx, cy, r, sw, dashed, color);
    return annulusPath(cx, cy, r + sw / 2, r - sw / 2, color);
  }
  if (tag === "ellipse") {
    const cx = parseFloat(el.getAttribute("cx"));
    const cy = parseFloat(el.getAttribute("cy"));
    const rx = parseFloat(el.getAttribute("rx"));
    const ry = parseFloat(el.getAttribute("ry"));
    return ellipseAnnulusPath(cx, cy, rx + sw / 2, ry + sw / 2, rx - sw / 2, ry - sw / 2, color);
  }
  if (tag === "rect") {
    const x = parseFloat(el.getAttribute("x"));
    const y = parseFloat(el.getAttribute("y"));
    const w = parseFloat(el.getAttribute("width"));
    const h = parseFloat(el.getAttribute("height"));
    return rectFramePath(x, y, w, h, sw, color);
  }
  return null;
}

function annulusPath(cx, cy, ro, ri, color) {
  const path = document.createElementNS(SVG_NS, "path");
  // Two circles, even-odd fill = ring
  const d =
    `M ${cx - ro} ${cy} A ${ro} ${ro} 0 1 0 ${cx + ro} ${cy} A ${ro} ${ro} 0 1 0 ${cx - ro} ${cy} Z` +
    (ri > 0
      ? ` M ${cx - ri} ${cy} A ${ri} ${ri} 0 1 1 ${cx + ri} ${cy} A ${ri} ${ri} 0 1 1 ${cx - ri} ${cy} Z`
      : "");
  path.setAttribute("d", d);
  path.setAttribute("fill", color);
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("stroke", "none");
  return path;
}

function ellipseAnnulusPath(cx, cy, rxo, ryo, rxi, ryi, color) {
  const path = document.createElementNS(SVG_NS, "path");
  const d =
    `M ${cx - rxo} ${cy} A ${rxo} ${ryo} 0 1 0 ${cx + rxo} ${cy} A ${rxo} ${ryo} 0 1 0 ${cx - rxo} ${cy} Z` +
    (rxi > 0 && ryi > 0
      ? ` M ${cx - rxi} ${cy} A ${rxi} ${ryi} 0 1 1 ${cx + rxi} ${cy} A ${rxi} ${ryi} 0 1 1 ${cx - rxi} ${cy} Z`
      : "");
  path.setAttribute("d", d);
  path.setAttribute("fill", color);
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("stroke", "none");
  return path;
}

function rectFramePath(x, y, w, h, sw, color) {
  const path = document.createElementNS(SVG_NS, "path");
  const ho = sw / 2;
  // outer rect (CW) + inner rect (CCW) → frame
  const d =
    `M ${x - ho} ${y - ho} H ${x + w + ho} V ${y + h + ho} H ${x - ho} Z ` +
    `M ${x + ho} ${y + ho} V ${y + h - ho} H ${x + w - ho} V ${y + ho} Z`;
  path.setAttribute("d", d);
  path.setAttribute("fill", color);
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("stroke", "none");
  return path;
}

function dashedRingPath(cx, cy, r, sw, dashArray, color) {
  // Approximate dashed circle as filled segments.
  const dashes = dashArray.split(/[,\s]+/).map(parseFloat).filter(n => n > 0);
  if (!dashes.length) return annulusPath(cx, cy, r + sw / 2, r - sw / 2, color);
  const dashLen = dashes[0];
  const gapLen = dashes[1] || dashes[0];
  const period = dashLen + gapLen;
  const circ = 2 * Math.PI * r;
  const count = Math.max(2, Math.round(circ / period));
  const dashAngle = (dashLen / period) * (2 * Math.PI / count);
  const segGap = (2 * Math.PI / count);

  let d = "";
  const ro = r + sw / 2, ri = r - sw / 2;
  for (let i = 0; i < count; i++) {
    const a0 = i * segGap;
    const a1 = a0 + dashAngle;
    const xo0 = cx + ro * Math.cos(a0), yo0 = cy + ro * Math.sin(a0);
    const xo1 = cx + ro * Math.cos(a1), yo1 = cy + ro * Math.sin(a1);
    const xi0 = cx + ri * Math.cos(a0), yi0 = cy + ri * Math.sin(a0);
    const xi1 = cx + ri * Math.cos(a1), yi1 = cy + ri * Math.sin(a1);
    d += `M ${xo0} ${yo0} A ${ro} ${ro} 0 0 1 ${xo1} ${yo1} ` +
         `L ${xi1} ${yi1} A ${ri} ${ri} 0 0 0 ${xi0} ${yi0} Z `;
  }
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", color);
  path.setAttribute("stroke", "none");
  return path;
}

async function convertOneText(textEl, svg) {
  const family = textEl.getAttribute("font-family") || getInheritedAttr(textEl.parentNode, "font-family") || "sans-serif";
  const weight = textEl.getAttribute("font-weight") || getInheritedAttr(textEl.parentNode, "font-weight") || "normal";
  const style = textEl.getAttribute("font-style") || "normal";
  const fill = textEl.getAttribute("fill") || getInheritedAttr(textEl.parentNode, "fill") || "black";
  const baseSize = parseFloat(textEl.getAttribute("font-size") || "16");
  const tp = textEl.querySelector("textPath");

  if (tp) {
    await convertCurvedText(textEl, tp, baseSize, family, weight, style, fill, svg);
  } else {
    await convertStraightText(textEl, baseSize, family, weight, style, fill);
  }
}

async function convertStraightText(textEl, fontSize, family, weight, style, fill) {
  const { font, group, italic } = await loadConvertFont(family, weight, style);
  const x = parseFloat(textEl.getAttribute("x") || "0");
  const y = parseFloat(textEl.getAttribute("y") || "0");
  const anchor = textEl.getAttribute("text-anchor") || "start";
  const text = textEl.textContent;
  const adv = font.getAdvanceWidth(text, fontSize);
  let dx = 0;
  if (anchor === "middle") dx = -adv / 2;
  else if (anchor === "end") dx = -adv;
  const path = font.getPath(text, x + dx, y, fontSize);
  const pathEl = document.createElementNS(SVG_NS, "path");
  pathEl.setAttribute("d", path.toPathData(3));
  pathEl.setAttribute("fill", fill);
  if (italic && SYNTH_ITALIC_GROUPS.has(group)) {
    // Synthesise italic for fonts without an Italic file: skewX around the text origin.
    pathEl.setAttribute("transform", `translate(${x} ${y}) skewX(-12) translate(${-x} ${-y})`);
  }
  textEl.parentNode.replaceChild(pathEl, textEl);
}

async function convertCurvedText(textEl, tpEl, baseSize, family, weight, style, fill, svg) {
  // Walk children: plain text nodes and <tspan>s (which may have own font-size for "*" stars)
  const items = []; // { char, size }
  for (const node of Array.from(tpEl.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const ch of node.textContent) items.push({ char: ch, size: baseSize });
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === "tspan") {
      const tsSize = parseFloat(node.getAttribute("font-size") || baseSize);
      for (const ch of node.textContent) items.push({ char: ch, size: tsSize });
    }
  }
  if (!items.length) {
    textEl.parentNode.removeChild(textEl);
    return;
  }

  const href = tpEl.getAttribute("href") || tpEl.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
  const arcPath = svg.querySelector(href);
  if (!arcPath) return;
  const totalLength = arcPath.getTotalLength();

  const offsetAttr = String(tpEl.getAttribute("startOffset") || "0");
  const startBase = offsetAttr.includes("%")
    ? totalLength * (parseFloat(offsetAttr) / 100)
    : parseFloat(offsetAttr);

  const anchor = tpEl.getAttribute("text-anchor") || "start";
  const { font, group: fontGroup, italic } = await loadConvertFont(family, weight, style);

  let totalAdv = 0;
  for (const it of items) totalAdv += font.getAdvanceWidth(it.char, it.size);

  let dist = startBase;
  if (anchor === "middle") dist -= totalAdv / 2;
  else if (anchor === "end") dist -= totalAdv;

  const groupEl = document.createElementNS(SVG_NS, "g");
  if (fill) groupEl.setAttribute("fill", fill);

  for (const it of items) {
    const adv = font.getAdvanceWidth(it.char, it.size);
    const midDist = dist + adv / 2;
    const wrapped = ((midDist % totalLength) + totalLength) % totalLength;
    const point = arcPath.getPointAtLength(wrapped);
    const eps = Math.min(0.3, totalLength / 2000);
    const next = arcPath.getPointAtLength((wrapped + eps) % totalLength);
    const angle = Math.atan2(next.y - point.y, next.x - point.x);
    // Use font.getPath() — it correctly applies font.unitsPerEm. glyph.getPath()
    // without passing the font defaults unitsPerEm to 1000 and outputs glyphs
    // ~2× their intended size for fonts with unitsPerEm = 2048 (Roboto, etc.).
    const glyphPath = font.getPath(it.char, 0, 0, it.size);
    const pathEl = document.createElementNS(SVG_NS, "path");
    pathEl.setAttribute("d", glyphPath.toPathData(3));
    pathEl.setAttribute("transform",
      glyphTransform(point, angle, adv, italic, fontGroup));
    groupEl.appendChild(pathEl);
    dist += adv;
  }

  textEl.parentNode.replaceChild(groupEl, textEl);
}

function setCurvesBusy(busy) {
  document.querySelector(".menubar")?.classList.toggle("busy", busy);
}

async function maybeConvertCurves(svg) {
  if (!els.exportAsCurves?.checked) return svg;
  setCurvesBusy(true);
  try {
    await convertSvgTextToCurves(svg);
  } catch (e) {
    alert("Не вдалося конвертувати у криві: " + e.message);
  } finally {
    setCurvesBusy(false);
  }
  return svg;
}

// Fusion 360 imports SVG by reading viewBox numbers as 96-DPI pixels and
// converting via 96 px = 25.4 mm. Our viewBox is in mm, so a 42mm stamp ends
// up as 11 mm in Fusion (factor 25.4/96). Pre-scale the viewBox by 96/25.4
// and wrap content in `transform="scale(3.78)"`, keeping width/height="42mm".
// Result: Inkscape/browsers still see 42mm physical, Fusion now also sees 42mm.
function scaleSvgForCadCompat(svg) {
  const SCALE = 96 / 25.4; // 3.77952755...
  const vbAttr = svg.getAttribute("viewBox");
  if (!vbAttr) return svg;
  const [vx, vy, vw, vh] = vbAttr.split(/\s+/).map(parseFloat);
  svg.setAttribute("viewBox",
    `${(vx * SCALE).toFixed(4)} ${(vy * SCALE).toFixed(4)} ` +
    `${(vw * SCALE).toFixed(4)} ${(vh * SCALE).toFixed(4)}`);

  const wrap = document.createElementNS(SVG_NS, "g");
  wrap.setAttribute("transform", `scale(${SCALE.toFixed(8)})`);
  // Keep <defs> at the SVG root; everything else goes inside the scaled group.
  const kids = Array.from(svg.childNodes);
  for (const k of kids) {
    if (k.nodeType === 1 && k.tagName && k.tagName.toLowerCase() === "defs") continue;
    wrap.appendChild(k);
  }
  svg.appendChild(wrap);
  return svg;
}

// ============================================================
// EXPORT
// ============================================================
async function exportSvg() {
  const svg = scaleSvgForCadCompat(await maybeConvertCurves(buildSvg()));
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: "image/svg+xml" });
  download(blob, `stamp-${Date.now()}.svg`);
}

async function copySvg() {
  const svg = scaleSvgForCadCompat(await maybeConvertCurves(buildSvg()));
  const xml = new XMLSerializer().serializeToString(svg);
  try {
    await navigator.clipboard.writeText(xml);
    flashButton($("copySvg"), "✓ Скопійовано");
  } catch {
    alert("Не вдалося скопіювати — браузер заблокував доступ до буфера.");
  }
}

// ============================================================
// DXF EXPORT (AutoCAD R14 ASCII)
// ============================================================
// Converts every visible SVG primitive to a DXF entity. Text is forced through
// the curves converter first (CAD ignores <text>). Y axis is flipped because
// SVG uses y-down while DXF uses y-up.

async function exportDxf() {
  // Force curves on for DXF — DXF cannot embed glyph rendering
  const prevCurves = els.exportAsCurves?.checked;
  if (els.exportAsCurves) els.exportAsCurves.checked = true;
  setCurvesBusy(true);
  let svg;
  try {
    svg = buildSvg();
    await convertSvgTextToCurves(svg);
  } catch (e) {
    setCurvesBusy(false);
    if (els.exportAsCurves) els.exportAsCurves.checked = prevCurves;
    alert("Не вдалося підготувати DXF: " + e.message);
    return;
  }
  setCurvesBusy(false);
  if (els.exportAsCurves) els.exportAsCurves.checked = prevCurves;

  // SVG must be in DOM for getCTM()
  const holder = document.createElement("div");
  holder.style.cssText = "position:absolute;left:-9999px;top:0;opacity:0;pointer-events:none;";
  holder.appendChild(svg);
  document.body.appendChild(holder);

  let dxf;
  try {
    const entities = collectDxfEntities(svg);
    dxf = makeDxf(entities);
  } finally {
    document.body.removeChild(holder);
  }

  const blob = new Blob([dxf], { type: "image/vnd.dxf" });
  download(blob, `stamp-${Date.now()}.dxf`);
}

function collectDxfEntities(svg) {
  const out = [];
  const all = svg.querySelectorAll("circle, ellipse, polyline, polygon, rect, path, line");
  for (const el of all) {
    if (el.closest("defs")) continue;
    const ctm = el.getCTM();
    const tag = el.tagName.toLowerCase();
    const xy = (x, y) => {
      const tx = (ctm ? ctm.a * x + ctm.c * y + ctm.e : x);
      const ty = (ctm ? ctm.b * x + ctm.d * y + ctm.f : y);
      return [tx, -ty]; // flip Y for DXF
    };

    if (tag === "circle") {
      const cx = +el.getAttribute("cx") || 0;
      const cy = +el.getAttribute("cy") || 0;
      const r = +el.getAttribute("r") || 0;
      const [tcx, tcy] = xy(cx, cy);
      out.push({ type: "CIRCLE", cx: tcx, cy: tcy, r });
    } else if (tag === "ellipse") {
      const cx = +el.getAttribute("cx") || 0;
      const cy = +el.getAttribute("cy") || 0;
      const rx = +el.getAttribute("rx") || 0;
      const ry = +el.getAttribute("ry") || 0;
      const pts = [];
      const N = 96;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push(xy(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
      }
      out.push({ type: "POLYLINE", points: pts, closed: true });
    } else if (tag === "rect") {
      const x = +el.getAttribute("x") || 0;
      const y = +el.getAttribute("y") || 0;
      const w = +el.getAttribute("width") || 0;
      const h = +el.getAttribute("height") || 0;
      const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      out.push({ type: "POLYLINE", points: corners.map(([px, py]) => xy(px, py)), closed: true });
    } else if (tag === "polyline" || tag === "polygon") {
      const pts = parsePoints(el.getAttribute("points") || "");
      if (pts.length < 2) continue;
      out.push({
        type: "POLYLINE",
        points: pts.map(([px, py]) => xy(px, py)),
        closed: tag === "polygon",
      });
    } else if (tag === "line") {
      const x1 = +el.getAttribute("x1") || 0;
      const y1 = +el.getAttribute("y1") || 0;
      const x2 = +el.getAttribute("x2") || 0;
      const y2 = +el.getAttribute("y2") || 0;
      const [tx1, ty1] = xy(x1, y1);
      const [tx2, ty2] = xy(x2, y2);
      out.push({ type: "LINE", x1: tx1, y1: ty1, x2: tx2, y2: ty2 });
    } else if (tag === "path") {
      const d = el.getAttribute("d") || "";
      const subpaths = pathToPolylines(d, 16);
      for (const sp of subpaths) {
        if (sp.points.length < 2) continue;
        out.push({
          type: "POLYLINE",
          points: sp.points.map(([px, py]) => xy(px, py)),
          closed: sp.closed,
        });
      }
    }
  }
  return out;
}

function parsePoints(str) {
  const nums = str.trim().split(/[\s,]+/).filter(Boolean).map(parseFloat);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

function pathToPolylines(d, samples) {
  // Minimal SVG path parser. Supports M m L l H h V v C c S s Q q T t A a Z z.
  // Cubic/quadratic beziers are sampled to `samples` segments each. Arcs are
  // converted via the W3C centre parameterisation and sampled.
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  const subs = [];
  let current = null;
  let cx = 0, cy = 0, startX = 0, startY = 0;
  let prevC = null, prevQ = null;
  let cmd = null, i = 0;

  const num = () => parseFloat(tokens[i++]);

  function startSub(x, y) {
    current = { points: [[x, y]], closed: false };
    subs.push(current);
    startX = x; startY = y; cx = x; cy = y;
  }
  function pushPt(x, y) { if (current) current.points.push([x, y]); cx = x; cy = y; }
  function sampleCubic(p0, p1, p2, p3) {
    for (let t = 1; t <= samples; t++) {
      const u = t / samples, mt = 1 - u;
      const x = mt*mt*mt*p0[0] + 3*mt*mt*u*p1[0] + 3*mt*u*u*p2[0] + u*u*u*p3[0];
      const y = mt*mt*mt*p0[1] + 3*mt*mt*u*p1[1] + 3*mt*u*u*p2[1] + u*u*u*p3[1];
      if (current) current.points.push([x, y]);
    }
    cx = p3[0]; cy = p3[1];
  }
  function sampleQuad(p0, p1, p2) {
    for (let t = 1; t <= samples; t++) {
      const u = t / samples, mt = 1 - u;
      const x = mt*mt*p0[0] + 2*mt*u*p1[0] + u*u*p2[0];
      const y = mt*mt*p0[1] + 2*mt*u*p1[1] + u*u*p2[1];
      if (current) current.points.push([x, y]);
    }
    cx = p2[0]; cy = p2[1];
  }

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[a-zA-Z]$/.test(tok)) {
      cmd = tok;
      i++;
      // Z/z takes no arguments — handle and continue
      if (cmd === "Z" || cmd === "z") {
        if (current) current.closed = true;
        cx = startX; cy = startY;
        prevC = prevQ = null;
        cmd = null;
        continue;
      }
    }
    if (!cmd) { i++; continue; } // bail on stray tokens
    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    switch (upper) {
      case "M": {
        const x = num(), y = num();
        const ax = rel ? cx + x : x, ay = rel ? cy + y : y;
        startSub(ax, ay);
        cmd = rel ? "l" : "L"; // implicit lineto on subsequent pairs
        prevC = prevQ = null;
        break;
      }
      case "L": {
        const x = num(), y = num();
        pushPt(rel ? cx + x : x, rel ? cy + y : y);
        prevC = prevQ = null;
        break;
      }
      case "H": {
        const x = num();
        pushPt(rel ? cx + x : x, cy);
        prevC = prevQ = null;
        break;
      }
      case "V": {
        const y = num();
        pushPt(cx, rel ? cy + y : y);
        prevC = prevQ = null;
        break;
      }
      case "C": {
        const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        const p1 = [rel ? cx + x1 : x1, rel ? cy + y1 : y1];
        const p2 = [rel ? cx + x2 : x2, rel ? cy + y2 : y2];
        const p3 = [rel ? cx + x : x, rel ? cy + y : y];
        sampleCubic([cx, cy], p1, p2, p3);
        prevC = p2; prevQ = null;
        break;
      }
      case "S": {
        const x2 = num(), y2 = num(), x = num(), y = num();
        const p2 = [rel ? cx + x2 : x2, rel ? cy + y2 : y2];
        const p3 = [rel ? cx + x : x, rel ? cy + y : y];
        const p1 = prevC ? [2 * cx - prevC[0], 2 * cy - prevC[1]] : [cx, cy];
        sampleCubic([cx, cy], p1, p2, p3);
        prevC = p2; prevQ = null;
        break;
      }
      case "Q": {
        const x1 = num(), y1 = num(), x = num(), y = num();
        const p1 = [rel ? cx + x1 : x1, rel ? cy + y1 : y1];
        const p2 = [rel ? cx + x : x, rel ? cy + y : y];
        sampleQuad([cx, cy], p1, p2);
        prevQ = p1; prevC = null;
        break;
      }
      case "T": {
        const x = num(), y = num();
        const p2 = [rel ? cx + x : x, rel ? cy + y : y];
        const p1 = prevQ ? [2 * cx - prevQ[0], 2 * cy - prevQ[1]] : [cx, cy];
        sampleQuad([cx, cy], p1, p2);
        prevQ = p1; prevC = null;
        break;
      }
      case "A": {
        const rx = Math.abs(num()), ry = Math.abs(num());
        const phi = num() * Math.PI / 180;
        const largeArc = num() ? 1 : 0;
        const sweep = num() ? 1 : 0;
        const x = num(), y = num();
        const ax = rel ? cx + x : x, ay = rel ? cy + y : y;
        sampleArc(cx, cy, rx, ry, phi, largeArc, sweep, ax, ay, samples * 2);
        prevC = prevQ = null;
        break;
      }
      default:
        // Unknown command — bail this token to avoid infinite loop
        i++;
        cmd = null;
        break;
    }
  }

  function sampleArc(x1, y1, rx, ry, phi, fa, fs, x2, y2, n) {
    // SVG arc → center parameterization (from W3C)
    if (rx === 0 || ry === 0) { pushPt(x2, y2); return; }
    const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cosPhi * dx + sinPhi * dy;
    const y1p = -sinPhi * dx + cosPhi * dy;
    let rxs = rx * rx, rys = ry * ry;
    const x1ps = x1p * x1p, y1ps = y1p * y1p;
    const lambda = x1ps / rxs + y1ps / rys;
    if (lambda > 1) {
      const k = Math.sqrt(lambda);
      rx = k * rx; ry = k * ry; rxs = rx * rx; rys = ry * ry;
    }
    let sign = (fa === fs) ? -1 : 1;
    let sq = (rxs * rys - rxs * y1ps - rys * x1ps) / (rxs * y1ps + rys * x1ps);
    sq = Math.max(0, sq);
    const coef = sign * Math.sqrt(sq);
    const cxp = coef * (rx * y1p / ry);
    const cyp = coef * -(ry * x1p / rx);
    const cx2 = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    const cy2 = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => {
      const dot = ux * vx + uy * vy;
      const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
      let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
      if (ux * vy - uy * vx < 0) a = -a;
      return a;
    };
    const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dtheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dtheta > 0) dtheta -= 2 * Math.PI;
    if (fs && dtheta < 0) dtheta += 2 * Math.PI;
    for (let t = 1; t <= n; t++) {
      const u = t / n;
      const a = theta1 + u * dtheta;
      const px = cosPhi * rx * Math.cos(a) - sinPhi * ry * Math.sin(a) + cx2;
      const py = sinPhi * rx * Math.cos(a) + cosPhi * ry * Math.sin(a) + cy2;
      if (current) current.points.push([px, py]);
    }
    cx = x2; cy = y2;
  }

  return subs.filter(sp => sp.points.length >= 2);
}

function makeDxf(entities) {
  // AutoCAD R12 ASCII (AC1009) — simplest, broadest CAD compatibility.
  // R12 doesn't have LWPOLYLINE; we use POLYLINE + VERTEX + SEQEND triplets,
  // which Fusion 360, FreeCAD and AutoCAD all handle without subclass markers.
  const out = [];
  const push = (...lines) => out.push(...lines);

  push("0", "SECTION", "2", "HEADER",
       "9", "$ACADVER", "1", "AC1009",
       "9", "$INSUNITS", "70", "4", // millimeters
       "0", "ENDSEC");
  push("0", "SECTION", "2", "ENTITIES");

  const fmt = (n) => Number.isFinite(n) ? n.toFixed(4) : "0.0000";

  for (const e of entities) {
    if (e.type === "CIRCLE") {
      push("0", "CIRCLE", "8", "0",
           "10", fmt(e.cx),
           "20", fmt(e.cy),
           "30", "0.0",
           "40", fmt(e.r));
    } else if (e.type === "LINE") {
      push("0", "LINE", "8", "0",
           "10", fmt(e.x1), "20", fmt(e.y1), "30", "0.0",
           "11", fmt(e.x2), "21", fmt(e.y2), "31", "0.0");
    } else if (e.type === "POLYLINE") {
      if (!e.points || e.points.length < 2) continue;
      // R12 polyline header
      push("0", "POLYLINE", "8", "0",
           "66", "1",                       // entities follow
           "70", e.closed ? "1" : "0",      // closed flag
           "10", "0.0", "20", "0.0", "30", "0.0");
      for (const [x, y] of e.points) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        push("0", "VERTEX", "8", "0",
             "10", fmt(x), "20", fmt(y), "30", "0.0",
             "70", "0");                    // vertex flags
      }
      push("0", "SEQEND", "8", "0");
    }
  }
  push("0", "ENDSEC");
  push("0", "EOF");
  return out.join("\r\n") + "\r\n";
}

async function exportPng(dpi) {
  // dpi is now an explicit argument coming from the Експорт menu items.
  // Default to 600 if called without one (kept for backwards-compat).
  if (typeof dpi !== "number") dpi = 600;
  const svg = await maybeConvertCurves(buildSvg());
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  // viewBox is in mm. 1 inch = 25.4 mm → pixelsPerMm = dpi / 25.4
  const scale = dpi / 25.4;
  const img = new Image();
  img.onload = () => {
    const vb = svg.getAttribute("viewBox").split(/\s+/);
    const mmW = parseFloat(vb[2]);
    const mmH = parseFloat(vb[3]);
    const w = Math.round(mmW * scale);
    const h = Math.round(mmH * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    // White background — без нього прозорий PNG може погано показуватись у деяких програмах
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => {
      download(b, `stamp-${dpi}dpi-${Date.now()}.png`);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => alert("Не вдалося зрендерити PNG.");
  img.src = url;
}

function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function flashButton(btn, msg) {
  if (!btn) return;
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = old), 1200);
}

// ============================================================
// WIRE-UP
// ============================================================
function bind() {
  const inputs = els.controls?.querySelectorAll?.("input, select")
    || document.querySelectorAll("aside.controls input, aside.controls select");
  inputs.forEach(el => {
    el.addEventListener("input", () => {
      if (el === els.shape) syncSizeOptions();
      render();
    });
  });

  els.preset.addEventListener("change", (e) => {
    if (e.target.value) applyPreset(e.target.value);
  });

  els.addLine.addEventListener("click", () => {
    els.centerLines.appendChild(makeLineRow({ text: "Новий рядок", size: 2.6 }));
    render();
  });

  $("exportSvg").addEventListener("click", exportSvg);
  $("exportDxf").addEventListener("click", exportDxf);
  $("copySvg").addEventListener("click", copySvg);

  // PNG menu items — кожен пункт у меню «Експорт» має свій DPI у data-dpi.
  document.querySelectorAll(".png-item").forEach(btn => {
    btn.addEventListener("click", () => exportPng(parseInt(btn.dataset.dpi, 10)));
  });

  // Меню-бар: відкриття/закриття випадаючих списків
  document.querySelectorAll(".menu-trigger").forEach(trig => {
    trig.addEventListener("click", (e) => {
      e.stopPropagation();
      const m = trig.parentElement;
      const wasOpen = m.classList.contains("open");
      document.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open"));
      if (!wasOpen) m.classList.add("open");
    });
  });
  // Клік по пункту меню — закрити меню (за винятком чекбоксу-перемикача).
  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open"));
    });
  });
  // Клік поза меню — закрити
  document.addEventListener("click", () => {
    document.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open"));
  });
  // Esc — закрити
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".menu.open").forEach(x => x.classList.remove("open"));
    }
  });
  $("exportJson").addEventListener("click", exportJson);
  $("importJson").addEventListener("click", () => $("importJsonFile").click());
  $("importJsonFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importJsonFile(f);
    e.target.value = ""; // allow reselecting the same file
  });
  $("resetBtn").addEventListener("click", () => {
    if (confirm("Скинути всі поля? Авто-збережений стан у браузері буде стертий.")) {
      lsClearAutosave();
      location.reload();
    }
  });
  $("saveAsUserPreset")?.addEventListener("click", saveAsUserPreset);
  $("deleteUserPreset")?.addEventListener("click", deleteUserPresetUi);

  // Background photo controls
  els.bgFile.addEventListener("change", onBgFileChange);
  els.bgClear.addEventListener("click", clearBg);
  ["bgOpacity", "bgScale", "bgX", "bgY", "bgRotate", "bgOnTop"].forEach(id => {
    $(id).addEventListener("input", updateBgImage);
    $(id).addEventListener("change", updateBgImage);
  });
  bindBgDrag();

  // Zoom controls
  els.zoomSlider.addEventListener("input", () => {
    currentZoom = parseInt(els.zoomSlider.value, 10);
    applyZoom();
  });
  els.zoomIn.addEventListener("click", () => {
    currentZoom = Math.min(600, currentZoom + 25);
    applyZoom();
  });
  els.zoomOut.addEventListener("click", () => {
    currentZoom = Math.max(50, currentZoom - 25);
    applyZoom();
  });
  els.zoomFit.addEventListener("click", zoomFit);
  els.zoom100.addEventListener("click", () => { currentZoom = 100; applyZoom(); });

  // Mouse wheel zoom on preview area (Ctrl+wheel)
  els.previewArea.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const dz = e.deltaY < 0 ? 15 : -15;
    currentZoom = Math.min(600, Math.max(50, currentZoom + dz));
    applyZoom();
  }, { passive: false });
}

// ============================================================
// INIT
// ============================================================
syncSizeOptions();
setLines(DEFAULT_LINES);
bind();
// Restore last session from localStorage if available; falls back to HTML defaults.
if (!lsRestoreAutosave()) render();
loadPresets();
