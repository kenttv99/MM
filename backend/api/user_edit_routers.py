# backend/api/user_edit_routers.py
import hashlib
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy import select
from backend.schemas_enums.schemas import UserResponse, UserUpdate
from backend.database.user_db import AsyncSession, get_async_db, User
from backend.config.auth import get_current_user, log_user_activity
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import uuid
from constants import USERS_AVATARS_DIR, BASE_DIR

router = APIRouter()
bearer_scheme = HTTPBearer()

@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    user_data: UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
) -> UserResponse:
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
        update_data = user_data.dict(exclude_unset=True, exclude={'email'})
        
        # Handle avatar removal if requested
        if update_data.get('remove_avatar'):
            logger.info(f"User {current_user.email} requested avatar removal")
            
            # Delete the avatar file if it exists
            if current_user.avatar_url:
                # Extract filename from URL
                avatar_filename = current_user.avatar_url.split('/')[-1]
                avatar_path = os.path.join(USERS_AVATARS_DIR, avatar_filename)
                
                if os.path.exists(avatar_path):
                    try:
                        os.remove(avatar_path)
                        logger.info(f"Deleted avatar file: {avatar_path}")
                    except OSError as e:
                        logger.warning(f"Failed to delete avatar file {avatar_path}: {str(e)}")
                else:
                    logger.warning(f"Avatar file not found at path: {avatar_path}")
                
                # Set avatar_url to None in the database
                current_user.avatar_url = None
                logger.info(f"Set avatar_url to None for user {current_user.email}")
            
            # Remove the remove_avatar flag from update_data to avoid trying to set it on the model
            update_data.pop('remove_avatar', None)
        
        # Apply the remaining updates
        for key, value in update_data.items():
            setattr(current_user, key, value)

        # Fix: Ensure avatar_url is properly formatted after update
        if current_user.avatar_url and not current_user.avatar_url.startswith('/'):
            current_user.avatar_url = f"/{current_user.avatar_url}"
            logger.info(f"Normalized avatar URL during profile update: {current_user.avatar_url}")
            
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
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)

        if not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Только изображения разрешены"
            )

        os.makedirs(USERS_AVATARS_DIR, exist_ok=True)

        # Удаляем старый аватар, если он существует
        if current_user.avatar_url:
            # Извлекаем имя файла из URL
            avatar_filename = current_user.avatar_url.split('/')[-1]  # Например, "old_filename.jpg"
            old_file_path = os.path.join(USERS_AVATARS_DIR, avatar_filename)  # Путь: private_media/users_avatars/old_filename.jpg
            
            if os.path.exists(old_file_path):
                try:
                    os.remove(old_file_path)
                    logger.info(f"Удалён старый аватар: {old_file_path}")
                except OSError as e:
                    logger.warning(f"Не удалось удалить старый аватар {old_file_path}: {str(e)}")
            else:
                logger.warning(f"Старый аватар не найден по пути: {old_file_path}")
            current_user.avatar_url = None  # Очищаем старый URL сразу

        # Загружаем новый аватар
        file_extension = file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(USERS_AVATARS_DIR, unique_filename)
        
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        avatar_url = f"/images/users_avatars/{unique_filename}"
        if not avatar_url.startswith('/'):
            avatar_url = f"/{avatar_url}"  # Double-ensure leading slash
            
        current_user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(current_user)

        logger.info(f"User {current_user.email} uploaded new avatar: {avatar_url}")
        
        await log_user_activity(db, current_user.id, request, action="upload_avatar")
        return current_user
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error uploading avatar: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось загрузить аватарку"
        )