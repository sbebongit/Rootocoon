"""Downloads the LaMa AI model (about 200 MB) to models/big-lama.pt."""
import sys
import urllib.request
from pathlib import Path

URL = "https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt"
DEST = Path(__file__).resolve().parent / "models" / "big-lama.pt"


def progress(blocks, block_size, total):
    done = blocks * block_size
    if total > 0:
        pct = min(100, done * 100 // total)
        sys.stdout.write(f"\r  {pct:3d}%  ({done // 1_048_576} / {total // 1_048_576} MB)")
        sys.stdout.flush()


if __name__ == "__main__":
    if DEST.exists():
        print("The model is already downloaded:", DEST)
        sys.exit()
    DEST.parent.mkdir(exist_ok=True)
    tmp = DEST.with_suffix(".part")
    print("Downloading LaMa ...")
    urllib.request.urlretrieve(URL, tmp, progress)
    tmp.rename(DEST)
    print("\nDone!", DEST)
