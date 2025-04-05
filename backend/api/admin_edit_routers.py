# backend/api/admin_edit_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from backend.schemas_enums.schemas import EventCreate, TicketTypeCreate, UserResponse, UserUpdate
from backend.config.auth import get_current_admin, log_admin_activity
from backend.database.user_db import AsyncSession, NotificationTemplate, NotificationView, UserActivity, get_async_db, Event, User, TicketType
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from backend.schemas_enums.enums import EventStatus
from datetime import datetime
import os
import uuid
from typing import Optional
import inspect
from pydantic import BaseModel

router = APIRouter()
bearer_scheme = HTTPBearer()

def make_naive(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

def form_body(cls):
    cls.__signature__ = inspect.Signature(
        parameters=[
            inspect.Parameter(
                name=field_name,
                kind=inspect.Parameter.POSITIONAL_OR_KEYWORD,
                default=Form(...) if field.default is ... else Form(field.default),
                annotation=field.annotation,
            )
            for field_name, field in cls.__fields__.items()
        ],
        return_annotation=cls,
    )
    return cls

@form_body
class EventFormData(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    location: Optional[str] = None
    price: str
    published: bool = False
    created_at: str
    updated_at: str
    status: str = "draft"
    ticket_type_name: str = "standart"
    ticket_type_available_quantity: str
    ticket_type_free_registration: str = "false"
    remove_image: str = "false"
    
    class Config:
        from_attributes = True

async def process_image(image_file: Optional[UploadFile], remove_image: bool, old_image_url: Optional[str] = None) -> Optional[str]:
    if remove_image and old_image_url:
        file_path = old_image_url.replace("/images/", "private_media/")
        if os.path.exists(file_path):
            os.remove(file_path)
        return None
    
    if image_file:
        if old_image_url:
            file_path = old_image_url.replace("/images/", "private_media/")
            if os.path.exists(file_path):
                os.remove(file_path)
        
        file_extension = image_file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join("private_media", unique_filename)
        
        os.makedirs("private_media", exist_ok=True)
        content = await image_file.read()
        with open(file_path, "wb") as f:
            f.write(content)
            
        return f"/images/{unique_filename}"
    
    return old_image_url

async def prepare_event_data(form_data: EventFormData):
    try:
        price_float = float(form_data.price)
        available_quantity = int(form_data.ticket_type_available_quantity)
        
        if available_quantity <= 0:
            raise HTTPException(status_code=422, detail="Количество мест должно быть больше 0")
            
        free_registration = form_data.ticket_type_free_registration.lower() == "true"
        remove_image = form_data.remove_image.lower() == "true"
        
        start_date_dt = make_naive(datetime.fromisoformat(form_data.start_date.replace("Z", "+00:00")))
        end_date_dt = None
        if form_data.end_date:
            end_date_dt = make_naive(datetime.fromisoformat(form_data.end_date.replace("Z", "+00:00")))
            
        created_at_dt = make_naive(datetime.fromisoformat(form_data.created_at.replace("Z", "+00:00")))
        updated_at_dt = make_naive(datetime.fromisoformat(form_data.updated_at.replace("Z", "+00:00")))
        
        return {
            "price_float": price_float,
            "available_quantity": available_quantity,
            "free_registration": free_registration,
            "remove_image": remove_image,
            "start_date_dt": start_date_dt,
            "end_date_dt": end_date_dt,
            "created_at_dt": created_at_dt,
            "updated_at_dt": updated_at_dt
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

async def send_notifications(db: AsyncSession, event: Event, message: str, notification_type: str):
    # Создаем шаблон уведомления
    template = NotificationTemplate(
        message=message,
        type=notification_type,
        event_id=event.id,
        is_public=True,
        created_at=datetime.utcnow()
    )
    db.add(template)
    await db.flush()

    # Получаем всех пользователей
    stmt = select(User.id)
    result = await db.execute(stmt)
    user_ids = result.scalars().all()

    # Получаем все уникальные фингерпринты из активности пользователей
    stmt = select(UserActivity.device_fingerprint).distinct()
    result = await db.execute(stmt)
    fingerprints = result.scalars().all()

    # Создаем записи просмотров для всех пользователей
    for user_id in user_ids:
        view = NotificationView(
            template_id=template.id,
            user_id=user_id,
            is_viewed=False,
            created_at=datetime.utcnow()
        )
        db.add(view)

    # Создаем записи просмотров для всех устройств
    for fingerprint in fingerprints:
        if fingerprint:  # Проверяем, что fingerprint не None
            view = NotificationView(
                template_id=template.id,
                fingerprint=fingerprint,
                is_viewed=False,
                created_at=datetime.utcnow()
            )
            db.add(view)

    await db.commit()

@router.post("/", response_model=EventCreate)
async def create_event(
    form_data: EventFormData = Depends(),
    image_file: Optional[UploadFile] = File(None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None,
    db: AsyncSession = Depends(get_async_db)
):
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        
        processed_data = await prepare_event_data(form_data)
        
        image_url = await process_image(image_file, processed_data["remove_image"])
        
        event = Event(
            title=form_data.title,
            description=form_data.description,
            start_date=processed_data["start_date_dt"],
            end_date=processed_data["end_date_dt"],
            location=form_data.location,
            image_url=image_url,
            price=processed_data["price_float"],
            published=form_data.published,
            created_at=processed_data["created_at_dt"],
            updated_at=processed_data["updated_at_dt"],
            status=form_data.status
        )
        db.add(event)
        await db.flush()
        
        ticket = TicketType(
            event_id=event.id,
            name=form_data.ticket_type_name,
            price=processed_data["price_float"],
            available_quantity=processed_data["available_quantity"],
            free_registration=processed_data["free_registration"],
            sold_quantity=0
        )
        db.add(ticket)
        
        await db.commit()
        await db.refresh(event, attribute_names=["tickets"])
        
        # Send notifications only if event is published and not in draft
        if event.published and event.status != EventStatus.draft:
            await send_notifications(
                db,
                event,
                f"Новое мероприятие '{event.title}' опубликовано!",
                "publication"
            )
        
        await log_admin_activity(db, current_admin.id, request, action=f"create_event_{event.id}")
        
        response_data = EventCreate(
            id=event.id,
            title=event.title,
            description=event.description,
            start_date=event.start_date,
            end_date=event.end_date,
            location=event.location,
            image_url=event.image_url,
            price=float(event.price),
            published=event.published,
            created_at=event.created_at,
            updated_at=event.updated_at,
            status=event.status,
            ticket_type=TicketTypeCreate(
                name=ticket.name,
                price=float(ticket.price),
                available_quantity=ticket.available_quantity,
                free_registration=ticket.free_registration,
                sold_quantity=ticket.sold_quantity
            )
        )
        
        logger.info(f"Admin {current_admin.email} created event {event.id}")
        return response_data
        
    except ValueError as e:
        logger.error(f"Validation error in create_event: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось создать мероприятие: {str(e)}"
        )

@router.put("/{event_id}", response_model=EventCreate)
async def update_event(
    event_id: int,
    form_data: EventFormData = Depends(),
    image_file: Optional[UploadFile] = File(None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None,
    db: AsyncSession = Depends(get_async_db)
):
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        
        processed_data = await prepare_event_data(form_data)
        
        event = await db.get(Event, event_id, options=[selectinload(Event.tickets)])
        if not event:
            raise HTTPException(status_code=404, detail="Мероприятие не найдено")
        
        old_status = event.status
        old_published = event.published
        
        image_url = await process_image(
            image_file, 
            processed_data["remove_image"], 
            event.image_url
        )
        
        event.title = form_data.title
        event.description = form_data.description
        event.start_date = processed_data["start_date_dt"]
        event.end_date = processed_data["end_date_dt"]
        event.location = form_data.location
        event.image_url = image_url
        event.price = processed_data["price_float"]
        event.published = form_data.published
        event.created_at = processed_data["created_at_dt"]
        event.updated_at = processed_data["updated_at_dt"]
        event.status = form_data.status
        
        ticket_query = select(TicketType).where(TicketType.event_id == event_id)
        ticket = (await db.execute(ticket_query)).scalar_one_or_none()
        
        if ticket:
            ticket.name = form_data.ticket_type_name
            ticket.price = processed_data["price_float"]
            ticket.available_quantity = processed_data["available_quantity"]
            ticket.free_registration = processed_data["free_registration"]
        else:
            ticket = TicketType(
                event_id=event_id,
                name=form_data.ticket_type_name,
                price=processed_data["price_float"],
                available_quantity=processed_data["available_quantity"],
                free_registration=processed_data["free_registration"],
                sold_quantity=0,
            )
            db.add(ticket)
        
        await db.flush()
        
        # Send notifications only for status changes (excluding draft) or new publication
        if (old_status != form_data.status and form_data.status != EventStatus.draft) or (not old_published and form_data.published):
            message = (
                f"Новое мероприятие '{event.title}' опубликовано!"
                if (not old_published and form_data.published)
                else f"Статус мероприятия '{event.title}' изменен на '{form_data.status}'"
            )
            notification_type = "publication" if (not old_published and form_data.published) else "status_change"
            await send_notifications(db, event, message, notification_type)
        
        await db.commit()
        await db.refresh(event)
        
        ticket_data = event.tickets[0] if event.tickets else ticket
        response_data = EventCreate(
            id=event.id,
            title=event.title,
            description=event.description,
            start_date=event.start_date,
            end_date=event.end_date,
            location=event.location,
            image_url=event.image_url,
            price=float(event.price),
            published=event.published,
            created_at=event.created_at,
            updated_at=event.updated_at,
            status=event.status,
            ticket_type=TicketTypeCreate(
                name=ticket_data.name,
                price=float(ticket_data.price),
                available_quantity=ticket_data.available_quantity,
                free_registration=ticket_data.free_registration,
                sold_quantity=ticket_data.sold_quantity
            ) if ticket_data else None,
        )
        
        await log_admin_activity(db, current_admin.id, request, action=f"update_event_{event_id}")
        
        return response_data
    except ValueError as e:
        logger.error(f"Validation error in update_event: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось обновить мероприятие: {str(e)}")

# Маршрут для создания мероприятия (переработанный)
@router.get("/events", response_model=list[EventCreate])
async def get_admin_events(
    search: str = None,
    start_date: str = None,
    end_date: str = None,
    status_param: str = None,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action="access_events")

        query = select(Event).options(
            selectinload(Event.tickets),
            selectinload(Event.registrations)
        )
        if search:
            query = query.where(Event.title.ilike(f"%{search}%"))

        # Преобразование строковых дат в datetime
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.where(Event.start_date >= start_dt)
            except ValueError as e:
                logger.error(f"Invalid start_date format: {start_date}, error: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid start_date format, expected YYYY-MM-DD")

        if end_date:
            try:
                # Устанавливаем конец дня (23:59:59), чтобы включить события до конца указанной даты
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                query = query.where(Event.start_date <= end_dt)
            except ValueError as e:
                logger.error(f"Invalid end_date format: {end_date}, error: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid end_date format, expected YYYY-MM-DD")

        if status_param:
            # Проверка, что status_param соответствует значениям перечисления EventStatus
            try:
                status_value = EventStatus(status_param)
                query = query.where(Event.status == status_value)
            except ValueError:
                logger.error(f"Invalid status value: {status_param}")
                raise HTTPException(status_code=400, detail=f"Invalid status value: {status_param}")

        result = await db.execute(query)
        events = result.scalars().all()

        event_responses = []
        for event in events:
            registrations_count = len(event.registrations)
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
                "status": event.status,
                "registrations_count": registrations_count
            }
            if event.tickets:
                ticket = event.tickets[0]
                event_dict["ticket_type"] = {
                    "name": ticket.name,
                    "price": float(ticket.price),
                    "available_quantity": ticket.available_quantity,
                    "free_registration": ticket.free_registration,
                    "sold_quantity": ticket.sold_quantity
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
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action="access_users")

        query = select(User)
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                (User.fio.ilike(search_pattern)) |
                (User.email.ilike(search_pattern)) |
                (User.telegram.ilike(search_pattern)) |
                (User.whatsapp.ilike(search_pattern))
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
# backend/api/admin_edit_routers.py
from sqlalchemy import delete

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Удаление мероприятия (только в статусе черновик) с каскадным удалением связанных данных."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action=f"delete_event_{event_id}")

        # Проверка существования мероприятия
        query = select(Event).where(Event.id == event_id)
        result = await db.execute(query)
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(status_code=404, detail="Мероприятие не найдено")

        if event.status != EventStatus.draft:
            raise HTTPException(status_code=400, detail="Мероприятие можно удалить только в статусе 'черновик'")

        # Удаление связанных записей из ticket_types
        ticket_query = delete(TicketType).where(TicketType.event_id == event_id)
        await db.execute(ticket_query)

        # Удаление файла изображения, если он существует
        if event.image_url:
            file_path = event.image_url.replace("/images/", "private_media/")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Удалён файл изображения: {file_path}")
                except OSError as e:
                    logger.warning(f"Не удалось удалить файл {file_path}: {str(e)}")

        # Удаление самого мероприятия
        await db.delete(event)
        await db.commit()

        logger.info(f"Admin {current_admin.email} deleted event {event_id}")
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить мероприятие"
        )
        
# Маршрут для получения данных пользователя
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_admin_user(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Получение данных конкретного пользователя для админа."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action=f"access_user_{user_id}")

        query = select(User).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )

        logger.info(f"Admin {current_admin.email} accessed user {user_id}")
        return user
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving user {user_id} for admin: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )

# Маршрут для обновления данных пользователя
@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Обновление данных пользователя."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action=f"update_user_{user_id}")

        query = select(User).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )

        update_data = user_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user, key, value)

        await db.commit()
        await db.refresh(user)

        logger.info(f"Admin {current_admin.email} updated user {user_id}")
        return user
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось обновить пользователя: {str(e)}"
        )   
            
@router.get("/{event_id}", response_model=EventCreate)
async def get_admin_event(
    event_id: int,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Получение конкретного мероприятия для админа."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        await log_admin_activity(db, current_admin.id, request, action=f"access_event_{event_id}")

        query = select(Event).where(Event.id == event_id).options(selectinload(Event.tickets))
        result = await db.execute(query)
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Мероприятие не найдено"
            )

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
                "sold_quantity": ticket.sold_quantity,
                "free_registration": ticket.free_registration
            }

        logger.info(f"Admin {current_admin.email} accessed event {event_id}")
        return EventCreate(**event_dict)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving event {event_id} for admin: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve event"
        )
        