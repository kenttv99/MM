# backend/config/rate_limiter.py
import os
from slowapi import Limiter
from slowapi.util import get_remote_address
# Импортируем RATE_LIMITS из корневого файла constants.py
from constants import RATE_LIMITS
from functools import wraps
from fastapi import Request
from typing import Callable, Any

# Получаем хост и порт Redis из переменных окружения
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", 6379)

# Создаем URL для Redis
# Используем redis:// для простого подключения
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"

# Инициализация Limiter с использованием Redis
# Обратите внимание на storage_uri
limiter = Limiter(key_func=get_remote_address, storage_uri=REDIS_URL)

def rate_limit(action: str):
    """
    Декоратор для применения лимитов запросов на основе действия (action).
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Извлекаем request из kwargs или args
            request = kwargs.get("request")
            if not request:
                # Если request не в kwargs, ищем его в args
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            if not request:
                raise ValueError("Request object not found in arguments")

            # Получаем лимит из RATE_LIMITS или устанавливаем значение по умолчанию
            limit = RATE_LIMITS.get(action, "100/minute")  # По умолчанию 100 запросов в минуту

            # Применяем лимит с использованием request
            @limiter.limit(limit)
            async def limited_func(request: Request) -> Any:
                # Передаем request через kwargs
                kwargs["request"] = request
                return await func(*args, **kwargs)

            return await limited_func(request)

        return wrapper

    return decorator