# backend/database/init_admin_db.py
import asyncio
import os
import sys
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func

# Добавляем корневую директорию проекта в sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, root_dir)

# Импортируем модели и настройки БД
try:
    from backend.database.user_db import engine, AsyncSessionLocal, Admin, Base
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
    print(f"Ошибка: Не найдены переменные окружения для администраторов: {', '.join(missing_emails)}")
    print("Устанавливаем значения по умолчанию...")
    # Значения по умолчанию, если переменные окружения не найдены
    ADMIN_EMAILS = ["admin@example.com"]
    ADMIN_PASSWORD = "MoscowMellows108108108"

async def initialize_admins():
    print("Начало инициализации администраторов...")
    async with AsyncSessionLocal() as session:
        async with session.begin():
            for email in ADMIN_EMAILS:
                if not email:
                    continue
                
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
                    print(f"Добавлен новый администратор: {email}")
                else:
                    print(f"Администратор {email} уже существует.")

        # Коммит транзакции происходит автоматически при выходе из `async with session.begin():`
        print("Транзакция успешно завершена.")

    # Закрываем соединение движка после завершения работы
    await engine.dispose()
    print("Соединение с БД закрыто.")

if __name__ == "__main__":
    try:
        asyncio.run(initialize_admins())
        print("Инициализация администраторов успешно завершена.")
    except Exception as e:
        print(f"Ошибка во время инициализации администраторов: {e}")
        sys.exit(1)
