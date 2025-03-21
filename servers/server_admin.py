from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.event_routers import router as event_router
from backend.config.auth import get_user_or_ip_key
from backend.config.rate_limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import uvicorn

app = FastAPI(
    title="Event Management API",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Настройка rate limiting
app.state.limiter = limiter
app.state.limiter.key_func = get_user_or_ip_key
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Подключение роутеров
app.include_router(event_router)

if __name__ == "__main__":
    uvicorn.run(
        "servers.server_admin:app",
        host="0.0.0.0",
        port=8001,  # Используем другой порт, чтобы не конфликтовать с server_user.py
        reload=True,
        log_level="info"
    )