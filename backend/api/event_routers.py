from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import func
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
@router.get("", response_model=List[EventCreate])
async def get_events(
    page: int = 1,
    limit: int = 6,
    start_date: Optional[str] = None,  # Формат: "YYYY-MM-DD"
    end_date: Optional[str] = None,    # Формат: "YYYY-MM-DD"
    db: AsyncSession = Depends(get_async_db)
) -> List[EventCreate]:
    try:
        offset = (page - 1) * limit
        query = (
            select(Event)
            .where(Event.status != "draft")
            .where(Event.published == True)
            .options(selectinload(Event.tickets))
            .order_by(Event.start_date.desc())
        )

        # Фильтрация по датам с упрощенной валидацией
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.where(Event.start_date >= start_dt)
            except ValueError:
                raise HTTPException(status_code=422, detail="Неверный формат start_date. Используйте YYYY-MM-DD")
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                query = query.where(Event.start_date <= end_dt)
            except ValueError:
                raise HTTPException(status_code=422, detail="Неверный формат end_date. Используйте YYYY-MM-DD")

        result = await db.execute(query.offset(offset).limit(limit))
        events = result.scalars().all()

        # Формирование ответа
        event_responses = []
        for event in events:
            # Берем первый билет из списка tickets, если он есть
            ticket = event.tickets[0] if event.tickets else None
            event_response = EventCreate(
                id=event.id,
                title=event.title,
                description=event.description,
                start_date=event.start_date,
                end_date=event.end_date,
                location=event.location,
                image_url=event.image_url,
                price=float(event.price) if event.price is not None else 0.0,
                published=event.published,
                created_at=event.created_at,
                updated_at=event.updated_at,
                status=event.status,
                ticket_type=TicketTypeCreate(
                    name=ticket.name,
                    price=float(ticket.price),
                    available_quantity=ticket.available_quantity,
                    free_registration=ticket.free_registration
                ) if ticket else None  # Условная передача ticket_type
            )
            event_responses.append(event_response)

        logger.info(f"Retrieved {len(events)} events for page {page} with limit {limit}")
        return event_responses

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving events: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка сервера при загрузке мероприятий")
    
    
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