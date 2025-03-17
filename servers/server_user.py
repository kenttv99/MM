from fastapi import FastAPI, Request
from backend.api.user_auth_routers import router as user_auth_router
from backend.config.auth import get_user_or_ip_key
from backend.config.logging_config import logger
from backend.config.rate_limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import uvicorn



app = FastAPI(
    title="User Authentication API",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Привязываем Limiter к приложению с кастомной функцией ключа
app.state.limiter = limiter
app.state.limiter.key_func = get_user_or_ip_key
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Подключение роутеров
app.include_router(user_auth_router, prefix="/auth", tags=["Authentication"])

if __name__ == "__main__":
    uvicorn.run(
        "servers.server_user:app",  # Исправлен путь к модулю
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )