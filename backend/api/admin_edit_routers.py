# backend/api/admin_edit_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.schemas_enums.schemas import EventCreate, UserResponse
from backend.config.auth import get_current_admin, log_admin_activity
from backend.database.user_db import AsyncSession, get_async_db, Event, User
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

router = APIRouter()

bearer_scheme = HTTPBearer()

# Маршрут для получения списка мероприятий
@router.get("/events", response_model=list[EventCreate])
async def get_admin_events(
    search: str = None,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Получение списка мероприятий для админа (с возможностью поиска)."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action="access_events")

        query = select(Event).options(selectinload(Event.tickets))
        if search:
            search_pattern = f"%{search}%"
            query = query.where(Event.title.ilike(search_pattern))

        result = await db.execute(query)
        events = result.scalars().all()

        event_responses = []
        for event in events:
            # Явно формируем словарь с необходимыми полями
            event_dict = {
                "id": event.id,
                "title": event.title,
                "description": event.description,
                "start_date": event.start_date,
                "end_date": event.end_date,
                "location": event.location,
                "image_url": event.image_url,
                "price": float(event.price) if event.price is not None else 0.0,
                "published": event.published,
                "created_at": event.created_at,
                "updated_at": event.updated_at,
                "status": event.status
            }
            if event.tickets:
                ticket = event.tickets[0]
                event_dict["ticket_type"] = {
                    "name": ticket.name,
                    "price": float(ticket.price),
                    "available_quantity": ticket.available_quantity,
                    "free_registration": ticket.free_registration
                }
            event_responses.append(EventCreate(**event_dict))

        logger.info(f"Admin {current_admin.email} accessed events list")
        return event_responses
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving events for admin: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve events"
        )

# Маршрут для получения списка пользователей
@router.get("/users", response_model=list[UserResponse])
async def get_admin_users(
    search: str = None,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Получение списка пользователей для админа (с возможностью поиска)."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action="access_users")

        query = select(User)
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                (User.fio.ilike(search_pattern)) | (User.email.ilike(search_pattern))
            )

        result = await db.execute(query)
        users = result.scalars().all()

        logger.info(f"Admin {current_admin.email} accessed users list")
        return users
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving users for admin: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )