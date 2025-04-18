# backend/database/init_user_db.py
import asyncio
import os
import sys

# Добавляем корневую директорию проекта в sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, root_dir)

# Импортируем модели и настройки БД
try:
    from backend.database.user_db import engine, Base
    from backend.config.logging_config import logger
except ImportError as e:
    print(f"Ошибка импорта: {e}. Убедитесь, что структура проекта верна и зависимости установлены.")
    sys.exit(1)

async def init_db():
    print("Начало создания таблиц в базе данных...")
    try:
        # Создаем все таблицы, определенные в моделях
        async with engine.begin() as conn:
            print("Удаление всех существующих таблиц...")
            await conn.run_sync(Base.metadata.drop_all)
            
            print("Создание новых таблиц...")
            await conn.run_sync(Base.metadata.create_all)
        
        print("Таблицы успешно созданы!")
        
        # Закрываем соединение с движком
        await engine.dispose()
        print("Соединение с БД закрыто.")
        
        return True
    except Exception as e:
        print(f"Ошибка при создании таблиц: {e}")
        # Закрываем соединение с движком в случае ошибки
        await engine.dispose()
        return False

# Инициализация админов отдельно вынесена в init_admin_db.py
# Можно вызвать ее после создания таблиц при необходимости
try:
    from backend.database.init_admin_db import initialize_admins
    admin_init_available = True
except ImportError:
    print("Модуль инициализации админов недоступен.")
    admin_init_available = False

async def init_all():
    # Сначала создаем таблицы
    tables_created = await init_db()
    
    if tables_created and admin_init_available:
        print("Инициализация администраторов...")
        try:
            # Затем инициализируем администраторов
            await initialize_admins()
            print("Администраторы успешно инициализированы!")
        except Exception as e:
            print(f"Ошибка при инициализации администраторов: {e}")
            return False
    
    return tables_created

if __name__ == "__main__":
    try:
        success = asyncio.run(init_all())
        if success:
            print("Инициализация базы данных успешно завершена.")
            sys.exit(0)
        else:
            print("Ошибка при инициализации базы данных.")
            sys.exit(1)
    except Exception as e:
        print(f"Необработанная ошибка во время инициализации: {e}")
        sys.exit(1)
