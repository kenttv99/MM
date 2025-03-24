# servers/server_admin.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.event_routers import router as event_router
from backend.api.admin_auth_routers import router as admin_auth_router
from backend.api.admin_edit_routers import router as admin_edit_routers 
from backend.config.auth import get_user_or_ip_key
from backend.config.rate_limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import uvicorn
from fastapi.staticfiles import StaticFiles  # Добавляем импорт

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
app.include_router(event_router, prefix="/events", tags=["Events"])
app.include_router(admin_auth_router, prefix="/admin", tags=["Admin Authentication"])
app.include_router(admin_edit_routers, prefix="/admin_edits", tags=["Admin Edits"])

# Монтируем директорию private_media как статические файлы
app.mount("/images", StaticFiles(directory="private_media"), name="images")

if __name__ == "__main__":
    uvicorn.run(
        "servers.server_admin:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )