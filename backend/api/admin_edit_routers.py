from enum import Enum
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
    token = credentials.credentials
    current_admin = await get_current_admin(token, db)
    
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
        updated_at=now_without_tz,
        status=event.status  # Устанавливаем статус
    )
    db.add(db_event)
    await db.flush()
    
    if event.ticket_type:
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
    await db.refresh(db_event, options=[selectinload(Event.tickets)])
    
    event_dict = db_event.__dict__
    if db_event.tickets:
        ticket = db_event.tickets[0]
        event_dict["ticket_type"] = TicketTypeCreate(
            name=ticket.name,
            price=ticket.price,
            available_quantity=ticket.available_quantity,
            free_registration=ticket.free_registration
        ).model_dump()
    
    await log_admin_activity(db, current_admin.id, request, action="create_event")
    logger.info(f"Event created by admin {current_admin.email}: {db_event.title}")
    return EventCreate(**event_dict)

# Маршрут для обновления мероприятия
@router.put("/{event_id}", response_model=EventCreate)
async def update_event(
    event_id: int,
    event: EventUpdate,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    token = credentials.credentials
    current_admin = await get_current_admin(token, db)
    
    db_event = await db.get(Event, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "status":
            value = value.value if isinstance(value, Enum) else value
        setattr(db_event, key, value)
    db_event.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await db.commit()
    await db.refresh(db_event, options=[selectinload(Event.tickets)])

    event_dict = db_event.__dict__
    if db_event.tickets:
        ticket = db_event.tickets[0]
        event_dict["ticket_type"] = TicketTypeCreate(
            name=ticket.name,
            price=ticket.price,
            available_quantity=ticket.available_quantity,
            free_registration=ticket.free_registration
        ).model_dump()

    await log_admin_activity(db, current_admin.id, request, action="update_event")
    logger.info(f"Event updated by admin {current_admin.email}: {db_event.title}")
    return EventCreate(**event_dict)