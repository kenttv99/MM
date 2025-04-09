# servers/server_admin.py
from datetime import timedelta
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.api.admin_auth_routers import router as admin_auth_router
from backend.api.admin_edit_routers import router as admin_edit_routers 
from backend.config.auth import create_access_token, get_current_admin, get_user_or_ip_key
from backend.config.rate_limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.config.logging_config import logger
import uvicorn
from datetime import datetime, timedelta  # Добавлен импорт для datetime и timedelta
from authlib.jose import jwt  # Добавлен импорт для jwt
from constants import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY  # Добавлен импорт для SECRET_KEY
from fastapi.staticfiles import StaticFiles
from fastapi.routing import APIRoute

from backend.database.user_db import AsyncSessionLocal, get_async_db
from constants import ACCESS_TOKEN_EXPIRE_MINUTES  # Добавляем импорт

app = FastAPI(
    title="Event Management API",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В режиме разработки разрешаем любой origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Refresh-Token", "Content-Type", "Authorization"],
)

@app.middleware("http")
async def refresh_token_middleware(request: Request, call_next):
    # Логируем запрос для отладки
    logger.info(f"Admin server received request: {request.method} {request.url.path}")
    
    response = await call_next(request)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        # Создаем сессию вручную
        db = AsyncSessionLocal()
        try:
            payload = jwt.decode(token, SECRET_KEY)
            exp = payload.get("exp")
            current_time = datetime.utcnow().timestamp()
            # Обновляем токен, только если осталось менее 5 минут
            if exp - current_time < 300:  # 300 секунд = 5 минут
                user = await get_current_admin(token, db)  # Исправлено на get_current_user
                new_token = await create_access_token(
                    data={"sub": user.email},
                    session=db,
                    expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                )
                response.headers["X-Refresh-Token"] = new_token
        except Exception as e:
            logger.error(f"Error in token refresh middleware: {str(e)}")
            # Если токен недействителен, ничего не добавляем
            pass
        finally:
            # Закрываем сессию вручную
            await db.close()
    
    return response

# Настройка rate limiting
app.state.limiter = limiter
app.state.limiter.key_func = get_user_or_ip_key
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Подключение роутеров
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