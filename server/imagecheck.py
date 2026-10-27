"""
Validation of uploaded images.

Everything happens in memory (BytesIO) - nothing is ever written to disk.
Every error has a code that the web page maps to one of Rootocoon's costumes.
"""
from io import BytesIO

from PIL import Image, ImageOps

# --- Limits (change them here) ------------------------------------------
MAX_MB = 10                      # largest allowed file size
MAX_BYTES = MAX_MB * 1024 * 1024
MAX_PIXELS = 40_000_000          # about 7700 x 5200 px - protects against "decompression bombs"
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "BMP"}

# Make Pillow refuse oversized images instead of trying to decode them
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class ImageError(Exception):
    """An error that is sent back to the web page as {"code": ...}."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def sniff_format(data: bytes) -> str | None:
    """Reads the file's "magic bytes". A file extension can lie, the content cannot."""
    if data[:3] == b"\xff\xd8\xff":
        return "JPEG"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "PNG"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"
    if data[:2] == b"BM":
        return "BMP"
    return None


def load_image(data: bytes, max_bytes: int = MAX_BYTES) -> Image.Image:
    """Validates and decodes an image. Raises ImageError if anything is wrong."""
    # --- 1. File size limit: empty files and files over 10 MB are refused ---
    if len(data) == 0:
        raise ImageError("empty", "The file is empty.")
    if len(data) > max_bytes:
        raise ImageError("too_big", f"The file is larger than {max_bytes // (1024 * 1024)} MB.", 413)

    # --- 2. Is it really an image? A video or a renamed .txt is caught here ---
    fmt = sniff_format(data)
    if fmt is None or fmt not in ALLOWED_FORMATS:
        raise ImageError("wrong_format", "The file is not an image (JPG, PNG, WEBP or BMP).", 415)

    # --- 3. Corrupt files: the whole image must open, or it is refused ---
    try:
        # 1) verify() checks the file structure
        with Image.open(BytesIO(data)) as probe:
            probe.verify()
        # 2) verify() does not decode the pixels, so we load them for real too.
        #    A truncated JPEG fails here.
        img = Image.open(BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise ImageError("wrong_format", "This image format is not supported.", 415)
        if img.width * img.height > MAX_PIXELS:
            raise ImageError("too_many_pixels", "The image has too many pixels.", 413)
        img.load()
    except ImageError:
        raise
    except Image.DecompressionBombError:
        raise ImageError("too_many_pixels", "The image has too many pixels.", 413)
    except Exception:
        raise ImageError("corrupt", "The image seems to be corrupt and cannot be opened.", 422)

    img = ImageOps.exif_transpose(img)  # rotate phone photos the right way up
    return img.convert("RGB")


def load_mask(data: bytes, size: tuple[int, int]) -> Image.Image:
    """The mask is a PNG where painted pixels have alpha > 0."""
    try:
        m = Image.open(BytesIO(data))
        if m.format != "PNG":
            raise ValueError
        m.load()
    except Exception:
        raise ImageError("bad_mask", "The selection could not be read.")
    if m.size != size:
        raise ImageError("bad_mask", "The selection has the wrong size.")
    alpha = m.convert("RGBA").getchannel("A")
    mask = alpha.point(lambda v: 255 if v > 10 else 0)
    if mask.getbbox() is None:
        raise ImageError("empty_mask", "Nothing has been selected.")
    return mask
