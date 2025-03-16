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
    
    
class UserParams(Base):
    __tablename__ = "users_parametrs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    max_card_amount = Column(DECIMAL(20, 8), nullable=False)
    max_photo_program_amount = Column(DECIMAL(20, 8), nullable=False)
    max_video_program_amount = Column(DECIMAL(20, 8), nullable=False)