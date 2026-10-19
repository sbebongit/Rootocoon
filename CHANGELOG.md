# Changelog

All notable changes to Rootocoon, newest first.

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
