# backend/api/user_auth_routers.py
from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from backend.schemas_enums.schemas import ChangePassword, ChangePasswordResponse, UserCreate, UserLogin, UserResponse
from backend.config.auth import create_user, get_user_by_username, pwd_context, create_access_token, get_current_user, log_user_activity
from backend.database.user_db import AsyncSession, User, get_async_db
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from backend.config.rate_limiter import rate_limit
from constants import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

bearer_scheme = HTTPBearer()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@rate_limit("register")
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_async_db), request: Request = None):
    """Регистрация нового пользователя."""
    existing_user = await get_user_by_username(db, user.email)
    if existing_user:
        logger.warning(f"Attempt to register existing email: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    try:
        new_user = await create_user(db, user.fio, user.email, user.password, user.telegram, user.whatsapp)
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
    """Авторизация пользователя с возвратом токена и данных пользователя."""
    db_user = await get_user_by_username(db, user.email)
    if not db_user or not pwd_context.verify(user.password, db_user.password_hash):
        # Логируем неудачную попытку входа только если пользователь существует
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
    db = Depends(get_async_db),
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