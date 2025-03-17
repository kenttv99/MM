from sqlalchemy.ext.asyncio import AsyncSession
from backend.database.user_db import User  # Оставляем только User
from sqlalchemy.future import select
from passlib.context import CryptContext
from typing import Optional
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, status

# Контекст для хэширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Секретный ключ и алгоритм для JWT
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

async def create_user(session: AsyncSession, fio: str, email: str, password: str, telegram: str, whatsapp: str) -> User:
    """Создание нового пользователя с хэшированием пароля."""
    password_hash = pwd_context.hash(password)
    new_user = User(fio=fio, email=email, password_hash=password_hash, telegram=telegram, whatsapp=whatsapp)
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return new_user

async def get_user_by_username(session: AsyncSession, email: str) -> Optional[User]:
    """Получение пользователя по email."""
    result = await session.execute(select(User).where(User.email == email))
    return result.scalars().first()

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Генерация JWT-токена."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str, session: AsyncSession) -> User:
    """Проверка токена и получение текущего пользователя."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await get_user_by_username(session, email)
    if user is None:
        raise credentials_exception
    return user