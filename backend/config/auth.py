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
from fastapi import HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import delete
from backend.config.logging_config import logger
from constants import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from backend.schemas_enums.schemas import TokenData

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

async def get_current_user(token: str, db: AsyncSession = Depends(get_async_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]) # Убираем algorithms
        payload = jwt.decode(token, SECRET_KEY)
        # email: str = payload.get("sub") # Убедимся, что получаем sub правильно
        sub = payload.get("sub")
        if sub is None:
            logger.warning("User token missing 'sub' claim")
            raise credentials_exception
        
        # Проверка типа sub, если это email
        if not isinstance(sub, str):
             logger.warning(f"User token 'sub' claim has unexpected type: {type(sub)}")
             raise credentials_exception
             
        email: str = sub # Теперь email точно строка
        
        # Проверка на истекший токен (добавлено для консистентности с get_current_admin)
        exp = payload.get("exp")
        if not exp:
            logger.warning("User token missing 'exp' claim")
            raise credentials_exception
            
        current_time = datetime.utcnow().timestamp()
        if exp < current_time:
            logger.warning(f"User token expired at {datetime.fromtimestamp(exp)}, current time: {datetime.utcnow()}")
            raise credentials_exception
        
        # Используем email напрямую
        token_data = TokenData(sub=email) 
    except (JWTError, JoseError) as e: # Ловим и JoseError от authlib
        logger.warning(f"JWT decode/validation error for user token: {str(e)}")
        raise credentials_exception
        
    # Используем email из token_data.sub
    user = await get_user_by_username(db, email=token_data.sub) 
    if user is None:
        logger.warning(f"User not found for email from token: {token_data.sub}")
        raise credentials_exception
    return user

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
        # Проверка на пустой токен
        if not token or token.strip() == "":
            logger.warning("Empty admin token provided")
            raise credentials_exception
            
        # Декодирование токена с информативными ошибками
        try:
            payload = jwt.decode(token, SECRET_KEY)
        except JoseError as e:
            logger.error(f"JWT decode error for admin token: {str(e)}")
            raise credentials_exception
            
        # Проверка наличия email в токене
        email: str = payload.get("sub")
        if email is None:
            logger.warning("Admin token missing 'sub' claim")
            raise credentials_exception
        
        # Проверка на истекший токен
        exp = payload.get("exp")
        if not exp:
            logger.warning("Admin token missing 'exp' claim")
            raise credentials_exception
            
        current_time = datetime.utcnow().timestamp()
        if exp < current_time:
            logger.warning(f"Admin token expired at {datetime.fromtimestamp(exp)}, current time: {datetime.utcnow()}")
            raise credentials_exception
        
        # Поиск администратора в базе
        admin = await get_admin_by_username(session, email)
        if admin is None:
            logger.warning(f"Admin not found for email: {email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized as an admin"
            )
        
        return admin
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_current_admin: {str(e)}")
        logger.exception("Full traceback:")
        raise credentials_exception

async def log_user_activity(
    db: AsyncSession,
    user_id: int | None,
    request: Request | None,
    *,
    action: str
) -> None:
    """
    Логирование действий пользователя / гостя.
    - Если `user_id` != None  -> пишем по user_id.
    - Если `user_id` is None  -> вычисляем fingerprint и пишем по нему.
    Перед записью удаляем все старые записи (старше 30 дней) соответствующие тому же
    user_id либо fingerprint.
    """
    try:
        # Определяем идентификатор (user_id или fingerprint)
        fingerprint: str | None = None
        ip_address: str | None = None
        user_agent: str | None = None
        if user_id is None and request is not None:
            fingerprint = generate_device_fingerprint(request)
       
        # Получаем IP и User-Agent из запроса, если он есть
        if request is not None:
            ip_address = request.headers.get("X-Forwarded-For", request.client.host)
            user_agent = request.headers.get("User-Agent", "Unknown")

        # Сначала удаляем устаревшие записи ( > 30 дней )
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        if user_id is not None:
            delete_stmt = (
                delete(UserActivity)
                .where(UserActivity.user_id == user_id)
                .where(UserActivity.created_at < thirty_days_ago)
            )
        elif fingerprint is not None: # Добавлено условие на наличие fingerprint
            delete_stmt = (
                delete(UserActivity)
                .where(UserActivity.device_fingerprint == fingerprint)
                .where(UserActivity.created_at < thirty_days_ago)
            )
        else:
            # Если нет ни user_id, ни fingerprint, удалять нечего
            delete_stmt = None

        if delete_stmt is not None:
            result = await db.execute(delete_stmt)
            logger.debug(f"Deleted {result.rowcount} old activity records (user_id={user_id}, fp={fingerprint})")

        # Теперь пишем новую запись
        ua = UserActivity(
            user_id=user_id,
            device_fingerprint=fingerprint,
            ip_address=ip_address,
            user_agent=user_agent,
            action=action,
            created_at=datetime.utcnow(),
        )
        db.add(ua)
        # Убрал commit отсюда, он должен быть во внешнем коде
        await db.flush() # Используем flush для получения ID, если нужно
        logger.debug(
            "Logged activity '%s' (user_id=%s, fp=%s, ip=%s)",
            action,
            user_id,
            fingerprint,
            ip_address,
        )
    except Exception as exc:
        logger.error("Failed to log user activity: %s", exc, exc_info=True)
        await db.rollback() # Откатываем только если была ошибка здесь

async def get_last_user_activity(db: AsyncSession, user_id: int) -> datetime | None:
    """Получает время последней активности пользователя."""
    stmt = (
        select(UserActivity.created_at)
        .where(UserActivity.user_id == user_id)
        .order_by(UserActivity.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    last_activity_time = result.scalar_one_or_none()
    return last_activity_time

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