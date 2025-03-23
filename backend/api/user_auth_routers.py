# backend/api/user_auth_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.schemas_enums.schemas import UserCreate, UserLogin, UserResponse
from backend.config.auth import create_user, get_user_by_username, pwd_context, create_access_token, get_current_user, log_user_activity
from backend.database.user_db import AsyncSession, get_async_db
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
    """Авторизация пользователя с возвратом токена."""
    db_user = await get_user_by_username(db, user.email)
    if not db_user or not pwd_context.verify(user.password, db_user.password_hash):
        await log_user_activity(db, db_user.id if db_user else None, request, action="login_failed")
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
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
@rate_limit("access_me")
async def read_users_me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """Получение данных текущего пользователя (защищенный эндпоинт)."""
    token = credentials.credentials
    current_user = await get_current_user(token, db)
    await log_user_activity(db, current_user.id, request, action="access_me")
    logger.info(f"User accessed their profile: {current_user.email}")
    return current_user