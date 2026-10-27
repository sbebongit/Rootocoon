/* =====================================================================
   Image info above the image
   ---------------------------------------------------------------------
   Shows the file name, size in pixels, aspect ratio (e.g. 16:9 landscape),
   file size and format. Called by upload.js when an image is opened.
   ===================================================================== */
import { $, state, imageCanvas } from "./state.js";

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

export function renderInfo(fullName) {
  const w = imageCanvas.width, h = imageCanvas.height;
  const items = [
    ["name", fullName],
    ["dims", `${w} × ${h} px`],
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

// The tooltip on Download says exactly what you will get
function updateSaveHint() {
  const jpg = $("#saveFormat").value === "image/jpeg";
  $("#downloadBtn").title = `Download: ${imageCanvas.width} × ${imageCanvas.height} px, ` +
    (jpg ? "JPG at maximum quality" : "PNG, lossless (every pixel exactly as shown)");
}
$("#saveFormat").addEventListener("change", updateSaveHint);
