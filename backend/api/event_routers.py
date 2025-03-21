from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.schemas_enums.schemas import EventCreate, EventUpdate
from backend.database.user_db import AsyncSession, get_async_db, Event
from backend.config.auth import get_current_admin, log_admin_activity
from backend.config.logging_config import logger
from datetime import datetime, timezone
from sqlalchemy.future import select

# Создаем роутер для маршрутов
router = APIRouter(prefix="/events", tags=["Events"])
bearer_scheme = HTTPBearer()

# Маршрут для создания мероприятия (требует авторизации)
@router.post("", response_model=EventCreate, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: EventCreate,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Создание нового мероприятия администратором."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        
        # Убираем часовой пояс из datetime объектов
        now_without_tz = datetime.now(timezone.utc).replace(tzinfo=None)
        
        db_event = Event(
            title=event.title,
            description=event.description,
            start_date=event.start_date.replace(tzinfo=None) if event.start_date.tzinfo else event.start_date,
            end_date=event.end_date.replace(tzinfo=None) if event.end_date and event.end_date.tzinfo else event.end_date,
            location=event.location,
            image_url=event.image_url,
            price=event.price,
            published=event.published,
            created_at=now_without_tz,
            updated_at=now_without_tz
        )
        db.add(db_event)
        await db.commit()
        await db.refresh(db_event)
        
        await log_admin_activity(db, current_admin.id, request, action="create_event")
        logger.info(f"Event created by admin {current_admin.email}: {db_event.title}")
        return EventCreate.model_validate(db_event)
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating event: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event"
        )

# Маршрут для получения списка мероприятий (без авторизации)
@router.get("", response_model=list[EventCreate])
async def get_events(
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """Получение списка всех мероприятий (публичный доступ)."""
    try:
        result = await db.execute(select(Event))
        events = result.scalars().all()
        logger.info(f"Public request for list of events")
        return [EventCreate.model_validate(event) for event in events]
    except Exception as e:
        logger.error(f"Error retrieving events: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve events"
        )

# Маршрут для получения конкретного мероприятия (без авторизации)
@router.get("/{event_id}", response_model=EventCreate)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """Получение конкретного мероприятия по ID (публичный доступ)."""
    try:
        db_event = await db.get(Event, event_id)
        if not db_event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        logger.info(f"Public request for event {event_id}")
        return EventCreate.model_validate(db_event)
    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve event"
        )