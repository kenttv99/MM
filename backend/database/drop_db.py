# backend/database/drop_db.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from backend.database.user_db import Base  # Импортируем Base
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from constants import DATABASE_URL

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