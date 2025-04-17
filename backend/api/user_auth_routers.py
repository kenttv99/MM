# backend/api/user_auth_routers.py
import os
from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from backend.schemas_enums.schemas import ChangePassword, ChangePasswordResponse, UserCreate, UserLogin, UserResponse
from backend.config.auth import create_user, get_user_by_username, pwd_context, create_access_token, get_current_user, log_user_activity, generate_device_fingerprint, get_last_user_activity
from backend.database.user_db import AsyncSession, User, get_async_db, NotificationView, UserActivity
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from backend.config.rate_limiter import rate_limit
from sqlalchemy import update, select
from sqlalchemy.sql.expression import desc

# --- Загрузка конфигурации из .env --- 
# Предполагается, что load_dotenv() вызывается где-то при старте приложения
ACCESS_TOKEN_EXPIRE_MINUTES_STR = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(ACCESS_TOKEN_EXPIRE_MINUTES_STR)
except ValueError:
    logger.error(f"Неверное значение для ACCESS_TOKEN_EXPIRE_MINUTES: {ACCESS_TOKEN_EXPIRE_MINUTES_STR}. Используется значение по умолчанию 30.") # logger может быть не определен здесь, добавим импорт позже если нужно
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
# --- Конец загрузки конфигурации ---

router = APIRouter()

bearer_scheme = HTTPBearer()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@rate_limit("register")
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_async_db), request: Request = None):
    """Регистрация нового пользователя с перепривязкой уведомлений."""
    existing_user = await get_user_by_username(db, user.email)
    if existing_user:
        logger.warning(f"Attempt to register existing email: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    try:
        # Создание нового пользователя
        new_user = await create_user(db, user.fio, user.email, user.password, user.telegram, user.whatsapp)
        
        # Перепривязка уведомлений от фингерпринта к user_id
        device_fingerprint = generate_device_fingerprint(request)
        stmt = (
            update(NotificationView)
            .where(NotificationView.fingerprint == device_fingerprint)
            .where(NotificationView.user_id.is_(None))  # Добавляем проверку
            .values(user_id=new_user.id, fingerprint=None)
        )
        result = await db.execute(stmt)
        migrated_count = result.rowcount
        if migrated_count > 0:
            logger.info(f"Migrated {migrated_count} notifications from fingerprint {device_fingerprint} to user {new_user.email}")

        await db.commit()
        await log_user_activity(db, new_user.id, request, action="register")
        logger.info(f"User registered successfully: {new_user.email}")
        return new_user
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user"
        )

@router.post("/login")
@rate_limit("login")
async def login_user(user: UserLogin, db: AsyncSession = Depends(get_async_db), request: Request = None):
    """Авторизация пользователя с возвратом токена и данных пользователя, перепривязка уведомлений."""
    db_user = await get_user_by_username(db, user.email)
    if not db_user or not pwd_context.verify(user.password, db_user.password_hash):
        if db_user:
            await log_user_activity(db, db_user.id, request, action="login_failed")
        logger.warning(f"Failed login attempt for email: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = await create_access_token(
        data={"sub": db_user.email}, session=db, expires_delta=access_token_expires
    )
    
    try:
        device_fingerprint = generate_device_fingerprint(request)
        stmt = (
            update(NotificationView)
            .where(NotificationView.fingerprint == device_fingerprint)
            .where(NotificationView.user_id.is_(None))  # Добавляем проверку
            .values(user_id=db_user.id, fingerprint=None)
        )
        result = await db.execute(stmt)
        migrated_count = result.rowcount
        if migrated_count > 0:
            logger.info(f"Migrated {migrated_count} notifications from fingerprint {device_fingerprint} to user {db_user.email}")
    except Exception as e:
        logger.error(f"Error rebinding notifications during login for {db_user.email}: {str(e)}")
        await db.rollback()
    
    await db.commit()
    await log_user_activity(db, db_user.id, request, action="login")
    logger.info(f"User logged in successfully: {db_user.email}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": db_user.id,
        "fio": db_user.fio,
        "email": db_user.email,
        "telegram": db_user.telegram,
        "whatsapp": db_user.whatsapp,
        "avatar_url": db_user.avatar_url
    }

@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_user_password(
    data: ChangePassword = Body(...),
    token: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=Depends(get_async_db),
    request: Request = None
):
    current_user = await get_current_user(token.credentials, db)
    user = await db.get(User, current_user.id)
    await log_user_activity(db, user.id, request, action="change_password")
    if not user or not pwd_context.verify(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный текущий пароль"
        )
    
    user.password_hash = pwd_context.hash(data.new_password)
    await db.commit()
    return {"message": "Пароль успешно изменен"}

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """Обработка выхода пользователя и логирование действия."""
    try:
        current_user = await get_current_user(credentials.credentials, db)
        # Основное действие - логирование выхода
        await log_user_activity(db, current_user.id, request, action="logout")
        await db.commit() # Сохраняем лог активности
        logger.info(f"User {current_user.email} logged out successfully.")
        return {"message": "Logout successful"}
    except HTTPException as e:
        # Если токен недействителен или произошла другая ошибка аутентификации
        logger.warning(f"Logout attempt failed for token: {e.detail}")
        raise e
    except Exception as e:
        error_msg = f"Error during logout: {str(e)}"
        logger.error(error_msg)
        logger.exception("Full traceback during logout:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed due to server error"
        )

@router.get("/me", response_model=UserResponse)
async def get_user_profile(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
) -> UserResponse:
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
        # Fix: Ensure avatar_url is properly formatted with leading slash
        if current_user.avatar_url and not current_user.avatar_url.startswith('/'):
            current_user.avatar_url = f"/{current_user.avatar_url}"
            # Update in the database for consistency
            await db.commit()
            await db.refresh(current_user)
            logger.info(f"Normalized avatar URL for user {current_user.email}: {current_user.avatar_url}")
        
        # Получаем последнюю активность из user_activities
        last_activity = await get_last_user_activity(db, current_user.id)
        if last_activity:
            current_user.last_active = last_activity
        
        await log_user_activity(db, current_user.id, request, action="access_profile")
        logger.info(f"User {current_user.email} accessed their profile")
        return current_user
    except HTTPException as e:
        # Просто пробрасываем ошибки HTTP, не обрабатывая их
        logger.warning(f"HTTP error in get_user_profile: {e.status_code} {e.detail}")
        raise e
    except Exception as e:
        # Логируем неожиданные ошибки для отладки
        error_msg = f"Error retrieving user profile: {str(e)}"
        logger.error(error_msg)
        # Трассируем стек ошибки для отладки
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve profile"
        )