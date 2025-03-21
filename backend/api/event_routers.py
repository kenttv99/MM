from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.database.user_db import AsyncSession, get_async_db, Event
from backend.config.logging_config import logger
from sqlalchemy.future import select
from backend.schemas_enums.schemas import EventCreate

router = APIRouter(
    tags=["Events"]
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