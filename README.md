# Rootocoon 🦝

Rootocoon is a website that removes things from photos. You upload an image, paint over what you want gone, and an AI fills in what was most likely behind it – similar to Roto Brush and Content-Aware Fill in Adobe's tools. The raccoon mascot, also called Rootocoon, guides you through it and changes costume depending on what happens.

The project runs locally on your own computer. Nothing is published to the internet.

![Rootocoon start page](docs/screenshot-start.png)

## Features

| Requirement | How it is solved |
|---|---|
| Upload an image | Drag and drop, click to choose, or paste with Ctrl+V |
| Brush to select | Brush, eraser, size slider, undo/redo, clear. Works with mouse, pen and touch |
| AI fills in the background | The LaMa model guesses what was behind the object from its surroundings |
| Uses the GPU | Picks NVIDIA (CUDA) → Apple Silicon (MPS) → CPU automatically |
| Rejects non-image files | Reads the file's first bytes ("magic numbers"), so a `.txt` renamed to `.jpg` is caught |
| Rejects corrupt files | The whole image is decoded before use; truncated or broken files are refused |
| File size limit | 10 MB (change `MAX_MB` in `server/imagecheck.py`) and max 40 megapixels |
| Encrypted | HTTPS/TLS for all traffic, plus strict security headers |
| Nothing stored | Images only live in RAM, no logs, `Cache-Control: no-store` |
| Mascot with a guide | Speech bubbles, a "Skip the guide" button, click the raccoon to get help again |

### Rootocoon's costumes

![All costumes](docs/costumes.png)

| Event | Costume |
|---|---|
| Welcome | Waving |
| You are painting | Painter's beret and brush |
| File is too big | Huge belly, sweat drop and "BURP" |
| File is not an image | Detective hat and magnifying glass |
| File is corrupt | Swirly eyes and question marks |
| The AI is working | Hard hat and wrench |
| Done | Party hat and confetti |
| Nothing selected | Shrugs |
| Server error | Band-aid on the head |
| Idle for one minute | Falls asleep |

## Getting started

You need **Python 3.10 or newer** ([python.org](https://www.python.org/downloads/)). On Windows, tick **"Add python.exe to PATH"** during installation.

```bash
# 1. Install the packages
pip install -r requirements.txt

# 2. Install PyTorch (the AI engine) - pick ONE line
pip install torch --index-url https://download.pytorch.org/whl/cu121   # Windows/Linux with an NVIDIA card
pip install torch                                                       # Mac, or no NVIDIA card

# 3. Download the AI model (about 200 MB)
python download_model.py

# 4. Start the server
python run.py
```

Open **https://localhost:8443**. The first time, the browser warns about the certificate – click *Advanced → Proceed to localhost* (explained below). Stop the server with **Ctrl+C** in the terminal.

The badge in the top-right corner shows where the AI runs, e.g. `⚡ AI on NVIDIA GeForce RTX 3060`. If it says *Fallback mode*, PyTorch or the model is missing, and a simpler method with blurrier results is used instead.

## How it works

```
Browser                                      Server (Python, FastAPI)
───────                                      ────────────────────────
1. Checks size, format and whether
   the image can be opened
2. Sends the file ───── HTTPS ──────────▶  /api/check: validates again, stores nothing
3. You paint a mask
4. Cuts out the area around the mask
   and sends crop + mask ───── HTTPS ───▶  /api/inpaint: LaMa on the GPU fills it in
5. Pastes the result back with      ◀────  returns a PNG, forgets everything
   soft edges
```

**Why is the file checked twice?** The browser check gives instant feedback, but a user can get around it. A server must never trust what the browser sends, so it always checks for itself.

**Why only send a crop?** It is faster, needs less GPU memory, and lets you erase several times in a row on large images without sending the whole image each time.

**About the AI.** LaMa (*Large Mask Inpainting*, Samsung AI, 2021) is a neural network trained on millions of photos with pieces cut out. It has learned to continue patterns and structures, so grass becomes grass, the horizon stays straight and brick walls get their joints right. It uses *Fourier convolutions*, which let the model "see" the whole image at once, so it handles large areas well. It is small and fast compared to models like Stable Diffusion, and runs on a normal graphics card in under a second.

**About the encryption.** HTTPS encrypts everything between the browser and the server, so nobody on the same network can see the images. `run.py` creates its own certificate. The browser warns because no known authority signed it, but the encryption is just as strong. A real public site would use a free certificate from Let's Encrypt, and the warning would go away.

**About privacy.** Images are read into memory, processed and dropped as soon as the response has been sent. Nothing is written to disk, access logging is turned off, and the responses tell the browser not to cache them. The page loads no external fonts, scripts or trackers.

## Project structure

```
rootocoon/
├── run.py               starts the server with HTTPS
├── download_model.py    downloads the AI model
├── requirements.txt
├── server/
│   ├── app.py           web server, API and security headers
│   ├── imagecheck.py    checks size, format and corrupt files
│   └── inpaint.py       the AI (LaMa on the GPU, OpenCV as a fallback)
├── web/
│   ├── index.html
│   ├── style.css
│   ├── app.js           brush, undo, upload, talking to the server
│   ├── mascot.js        Rootocoon, drawn in SVG code with all costumes
│   └── favicon.svg
├── docs/                screenshots for this README
├── models/              big-lama.pt is downloaded here (not in git)
└── certs/               the TLS certificate is created here (not in git)
```

## Keyboard shortcuts

`B` brush · `E` eraser · `[` `]` brush size · `Ctrl+Z` undo · `Ctrl+Y` redo · `Enter` erase

## Tips for good results

- Paint a little **outside** the object and include its shadow.
- Large objects: remove them in several passes.
- The AI guesses from the surroundings. Repeating textures (grass, sky, walls, water) work best; faces or text hidden behind the object cannot be known.

## Credits

- LaMa: Suvorov et al., *Resolution-robust Large Mask Inpainting with Fourier Convolutions*, WACV 2022 (Apache 2.0)
- TorchScript export of the model: the *simple-lama-inpainting* project on GitHub
- Rootocoon mascot: drawn for this project
