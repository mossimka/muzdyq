from __future__ import annotations

import math
import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    """Small in-process sliding-window limiter.

    For a single-container deployment this is enough and avoids storing PII.
    For multi-replica deployments, swap in Redis — see docs/ARCHITECTURE.md.
    """

    def __init__(self) -> None:
        self._windows: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def consume(self, key: str, limit: int, window_seconds: float) -> tuple[bool, int]:
        """Record one event if under the limit.

        Returns ``(allowed, retry_after_seconds)``.
        """
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = self._windows[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry = max(1, math.ceil(events[0] + window_seconds - now))
                return False, retry
            events.append(now)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()
