/* =====================================================================
   Upload and file checks
   ---------------------------------------------------------------------
   Every file is checked in four steps before it is opened:
     1. size        – empty files and files over the limit are refused
     2. real format – we read the first bytes, not the file name
     3. corrupt?    – the whole image must decode
     4. the server  – checks everything again (never trust only the browser)
   If a check fails, Rootocoon puts on the matching costume (see guide.js).
   ===================================================================== */
import { $, cfg, state, imageCanvas, maskCanvas, ictx } from "./state.js";
import { mascot, MESSAGES, autoGuide } from "./guide.js";
import { redrawMask } from "./brush.js";
import { updateButtons } from "./history.js";
import { renderInfo } from "./imageinfo.js";

// --- Is it really an image? ------------------------------------------------
// Every image format starts with its own "magic numbers". A video or a .txt
// renamed to .jpg starts with something else, so it is caught here.
function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  return null;
}

// An error with a code, e.g. "too_big", that matches a message in guide.js
export class CheckError extends Error {
  constructor(code, retryAfter) { super(code); this.code = code; this.retryAfter = retryAfter; }
}
// Turns an error answer from the server into a CheckError
export async function serverError(res) {
  const j = await res.json().catch(() => ({}));
  return new CheckError(j.code || "server", j.retry_after);
}
// Sends a form to the server. If the server can't be reached, Rootocoon says so.
export async function api(url, body) {
  try { return await fetch(url, { method: "POST", body, cache: "no-store" }); }
  catch { throw new CheckError("network"); }
}

async function checkFile(file) {
  // 1. File size limit – checked before we even read the file
  if (file.size === 0) throw new CheckError("empty");
  if (file.size > cfg.maxMb * 1024 * 1024) throw new CheckError("too_big");
  // 2. Real format? We read the file's first bytes instead of trusting the file extension
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = sniff(head);
  if (!type) throw new CheckError("wrong_format");
  // 3. Corrupt files: if the image can't be decoded, it is broken
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new CheckError("corrupt"); }
  if (bmp.width * bmp.height > cfg.maxPixels) { bmp.close(); throw new CheckError("too_many_pixels"); }
  // 4. The server checks too (never trust only the browser)
  const fd = new FormData();
  fd.append("image", file);
  const res = await api("/api/check", fd);
  if (!res.ok) { bmp.close(); throw await serverError(res); }
  return { bmp, type };
}

// Runs the checks, then opens the image in the editor
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
    mascot.say(e.code in MESSAGES ? e.code : "server", { retryAfter: e.retryAfter });
  }
  $("#fileInput").value = "";
}

// Draws the image on the canvas and starts with an empty history
function loadBitmap(bmp) {
  state.original?.close?.();
  state.original = bmp;
  for (const c of [imageCanvas, maskCanvas]) { c.width = bmp.width; c.height = bmp.height; }
  ictx.drawImage(bmp, 0, 0);
  state.strokes = []; state.undo = []; state.redo = [];
  redrawMask();
  updateButtons();
}

// Switches between the upload screen and the editor
export function showView(v) {
  state.view = v;
  $("#uploadView").hidden = v !== "upload";
  $("#editView").hidden = v !== "edit";
  autoGuide(v);
}

// --- Ways to add an image: click, drag and drop, or paste with Ctrl+V -------
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
