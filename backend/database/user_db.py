import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.schemas_enums.enums import EventStatus, MediaType, Status
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
    
    # Обратная ссылка на пользователя
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
    
    # Связь с типами билетов
    tickets = relationship("TicketType", back_populates="event")
    
    # Связь с регистрациями на мероприятие
    registrations = relationship("Registration", back_populates="event")
    
    # Связь с медиа, относящимся к мероприятию
    medias = relationship("Media", back_populates="event")


class TicketType(Base):
    __tablename__ = "ticket_types"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String(255), nullable=False)  # Название типа билета (например, "Стандарт", "Премиум")
    price = Column(DECIMAL(20, 8), nullable=False)  # Цена билета
    available_quantity = Column(Integer, nullable=False)  # Количество доступных билетов данного типа
    sold_quantity = Column(Integer, default=0)  # Количество проданных билетов данного типа
    free_registration = Column(Boolean, default=False)  # Возможность бесплатной регистрации
    
    # Обратная связь с событием
    event = relationship("Event", back_populates="tickets")
    
    # Связь с регистрациями, использующими данный тип билета
    registrations = relationship("Registration", back_populates="ticket_type")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"))
    ticket_type_id = Column(Integer, ForeignKey("ticket_types.id"))
    ticket_number = Column(String(255))  # Номер билета
    payment_status = Column(Boolean, default=False)  # Статус оплаты
    amount_paid = Column(DECIMAL(20, 8))  # Сумма платежа
    status = Column(Enum(Status), default=Status.pending.name)  # Статусы: pending, approved, rejected
    submission_time = Column(TIMESTAMP, default=datetime.utcnow)
    
    # Обратная связь с пользователем
    user = relationship("User", back_populates="registrations")
    
    # Обратная связь с мероприятием
    event = relationship("Event", back_populates="registrations")
    
    # Обратная связь с типом билета
    ticket_type = relationship("TicketType", back_populates="registrations")


class Media(Base):
    __tablename__ = "medias"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))  # К какому мероприятию относится
    user_uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Кто загрузил (обычный пользователь)
    admin_uploaded_by_id = Column(Integer, ForeignKey("admins.id"), nullable=True)  # Кто загрузил (администратор)
    type = Column(Enum(MediaType), nullable=False)  # Тип медиафайла
    url = Column(String(255), nullable=False)  # Ссылка на файл
    caption = Column(String(500))  # Описание файла
    approved = Column(Boolean, default=False)  # Прошёл ли модерацию
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Обратная связь с мероприятием
    event = relationship("Event", back_populates="medias")
    
    # Обратная связь с пользователем, загрузившим медиа
    user_uploaded_by = relationship("User", foreign_keys=[user_uploaded_by_id], back_populates="user_medias")
    
    # Обратная связь с администратором, загрузившим медиа
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
    
    # Связь с параметрами пользователя
    params = relationship("UserParams", uselist=False, back_populates="user")
    # Связь с регистрациями пользователя
    registrations = relationship("Registration", back_populates="user")
    # Связь с медиа, загруженным пользователем
    user_medias = relationship("Media", foreign_keys=[Media.user_uploaded_by_id], back_populates="user_uploaded_by")
    activities = relationship("UserActivity", back_populates="user")
    
    notifications = relationship("Notification", back_populates="user")
    
class UserActivity(Base):
    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ip_address = Column(String(45), nullable=False)  # Поддержка IPv4 и IPv6
    cookies = Column(Text, nullable=True)  # Храним куки как текст
    user_agent = Column(Text, nullable=True)  # Информация о браузере/устройстве
    action = Column(String(50), nullable=False)  # Тип действия: register, login, access_me
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    device_fingerprint = Column(Text, nullable=True)

    user = relationship("User", back_populates="activities")
    
    # Уникальный индекс для предотвращения дубликатов
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
    
    # Связь с медиа, загруженным администратором
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
    user = relationship("User")

# Функция для инициализации базы данных
async def init_db():
    try:
        async with engine.begin() as conn:
            # Создание всех таблиц
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