"""
The AI part: fills in the painted area.

The model is LaMa ("Resolution-robust Large Mask Inpainting with Fourier
Convolutions", Samsung AI, 2021). It was trained on millions of photos with
pieces cut out, and has learned to guess what "should" be there - grass
continues as grass, a wall continues as a wall, and so on. It is small
(about 200 MB) and fast, and it runs on the graphics card (GPU) if there is one.

If PyTorch or the model file is missing, OpenCV's classic algorithm
(Telea, 2004) is used as a fallback. It works for small things but looks
blurry on large areas - that is the difference between "real AI" and
plain math.
"""
import threading
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "big-lama.pt"
MAX_SIDE = 1536  # larger images are scaled down before the AI runs (saves GPU memory)

_lock = threading.Lock()  # one job at a time on the GPU
_model = None
_device = None
_torch = None


def _load():
    """Loads the model once, the first time it is needed."""
    global _model, _device, _torch
    if _model is not None or _torch is False:
        return
    try:
        import torch
    except ImportError:
        print("[AI] PyTorch not installed - using the OpenCV fallback (lower quality).")
        _torch = False
        return
    if not MODEL_PATH.exists():
        print(f"[AI] Cannot find {MODEL_PATH} - run: python download_model.py")
        _torch = False
        return

    if torch.cuda.is_available():
        _device = torch.device("cuda")          # NVIDIA graphics card
    elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        _device = torch.device("mps")           # Apple M1/M2/M3/M4
    else:
        _device = torch.device("cpu")
    _model = torch.jit.load(str(MODEL_PATH), map_location=_device).eval()
    _torch = torch
    print(f"[AI] LaMa loaded on: {_device}")


def engine_info() -> dict:
    _load()
    if _model is None:
        return {"engine": "opencv", "device": "cpu"}
    name = str(_device)
    if _device.type == "cuda":
        name = _torch.cuda.get_device_name(0)
    return {"engine": "lama", "device": name}


def _pad8(x: np.ndarray) -> np.ndarray:
    """LaMa needs width and height to be divisible by 8."""
    h, w = x.shape[:2]
    ph, pw = (-h) % 8, (-w) % 8
    pad = ((0, ph), (0, pw)) + ((0, 0),) * (x.ndim - 2)
    return np.pad(x, pad, mode="reflect")


def inpaint(image: Image.Image, mask: Image.Image) -> tuple[Image.Image, dict]:
    """image: RGB, mask: L (255 = remove). Returns a new image of the same size."""
    _load()
    t0 = time.perf_counter()
    orig_size = image.size

    img = np.asarray(image)
    m = np.asarray(mask)

    # Scale down large images
    scale = min(1.0, MAX_SIDE / max(orig_size))
    if scale < 1.0:
        new = (round(orig_size[0] * scale), round(orig_size[1] * scale))
        img = cv2.resize(img, new, interpolation=cv2.INTER_AREA)
        m = cv2.resize(m, new, interpolation=cv2.INTER_NEAREST)

    # Grow the mask a few pixels so edges and shadows around the object go too
    m = cv2.dilate((m > 127).astype(np.uint8) * 255, np.ones((7, 7), np.uint8), iterations=2)

    if _model is not None:
        out = _run_lama(img, m)
        engine = "lama"
    else:
        out = cv2.inpaint(img, m, 7, cv2.INPAINT_TELEA)
        engine = "opencv"

    # Keep the original pixels outside the selection (sharper result)
    if scale < 1.0:
        out = cv2.resize(out, orig_size, interpolation=cv2.INTER_CUBIC)
        m = cv2.resize(m, orig_size, interpolation=cv2.INTER_LINEAR)
    alpha = cv2.GaussianBlur(m, (0, 0), 2).astype(np.float32)[..., None] / 255.0
    full = np.asarray(image).astype(np.float32)
    result = (out.astype(np.float32) * alpha + full * (1 - alpha)).clip(0, 255).astype(np.uint8)

    ms = round((time.perf_counter() - t0) * 1000)
    return Image.fromarray(result), {"engine": engine, "ms": ms}


def _run_lama(img: np.ndarray, m: np.ndarray) -> np.ndarray:
    torch = _torch
    h, w = img.shape[:2]
    x = _pad8(img).astype(np.float32) / 255.0          # colours as numbers 0..1
    k = (_pad8(m) > 127).astype(np.float32)            # mask as 0 (keep) or 1 (remove)
    x_t = torch.from_numpy(x).permute(2, 0, 1)[None].to(_device)
    m_t = torch.from_numpy(k)[None, None].to(_device)
    with _lock, torch.inference_mode():
        y = _model(x_t, m_t)
    y = (y[0].permute(1, 2, 0).clamp(0, 1) * 255).byte().cpu().numpy()
    if _device.type == "cuda":
        torch.cuda.empty_cache()
    return y[:h, :w]
