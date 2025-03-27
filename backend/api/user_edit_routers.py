# backend/api/user_edit_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy import select
from backend.schemas_enums.schemas import UserResponse, UserUpdate
from backend.database.user_db import AsyncSession, get_async_db, User
from backend.config.auth import get_current_user, log_user_activity
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import uuid

router = APIRouter()
bearer_scheme = HTTPBearer()

@router.get("/me", response_model=UserResponse)
async def get_user_profile(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
) -> UserResponse:
    """Получение данных текущего пользователя"""
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        await log_user_activity(db, current_user.id, request, action="access_profile")
        logger.info(f"User {current_user.email} accessed their profile")
        return current_user
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving user profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve profile"
        )

@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    user_data: UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
) -> UserResponse:
    """Обновление данных текущего пользователя"""
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
        update_data = user_data.dict(exclude_unset=True, exclude={'email'})
        for key, value in update_data.items():
            setattr(current_user, key, value)

        await db.commit()
        await db.refresh(current_user)

        await log_user_activity(db, current_user.id, request, action="update_profile")
        logger.info(f"User {current_user.email} updated their profile")
        return current_user
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось обновить профиль: {str(e)}"
        )

@router.post("/upload-avatar", response_model=UserResponse)
async def upload_user_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
) -> UserResponse:
    """Загрузка аватарки пользователя"""
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)

        if not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Только изображения разрешены"
            )

        avatar_dir = "private_media/users_avatars"
        os.makedirs(avatar_dir, exist_ok=True)

        if current_user.avatar_url:
            old_file_path = current_user.avatar_url.replace("/images/users_avatars/", "private_media/users_avatars/")
            if os.path.exists(old_file_path):
                os.remove(old_file_path)

        file_extension = file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(avatar_dir, unique_filename)
        
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        current_user.avatar_url = f"/images/users_avatars/{unique_filename}"
        await db.commit()
        await db.refresh(current_user)

        await log_user_activity(db, current_user.id, request, action="upload_avatar")
        logger.info(f"User {current_user.email} uploaded new avatar")
        return current_user
    except Exception as e:
        logger.error(f"Error uploading avatar: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось загрузить аватарку"
        )