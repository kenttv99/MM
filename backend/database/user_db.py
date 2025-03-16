import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    avatar_url = Column(String(255), nullable=True)
    telegram = Column(String(255), unique=True, nullable=False)
    whatsapp = Column(String(255), unique=True, nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связь с параметрами пользователя
    params = relationship("UserParams", uselist=False, back_populates="user")


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
    image_url = Column(String(255))  # Ссылка на обложку мероприятия
    price = Column(DECIMAL(20, 8), nullable=False)  # Цена билета
    published = Column(Boolean, default=False)  # Публикуемое событие
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    
class TicketType(Base):
    __tablename__ = "ticket_types"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    name = Column(String(255), nullable=False)  # Название типа билета (например, "Стандарт", "Премиум")
    price = Column(DECIMAL(20, 8), nullable=False)  # Цена билета
    available_quantity = Column(Integer, nullable=False)  # Количество доступных билетов данного типа
    sold_quantity = Column(Integer, default=0)  # Количество проданных билетов данного типа
    free_registration = Column(Boolean, default=False)  # Возможность бесплатной регистрации
    
class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"))
    ticket_type_id = Column(Integer, ForeignKey("ticket_types.id"))
    ticket_number = Column(String(255))  # Номер билета
    payment_status = Column(Boolean, default=False)  # Статус оплаты
    amount_paid = Column(DECIMAL(20, 8))  # Сумма платежа
    status = Column(String(30), default='pending')  # Статусы: pending, approved, rejected
    submission_time = Column(TIMESTAMP, default=datetime.utcnow)
    
class Media(Base):
    __tablename__ = "medias"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))  # К какому мероприятию относится
    user_uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Кто загрузил (обычный пользователь)
    admin_uploaded_by_id = Column(Integer, ForeignKey("admins.id"), nullable=True)  # Кто загрузил (администратор)
    type = Column(Enum('photo', 'video'), nullable=False)  # Тип медиафайла
    url = Column(String(255), nullable=False)  # Ссылка на файл
    caption = Column(String(500))  # Описание файла
    approved = Column(Boolean, default=False)  # Прошёл ли модерацию
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)


async def init_db():
    """
    Инициализация базы данных.
    """
    try:
        async with engine.begin() as conn:
            # Создание всех таблиц
            await conn.run_sync(Base.metadata.create_all)
            print("Таблицы успешно созданы.")
    except Exception as e:
        print(f"Произошла ошибка при инициализации базы данных: {e}")
    finally:
        await engine.dispose()


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