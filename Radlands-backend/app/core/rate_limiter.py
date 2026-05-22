import time
from collections import defaultdict
from fastapi import HTTPException, Request

class _RateLimiter:
    def __init__(self, max_calls: int, period_seconds: float):
        self.max_calls = max_calls
        self.period = period_seconds
        self._calls: dict[str, list[float]] = defaultdict(list)

    def __call__(self, request: Request) -> None:
        now = time.monotonic()
        ip = request.client.host if request.client else "unknown"
        bucket = self._calls[ip]
        self._calls[ip] = [t for t in bucket if now - t < self.period]
        if len(self._calls[ip]) >= self.max_calls:
            raise HTTPException(
                status_code=429,
                detail="Too many requests — slow down, warrior.",
                headers={"Retry-After": str(int(self.period))},
            )
        self._calls[ip].append(now)

# 10 auth attempts per minute per IP
auth_rate_limit = _RateLimiter(max_calls=10, period_seconds=60)
