/* =====================================================================
   Download and "New image"
   ---------------------------------------------------------------------
   The download has the same width and height as the upload, at the best
   quality the format allows: JPG at maximum quality, or lossless PNG.
   The image is never scaled down. Only the area you erased has new pixels.
   ===================================================================== */
import { $, state, imageCanvas, maskCanvas, toBlob } from "./state.js";
import { mascot } from "./guide.js";
import { stopCompare } from "./compare.js";
import { showView } from "./upload.js";

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
  // Release everything from memory – nothing from the old image is kept
  state.undo.forEach((a) => { a.before?.close?.(); a.after?.close?.(); });
  state.redo.forEach((a) => { a.before?.close?.(); a.after?.close?.(); });
  stopCompare();
  state.undo = []; state.redo = []; state.strokes = [];
  state.original?.close?.(); state.original = null;
  for (const c of [imageCanvas, maskCanvas]) { c.width = c.height = 1; }
  mascot.hide();
  showView("upload");
});
