# backend/api/notification_routers.py
from asyncio import Event
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from backend.database.user_db import User, get_async_db, NotificationTemplate, NotificationView, UserActivity
from backend.config.auth import get_current_user, log_user_activity
from backend.config.logging_config import logger
from backend.schemas_enums.schemas import NotificationViewResponse
from datetime import datetime

router = APIRouter()
bearer_scheme = HTTPBearer()

# Опциональная зависимость для получения текущего пользователя
async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db)
):
    if credentials:
        token = credentials.credentials
        try:
            return await get_current_user(token, db)
        except HTTPException:
            pass
    return None

@router.post("/notifications/public", response_model=List[NotificationViewResponse])
async def get_public_notifications(
    fingerprint: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user=Depends(get_current_user_optional),
    request: Request = None
):
    """
    Получение публичных уведомлений для авторизованного пользователя (по user_id)
    или неавторизованного (по fingerprint).
    """
    try:
        if not current_user and not fingerprint:
            raise HTTPException(status_code=400, detail="Either user authentication or fingerprint is required")

        query = (
            select(NotificationTemplate, NotificationView)
            .join(NotificationView, NotificationTemplate.id == NotificationView.template_id, isouter=True)
            .where(NotificationTemplate.is_public == True)
            .where(
                (NotificationView.user_id == (current_user.id if current_user else None)) |
                (NotificationView.fingerprint == fingerprint if not current_user else None)
            )
        )
        result = await db.execute(query)
        notifications = result.all()

        response = []
        for template, view in notifications:
            if not view and template:
                view = NotificationView(
                    template_id=template.id,
                    user_id=current_user.id if current_user else None,
                    fingerprint=fingerprint if not current_user else None,
                    is_viewed=False,
                    created_at=datetime.utcnow()
                )
                db.add(view)
                await db.commit()
                await db.refresh(view)

            response.append(
                NotificationViewResponse(
                    id=view.id if view else None,
                    template_id=template.id,
                    user_id=view.user_id if view else current_user.id if current_user else None,
                    fingerprint=view.fingerprint if view else fingerprint if not current_user else None,
                    is_viewed=view.is_viewed if view else False,
                    viewed_at=view.viewed_at if view else None,
                    created_at=view.created_at if view else template.created_at,
                )
            )

        if current_user and request:
            await log_user_activity(db, current_user.id, request, action="get_notifications")
            logger.info(f"User {current_user.email} retrieved notifications")
        elif fingerprint:
            logger.info(f"Notifications retrieved for fingerprint: {fingerprint}")

        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving notifications: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve notifications")

@router.post("/notifications/view")
async def mark_notification_viewed(
    template_id: int,
    fingerprint: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user=Depends(get_current_user_optional),
    request: Request = None
):
    """
    Отмечает уведомление как просмотренное для пользователя или устройства.
    """
    try:
        if not current_user and not fingerprint:
            raise HTTPException(status_code=400, detail="Either user authentication or fingerprint is required")

        if current_user:
            stmt = (
                update(NotificationView)
                .where(NotificationView.template_id == template_id)
                .where(NotificationView.user_id == current_user.id)
                .values(is_viewed=True, viewed_at=datetime.utcnow())
            )
            result = await db.execute(stmt)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Notification not found for this user")
            await log_user_activity(db, current_user.id, request, action=f"view_notification_{template_id}")
            logger.info(f"User {current_user.email} marked notification {template_id} as viewed")
        else:
            stmt = (
                update(NotificationView)
                .where(NotificationView.template_id == template_id)
                .where(NotificationView.fingerprint == fingerprint)
                .values(is_viewed=True, viewed_at=datetime.utcnow())
            )
            result = await db.execute(stmt)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Notification not found for this device")
            logger.info(f"Notification {template_id} marked as viewed for fingerprint: {fingerprint}")

        await db.commit()
        return {"message": "Notification marked as viewed"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error marking notification {template_id} as viewed: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to mark notification as viewed")

@router.post("/notifications/rebind")
async def rebind_notifications(
    fingerprint: str,
    db: AsyncSession = Depends(get_async_db),
    current_user=Depends(get_current_user),
    request: Request = None
):
    """
    Перепривязка уведомлений от fingerprint к user_id после авторизации.
    """
    try:
        stmt = (
            update(NotificationView)
            .where(NotificationView.fingerprint == fingerprint)
            .values(user_id=current_user.id, fingerprint=None)
        )
        result = await db.execute(stmt)
        await db.commit()

        migrated_count = result.rowcount
        await log_user_activity(db, current_user.id, request, action="rebind_notifications")
        logger.info(f"User {current_user.email} rebound {migrated_count} notifications from fingerprint {fingerprint}")
        return {"message": f"Migrated {migrated_count} notifications"}
    except Exception as e:
        logger.error(f"Error rebinding notifications: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to rebind notifications")
    
@router.post("/notifications/send")
async def send_event_notification(
    event_id: int,
    message: str,
    db: AsyncSession = Depends(get_async_db),
    current_user=Depends(get_current_user),  # Требуем авторизацию администратора
    request: Request = None
):
    """
    Создание уведомления для всех пользователей и устройств по событию.
    """
    try:
        # Проверяем существование события
        event = await db.execute(select(Event).where(Event.id == event_id))
        event = event.scalar_one_or_none()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Создаем шаблон уведомления
        template = NotificationTemplate(
            message=message,
            type="publication",
            event_id=event_id,
            is_public=True,
            created_at=datetime.utcnow()
        )
        db.add(template)
        await db.flush()

        # Получаем всех пользователей
        stmt = select(User.id)
        result = await db.execute(stmt)
        user_ids = result.scalars().all()

        # Получаем все уникальные фингерпринты
        stmt = select(UserActivity.device_fingerprint).distinct()
        result = await db.execute(stmt)
        fingerprints = result.scalars().all()

        # Создаем записи просмотров для всех пользователей
        for user_id in user_ids:
            view = NotificationView(
                template_id=template.id,
                user_id=user_id,
                is_viewed=False,
                created_at=datetime.utcnow()
            )
            db.add(view)

        # Создаем записи просмотров для всех устройств
        for fingerprint in fingerprints:
            if fingerprint:
                view = NotificationView(
                    template_id=template.id,
                    fingerprint=fingerprint,
                    is_viewed=False,
                    created_at=datetime.utcnow()
                )
                db.add(view)

        await db.commit()
        logger.info(f"Admin {current_user.email} sent notification for event {event_id}")
        return {"message": "Notification sent successfully"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error sending notification for event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send notification")