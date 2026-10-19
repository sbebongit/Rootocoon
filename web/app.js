import { raccoonSVG } from "./mascot.js";

const $ = (s) => document.querySelector(s);
const MAX_SEND_SIDE = 1536; // crops larger than this are scaled down before they are sent

const cfg = { maxMb: 10, maxPixels: 40_000_000, engine: "?" };

/* =====================================================================
   Rootocoon – speech bubbles, guide and costumes
   ===================================================================== */
const GUIDES = {
  upload: [
    ["hello", "Hi! I'm <b>Rootocoon</b> 🦝 I help you erase things from photos – tourists, power lines, your little brother's thumb…"],
    ["talk", "Start by <b>dragging an image</b> into the box, or click to choose one. JPG, PNG, WEBP or BMP, max {MB} MB."],
    ["talk", "Don't worry about uploading: everything is sent <b>encrypted</b> (HTTPS) and your image only lives in memory while I work. <b>Nothing is stored.</b>"],
  ],
  edit: [
    ["painter", "Nice! Now <b>paint over</b> whatever you want gone. Cover all of it – and its shadow too, if it has one."],
    ["talk", "Change the brush <b>size</b> with the slider (or the <b>[</b> and <b>]</b> keys). Painted too much? Use the <b>Eraser</b> or <b>Undo</b>."],
    ["talk", "Then press <b>✨ Erase it!</b> and the AI guesses what was behind it. You can run it several times, and press <b>Original</b> to compare with the image you uploaded."],
  ],
};

const MESSAGES = {
  too_big: ["stuffed", "<b>Burp!</b> That file was way too big – I can't eat more than <b>{MB} MB</b>. Try a smaller image, or shrink it first."],
  too_many_pixels: ["stuffed", "Phew… so many pixels! The image is bigger than <b>{MP} megapixels</b> and won't fit in my belly. Shrink it a bit and try again."],
  wrong_format: ["detective", "Hmm… I've investigated this file and it is <b>not an image</b>! I only eat JPG, PNG, WEBP and BMP."],
  corrupt: ["confused", "Huh… what? This file <i>looks</i> like an image but won't open. It seems to be <b>corrupt</b> – broken or only half downloaded."],
  empty: ["confused", "This file is… empty? There's nothing in it to look at."],
  empty_mask: ["shrug", "You haven't painted anything yet! Paint over what you want gone, then press the button."],
  bad_mask: ["confused", "Something went wrong with the selection. Try clearing it and painting again."],
  network: ["hurt", "Ouch! I can't reach the server. Is it running? Try again in a moment."],
  server: ["hurt", "Ouch, something broke in the engine room. Try again – or try another image."],
  working: ["working", "Working… I'm looking at the surroundings and rebuilding what was behind it 🔧"],
  done: ["party", "<b>Ta-da!</b> Gone! Does something look odd? Press Undo, paint a little wider and run it again."],
  done_basic: ["party", "<b>Ta-da!</b> Done! (Psst – the server is using my simple fallback method right now. Install the AI model for much better results, see the README.)"],
};

const mascot = (() => {
  const btn = $("#mascotBtn"), bubble = $("#bubble"), text = $("#bubbleText");
  const next = $("#nextBtn"), skip = $("#skipBtn");
  let queue = [], current = "talk", idleTimer = 0, onClose = null;

  const fill = (s) => s.replace("{MB}", cfg.maxMb).replace("{MP}", Math.round(cfg.maxPixels / 1e6));

  function costume(name, pop = true) {
    if (name === current && btn.innerHTML) return;
    current = name;
    btn.innerHTML = raccoonSVG(name);
    if (pop) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
  }
  function show([name, msg], { buttons = true, alert = false, last = true, guide = false } = {}) {
    costume(name);
    text.innerHTML = fill(msg);
    bubble.classList.toggle("alert", alert);
    next.hidden = !buttons;
    skip.hidden = !guide;
    next.textContent = guide && !last ? "Next" : "OK";
    bubble.hidden = false;
    resetIdle();
  }
  function hide() {
    bubble.hidden = true;
    queue = [];
    costume("talk", false);
    const cb = onClose; onClose = null; cb && cb();
  }
  function guide(steps) {
    queue = steps.slice();
    step();
  }
  function step() {
    const s = queue.shift();
    if (!s) return hide();
    show(s, { guide: true, last: queue.length === 0 });
  }
  function say(key, opts = {}) {
    queue = [];
    show(MESSAGES[key], { alert: opts.alert ?? true, buttons: opts.buttons ?? true });
  }
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (bubble.hidden) costume("sleepy"); }, 60_000);
  }

  next.addEventListener("click", () => (queue.length ? step() : hide()));
  skip.addEventListener("click", () => { store.set("skipGuide", "1"); hide(); });
  btn.addEventListener("click", () => {
    if (!bubble.hidden) return hide();
    guide(GUIDES[state.view]);
  });
  ["pointerdown", "keydown"].forEach((e) => addEventListener(e, () => {
    if (current === "sleepy") costume("talk");
    resetIdle();
  }));

  costume("talk", false);
  return { costume, say, guide, hide, get current() { return current; }, get open() { return !bubble.hidden; } };
})();

// localStorage can be disabled (private mode) – then we just don't remember anything
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const autoGuide = (view) => { if (!store.get("skipGuide") && !store.get("seen_" + view)) { store.set("seen_" + view, "1"); mascot.guide(GUIDES[view]); } };

/* =====================================================================
   Upload + file checks
   ===================================================================== */
const state = {
  view: "upload",
  tool: "brush",
  strokes: [],       // the selection is stored as brush strokes, so undo is cheap
  undo: [], redo: [],
  original: null,    // ImageBitmap of the original (for comparing)
  fileType: "image/png",   // the real format of the uploaded file
  fileName: "image",       // file name without extension
  fileSize: 0,
  busy: false,
};

const imageCanvas = $("#imageCanvas"), maskCanvas = $("#maskCanvas");
const ictx = imageCanvas.getContext("2d");
const mctx = maskCanvas.getContext("2d");
const wrap = $("#canvasWrap");

function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  return null;
}

class CheckError extends Error { constructor(code) { super(code); this.code = code; } }

async function checkFile(file) {
  // 1. Size – checked before we even read the file
  if (file.size === 0) throw new CheckError("empty");
  if (file.size > cfg.maxMb * 1024 * 1024) throw new CheckError("too_big");
  // 2. Real format? We read the file's first bytes instead of trusting the file extension
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = sniff(head);
  if (!type) throw new CheckError("wrong_format");
  // 3. Can it be decoded? If not, it is corrupt
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new CheckError("corrupt"); }
  if (bmp.width * bmp.height > cfg.maxPixels) { bmp.close(); throw new CheckError("too_many_pixels"); }
  // 4. The server checks too (never trust only the browser)
  const fd = new FormData();
  fd.append("image", file);
  const res = await api("/api/check", fd);
  if (!res.ok) { bmp.close(); throw new CheckError((await res.json().catch(() => ({}))).code || "server"); }
  return { bmp, type };
}

async function api(url, body) {
  try { return await fetch(url, { method: "POST", body, cache: "no-store" }); }
  catch { throw new CheckError("network"); }
}

async function openFile(file) {
  if (!file || state.busy) return;
  mascot.costume("detective");
  try {
    const { bmp, type } = await checkFile(file);
    state.fileType = type;
    state.fileName = file.name.replace(/\.[^.]+$/, "") || "image";
    state.fileSize = file.size;
    // Save in the same kind of format as the upload: JPG stays JPG, everything else is saved as lossless PNG
    $("#saveFormat").value = type === "image/jpeg" ? "image/jpeg" : "image/png";
    loadBitmap(bmp);
    renderInfo(file.name);
    mascot.hide();
    showView("edit");
  } catch (e) {
    mascot.say(e.code in MESSAGES ? e.code : "server");
  }
  $("#fileInput").value = "";
}

function loadBitmap(bmp) {
  state.original?.close?.();
  state.original = bmp;
  for (const c of [imageCanvas, maskCanvas]) { c.width = bmp.width; c.height = bmp.height; }
  ictx.drawImage(bmp, 0, 0);
  state.strokes = []; state.undo = []; state.redo = [];
  redrawMask();
  updateButtons();
}

/* ---------------------------------------------------------------------
   Image info: size in pixels, aspect ratio, file size and format
   --------------------------------------------------------------------- */
const COMMON_RATIOS = [[1, 1], [5, 4], [4, 3], [3, 2], [16, 10], [16, 9], [2, 1], [21, 9], [32, 9]];
const FORMAT_NAMES = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WEBP", "image/bmp": "BMP" };

function aspectRatio(w, h) {
  const r = w / h;
  // Snap to a well-known ratio if it is within 1% (e.g. 1366x768 is "16:9")
  for (const [a, b] of COMMON_RATIOS) {
    if (Math.abs(r - a / b) / (a / b) < 0.01) return `${a}:${b}`;
    if (Math.abs(r - b / a) / (b / a) < 0.01) return `${b}:${a}`;   // portrait, e.g. 9:16
  }
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const g = gcd(w, h);
  if (w / g <= 50 && h / g <= 50) return `${w / g}:${h / g}`;
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}
function orientation(w, h) {
  return w === h ? "square" : w > h ? "landscape" : "portrait";
}
function formatBytes(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
function renderInfo(fullName) {
  const w = imageCanvas.width, h = imageCanvas.height;
  const items = [
    ["name", fullName],
    ["dims", `${w} \u00d7 ${h} px`],
    ["ratio", `${aspectRatio(w, h)} ${orientation(w, h)}`],
    ["size", formatBytes(state.fileSize)],
    ["type", FORMAT_NAMES[state.fileType] || ""],
  ];
  const box = $("#imgInfo");
  box.replaceChildren(...items.map(([cls, text]) => {
    const el = document.createElement("span");      // textContent, never innerHTML: file names are user input
    el.className = "info-" + cls;
    el.textContent = text;
    if (cls === "name") el.title = text;
    return el;
  }));
  updateSaveHint();
}
function updateSaveHint() {
  const jpg = $("#saveFormat").value === "image/jpeg";
  $("#downloadBtn").title = `Download: ${imageCanvas.width} \u00d7 ${imageCanvas.height} px, ` +
    (jpg ? "JPG at maximum quality" : "PNG, lossless (every pixel exactly as shown)");
}
$("#saveFormat").addEventListener("change", updateSaveHint);

function showView(v) {
  state.view = v;
  $("#uploadView").hidden = v !== "upload";
  $("#editView").hidden = v !== "edit";
  autoGuide(v);
}

// Drop zone
const drop = $("#dropZone");
$("#fileInput").addEventListener("change", (e) => openFile(e.target.files[0]));
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#fileInput").click(); } });
addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
addEventListener("dragleave", (e) => { if (!e.relatedTarget) drop.classList.remove("over"); });
addEventListener("drop", (e) => {
  e.preventDefault(); drop.classList.remove("over");
  openFile(e.dataTransfer.files[0]);
});
addEventListener("paste", (e) => {
  const f = [...(e.clipboardData?.files || [])][0];
  if (f) openFile(f);
});

/* =====================================================================
   The brush
   ===================================================================== */
const sizeInput = $("#brushSize"), cursor = $("#cursor");
const SIZE_MIN = 2, SIZE_MAX = 200;
// Smaller steps for small brushes, bigger steps for big ones
const sizeStep = (v) => (v < 20 ? 2 : v < 60 ? 5 : 10);
let previewTimer = 0;
function setSize(v, preview = true) {
  v = Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, v)));
  sizeInput.value = v;
  $("#sizeValue").textContent = `${v} px`;
  $("#sizeDown").disabled = v <= SIZE_MIN;
  $("#sizeUp").disabled = v >= SIZE_MAX;
  if (preview && state.view === "edit") showSizePreview(v);
}
function changeSize(dir) {
  const v = +sizeInput.value;
  setSize(dir > 0 ? v + sizeStep(v) : v - sizeStep(v - 1));
}
// Show the brush circle in the middle of the image for a moment, so you see the new size
function showSizePreview(v) {
  if (live || cursor.dataset.over === "1") { cursor.style.width = cursor.style.height = v + "px"; return; }
  cursor.hidden = false;
  cursor.classList.add("preview");
  cursor.style.left = wrap.clientWidth / 2 + "px";
  cursor.style.top = wrap.clientHeight / 2 + "px";
  cursor.style.width = cursor.style.height = v + "px";
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    cursor.classList.remove("preview");
    if (cursor.dataset.over !== "1") cursor.hidden = true;
  }, 700);
}
sizeInput.addEventListener("input", () => setSize(+sizeInput.value));
$("#sizeDown").addEventListener("click", () => changeSize(-1));
$("#sizeUp").addEventListener("click", () => changeSize(1));
const toScale = () => maskCanvas.width / maskCanvas.getBoundingClientRect().width;
const brushPx = () => +sizeInput.value * toScale(); // screen pixels -> image pixels

function drawStroke(s, from = 0) {
  mctx.save();
  mctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  mctx.strokeStyle = mctx.fillStyle = "rgb(232,60,80)";
  mctx.lineWidth = s.size; mctx.lineCap = mctx.lineJoin = "round";
  const p = s.pts;
  if (p.length === 1) {
    mctx.beginPath(); mctx.arc(p[0][0], p[0][1], s.size / 2, 0, Math.PI * 2); mctx.fill();
  } else {
    mctx.beginPath();
    mctx.moveTo(...p[Math.max(0, from - 1)]);
    for (let i = Math.max(1, from); i < p.length; i++) mctx.lineTo(...p[i]);
    mctx.stroke();
  }
  mctx.restore();
}
function redrawMask() {
  mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  state.strokes.forEach((s) => drawStroke(s));
}

let live = null;
function pos(e) {
  const r = maskCanvas.getBoundingClientRect(), k = toScale();
  return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
}
// Ctrl + drag (Cmd + drag on Mac) changes the brush size, like the Roto Brush in After Effects:
// drag right or up = bigger, left or down = smaller. The circle stays where you started.
let resizing = null;
const resizeKey = (e) => e.ctrlKey || e.metaKey;
function startResize(e) {
  const r = wrap.getBoundingClientRect();
  resizing = { x: e.clientX, y: e.clientY, size: +sizeInput.value };
  maskCanvas.setPointerCapture(e.pointerId);
  cursor.hidden = false;
  cursor.classList.remove("preview");
  cursor.classList.add("resizing");
  cursor.style.left = e.clientX - r.left + "px";
  cursor.style.top = e.clientY - r.top + "px";
  showResize();
}
function moveResize(e) {
  const moved = (e.clientX - resizing.x) - (e.clientY - resizing.y);   // right and up count as positive
  setSize(resizing.size + moved, false);
  showResize();
}
function showResize() {
  cursor.style.width = cursor.style.height = sizeInput.value + "px";
  cursor.dataset.size = sizeInput.value + " px";
}
function endResize() {
  resizing = null;
  cursor.classList.remove("resizing");
}
// On a Mac, Ctrl + click opens the right-click menu – don't let it pop up over the image
maskCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

maskCanvas.addEventListener("pointerdown", (e) => {
  if (state.busy || e.button > 0) return;
  stopCompare();
  if (resizeKey(e)) return startResize(e);
  maskCanvas.setPointerCapture(e.pointerId);
  live = { erase: state.tool === "eraser", size: brushPx(), pts: [pos(e)] };
  drawStroke(live);
  if (!mascot.open && !live.erase) mascot.costume("painter");
});
maskCanvas.addEventListener("pointermove", (e) => {
  if (resizing) return moveResize(e);
  moveCursor(e);
  if (!live) return;
  live.pts.push(pos(e));
  drawStroke(live, live.pts.length - 1);
});
const endStroke = () => {
  if (!live) return;
  state.strokes.push(live);
  state.undo.push({ type: "stroke", stroke: live }); state.redo = [];
  live = null;
  if (!mascot.open) mascot.costume("talk", false);
  updateButtons();
};
const endPointer = () => (resizing ? endResize() : endStroke());
maskCanvas.addEventListener("pointerup", endPointer);
maskCanvas.addEventListener("pointercancel", endPointer);
maskCanvas.addEventListener("pointerleave", () => { cursor.hidden = true; cursor.dataset.over = "0"; });
maskCanvas.addEventListener("pointerenter", () => { cursor.dataset.over = "1"; cursor.classList.remove("preview"); });

function moveCursor(e) {
  const r = wrap.getBoundingClientRect();
  cursor.hidden = false;
  cursor.style.left = e.clientX - r.left + "px";
  cursor.style.top = e.clientY - r.top + "px";
  cursor.style.width = cursor.style.height = sizeInput.value + "px";
  cursor.classList.toggle("eraser", state.tool === "eraser");
}

function setTool(t) {
  state.tool = t;
  document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b.dataset.tool === t));
}
document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));

/* =====================================================================
   Undo / redo
   ===================================================================== */
// Every step in the history is one of three kinds:
//   stroke  – one brush or eraser stroke
//   clear   – "Clear" (we remember which strokes were removed)
//   inpaint – one AI removal (we remember the image piece before and after,
//             and the painting, so undo goes back to just before "Erase it!")
// One click on Undo always takes back exactly one step.
function undo() {
  if (state.busy || !state.undo.length) return; // never touch history while the AI works
  stopCompare();
  const a = state.undo.pop();
  if (a.type === "stroke") state.strokes = state.strokes.filter((s) => s !== a.stroke);
  if (a.type === "clear") state.strokes = a.removed;
  if (a.type === "inpaint") { ictx.drawImage(a.before, a.x, a.y); state.strokes = a.strokes; }
  state.redo.push(a); redrawMask(); updateButtons();
}
function redo() {
  if (state.busy || !state.redo.length) return;
  stopCompare();
  const a = state.redo.pop();
  if (a.type === "stroke") state.strokes = [...state.strokes, a.stroke];
  if (a.type === "clear") state.strokes = [];
  if (a.type === "inpaint") { ictx.drawImage(a.after, a.x, a.y); state.strokes = []; }
  state.undo.push(a); redrawMask(); updateButtons();
}
function updateButtons() {
  $("#undoBtn").disabled = !state.undo.length || state.busy;
  $("#redoBtn").disabled = !state.redo.length || state.busy;
  $("#clearBtn").disabled = !state.strokes.length || state.busy;
  $("#compareBtn").disabled = state.busy;
  $("#goBtn").disabled = !state.strokes.some((s) => !s.erase) || state.busy;
}
$("#undoBtn").addEventListener("click", undo);
$("#redoBtn").addEventListener("click", redo);
$("#clearBtn").addEventListener("click", () => {
  if (state.busy || !state.strokes.length) return;
  state.undo.push({ type: "clear", removed: state.strokes });
  state.redo = []; state.strokes = [];
  redrawMask(); updateButtons();
});

/* =====================================================================
   Erase it! – send the crop to the AI
   ===================================================================== */
function strokeBounds() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of state.strokes) {
    if (s.erase) continue;
    for (const [x, y] of s.pts) {
      x0 = Math.min(x0, x - s.size / 2); y0 = Math.min(y0, y - s.size / 2);
      x1 = Math.max(x1, x + s.size / 2); y1 = Math.max(y1, y + s.size / 2);
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const toBlob = (c, type = "image/png", q) => new Promise((r) => c.toBlob(r, type, q));

async function run() {
  if (state.busy) return;
  stopCompare();
  const b = strokeBounds();
  if (!b) return mascot.say("empty_mask");

  // Crop around the selection + a margin, so the AI sees the surroundings
  const W = imageCanvas.width, H = imageCanvas.height;
  const margin = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.6 + 48;
  const x = Math.max(0, Math.floor(b.x0 - margin)), y = Math.max(0, Math.floor(b.y0 - margin));
  const w = Math.min(W, Math.ceil(b.x1 + margin)) - x, h = Math.min(H, Math.ceil(b.y1 + margin)) - y;
  const scale = Math.min(1, MAX_SEND_SIDE / Math.max(w, h));
  const sw = Math.round(w * scale), sh = Math.round(h * scale);

  const imgCrop = canvasOf(sw, sh), maskCrop = canvasOf(sw, sh);
  imgCrop.getContext("2d").drawImage(imageCanvas, x, y, w, h, 0, 0, sw, sh);
  maskCrop.getContext("2d").drawImage(maskCanvas, x, y, w, h, 0, 0, sw, sh);

  setBusy(true);
  mascot.say("working", { buttons: false, alert: false });
  try {
    const fd = new FormData();
    fd.append("image", await toBlob(imgCrop), "crop.png");
    fd.append("mask", await toBlob(maskCrop), "mask.png");
    const res = await api("/api/inpaint", fd);
    if (!res.ok) throw new CheckError((await res.json().catch(() => ({}))).code || "server");
    const engine = res.headers.get("X-Engine");
    const out = await createImageBitmap(await res.blob());

    // Paste the result, but only where the user painted (+ soft edge)
    const patch = canvasOf(w, h), pctx = patch.getContext("2d");
    pctx.imageSmoothingQuality = "high";
    pctx.drawImage(out, 0, 0, w, h);
    pctx.globalCompositeOperation = "destination-in";
    pctx.filter = `blur(${Math.max(2, 5 / scale)}px)`;
    const soft = canvasOf(w, h), sctx = soft.getContext("2d");
    for (let i = 0; i < 3; i++) sctx.drawImage(maskCanvas, x, y, w, h, 0, 0, w, h); // slightly thicker mask
    pctx.drawImage(soft, 0, 0);
    out.close();

    const before = await createImageBitmap(imageCanvas, x, y, w, h);
    ictx.drawImage(patch, x, y);
    const after = await createImageBitmap(imageCanvas, x, y, w, h);

    state.undo.push({ type: "inpaint", x, y, before, after, strokes: state.strokes });
    state.redo = []; state.strokes = [];
    redrawMask();
    mascot.say(engine === "lama" ? "done" : "done_basic", { alert: false });
  } catch (e) {
    mascot.say(e.code in MESSAGES ? e.code : "server");
  } finally {
    setBusy(false);
  }
}
$("#goBtn").addEventListener("click", run);

function setBusy(on) {
  state.busy = on;
  $("#busy").hidden = !on;
  updateButtons();
}

/* =====================================================================
   Compare, save, new image
   ===================================================================== */
// "Original" is a toggle: click once to see the uploaded image, click again to go back.
// Any other action (painting, undo, erase…) also switches back automatically.
const orig = canvasOf(1, 1);
orig.className = "orig";
const cmp = $("#compareBtn");
let comparing = false;
function startCompare() {
  if (!state.original || state.busy) return;
  orig.width = imageCanvas.width; orig.height = imageCanvas.height;
  orig.getContext("2d").drawImage(state.original, 0, 0);
  wrap.appendChild(orig); wrap.classList.add("comparing");
  comparing = true;
  cmp.classList.add("active"); cmp.setAttribute("aria-pressed", "true");
}
function stopCompare() {
  if (!comparing) return;
  orig.remove(); wrap.classList.remove("comparing");
  comparing = false;
  cmp.classList.remove("active"); cmp.setAttribute("aria-pressed", "false");
}
cmp.addEventListener("click", () => (comparing ? stopCompare() : startCompare()));

// Save: same width and height as the upload, at the best quality the format allows.
// The image is never scaled down. Only the area you erased has new pixels.
$("#downloadBtn").addEventListener("click", async () => {
  const type = $("#saveFormat").value;
  const jpg = type === "image/jpeg";
  const blob = await toBlob(imageCanvas, type, jpg ? 1.0 : undefined);  // 1.0 = maximum JPG quality
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `${state.fileName}-erased.${jpg ? "jpg" : "png"}`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("#newBtn").addEventListener("click", () => {
  if (state.undo.some((a) => a.type === "inpaint") && !confirm("Start over with a new image? Unsaved changes will be lost.")) return;
  // Release everything from memory
  state.undo.forEach((a) => { a.before?.close?.(); a.after?.close?.(); });
  state.redo.forEach((a) => { a.before?.close?.(); a.after?.close?.(); });
  stopCompare();
  state.undo = []; state.redo = []; state.strokes = [];
  state.original?.close?.(); state.original = null;
  for (const c of [imageCanvas, maskCanvas]) { c.width = c.height = 1; }
  mascot.hide();
  showView("upload");
});

/* =====================================================================
   Keyboard
   ===================================================================== */
addEventListener("keydown", (e) => {
  if (state.view !== "edit" || e.target.matches("input[type=text], textarea")) return;
  // Enter/Space on a focused button already "clicks" it – don't run a shortcut on top of that
  if (e.target.matches("button") && (e.key === "Enter" || e.key === " ")) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (key === "y" || (e.shiftKey && key === "z"))) { e.preventDefault(); redo(); }
  else if (mod) return; // leave other Ctrl shortcuts (copy, paste…) alone
  else if (key === "b") setTool("brush");
  else if (key === "e") setTool("eraser");
  else if (key === "o") comparing ? stopCompare() : startCompare();
  else if (e.key === "[") changeSize(-1);
  else if (e.key === "]") changeSize(1);
  else if (e.key === "Enter" && !$("#goBtn").disabled) run();
});

/* =====================================================================
   Start
   ===================================================================== */
fetch("/api/info", { cache: "no-store" })
  .then((r) => r.json())
  .then((i) => {
    cfg.maxMb = i.max_mb; cfg.maxPixels = i.max_pixels; cfg.engine = i.engine;
    $("#limitText").textContent = `JPG, PNG, WEBP or BMP · max ${i.max_mb} MB`;
    $("#engineBadge").textContent = i.engine === "lama" ? `⚡ AI on ${i.device}` : "⚙️ Fallback mode (no AI model)";
  })
  .catch(() => ($("#engineBadge").textContent = "⚠️ Server not responding"));

if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  $("#engineBadge").textContent = "⚠️ Not encrypted!";
}
setSize(+sizeInput.value, false);
showView("upload");
