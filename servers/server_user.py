from fastapi import FastAPI
from backend.api.user_auth_routers import router as user_auth_router
from backend.config.logging_config import logger
import uvicorn

app = FastAPI(title="User Authentication API")

# Подключение роутеров
app.include_router(user_auth_router, prefix="/auth", tags=["Authentication"])

if __name__ == "__main__":
    uvicorn.run(
        "backend.server_user:app",  # Путь к FastAPI-приложению
        host="0.0.0.0",            # Доступен извне
        port=8000,                 # Стандартный порт
        reload=True,               # Автоматическая перезагрузка при изменении кода (для разработки)
        log_level="info"           # Уровень логирования Uvicorn
    )