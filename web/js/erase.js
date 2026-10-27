/* =====================================================================
   "Erase it!" – sends the painted area to the AI
   ---------------------------------------------------------------------
   Only a crop around the red paint is sent, not the whole image. That is
   faster, uses less memory on the server, and lets you erase several times
   in a row. The AI's answer is pasted back with soft edges.
   The AI itself runs on the server, see server/inpaint.py.
   ===================================================================== */
import { $, state, imageCanvas, maskCanvas, ictx, canvasOf, toBlob } from "./state.js";
import { mascot, MESSAGES } from "./guide.js";
import { redrawMask } from "./brush.js";
import { updateButtons } from "./history.js";
import { stopCompare } from "./compare.js";
import { api, serverError } from "./upload.js";

const MAX_SEND_SIDE = 1536; // crops larger than this are scaled down before they are sent

// The rectangle around everything painted in red
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

export async function run() {
  if (state.busy) return;
  stopCompare();
  const b = strokeBounds();
  if (!b) return mascot.say("empty_mask");

  // 1. Crop around the selection + a margin, so the AI sees the surroundings
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
    // 2. Send the crop and the mask to the server
    const fd = new FormData();
    fd.append("image", await toBlob(imgCrop), "crop.png");
    fd.append("mask", await toBlob(maskCrop), "mask.png");
    const res = await api("/api/inpaint", fd);
    if (!res.ok) throw await serverError(res);
    const engine = res.headers.get("X-Engine");
    const out = await createImageBitmap(await res.blob());

    // 3. Paste the result, but only where the user painted (+ soft edge)
    const patch = canvasOf(w, h), pctx = patch.getContext("2d");
    pctx.imageSmoothingQuality = "high";
    pctx.drawImage(out, 0, 0, w, h);
    pctx.globalCompositeOperation = "destination-in";
    pctx.filter = `blur(${Math.max(2, 5 / scale)}px)`;
    const soft = canvasOf(w, h), sctx = soft.getContext("2d");
    for (let i = 0; i < 3; i++) sctx.drawImage(maskCanvas, x, y, w, h, 0, 0, w, h); // slightly thicker mask
    pctx.drawImage(soft, 0, 0);
    out.close();

    // 4. Remember the piece before and after, so Undo can switch between them
    const before = await createImageBitmap(imageCanvas, x, y, w, h);
    ictx.drawImage(patch, x, y);
    const after = await createImageBitmap(imageCanvas, x, y, w, h);

    state.undo.push({ type: "inpaint", x, y, before, after, strokes: state.strokes });
    state.redo = []; state.strokes = [];
    redrawMask();
    mascot.say(engine === "lama" ? "done" : "done_basic", { alert: false });
  } catch (e) {
    mascot.say(e.code in MESSAGES ? e.code : "server", { retryAfter: e.retryAfter });
  } finally {
    setBusy(false);
  }
}
$("#goBtn").addEventListener("click", run);

// While the AI works, the buttons are locked and a spinner is shown
function setBusy(on) {
  state.busy = on;
  $("#busy").hidden = !on;
  updateButtons();
}
