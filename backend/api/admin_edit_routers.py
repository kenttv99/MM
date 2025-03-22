from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.schemas_enums.schemas import EventCreate, EventUpdate
from backend.database.user_db import AsyncSession, Registration, TicketType, get_async_db, Event
from backend.config.auth import get_current_admin, log_admin_activity
from backend.config.logging_config import logger
from datetime import datetime, timezone

router = APIRouter()
bearer_scheme = HTTPBearer()

# Маршрут для создания мероприятия
# backend/api/admin_edit_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.schemas_enums.schemas import EventCreate, EventUpdate, TicketTypeCreate
from backend.database.user_db import AsyncSession, get_async_db, Event, TicketType
from backend.config.auth import get_current_admin, log_admin_activity
from backend.config.logging_config import logger
from datetime import datetime, timezone
from sqlalchemy.orm import selectinload

router = APIRouter()
bearer_scheme = HTTPBearer()

@router.post("", response_model=EventCreate, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: EventCreate,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Создание нового мероприятия администратором с типом билета."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        
        # Убираем часовой пояс из datetime объектов
        now_without_tz = datetime.now(timezone.utc).replace(tzinfo=None)
        
        # Создаем мероприятие
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
        await db.flush()  # Получаем ID мероприятия
        
        # Создаем тип билета, если переданы данные
        if event.ticket_type:
            if event.ticket_type.name == "free" and event.ticket_type.price != 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Price must be 0 for 'free' ticket type"
                )
            
            ticket_type = TicketType(
                event_id=db_event.id,
                name=event.ticket_type.name.value,
                price=event.ticket_type.price,
                available_quantity=event.ticket_type.available_quantity,
                sold_quantity=0,
                free_registration=event.ticket_type.free_registration
            )
            db.add(ticket_type)
            await db.flush()

        await db.commit()
        # Подгружаем связанные данные
        await db.refresh(db_event, options=[selectinload(Event.tickets)])
        
        # Формируем данные для ответа
        event_dict = db_event.__dict__  # Получаем словарь атрибутов модели Event
        if db_event.tickets and len(db_event.tickets) > 0:
            ticket = db_event.tickets[0]
            event_dict["ticket_type"] = TicketTypeCreate(
                name=ticket.name,
                price=ticket.price,
                available_quantity=ticket.available_quantity,
                free_registration=ticket.free_registration
            ).model_dump()  # Преобразуем в словарь для совместимости
        
        await log_admin_activity(db, current_admin.id, request, action="create_event")
        logger.info(f"Event created by admin {current_admin.email}: {db_event.title}")
        return EventCreate(**event_dict)  # Создаем объект EventCreate из словаря
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating event: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event"
        )

# Маршрут для обновления мероприятия
@router.put("/{event_id}", response_model=EventCreate)
async def update_event(
    event_id: int,
    event: EventUpdate,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Обновление мероприятия администратором."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        
        db_event = await db.get(Event, event_id)
        if not db_event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        # Исправление: используем model_dump вместо dict для Pydantic v2
        update_data = event.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_event, key, value)
        db_event.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

        await db.commit()
        await db.refresh(db_event)

        await log_admin_activity(db, current_admin.id, request, action="update_event")
        logger.info(f"Event updated by admin {current_admin.email}: {db_event.title}")
        return EventCreate.model_validate(db_event)
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating event: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update event"
        )