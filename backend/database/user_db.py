# backend/database/user_db.py
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.schemas_enums.enums import EventStatus, MediaType, Status
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from constants import DATABASE_URL
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
)

# Создание асинхронного движка SQLAlchemy
engine = create_async_engine(DATABASE_URL, echo=True, future=True)

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

# Dependency для FastAPI
async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(init_db())