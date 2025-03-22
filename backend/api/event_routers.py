from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.database.user_db import AsyncSession, get_async_db, Event
from backend.config.logging_config import logger
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.schemas_enums.schemas import EventCreate, TicketTypeCreate

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
        # Подгружаем связанные tickets для всех событий
        result = await db.execute(select(Event).options(selectinload(Event.tickets)))
        events = result.scalars().all()
        
        # Формируем ответ с ticket_type
        event_responses = []
        for event in events:
            event_dict = event.__dict__  # Получаем словарь атрибутов события
            if event.tickets and len(event.tickets) > 0:
                ticket = event.tickets[0]  # Берем первый тип билета
                event_dict["ticket_type"] = TicketTypeCreate(
                    name=ticket.name,
                    price=ticket.price,
                    available_quantity=ticket.available_quantity,
                    free_registration=ticket.free_registration
                ).model_dump()
            event_responses.append(EventCreate(**event_dict))
        
        logger.info(f"Public request for list of events")
        return event_responses
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
        # Подгружаем событие с связанными tickets
        db_event = await db.get(Event, event_id, options=[selectinload(Event.tickets)])
        if not db_event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        
        # Формируем ответ с ticket_type
        event_dict = db_event.__dict__
        if db_event.tickets and len(db_event.tickets) > 0:
            ticket = db_event.tickets[0]  # Берем первый тип билета
            event_dict["ticket_type"] = TicketTypeCreate(
                name=ticket.name,
                price=ticket.price,
                available_quantity=ticket.available_quantity,
                free_registration=ticket.free_registration
            ).model_dump()
            logger.info(f"Event {event_id} retrieved with {ticket.available_quantity - ticket.sold_quantity} available tickets")
        
        logger.info(f"Public request for event {event_id}")
        return EventCreate(**event_dict)
    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve event"
        )