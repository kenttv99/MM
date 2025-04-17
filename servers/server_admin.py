# servers/server_admin.py
import os
from dotenv import load_dotenv, find_dotenv
env_path = find_dotenv()
if not env_path:
    print("ERROR: Не удалось найти файл .env!")
else:
    print(f"Найден .env файл: {env_path}")
    load_dotenv(dotenv_path=env_path)
    print("Переменные окружения из .env загружены.")

# Проверка, что переменная загрузилась (для отладки)
db_password_value = os.getenv('DB_PASSWORD')
print(f"DEBUG: DB_PASSWORD загружена? {'Да' if db_password_value else 'Нет'}")
if db_password_value:
    print(f"DEBUG: DB_PASSWORD={db_password_value[:3]}***")

import sys
import asyncio

# На Windows использовать SelectorEventLoopPolicy для совместимости с asyncpg
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from dotenv import load_dotenv
load_dotenv()
import os # Добавляю os
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
# Удаляю импорты из constants (обратите внимание на дублирующий импорт ACCESS_TOKEN_EXPIRE_MINUTES)
# from constants import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY  
from fastapi.staticfiles import StaticFiles
from fastapi.routing import APIRoute

from backend.database.user_db import AsyncSessionLocal, get_async_db
# from constants import ACCESS_TOKEN_EXPIRE_MINUTES  # Удаляю дублирующий импорт

# --- Загрузка конфигурации из .env --- 
# Предполагается, что load_dotenv() вызывается где-то при старте приложения
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES_STR = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

# Проверка критических переменных
if not SECRET_KEY:
    raise ValueError("Переменная окружения SECRET_KEY не установлена!")

try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(ACCESS_TOKEN_EXPIRE_MINUTES_STR)
except ValueError:
    logger.error(f"Неверное значение для ACCESS_TOKEN_EXPIRE_MINUTES: {ACCESS_TOKEN_EXPIRE_MINUTES_STR}. Используется значение по умолчанию 30.")
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
# --- Конец загрузки конфигурации ---

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
    logger.info(f"Request headers: Authorization={request.headers.get('Authorization')[:20] + '...' if request.headers.get('Authorization') else 'None'}")
    
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