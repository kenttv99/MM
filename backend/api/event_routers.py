from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import func
from backend.database.user_db import AsyncSession, get_async_db, Event
from backend.config.logging_config import logger
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.schemas_enums.schemas import EventCreate, TicketTypeCreate

router = APIRouter()

# Маршрут для получения списка мероприятий (без авторизации)
@router.get("", response_model=List[EventCreate])
async def get_events(
    page: int = 1,
    limit: int = 6,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db)
) -> List[EventCreate]:
    try:
        offset = (page - 1) * limit
        query = (
            select(Event)
            .where(Event.status != "draft")
            .where(Event.published == True)
            .options(selectinload(Event.tickets))
        )

        # Debug logs
        logger.info(f"Request parameters: page={page}, limit={limit}, start_date={start_date}, end_date={end_date}")

        # Improved date handling
        if start_date:
            try:
                # Принимаем дату в формате YYYY-MM-DD
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                
                # Создаем datetime для начала этого дня (00:00:00)
                start_datetime = datetime.combine(start_dt, datetime.min.time())
                
                logger.info(f"Filtering events with start_date >= {start_datetime}")
                
                # Применяем фильтр к полю start_date
                query = query.where(Event.start_date >= start_datetime)
            except ValueError as e:
                logger.error(f"Error parsing start_date '{start_date}': {str(e)}")
                # Продолжаем запрос без этого фильтра, если парсинг даты не удался
        
        if end_date:
            try:
                # Принимаем дату в формате YYYY-MM-DD
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                
                # Создаем datetime для конца этого дня (23:59:59)
                end_datetime = datetime.combine(end_dt, datetime.max.time())
                
                logger.info(f"Filtering events with start_date <= {end_datetime}")
                
                # Применяем фильтр к полю start_date
                query = query.where(Event.start_date <= end_datetime)
            except ValueError as e:
                logger.error(f"Error parsing end_date '{end_date}': {str(e)}")
                # Продолжаем запрос без этого фильтра, если парсинг даты не удался

        # Сортировка по убыванию
        query = query.order_by(Event.start_date.desc())

        # Execute query with pagination
        result = await db.execute(query.offset(offset).limit(limit))
        events = result.scalars().all()
        
        # Log the events found
        logger.info(f"Found {len(events)} events matching the criteria")
        for event in events:
            logger.info(f"Event ID: {event.id}, Title: {event.title}, Start Date: {event.start_date}")

        event_responses = []
        for event in events:
            ticket = event.tickets[0] if event.tickets else None
            remaining_quantity = ticket.available_quantity - ticket.sold_quantity if ticket else 0
            
            # Формируем канонический URL slug для списка мероприятий
            formatted_slug = None
            if event.url_slug:
                # Получаем год из даты начала события
                event_year = event.start_date.year
                # Формируем полный url_slug в формате base-year-id
                formatted_slug = f"{event.url_slug}-{event_year}-{event.id}"
                logger.info(f"Generated canonical slug for event list: {formatted_slug}")
            
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
                url_slug=formatted_slug,  # Добавляем канонический URL слаг
                ticket_type=TicketTypeCreate(
                    name=ticket.name,
                    price=float(ticket.price),
                    available_quantity=ticket.available_quantity,
                    free_registration=ticket.free_registration,
                    remaining_quantity=remaining_quantity
                ) if ticket else None
            )
            event_responses.append(event_response)

        return event_responses

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving events: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка сервера при загрузке мероприятий")
    
    
@router.get("/{slug_or_id}", response_model=EventCreate)
async def get_event(
    slug_or_id: str,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    try:
        db_event = None
        accessed_by_id = False
        
        # Если это числовой ID, ищем по ID
        if slug_or_id.isdigit():
            db_event = await db.get(Event, int(slug_or_id), options=[selectinload(Event.tickets)])
            accessed_by_id = True
        else:
            # Сначала пытаемся найти по точному соответствию url_slug
            query = select(Event).where(Event.url_slug == slug_or_id).options(selectinload(Event.tickets))
            result = await db.execute(query)
            db_event = result.scalars().first()
            
            # Если не найдено по slug, проверяем является ли это составным слагом (base-year-id)
            if not db_event:
                parts = slug_or_id.split('-')
                if len(parts) >= 2 and parts[-1].isdigit():
                    # Получаем ID из последней части slug
                    event_id = int(parts[-1])
                    logger.info(f"Extracted event ID {event_id} from slug {slug_or_id}")
                    
                    # Ищем мероприятие по ID
                    db_event = await db.get(Event, event_id, options=[selectinload(Event.tickets)])
                    
                    # Если мероприятие найдено, проверяем соответствует ли запрошенный slug каноническому
                    if db_event and db_event.url_slug:
                        # Получаем год из даты начала события
                        event_year = db_event.start_date.year
                        
                        # Формируем полный канонический url_slug
                        canonical_slug = f"{db_event.url_slug}-{event_year}-{db_event.id}"
                        
                        # Если запрошенный slug не соответствует каноническому - 
                        # вместо 404 ошибки просто записываем предупреждение и возвращаем событие
                        # с правильным url_slug, чтобы клиент мог выполнить перенаправление
                        if canonical_slug != slug_or_id:
                            logger.warning(f"Non-canonical slug access attempt: {slug_or_id}, canonical: {canonical_slug}")
                            # Продолжаем выполнение, клиент выполнит перенаправление
        
        if not db_event or not db_event.published:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found or not published")
        
        # Создаем словарь с данными мероприятия
        event_dict = {
            "id": db_event.id,
            "title": db_event.title,
            "description": db_event.description,
            "start_date": db_event.start_date,
            "end_date": db_event.end_date,
            "location": db_event.location,
            "image_url": db_event.image_url,
            "price": float(db_event.price) if db_event.price is not None else 0.0,
            "published": db_event.published,
            "created_at": db_event.created_at,
            "updated_at": db_event.updated_at,
            "status": db_event.status,
        }

        if db_event.tickets and len(db_event.tickets) > 0:
            ticket = db_event.tickets[0]
            remaining_quantity = ticket.available_quantity - ticket.sold_quantity
            event_dict["ticket_type"] = TicketTypeCreate(
                name=ticket.name,
                price=float(ticket.price),
                available_quantity=ticket.available_quantity,
                free_registration=ticket.free_registration,
                remaining_quantity=remaining_quantity,
                sold_quantity=ticket.sold_quantity
            ).model_dump()
        
        # Формируем канонический URL slug для ответа
        if db_event.url_slug:
            # Получаем год из даты начала события
            event_year = db_event.start_date.year
            
            # Формируем полный url_slug в формате base-year-id
            formatted_slug = f"{db_event.url_slug}-{event_year}-{db_event.id}"
            
            # Добавляем в ответ
            event_dict["url_slug"] = formatted_slug
            
            # Если был доступ по ID, логируем информацию о каноническом URL
            if accessed_by_id:
                logger.info(f"Accessed by ID {db_event.id}, canonical slug is: {formatted_slug}")
        else:
            # Формируем временный slug из названия
            base_slug = db_event.title.lower().replace(' ', '-')
            event_year = db_event.start_date.year
            formatted_slug = f"{base_slug}-{event_year}-{db_event.id}"
            event_dict["url_slug"] = formatted_slug
            logger.info(f"No url_slug in database, generated: {formatted_slug} for event {db_event.id}")
        
        logger.info(f"Public request for event {db_event.id} with url_slug: {event_dict['url_slug']}")
        return EventCreate(**event_dict)
    except HTTPException as e:
        raise e
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid event ID or slug format")
    except Exception as e:
        logger.error(f"Error retrieving event {slug_or_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve event: {str(e)}"
        )