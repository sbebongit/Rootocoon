"""
Rootocoon - the web server.

Privacy:
  * Images are only held in RAM and are gone once the response is sent.
    Nothing is written to disk: no database, no logs of image content.
  * The server runs over HTTPS (TLS), so all traffic is encrypted - see run.py.
  * No external scripts, fonts or trackers: the page only talks to this server.

Protection against overload (so nobody can keep the server busy):
  * Each visitor can only send a limited number of images per minute and per hour
    (see ratelimit.py).
  * At most MAX_JOBS images are processed or waiting at the same time.
"""
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.formparsers import MultiPartParser

import inpaint
from imagecheck import MAX_BYTES, MAX_MB, MAX_PIXELS, ImageError, load_image, load_mask
from ratelimit import RateLimiter

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
MAX_REQUEST_BYTES = MAX_BYTES * 2 + 1_048_576   # image + mask + 1 MB for form overhead

# --- Limits per visitor (IP address) -------------------------------------
# A person erases something every 10-20 seconds at most, so these are generous
# for people but stop a script from hammering the server.
RATE_PER_MIN = 15
LIMITS = {
    "/api/inpaint": [RateLimiter(RATE_PER_MIN, 60), RateLimiter(150, 3600)],  # 15 a minute, 150 an hour
    "/api/check":   [RateLimiter(20, 60), RateLimiter(200, 3600)],            # uploads
}
MAX_JOBS = 3      # AI jobs running or waiting at once; more than that -> "busy, try again"
_jobs = 0

# By default, uploads over 1 MB are buffered in a temporary file on disk.
# Raise that limit so uploads always stay in memory and nothing touches the disk.
MultiPartParser.spool_max_size = MAX_REQUEST_BYTES

app = FastAPI(title="Rootocoon", docs_url=None, redoc_url=None, openapi_url=None)


def client_ip(request: Request) -> str:
    # The address the connection really comes from. Headers like X-Forwarded-For
    # are not trusted, because anyone can fake them to get around the limits.
    return request.client.host if request.client else "unknown"


# --- Runs on every request: size and rate limits, then security headers ------
@app.middleware("http")
async def protect(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and request.method == "POST":
        # 1. Stop oversized requests before we even read them
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_REQUEST_BYTES:
            return JSONResponse({"code": "too_big", "message": f"The file is larger than {MAX_MB} MB."}, 413)
        # 2. Has this visitor sent too many images lately?
        for limiter in LIMITS.get(path, []):
            ok, retry_after = limiter.allow(client_ip(request))
            if not ok:
                return JSONResponse(
                    {"code": "rate_limited", "message": "Too many images. Please wait a moment.",
                     "retry_after": retry_after},
                    429, headers={"Retry-After": str(retry_after)},
                )

    resp = await call_next(request)
    resp.headers["Strict-Transport-Security"] = "max-age=31536000"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; "
        "script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; "
        "frame-ancestors 'none'"
    )
    if request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"  # the browser must not keep the images either
    return resp


@app.exception_handler(ImageError)
async def image_error(_: Request, exc: ImageError):
    return JSONResponse({"code": exc.code, "message": exc.message}, exc.status)


async def read_limited(f: UploadFile) -> bytes:
    """Reads the upload but stops as soon as it gets too big."""
    data = await f.read(MAX_BYTES + 1)
    await f.close()
    if len(data) > MAX_BYTES:
        raise ImageError("too_big", f"The file is larger than {MAX_MB} MB.", 413)
    return data


# --- API ------------------------------------------------------------------
@app.get("/api/info")
async def info():
    data = await run_in_threadpool(inpaint.engine_info)
    return {**data, "max_mb": MAX_MB, "max_pixels": MAX_PIXELS, "rate_per_min": RATE_PER_MIN}


@app.post("/api/check")
async def check(image: UploadFile):
    """Checks the original file (size, format, corrupt). Stores nothing."""
    data = await read_limited(image)
    img = await run_in_threadpool(load_image, data)
    w, h = img.size
    del data, img
    return {"ok": True, "width": w, "height": h}


@app.post("/api/inpaint")
async def do_inpaint(image: UploadFile, mask: UploadFile):
    """Receives an image crop + selection, returns the filled-in PNG."""
    global _jobs
    if _jobs >= MAX_JOBS:
        raise ImageError("server_busy", "The server is busy. Try again in a few seconds.", 503)
    _jobs += 1
    try:
        img_bytes = await read_limited(image)
        mask_bytes = await read_limited(mask)

        def work():
            img = load_image(img_bytes)
            m = load_mask(mask_bytes, img.size)
            out, meta = inpaint.inpaint(img, m)
            buf = BytesIO()
            out.save(buf, "PNG", compress_level=1)
            return buf.getvalue(), meta

        png, meta = await run_in_threadpool(work)
        del img_bytes, mask_bytes
    finally:
        _jobs -= 1
    return Response(
        png,
        media_type="image/png",
        headers={"X-Engine": meta["engine"], "X-Time-Ms": str(meta["ms"])},
    )


# --- The web page -------------------------------------------------------------
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
