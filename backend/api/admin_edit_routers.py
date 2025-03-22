# backend/api/admin_edit_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.schemas_enums.schemas import EventCreate, UserResponse
from backend.config.auth import get_current_admin, log_admin_activity
from backend.database.user_db import AsyncSession, get_async_db, Event, User, TicketType
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.schemas_enums.enums import EventStatus
from datetime import datetime

router = APIRouter()

bearer_scheme = HTTPBearer()

# Функция для преобразования timezone-aware datetime в timezone-naive
def make_naive(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

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

# Маршрут для удаления мероприятия
@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Удаление мероприятия (только в статусе черновик)."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)

        # Находим мероприятие
        query = select(Event).where(Event.id == event_id)
        result = await db.execute(query)
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Мероприятие не найдено"
            )

        # Проверяем статус мероприятия
        if event.status != EventStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Мероприятие можно удалить только в статусе 'черновик'"
            )

        # Удаляем мероприятие
        await db.delete(event)
        await db.commit()

        await log_admin_activity(db, current_admin.id, request, action=f"delete_event_{event_id}")
        logger.info(f"Admin {current_admin.email} deleted event {event_id}")
        return
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить мероприятие"
        )

# Маршрут для создания мероприятия
@router.post("", response_model=EventCreate, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Создание нового мероприятия."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)

        # Преобразуем все временные метки в timezone-naive
        start_date = make_naive(event_data.start_date)
        end_date = make_naive(event_data.end_date) if event_data.end_date else None
        created_at = make_naive(event_data.created_at) if event_data.created_at else make_naive(datetime.utcnow())
        updated_at = make_naive(event_data.updated_at) if event_data.updated_at else make_naive(datetime.utcnow())

        # Создаём новое мероприятие
        new_event = Event(
            title=event_data.title,
            description=event_data.description,
            start_date=start_date,
            end_date=end_date,
            location=event_data.location,
            image_url=event_data.image_url,
            price=event_data.price,
            published=event_data.published,
            created_at=created_at,
            updated_at=updated_at,
            status=event_data.status or EventStatus.draft
        )

        db.add(new_event)
        await db.flush()  # Сохраняем событие в базе, чтобы получить ID

        # Если есть данные о билетах, создаём их
        if event_data.ticket_type:
            ticket = TicketType(
                event_id=new_event.id,
                name=event_data.ticket_type.name,
                price=event_data.ticket_type.price,
                available_quantity=event_data.ticket_type.available_quantity,
                free_registration=event_data.ticket_type.free_registration or False
            )
            db.add(ticket)

        await db.commit()
        await db.refresh(new_event)

        # Формируем ответ в формате EventCreate
        response_data = {
            "id": new_event.id,
            "title": new_event.title,
            "description": new_event.description,
            "start_date": new_event.start_date,
            "end_date": new_event.end_date,
            "location": new_event.location,
            "image_url": new_event.image_url,
            "price": float(new_event.price),
            "published": new_event.published,
            "created_at": new_event.created_at,
            "updated_at": new_event.updated_at,
            "status": new_event.status
        }
        if event_data.ticket_type:
            response_data["ticket_type"] = {
                "name": event_data.ticket_type.name,
                "price": event_data.ticket_type.price,
                "available_quantity": event_data.ticket_type.available_quantity,
                "free_registration": event_data.ticket_type.free_registration
            }

        await log_admin_activity(db, current_admin.id, request, action="create_event")
        logger.info(f"Admin {current_admin.email} created event {new_event.id}")
        return response_data
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось создать мероприятие: {str(e)}"
        )