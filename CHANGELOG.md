# Changelog

All notable changes to Rootocoon, newest first.

## 2026-10-21

### Added
- Upload limit: each visitor can erase up to 15 images a minute and 150 an hour, and at most 3 images are processed at the same time. This stops a single visitor or script from keeping the server busy. Rootocoon explains the limit in the guide, and tells you how long to wait when it is reached.

### Changed
- New greeting: "Hi! I'm Rootocoon. Other raccoons raid trash cans - I raid photos. Show me what you want gone, and I'll snatch it right out."
- The guide explains how to change the brush size (- and +, or Ctrl + drag) and how to use the Eraser to wipe away red paint.
- The guide starts on every visit. "Skip the guide" only applies to the current visit, and nothing is saved in the browser.
- Speech bubbles no longer contain emojis.
- Uploads are always kept in memory, never in temporary files on disk.
- The README describes Rootocoon as a web app that runs on your own computer or on a server such as AWS EC2.

## 2026-10-19

### Added
- Image info above the image: file name, width and height in pixels, aspect ratio (for example 16:9 landscape), file size and format (#1).
- "Save as" option: JPG at maximum quality, or lossless PNG. Downloads always keep the same width and height as the uploaded image (#2).
- Brush size can now be changed (#3):
  - Hold Ctrl (Cmd on Mac) and drag on the image, like the Roto Brush in After Effects: right or up makes the brush bigger, left or down makes it smaller. The circle and its size in px are shown while dragging.
  - A labelled brush size control in the toolbar with - and + buttons, a slider and the size in pixels, plus a preview circle on the image.
  - The brush goes from 2 to 200 px, so small objects are easier to select.

### Fixed
- JPG downloads were saved at 95% quality, losing a little detail every time. They are now saved at maximum quality (#2).
- On narrow windows the toolbar hid all its labels, leaving unlabelled icons and a slider with no name. Labels now stay visible and the toolbar wraps onto two rows instead (#3).

### Changed
- Plain background around the image instead of a checkered pattern, which looked like dark bars in dark mode.

## 2026-10-16 - Initial version

- Upload an image, paint over an object and let the LaMa model fill in the background.
- File checks: wrong format, corrupt files and files over 10 MB are rejected.
- HTTPS encryption, nothing stored on the server.
- Rootocoon mascot with a guide and costumes for different events.

Fixed during the first round of testing:
- Undo could lose steps when pressed while the AI was working, and Enter on a focused button could trigger two actions at once.
- The Original button had to be held down and only flashed when clicked. It is now a toggle.
- Text on an active toolbar button became invisible when hovered.
