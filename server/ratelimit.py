"""
Rate limiting: how many requests one visitor may send in a period of time.

Without a limit, one person (or a script) could send thousands of images per
minute. The server would spend all its time on them, the site would become
slow or crash for everyone else, and on a paid server that work costs money.

Visitors are told apart by their IP address. The addresses are only kept in
memory for as long as the time window (at most an hour) and are never written
to disk or logged.
"""
import threading
import time
from collections import deque


class RateLimiter:
    """Allows at most `limit` requests per `window` seconds for each visitor."""

    def __init__(self, limit: int, window: float):
        self.limit = limit
        self.window = window
        self._hits: dict[str, deque] = {}   # IP address -> times of recent requests
        self._lock = threading.Lock()
        self._last_sweep = 0.0

    def allow(self, key: str, now: float | None = None) -> tuple[bool, int]:
        """Returns (allowed, seconds to wait before trying again)."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            # Forget requests that are older than the window ("sliding window")
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = int(self.window - (now - hits[0])) + 1
                return False, retry_after
            hits.append(now)
            self._sweep(now)
            return True, 0

    def _sweep(self, now: float) -> None:
        """Now and then, remove visitors we haven't heard from, so memory stays small."""
        if now - self._last_sweep < self.window:
            return
        self._last_sweep = now
        idle = [k for k, h in self._hits.items() if not h or now - h[-1] >= self.window]
        for k in idle:
            del self._hits[k]
