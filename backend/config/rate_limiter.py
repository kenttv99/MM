from slowapi import Limiter
from slowapi.util import get_remote_address
from constants import RATE_LIMITS
from functools import wraps
from fastapi import Request
from typing import Callable, Any

# Инициализация Limiter
limiter = Limiter(key_func=get_remote_address)

def rate_limit(action: str):
    """
    Декоратор для применения лимитов запросов на основе действия (action).
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Получаем лимит из RATE_LIMITS или устанавливаем значение по умолчанию
            limit = RATE_LIMITS.get(action, "100/minute")  # По умолчанию 100 запросов в минуту
            
            # Находим объект Request в аргументах
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if 'request' in kwargs:
                request = kwargs['request']
            
            if not request:
                # Если request не найден в аргументах, создаем заглушку
                # или используем другие методы для получения информации о запросе
                from starlette.datastructures import Headers
                from starlette.types import Scope
                
                # Создаем минимальную заглушку для Request
                class RequestStub(Request):
                    def __init__(self):
                        self.scope = {"type": "http", "headers": []}
                        self.headers = Headers(raw=self.scope.get("headers", []))
                        self.client = type('obj', (object,), {'host': '127.0.0.1'})
                
                request = RequestStub()
            
            # Применяем лимит с использованием request
            @limiter.limit(limit)
            async def limited_func(request: Request) -> Any:
                # Передаем все оригинальные аргументы в функцию
                return await func(*args, **kwargs)
            
            return await limited_func(request)
        
        return wrapper
    
    return decorator