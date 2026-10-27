/* =====================================================================
   The brush and the eraser
   ---------------------------------------------------------------------
   You paint in red on a transparent canvas on top of the photo (maskCanvas).
   The red area is the "mask": what the AI should remove.
   Each stroke is saved as a list of points, so undo can take it back.
   ===================================================================== */
import { $, state, maskCanvas, mctx, wrap } from "./state.js";
import { mascot } from "./guide.js";
import { updateButtons } from "./history.js";
import { stopCompare } from "./compare.js";

// --- Brush size: 2 to 200 px -------------------------------------------------
const sizeInput = $("#brushSize"), cursor = $("#cursor");
const SIZE_MIN = 2, SIZE_MAX = 200;
// Smaller steps for small brushes, bigger steps for big ones
const sizeStep = (v) => (v < 20 ? 2 : v < 60 ? 5 : 10);
let previewTimer = 0;

export function setSize(v, preview = true) {
  v = Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, v)));
  sizeInput.value = v;
  $("#sizeValue").textContent = `${v} px`;
  $("#sizeDown").disabled = v <= SIZE_MIN;
  $("#sizeUp").disabled = v >= SIZE_MAX;
  if (preview && state.view === "edit") showSizePreview(v);
}
// The - and + buttons, and the [ and ] keys
export function changeSize(dir) {
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

// The image is shown smaller than it really is, so screen pixels are converted to image pixels
const toScale = () => maskCanvas.width / maskCanvas.getBoundingClientRect().width;
const brushPx = () => +sizeInput.value * toScale();

// --- Drawing -------------------------------------------------------------------
// Draws one stroke. The eraser uses "destination-out", which removes red paint
// instead of adding it – the photo underneath is never touched.
export function drawStroke(s, from = 0) {
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
// Paints all strokes again from scratch (after undo, redo or clear)
export function redrawMask() {
  mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  state.strokes.forEach((s) => drawStroke(s));
}

let live = null;   // the stroke being painted right now
function pos(e) {
  const r = maskCanvas.getBoundingClientRect(), k = toScale();
  return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
}

// --- Ctrl + drag changes the brush size ----------------------------------------
// Like the Roto Brush in After Effects (Cmd + drag on Mac):
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

// --- Mouse, pen and touch --------------------------------------------------------
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
// When the stroke is finished it is saved in the history, so Undo can take it back
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

// The circle that follows the mouse and shows the brush size
function moveCursor(e) {
  const r = wrap.getBoundingClientRect();
  cursor.hidden = false;
  cursor.style.left = e.clientX - r.left + "px";
  cursor.style.top = e.clientY - r.top + "px";
  cursor.style.width = cursor.style.height = sizeInput.value + "px";
  cursor.classList.toggle("eraser", state.tool === "eraser");
}

// --- Brush or eraser -------------------------------------------------------------
export function setTool(t) {
  state.tool = t;
  document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b.dataset.tool === t));
}
document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
