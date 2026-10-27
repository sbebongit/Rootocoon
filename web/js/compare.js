/* =====================================================================
   The Original button – compare with the uploaded image
   ---------------------------------------------------------------------
   A toggle: click once to see the uploaded image, click again to go back.
   Any other action (painting, undo, erase…) also switches back automatically.
   ===================================================================== */
import { $, state, imageCanvas, wrap, canvasOf } from "./state.js";

const orig = canvasOf(1, 1);   // a canvas with the original, laid on top while comparing
orig.className = "orig";
const cmp = $("#compareBtn");
let comparing = false;

export function startCompare() {
  if (!state.original || state.busy) return;
  orig.width = imageCanvas.width; orig.height = imageCanvas.height;
  orig.getContext("2d").drawImage(state.original, 0, 0);
  wrap.appendChild(orig); wrap.classList.add("comparing");
  comparing = true;
  cmp.classList.add("active"); cmp.setAttribute("aria-pressed", "true");
}
export function stopCompare() {
  if (!comparing) return;
  orig.remove(); wrap.classList.remove("comparing");
  comparing = false;
  cmp.classList.remove("active"); cmp.setAttribute("aria-pressed", "false");
}
export const toggleCompare = () => (comparing ? stopCompare() : startCompare());

cmp.addEventListener("click", toggleCompare);
