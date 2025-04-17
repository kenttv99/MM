# backend/database/user_db.py
import asyncio
import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from backend.schemas_enums.enums import EventStatus, MediaType, Status
import sys
from datetime import datetime
from sqlalchemy.orm import (
    declarative_base,
    relationship,
    backref,
    selectinload
)
from contextlib import asynccontextmanager
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Boolean,
    Text,
    DECIMAL,
    TIMESTAMP,
    Enum,
    UniqueConstraint,
    text,
)
import time
from backend.config.logging_config import logger

# Настройка логирования
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# Читаем отдельные параметры из .env
DB_LOGIN = os.getenv("DB_LOGIN") # Добавил значения по умолчанию для подстраховки
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_URL")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
debug_mode = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
diagnostics_mode = debug_mode

# Проверяем, что основные переменные заданы
if not DB_PASSWORD:
    raise ValueError("Переменная окружения DB_PASSWORD не установлена!")
if not DB_NAME:
     raise ValueError("Переменная окружения DB_NAME не установлена!")

# Формируем DATABASE_URL программно
DATABASE_URL = f"postgresql+asyncpg://{DB_LOGIN}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Логируем параметры для отладки
logger.info(f"Параметры подключения: host={DB_HOST}, port={DB_PORT}, dbname={DB_NAME}, user={DB_LOGIN}")

# Отображаем URL в логе, маскируя пароль
masked_url = f"postgresql+asyncpg://{DB_LOGIN}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}"
if diagnostics_mode:
    logger.info(f"ДИАГНОСТИКА - Реальный URL подключения: {DATABASE_URL}")
else:
    logger.info(f"Подключение к базе данных с URL: {masked_url}")

# Выводим параметры URL для отладки
parts = DATABASE_URL.split('@')
if len(parts) >= 2:
    auth_part = parts[0].split('//')
    if len(auth_part) >= 2:
        auth_info = auth_part[1].split(':')
        user = auth_info[0] if len(auth_info) >= 1 else "unknown"
        
    connection_details = parts[1].split('/')
    host_port = connection_details[0].split(':')
    host = host_port[0] if len(host_port) >= 1 else "unknown"
    port = host_port[1] if len(host_port) >= 2 else "5432"  # Стандартный порт PostgreSQL
    dbname = connection_details[1] if len(connection_details) >= 2 else "unknown"
    
    logger.info(f"Параметры подключения: host={host}, port={port}, dbname={dbname}, user={user}")
else:
    # Для диагностики выводим полный URL в логи
    logger.warning(f"Неожиданный формат URL БД: {DATABASE_URL}")
    # Пробуем вывести DATABASE_URL напрямую
    logger.warning(f"Значение переменной DATABASE_URL из .env: {os.getenv('DATABASE_URL')}")

if not DATABASE_URL:
    raise ValueError("Переменная окружения DATABASE_URL не установлена!")
# --- Конец загрузки конфигурации ---

# Настройка параметров для прямого TCP соединения
connect_args = {
    "server_settings": {
        "client_encoding": "utf8"
    },
    "statement_cache_size": 0,
    "command_timeout": 60,
    "timeout": 10
}

if sys.platform.startswith("win"):
    connect_args.update({"ssl": False})
    logger.info("Применены дополнительные настройки для Windows")

# Создание асинхронного движка SQLAlchemy
engine = create_async_engine(
    DATABASE_URL,
    echo=debug_mode, # Включаем echo только если DEBUG=True
    future=True,
    pool_pre_ping=True,
    poolclass=NullPool, # Использование NullPool для Windows с asyncpg
    connect_args=connect_args,
    # Убираем isolation_level="AUTOCOMMIT", т.к. он может мешать транзакциям
)

# Базовый класс для моделей
Base = declarative_base()

# Создание асинхронной фабрики сессий
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Логируем параметры подключения безопасным способом
try:
    logger.info(f"Диагностика URL: драйвер={engine.url.drivername}, хост={engine.url.host}, порт={engine.url.port}, база={engine.url.database}, пользователь={engine.url.username}")
    if diagnostics_mode:
        logger.info(f"Настройки движка: echo={engine.echo}") # Убрал _future
        logger.info(f"Параметры соединения: {connect_args}")
except Exception as e:
    logger.error(f"Ошибка при логировании параметров движка: {str(e)}")

class UserParams(Base):
    __tablename__ = "users_params"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    max_card_amount = Column(DECIMAL(20, 8), nullable=False)
    max_photo_program_amount = Column(DECIMAL(20, 8), nullable=False)
    max_video_program_amount = Column(DECIMAL(20, 8), nullable=False)
    
    user = relationship("User", back_populates="params")

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    start_date = Column(TIMESTAMP, nullable=False)
    end_date = Column(TIMESTAMP)
    location = Column(String(255))
    image_url = Column(String(255))
    price = Column(DECIMAL(20, 8), nullable=False)
    published = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(Enum(EventStatus), default=EventStatus.draft, nullable=False)
    url_slug = Column(String(255), unique=True)
    
    tickets = relationship("TicketType", back_populates="event")
    registrations = relationship("Registration", back_populates="event")
    medias = relationship("Media", back_populates="event")

class TicketType(Base):
    __tablename__ = "ticket_types"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String(255), nullable=False)
    price = Column(DECIMAL(20, 8), nullable=False)
    available_quantity = Column(Integer, nullable=False)
    sold_quantity = Column(Integer, default=0)
    free_registration = Column(Boolean, default=False)
    
    event = relationship("Event", back_populates="tickets")
    registrations = relationship("Registration", back_populates="ticket_type")

class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"))
    ticket_type_id = Column(Integer, ForeignKey("ticket_types.id"))
    ticket_number = Column(String(255))
    payment_status = Column(Boolean, default=False)
    amount_paid = Column(DECIMAL(20, 8))
    status = Column(Enum(Status), default=Status.pending.name)
    submission_time = Column(TIMESTAMP, default=datetime.utcnow)
    cancellation_count = Column(Integer, default=0, nullable=False)
    
    user = relationship("User", back_populates="registrations")
    event = relationship("Event", back_populates="registrations")
    ticket_type = relationship("TicketType", back_populates="registrations")

class Media(Base):
    __tablename__ = "medias"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    user_uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_uploaded_by_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    type = Column(Enum(MediaType), nullable=False)
    url = Column(String(255), nullable=False)
    caption = Column(String(500))
    approved = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    event = relationship("Event", back_populates="medias")
    user_uploaded_by = relationship("User", foreign_keys=[user_uploaded_by_id], back_populates="user_medias")
    admin_uploaded_by = relationship("Admin", foreign_keys=[admin_uploaded_by_id], back_populates="admin_medias")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    avatar_url = Column(String(255), nullable=True)
    telegram = Column(String(255), unique=True, nullable=False)
    whatsapp = Column(String(255), unique=True, nullable=False)
    is_blocked = Column(Boolean, default=False)
    is_partner = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    params = relationship("UserParams", uselist=False, back_populates="user")
    registrations = relationship("Registration", back_populates="user")
    user_medias = relationship("Media", foreign_keys=[Media.user_uploaded_by_id], back_populates="user_uploaded_by")
    activities = relationship("UserActivity", back_populates="user")
    notification_views = relationship("NotificationView", back_populates="user")  # Исправленное отношение

class UserActivity(Base):
    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ip_address = Column(String(45), nullable=False)
    cookies = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)
    action = Column(String(50), nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    device_fingerprint = Column(Text, nullable=True)

    user = relationship("User", back_populates="activities")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'ip_address', 'device_fingerprint', 'action', 'created_at', name='uq_user_activity'),
    )

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    admin_medias = relationship("Media", foreign_keys=[Media.admin_uploaded_by_id], back_populates="admin_uploaded_by")

class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    is_public = Column(Boolean, default=False)

    event = relationship("Event")
    views = relationship("NotificationView", back_populates="template")

class NotificationView(Base):
    __tablename__ = "notification_views"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("notification_templates.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    fingerprint = Column(String(64), nullable=True)
    is_viewed = Column(Boolean, default=False)
    viewed_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    template = relationship("NotificationTemplate", back_populates="views")
    user = relationship("User", back_populates="notification_views")

# Функция для инициализации базы данных
async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("Таблицы успешно созданы.")
    except Exception as e:
        print(f"Произошла ошибка при инициализации базы данных: {e}")
    finally:
        await engine.dispose()

# Контекст-менеджер для получения сессии
@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

# Dependency для FastAPI (упрощенная версия)
async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    logger.info("Запрос сессии БД...")
    session = None # Инициализируем None
    try:
        async with AsyncSessionLocal() as session:
             # pool_pre_ping должен проверить соединение перед этим
             logger.info("Сессия БД получена, передается в эндпоинт.")
             yield session
             logger.info("Контекст эндпоинта завершен, сессия будет неявно закрыта.")
    except Exception as e:
        logger.error(f"Ошибка во время работы с сессией БД: {str(e)}")
        if session: # Добавим проверку на всякий случай
             try:
                 await session.rollback()
                 logger.info("Откат транзакции выполнен.")
             except Exception as rb_exc:
                 logger.error(f"Ошибка при откате транзакции: {rb_exc}")
        raise # Передаем исключение дальше
    finally:
        # async with AsyncSessionLocal() автоматически закроет сессию
        logger.info("Блок finally get_async_db - сессия должна быть закрыта.")

if __name__ == "__main__":
    asyncio.run(init_db())