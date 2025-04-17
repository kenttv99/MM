# backend/database/init_admin_db.py
import asyncio
import os
import sys
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from dotenv import load_dotenv

# Добавляем корневую директорию проекта в sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, root_dir)

# Загружаем переменные окружения из .env
dotenv_path = os.path.join(root_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
    print(".env файл загружен.")
else:
    print("ВНИМАНИЕ: .env файл не найден!")
    sys.exit(1)

# Импортируем модели и настройки БД ПОСЛЕ добавления пути и загрузки .env
# Это гарантирует, что user_db сможет прочитать переменные окружения
try:
    from backend.database.user_db import engine, AsyncSessionLocal, Admin, Base
    from backend.config.logging_config import logger # Используем общий логгер
except ImportError as e:
     print(f"Ошибка импорта: {e}. Убедитесь, что структура проекта верна и зависимости установлены.")
     sys.exit(1)

# Контекст для хэширования паролей (должен совпадать с auth.py)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Данные администраторов из .env
ADMIN_EMAILS = [
    os.getenv(f"ADMIN_EMAIL_{i}") for i in range(1, 6)
]
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Проверяем, что все данные загружены
if not all(ADMIN_EMAILS) or not ADMIN_PASSWORD:
    missing_emails = [f"ADMIN_EMAIL_{i+1}" for i, email in enumerate(ADMIN_EMAILS) if not email]
    if not ADMIN_PASSWORD:
        missing_emails.append("ADMIN_PASSWORD")
    logger.error(f"Ошибка: Не найдены переменные окружения для администраторов: {', '.join(missing_emails)}")
    sys.exit(1)

async def initialize_admins():
    logger.info("Начало инициализации администраторов...")
    async with AsyncSessionLocal() as session:
        async with session.begin():
            for email in ADMIN_EMAILS:
                # Проверяем, существует ли администратор
                result = await session.execute(select(Admin).filter(Admin.email == email))
                existing_admin = result.scalars().first()

                if not existing_admin:
                    # Если администратор не существует, создаем его
                    password_hash = pwd_context.hash(ADMIN_PASSWORD)

                    # Генерируем ФИО из email (можно изменить логику при необходимости)
                    fio = email.split('@')[0].replace('_', ' ').replace('.', ' ').title()

                    # Получаем текущее время из базы данных для created_at и updated_at
                    db_time_result = await session.execute(select(func.now()))
                    now = db_time_result.scalar_one()

                    new_admin = Admin(
                        fio=fio,
                        email=email,
                        password_hash=password_hash,
                        created_at=now.replace(tzinfo=None), # Убираем таймзону, если она есть
                        updated_at=now.replace(tzinfo=None)
                    )
                    session.add(new_admin)
                    logger.info(f"Добавлен новый администратор: {email}")
                else:
                    logger.info(f"Администратор {email} уже существует.")

        # Коммит транзакции происходит автоматически при выходе из `async with session.begin():`
        logger.info("Транзакция успешно завершена.")

    # Закрываем соединение движка после завершения работы
    await engine.dispose()
    logger.info("Соединение с БД закрыто.")

if __name__ == "__main__":
    try:
        asyncio.run(initialize_admins())
        logger.info("Инициализация администраторов успешно завершена.")
    except Exception as e:
        logger.error(f"Ошибка во время инициализации администраторов: {e}")
        sys.exit(1)
