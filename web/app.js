/* =====================================================================
   Rootocoon – the web page starts here
   ---------------------------------------------------------------------
   The code is split into small files in the js/ folder, one per topic:

     js/state.js      shared settings, state and the two canvases
     js/guide.js      Rootocoon's speech bubbles, guide and costumes
     js/mascot.js     Rootocoon himself, drawn in SVG with all costumes
     js/upload.js     upload and file checks (size, format, corrupt)
     js/imageinfo.js  the image info line (size, aspect ratio, format)
     js/brush.js      brush, eraser and brush size
     js/history.js    undo and redo
     js/erase.js      "Erase it!" – sends the painted area to the AI
     js/compare.js    the Original button
     js/save.js       download and "New image"

   This file only adds the keyboard shortcuts and starts everything.
   ===================================================================== */
import { $, cfg, state } from "./js/state.js";
import { showView } from "./js/upload.js";
import { setSize, changeSize, setTool } from "./js/brush.js";
import { undo, redo } from "./js/history.js";
import { run } from "./js/erase.js";
import { toggleCompare } from "./js/compare.js";
import "./js/imageinfo.js";
import "./js/save.js";

// --- Keyboard shortcuts ----------------------------------------------------
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
  else if (key === "o") toggleCompare();
  else if (e.key === "[") changeSize(-1);
  else if (e.key === "]") changeSize(1);
  else if (e.key === "Enter" && !$("#goBtn").disabled) run();
});

// --- Start: ask the server for its limits, then show the upload screen -------
fetch("/api/info", { cache: "no-store" })
  .then((r) => r.json())
  .then((i) => {
    cfg.maxMb = i.max_mb; cfg.maxPixels = i.max_pixels; cfg.engine = i.engine;
    if (i.rate_per_min) cfg.ratePerMin = i.rate_per_min;
    $("#limitText").textContent = `JPG, PNG, WEBP or BMP · max ${i.max_mb} MB`;
    // Where the AI runs is only written to the browser console (F12), not shown on the page
    console.info(`Rootocoon AI: ${i.engine} on ${i.device}`);
  })
  .catch(() => console.warn("Rootocoon: the server is not responding"));

setSize(+$("#brushSize").value, false);
showView("upload");
