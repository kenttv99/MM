# backend/api/admin_auth_routers.py
import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.schemas_enums.schemas import AdminCreate, AdminLogin, AdminResponse
from backend.config.auth import create_admin, get_admin_by_username, pwd_context, create_access_token, get_current_admin, log_admin_activity
from backend.database.user_db import AsyncSession, get_async_db
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from backend.config.rate_limiter import rate_limit

# --- Загрузка конфигурации из .env --- 
# Предполагается, что load_dotenv() вызывается где-то при старте приложения
ACCESS_TOKEN_EXPIRE_MINUTES_STR = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(ACCESS_TOKEN_EXPIRE_MINUTES_STR)
except ValueError:
    logger.error(f"Неверное значение для ACCESS_TOKEN_EXPIRE_MINUTES: {ACCESS_TOKEN_EXPIRE_MINUTES_STR}. Используется значение по умолчанию 30.") # logger может быть не определен здесь
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
# --- Конец загрузки конфигурации ---

router = APIRouter()

bearer_scheme = HTTPBearer()

@router.post("/register", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
@rate_limit("register_admin")
async def register_admin(admin: AdminCreate, db: AsyncSession = Depends(get_async_db), request: Request = None):
    """Регистрация нового администратора."""
    existing_admin = await get_admin_by_username(db, admin.email)
    if existing_admin:
        logger.warning(f"Attempt to register existing admin email: {admin.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    try:
        new_admin = await create_admin(db, admin.fio, admin.email, admin.password)
        await log_admin_activity(db, new_admin.id, request, action="register")
        logger.info(f"Admin registered successfully: {new_admin.email}")
        return new_admin
    except Exception as e:
        logger.error(f"Error registering admin: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register admin"
        )

@router.post("/login")
@rate_limit("login_admin")
async def login_admin(admin: AdminLogin, db: AsyncSession = Depends(get_async_db), request: Request = None):
    """Авторизация администратора с возвратом токена и данных администратора."""
    db_admin = await get_admin_by_username(db, admin.email)
    if not db_admin or not pwd_context.verify(admin.password, db_admin.password_hash):
        await log_admin_activity(db, db_admin.id if db_admin else None, request, action="login_failed")
        logger.warning(f"Failed login attempt for admin email: {admin.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = await create_access_token(
        data={"sub": db_admin.email}, session=db, expires_delta=access_token_expires
    )
    await log_admin_activity(db, db_admin.id, request, action="login")
    logger.info(f"Admin logged in successfully: {db_admin.email}")
    logger.info(f"Returning admin data: id={db_admin.id}, fio={db_admin.fio}, email={db_admin.email}")  # Отладочный лог
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": db_admin.id,
        "fio": db_admin.fio if db_admin.fio else "Администратор",  # Гарантируем, что fio всегда строка
        "email": db_admin.email
    }

@router.get("/me")
@rate_limit("access_me_admin")
async def read_admins_me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """Получение данных текущего администратора (защищенный эндпоинт)."""
    try:
        logger.info(f"Admin /me endpoint called with path: {request.url.path if request else 'unknown'}")
        
        token = credentials.credentials
        logger.info(f"Token received: {token[:10]}...")  # Логируем только начало токена для безопасности
        
        current_admin = await get_current_admin(token, db)
        logger.info(f"Admin authenticated: {current_admin.email}")
        
        await log_admin_activity(db, current_admin.id, request, action="access_me")
        logger.info(f"Admin accessed their profile: {current_admin.email}")
        
        # Возвращаем ответ в формате, который ожидает фронтенд
        return {
            "success": True,
            "data": {
                "id": current_admin.id,
                "fio": current_admin.fio,
                "email": current_admin.email
            }
        }
    except HTTPException as e:
        logger.warning(f"HTTP error in read_admins_me: {e.status_code} {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in read_admins_me: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve admin profile: {str(e)}"
        )