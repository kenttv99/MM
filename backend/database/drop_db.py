# backend/database/drop_db.py
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from backend.database.user_db import Base  # Импортируем Base
import sys

# --- Загрузка конфигурации из .env --- 
# Предполагается, что load_dotenv() вызывается где-то при старте приложения
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("Переменная окружения DATABASE_URL не установлена!")
# --- Конец загрузки конфигурации ---

# Создаем асинхронный движок
engine = create_async_engine(DATABASE_URL, echo=True, future=True)

async def drop_tables():
    async with engine.begin() as conn:
        # Отражаем текущую структуру базы через run_sync
        await conn.run_sync(Base.metadata.reflect)
        # Удаляем все таблицы через run_sync
        await conn.run_sync(Base.metadata.drop_all)

if __name__ == "__main__":
    asyncio.run(drop_tables())
    print("Все таблицы успешно удалены.")