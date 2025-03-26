from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.database.user_db import AsyncSession, get_async_db, Event
from backend.config.logging_config import logger
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.schemas_enums.schemas import EventCreate, TicketTypeCreate

router = APIRouter(
    tags=["Events"]
)

def extract_id_from_slug(slug: str) -> int:
    parts = slug.split("-")
    event_id = parts[-1]
    if not event_id.isdigit():
        raise HTTPException(status_code=404, detail="Invalid event slug")
    return int(event_id)

# Маршрут для получения списка мероприятий (без авторизации)
@router.get("", response_model=list[EventCreate])
async def get_events(db: AsyncSession = Depends(get_async_db)):
    try:
        result = await db.execute(
            select(Event)
            .where(Event.status != "draft")  # Существующий фильтр
            .where(Event.published == True)  # Новый фильтр
            .options(selectinload(Event.tickets))
        )
        events = result.scalars().all()
        
        event_responses = []
        for event in events:
            event_dict = event.__dict__
            if event.tickets:
                ticket = event.tickets[0]
                event_dict["ticket_type"] = TicketTypeCreate(
                    name=ticket.name,
                    price=ticket.price,
                    available_quantity=ticket.available_quantity,
                    free_registration=ticket.free_registration
                ).model_dump()
            event_responses.append(EventCreate(**event_dict))
        
        return event_responses
    except Exception as e:
        logger.error(f"Error retrieving events: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve events: {str(e)}"
        )

@router.get("/{event_id}", response_model=EventCreate)
async def get_event(
    event_id: str,  # Изменяем тип на str, чтобы принимать как slug, так и ID
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    try:
        # Проверяем, является ли event_id числом или slug
        if event_id.isdigit():
            actual_event_id = int(event_id)
        else:
            actual_event_id = extract_id_from_slug(event_id)

        db_event = await db.get(Event, actual_event_id, options=[selectinload(Event.tickets)])
        if not db_event or not db_event.published:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found or not published")
        
        event_dict = db_event.__dict__
        if db_event.tickets and len(db_event.tickets) > 0:
            ticket = db_event.tickets[0]
            event_dict["ticket_type"] = TicketTypeCreate(
                name=ticket.name,
                price=ticket.price,
                available_quantity=ticket.available_quantity,
                free_registration=ticket.free_registration
            ).model_dump()
        
        logger.info(f"Public request for event {actual_event_id}")
        return EventCreate(**event_dict)
    except HTTPException as e:
        raise e
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid event ID or slug format")
    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve event: {str(e)}"
        )