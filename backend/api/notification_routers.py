# backend/api/notification_routers.py
from fastapi import APIRouter, Depends, HTTPException, Request, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from backend.database.user_db import get_async_db, NotificationTemplate, NotificationView, User, UserActivity, Event
from backend.config.auth import generate_device_fingerprint, get_current_user, log_user_activity
from backend.config.logging_config import logger
from backend.schemas_enums.schemas import NotificationViewResponse
from datetime import datetime

router = APIRouter()
bearer_scheme = HTTPBearer()

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
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
    db: AsyncSession = Depends(get_async_db),
    current_user=Depends(get_current_user_optional),
    request: Request = None
):
    try:
        device_fingerprint = generate_device_fingerprint(request)
        if current_user:
            query = (
                select(NotificationTemplate, NotificationView)
                .join(NotificationView, NotificationTemplate.id == NotificationView.template_id, isouter=True)
                .where(NotificationTemplate.is_public == True)
                .where(NotificationView.user_id == current_user.id)
            )
        else:
            query = (
                select(NotificationTemplate, NotificationView)
                .join(NotificationView, NotificationTemplate.id == NotificationView.template_id, isouter=True)
                .where(NotificationTemplate.is_public == True)
                .where(NotificationView.fingerprint == device_fingerprint)
            )

        result = await db.execute(query)
        notifications = result.all()

        response = []
        for template, view in notifications:
            if not view and template:
                view = NotificationView(
                    template_id=template.id,
                    user_id=current_user.id if current_user else None,
                    fingerprint=device_fingerprint if not current_user else None,
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
                    fingerprint=view.fingerprint if view else device_fingerprint if not current_user else None,
                    is_viewed=view.is_viewed if view else False,
                    viewed_at=view.viewed_at if view else None,
                    created_at=view.created_at if view else template.created_at,
                )
            )

        if current_user and request:
            await log_user_activity(db, current_user.id, request, action="get_notifications")
            logger.info(f"User {current_user.email} retrieved notifications")
        else:
            logger.info(f"Notifications retrieved for fingerprint: {device_fingerprint}")

        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving notifications: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve notifications")

@router.post("/notifications/view")
async def mark_notification_viewed(
    template_id: int = Body(...),
    db: AsyncSession = Depends(get_async_db),
    current_user=Depends(get_current_user_optional),
    request: Request = None
):
    try:
        device_fingerprint = generate_device_fingerprint(request)
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
                .where(NotificationView.fingerprint == device_fingerprint)
                .values(is_viewed=True, viewed_at=datetime.utcnow())
            )
            result = await db.execute(stmt)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Notification not found for this device")
            logger.info(f"Notification {template_id} marked as viewed for fingerprint: {device_fingerprint}")

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
    fingerprint: str = Body(...),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
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
    event_id: int = Body(...),
    message: str = Body(...),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
        event = await db.execute(select(Event).where(Event.id == event_id))
        event = event.scalar_one_or_none()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        template = NotificationTemplate(
            message=message,
            type="publication",
            event_id=event_id,
            is_public=True,
            created_at=datetime.utcnow()
        )
        db.add(template)
        await db.flush()

        stmt = select(User.id)
        result = await db.execute(stmt)
        user_ids = result.scalars().all()

        stmt = select(UserActivity.device_fingerprint).distinct()
        result = await db.execute(stmt)
        fingerprints = result.scalars().all()

        for user_id in user_ids:
            view = NotificationView(
                template_id=template.id,
                user_id=user_id,
                is_viewed=False,
                created_at=datetime.utcnow()
            )
            db.add(view)

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
        await log_user_activity(db, current_user.id, request, action=f"send_notification_event_{event_id}")
        logger.info(f"Admin {current_user.email} sent notification for event {event_id}")
        return {"message": "Notification sent successfully"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error sending notification for event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to send notification")

@router.delete("/notifications/{view_id}")
async def delete_notification(
    view_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
        stmt = select(NotificationView).where(
            NotificationView.id == view_id,
            NotificationView.user_id == current_user.id
        )
        result = await db.execute(stmt)
        view = result.scalar_one_or_none()
        
        if not view:
            raise HTTPException(status_code=404, detail="Notification not found or not owned by user")
        
        await db.delete(view)
        await db.commit()
        await log_user_activity(db, current_user.id, request, action=f"delete_notification_{view_id}")
        logger.info(f"User {current_user.email} deleted notification view {view_id}")
        return {"message": "Notification deleted"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting notification {view_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete notification")

@router.delete("/notifications/clear")
async def clear_notifications(
    db: AsyncSession = Depends(get_async_db),
    current_user=Depends(get_current_user_optional),
    request: Request = None
):
    try:
        device_fingerprint = generate_device_fingerprint(request)
        if current_user:
            stmt = delete(NotificationView).where(NotificationView.user_id == current_user.id)
            result = await db.execute(stmt)
            deleted_count = result.rowcount
            await db.commit()
            await log_user_activity(db, current_user.id, request, action="clear_notifications")
            logger.info(f"User {current_user.email} cleared {deleted_count} notifications")
        else:
            stmt = delete(NotificationView).where(NotificationView.fingerprint == device_fingerprint)
            result = await db.execute(stmt)
            deleted_count = result.rowcount
            await db.commit()
            logger.info(f"Cleared {deleted_count} notifications for fingerprint: {device_fingerprint}")

        return {"message": f"Cleared {deleted_count} notifications"}
    except Exception as e:
        logger.error(f"Error clearing notifications: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to clear notifications")