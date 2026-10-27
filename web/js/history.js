/* =====================================================================
   Undo and redo
   ---------------------------------------------------------------------
   Every step in the history is one of three kinds:
     stroke  – one brush or eraser stroke
     clear   – "Clear" (we remember which strokes were removed)
     inpaint – one AI removal (we remember the image piece before and after,
               and the painting, so undo goes back to just before "Erase it!")
   One click on Undo always takes back exactly one step.
   ===================================================================== */
import { $, state, ictx } from "./state.js";
import { redrawMask } from "./brush.js";
import { stopCompare } from "./compare.js";

// The history is never changed while the AI works. Earlier, pressing Undo during
// that time could make steps disappear, because the AI's answer was saved on top
// of a history that had changed in the meantime.
export function undo() {
  if (state.busy || !state.undo.length) return;
  stopCompare();
  const a = state.undo.pop();
  if (a.type === "stroke") state.strokes = state.strokes.filter((s) => s !== a.stroke);
  if (a.type === "clear") state.strokes = a.removed;
  if (a.type === "inpaint") { ictx.drawImage(a.before, a.x, a.y); state.strokes = a.strokes; }
  state.redo.push(a); redrawMask(); updateButtons();
}
export function redo() {
  if (state.busy || !state.redo.length) return;
  stopCompare();
  const a = state.redo.pop();
  if (a.type === "stroke") state.strokes = [...state.strokes, a.stroke];
  if (a.type === "clear") state.strokes = [];
  if (a.type === "inpaint") { ictx.drawImage(a.after, a.x, a.y); state.strokes = []; }
  state.undo.push(a); redrawMask(); updateButtons();
}

// Greys out the buttons that can't be used right now
export function updateButtons() {
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
