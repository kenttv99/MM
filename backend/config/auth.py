import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database.user_db import User, UserActivity, Admin, get_async_db
from sqlalchemy.future import select
from sqlalchemy.sql import func, text
from passlib.context import CryptContext
from typing import Optional
from authlib.jose import jwt
from authlib.jose.errors import JoseError
from datetime import datetime, timedelta
from fastapi import HTTPException, Request, status
from backend.config.logging_config import logger
from constants import SECRET_KEY, ALGORITHM

# Контекст для хэширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_device_fingerprint(request: Request) -> str:
    """Генерация фингерпринта устройства на основе заголовков запроса."""
    ip_address = request.headers.get("X-Forwarded-For", request.client.host)
    user_agent = request.headers.get("User-Agent", "Unknown")
    cookies = "; ".join([f"{key}={value}" for key, value in request.cookies.items()]) if request.cookies else None
    accept_language = request.headers.get("Accept-Language", "")
    accept_encoding = request.headers.get("Accept-Encoding", "")
    
    fingerprint_data = f"{ip_address}{user_agent}{cookies or ''}{accept_language}{accept_encoding}"
    return hashlib.sha256(fingerprint_data.encode("utf-8")).hexdigest()

async def create_user(session: AsyncSession, fio: str, email: str, password: str, telegram: str, whatsapp: str) -> User:
    """Создание нового пользователя с хэшированием пароля."""
    # Получаем текущее время из базы данных
    result = await session.execute(select(func.now()))
    now = result.scalar()

    password_hash = pwd_context.hash(password)
    new_user = User(
        fio=fio,
        email=email,
        password_hash=password_hash,
        telegram=telegram,
        whatsapp=whatsapp,
        created_at=now.replace(tzinfo=None),
        updated_at=now.replace(tzinfo=None)
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return new_user

async def get_user_by_username(session: AsyncSession, email: str) -> Optional[User]:
    """Получение пользователя по email."""
    result = await session.execute(select(User).where(User.email == email))
    return result.scalars().first()

async def create_access_token(data: dict, session: AsyncSession, expires_delta: timedelta = None):
    """Генерация JWT-токена."""
    to_encode = data.copy()
    
    # Получаем текущее время из базы данных, используя переданную сессию
    result = await session.execute(select(func.now()))
    now = result.scalar()

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    
    # Исправляем вызов метода encode, используя правильный синтаксис для authlib
    header = {"alg": ALGORITHM}
    encoded_jwt = jwt.encode(header, to_encode, SECRET_KEY)
    return encoded_jwt

async def get_current_user(token: str, session: AsyncSession) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        
        exp = payload.get("exp")
        current_time = datetime.utcnow().timestamp()
        if exp < current_time:
            raise credentials_exception
        
        user = await get_user_by_username(session, email)
        if user is None:
            raise credentials_exception
        
        return user  # Возвращаем только пользователя
    except JoseError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise credentials_exception

async def create_admin(session: AsyncSession, fio: str, email: str, password: str) -> Admin:
    """Создание нового администратора с хэшированием пароля."""
    # Получаем текущее время из базы данных
    result = await session.execute(select(func.now()))
    now = result.scalar()

    password_hash = pwd_context.hash(password)
    new_admin = Admin(
        fio=fio,
        email=email,
        password_hash=password_hash,
        created_at=now.replace(tzinfo=None),
        updated_at=now.replace(tzinfo=None)
    )
    session.add(new_admin)
    await session.commit()
    await session.refresh(new_admin)
    return new_admin

async def get_admin_by_username(session: AsyncSession, email: str) -> Optional[Admin]:
    """Получение администратора по email."""
    result = await session.execute(select(Admin).where(Admin.email == email))
    return result.scalars().first()

async def get_current_admin(token: str, session: AsyncSession) -> Admin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        
        exp = payload.get("exp")
        current_time = datetime.utcnow().timestamp()
        if exp < current_time:
            raise credentials_exception
        
        admin = await get_admin_by_username(session, email)
        if admin is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized as an admin"
            )
        
        return admin  # Возвращаем только администратора
    except JoseError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise credentials_exception

async def log_user_activity(
    db: AsyncSession,
    user_id: int,
    request: Request,
    action: str
):
    """Логирование активности пользователя с фингерпринтом устройства, предотвращение дубликатов."""
    try:
        ip_address = request.headers.get("X-Forwarded-For", request.client.host)
        cookies = "; ".join([f"{key}={value}" for key, value in request.cookies.items()]) if request.cookies else None
        user_agent = request.headers.get("User-Agent", "Unknown")
        
        # Используем новую функцию
        device_fingerprint = generate_device_fingerprint(request)

        result = await db.execute(select(func.now()))
        now = result.scalar()
        now_naive = now.replace(tzinfo=None)

        stmt = select(UserActivity).where(
            UserActivity.user_id == user_id,
            UserActivity.ip_address == ip_address,
            UserActivity.device_fingerprint == device_fingerprint,
            UserActivity.action == action,
            UserActivity.created_at >= now_naive - timedelta(minutes=5)
        )
        result = await db.execute(stmt)
        existing_activity = result.scalars().first()

        if not existing_activity:
            activity = UserActivity(
                user_id=user_id,
                ip_address=ip_address,
                cookies=cookies,
                user_agent=user_agent,
                action=action,
                created_at=now_naive,
                device_fingerprint=device_fingerprint
            )
            db.add(activity)
            await db.commit()
        else:
            existing_activity.created_at = now_naive
            await db.commit()
            logger.info(f"Duplicate activity ignored for user_id={user_id}, action={action}")
    except Exception as e:
        logger.error(f"Error logging user activity: {str(e)}")
        await db.rollback()
        raise

async def log_admin_activity(
    db: AsyncSession,
    admin_id: int,
    request: Request,
    action: str
):
    try:
        ip_address = request.headers.get("X-Forwarded-For", request.client.host)
        user_agent = request.headers.get("User-Agent", "Unknown")
        logger.info(f"Admin activity: admin_id={admin_id}, action={action}, ip={ip_address}, user_agent={user_agent}")
    except Exception as e:
        logger.error(f"Error logging admin activity: {str(e)}")

async def get_user_or_ip_key(request: Request) -> str:
    """Возвращает user_id (если аутентифицирован) или IP-адрес как ключ для ограничения."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        async with get_async_db() as session:
            try:
                user = await get_current_user(token, session)
                return f"user_{user.id}"  # Ключ на основе user_id
            except Exception:
                pass
    return f"ip_{request.client.host}"  # Ключ на основе IP для неаутентифицированных пользователей