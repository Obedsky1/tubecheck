import time
import logging
from fastapi import Request, Depends, HTTPException, status
from app.routers.auth import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self):
        self.local_cache = {}

    async def check_rate_limit(self, key: str, limit: int, period: int) -> bool:
        """
        Check if the request limit is exceeded for a given key.
        Uses Redis if available, otherwise falls back to local in-memory dict.
        """
        # Try using Redis if configured
        try:
            from app.config import get_settings
            import redis
            settings = get_settings()
            if settings.REDIS_URL:
                r = redis.Redis.from_url(settings.REDIS_URL)
                current = r.get(key)
                if current is not None:
                    count = int(current)
                    if count >= limit:
                        return False
                    r.incrby(key, 1)
                else:
                    pipe = r.pipeline()
                    pipe.set(key, 1)
                    pipe.expire(key, period)
                    pipe.execute()
                return True
        except Exception as e:
            logger.warning("Redis rate limiter failed, falling back to local memory: %s", e)

        # Fallback to local memory cache
        now = time.time()
        # Clean up expired cache items
        self.local_cache = {k: v for k, v in self.local_cache.items() if v["expiry"] > now}

        if key in self.local_cache:
            entry = self.local_cache[key]
            if entry["count"] >= limit:
                return False
            entry["count"] += 1
        else:
            self.local_cache[key] = {
                "count": 1,
                "expiry": now + period
            }
        return True

rate_limiter = RateLimiter()

def RateLimit(limit: int, period: int):
    """
    FastAPI dependency creator to apply rate limits.
    Usage: Depends(RateLimit(5, 60)) limit to 5 requests per minute.
    """
    async def dependency(request: Request, current_user: User = Depends(get_current_user)):
        user_id = str(current_user.id) if current_user else "anonymous"
        endpoint = request.url.path
        key = f"rl:{user_id}:{endpoint}"
        
        allowed = await rate_limiter.check_rate_limit(key, limit, period)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum allowed is {limit} requests per {period} seconds."
            )
    return dependency
