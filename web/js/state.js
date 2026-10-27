/* =====================================================================
   Shared state
   ---------------------------------------------------------------------
   Everything the other files need to share lives here: the settings from
   the server, what the user is doing right now, and the two canvases.
   This file doesn't import anything, so every other file can import it.
   ===================================================================== */

// Short way to find an element on the page, e.g. $("#goBtn")
export const $ = (s) => document.querySelector(s);

// Limits from the server. These are defaults until /api/info answers (see app.js).
export const cfg = { maxMb: 10, maxPixels: 40_000_000, ratePerMin: 15, engine: "?" };

export const state = {
  view: "upload",          // "upload" or "edit"
  tool: "brush",           // "brush" or "eraser"
  strokes: [],             // the red selection, stored as brush strokes so undo is cheap
  undo: [], redo: [],      // history, see history.js
  original: null,          // the uploaded image, kept for the Original button
  fileType: "image/png",   // the real format of the uploaded file
  fileName: "image",       // file name without extension
  fileSize: 0,
  busy: false,             // true while the AI is working
};

// Two canvases on top of each other: the photo, and the red paint above it
export const imageCanvas = $("#imageCanvas");
export const maskCanvas = $("#maskCanvas");
export const ictx = imageCanvas.getContext("2d");
export const mctx = maskCanvas.getContext("2d");
export const wrap = $("#canvasWrap");

// Small helpers for working with canvases
export const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
export const toBlob = (c, type = "image/png", q) => new Promise((r) => c.toBlob(r, type, q));
