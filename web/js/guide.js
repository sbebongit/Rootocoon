/* =====================================================================
   Rootocoon the raccoon – speech bubbles, guide and costumes
   ---------------------------------------------------------------------
   GUIDES   = the step-by-step guide shown on each screen
   MESSAGES = what Rootocoon says when something happens (an error, done…)
   Each line is [costume, text]. The costumes are drawn in mascot.js.
   {MB}, {MP}, {RATE} and {WAIT} are filled in with the real numbers.
   ===================================================================== */
import { raccoonSVG } from "./mascot.js";
import { $, cfg, state } from "./state.js";

export const GUIDES = {
  upload: [
    ["hello", "Hi! I'm <b>Rootocoon</b>. Other raccoons raid trash cans – I raid photos. Show me what you want gone, and I'll snatch it right out."],
    ["talk", "Start by <b>dragging an image</b> into the box, or click to choose one. JPG, PNG, WEBP or BMP, max {MB} MB."],
    ["talk", "Don't worry about uploading: everything is sent <b>encrypted</b> (HTTPS) and your image only lives in memory while I work. <b>Nothing is stored.</b>"],
  ],
  edit: [
    ["painter", "Nice! Now <b>paint over</b> whatever you want gone. Cover all of it – and its shadow too, if it has one."],
    ["talk", "Change the <b>brush size</b> with <b>−</b> and <b>+</b>, or hold <b>Ctrl</b> and drag on the image: right makes it bigger, left smaller."],
    ["talk", "Painted too much? Click the <b>Eraser</b> in the toolbar, then paint over the red to wipe it away. It only removes the red paint, never your photo. Click <b>Brush</b> to paint again."],
    ["talk", "Then press <b>Erase it!</b> and the AI guesses what was behind it. You can run it several times, and press <b>Original</b> to compare with the image you uploaded."],
    ["talk", "Heads up: I'm just a little raccoon with a little brain. I can handle about <b>{RATE} photos a minute</b> before I get overwhelmed."],
  ],
};

// The keys match the error codes the server sends back (see server/imagecheck.py)
export const MESSAGES = {
  too_big: ["stuffed", "<b>Burp!</b> That file was way too big – I can't eat more than <b>{MB} MB</b>. Try a smaller image, or shrink it first."],
  too_many_pixels: ["stuffed", "Phew… so many pixels! The image is bigger than <b>{MP} megapixels</b> and won't fit in my belly. Shrink it a bit and try again."],
  wrong_format: ["detective", "Hmm… I've investigated this file and it is <b>not an image</b>! I only eat JPG, PNG, WEBP and BMP."],
  corrupt: ["confused", "Huh… what? This file <i>looks</i> like an image but won't open. It seems to be <b>corrupt</b> – broken or only half downloaded."],
  empty: ["confused", "This file is… empty? There's nothing in it to look at."],
  empty_mask: ["shrug", "You haven't painted anything yet! Paint over what you want gone, then press the button."],
  bad_mask: ["confused", "Something went wrong with the selection. Try clearing it and painting again."],
  network: ["hurt", "Ouch! I can't reach the server. Is it running? Try again in a moment."],
  server: ["hurt", "Ouch, something broke in the engine room. Try again – or try another image."],
  working: ["working", "Working… I'm looking at the surroundings and rebuilding what was behind it."],
  rate_limited: ["sleepy", "Phew, too much work! My little raccoon brain needs a breather. Try again in <b>{WAIT}</b>."],
  server_busy: ["working", "My paws are full with other people's photos right now! Give me a few seconds and try again."],
  done: ["party", "<b>Ta-da!</b> Gone! Does something look odd? Press Undo, paint a little wider and run it again."],
  done_basic: ["party", "<b>Ta-da!</b> Done! (Psst – the server is using my simple fallback method right now. Install the AI model for much better results, see the README.)"],
};

// The guide starts on every visit. "Skip the guide" only lasts for this visit:
// nothing is saved in the browser, so opening the site again starts the guide again.
const visit = { skipped: false, seen: {} };

export const mascot = (() => {
  const btn = $("#mascotBtn"), bubble = $("#bubble"), text = $("#bubbleText");
  const next = $("#nextBtn"), skip = $("#skipBtn");
  let queue = [], current = "talk", idleTimer = 0, onClose = null;

  let wait = "a minute";
  const fill = (s) => s.replace("{MB}", cfg.maxMb).replace("{MP}", Math.round(cfg.maxPixels / 1e6))
    .replace("{RATE}", cfg.ratePerMin).replace("{WAIT}", wait);

  // Change outfit, with a little "pop" animation
  function costume(name, pop = true) {
    if (name === current && btn.innerHTML) return;
    current = name;
    btn.innerHTML = raccoonSVG(name);
    if (pop) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
  }
  // Show one speech bubble
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
  // Start a guide: show the lines one at a time, "Next" moves on
  function guide(steps) {
    queue = steps.slice();
    step();
  }
  function step() {
    const s = queue.shift();
    if (!s) return hide();
    show(s, { guide: true, last: queue.length === 0 });
  }
  // Say one message from MESSAGES, e.g. say("too_big")
  function say(key, opts = {}) {
    queue = [];
    // How long to wait, in words, when the server says "too many requests"
    const sec = opts.retryAfter;
    const min = Math.ceil(sec / 60);
    wait = !sec ? "a minute" : sec < 90 ? `${sec} seconds` : `${min} ${min === 1 ? "minute" : "minutes"}`;
    show(MESSAGES[key], { alert: opts.alert ?? true, buttons: opts.buttons ?? true });
  }
  // Fall asleep after a minute without anything happening
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (bubble.hidden) costume("sleepy"); }, 60_000);
  }

  next.addEventListener("click", () => (queue.length ? step() : hide()));
  skip.addEventListener("click", () => { visit.skipped = true; hide(); });
  // Clicking the raccoon shows the guide for the current screen again
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

// Start the guide the first time a screen is shown during this visit
export function autoGuide(view) {
  if (visit.skipped || visit.seen[view]) return;
  visit.seen[view] = true;
  mascot.guide(GUIDES[view]);
}
