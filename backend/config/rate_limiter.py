from slowapi import Limiter
from slowapi.util import get_remote_address
from constants import RATE_LIMITS
from functools import wraps
from fastapi import Request

# Инициализация Limiter
limiter = Limiter(key_func=get_remote_address)

def rate_limit(action: str):
    """
    Декоратор для применения лимитов запросов на основе действия (action).
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, request: Request = None, **kwargs):
            # Получаем лимит из RATE_LIMITS или устанавливаем значение по умолчанию
            limit = RATE_LIMITS.get(action, "100/minute")  # По умолчанию 100 запросов в минуту
            # Применяем лимит
            @limiter.limit(limit)
            async def limited_func(request: Request, *args, **kwargs):
                return await func(*args, request=request, **kwargs)
            return await limited_func(request, *args, **kwargs)
        return wrapper
    return decorator