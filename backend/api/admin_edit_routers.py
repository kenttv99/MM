# backend/api/admin_edit_routers.py
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Request, Depends
from fastapi.responses import FileResponse
from backend.schemas_enums.schemas import EventCreate, TicketTypeCreate, UserResponse, UserUpdate
from backend.config.auth import get_current_admin, log_admin_activity
from backend.database.user_db import AsyncSession, get_async_db, Event, User, TicketType
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from backend.schemas_enums.enums import EventStatus
from datetime import datetime
import os
import uuid
from typing import Optional

router = APIRouter()

bearer_scheme = HTTPBearer()

def make_naive(dt: datetime) -> datetime:
    """Убирает временную зону из datetime."""
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

# Маршрут для создания мероприятия
@router.post("", response_model=EventCreate, status_code=status.HTTP_201_CREATED)
async def create_event(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    start_date: str = Form(...),
    end_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    price: str = Form(...),
    published: bool = Form(False),
    created_at: str = Form(...),
    updated_at: str = Form(...),
    status: str = Form("draft"),
    ticket_type_name: str = Form("standart"),
    ticket_type_available_quantity: str = Form(...),
    ticket_type_free_registration: str = Form("false"),
    image_file: Optional[UploadFile] = File(None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """Создание нового мероприятия."""
    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)

        # Валидация и преобразование данных
        price_float = float(price)
        available_quantity = int(ticket_type_available_quantity)
        if available_quantity <= 0:
            raise HTTPException(status_code=422, detail="Количество мест должно быть больше 0")
        free_registration = ticket_type_free_registration.lower() == "true"

        # Парсинг дат
        start_date_dt = make_naive(datetime.fromisoformat(start_date.replace("Z", "+00:00")))
        end_date_dt = (
            make_naive(datetime.fromisoformat(end_date.replace("Z", "+00:00")))
            if end_date
            else None
        )
        created_at_dt = make_naive(datetime.fromisoformat(created_at.replace("Z", "+00:00")))
        updated_at_dt = make_naive(datetime.fromisoformat(updated_at.replace("Z", "+00:00")))

        # Обработка изображения
        image_url = None
        if image_file:
            file_extension = image_file.filename.split('.')[-1]
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            file_path = os.path.join("private_media", unique_filename)
            os.makedirs("private_media", exist_ok=True)
            with open(file_path, "wb") as f:
                content = await image_file.read()
                f.write(content)
            image_url = f"/images/{unique_filename}"

        # Создание мероприятия
        new_event = Event(
            title=title,
            description=description,
            start_date=start_date_dt,
            end_date=end_date_dt,
            location=location,
            image_url=image_url,
            price=price_float,
            published=published,
            created_at=created_at_dt,
            updated_at=updated_at_dt,
            status=status,
        )
        db.add(new_event)
        await db.flush()

        # Создание ticket_type
        ticket = TicketType(
            event_id=new_event.id,
            name=ticket_type_name,
            price=price_float,
            available_quantity=available_quantity,
            free_registration=free_registration,
            sold_quantity=0,
        )
        db.add(ticket)

        await db.commit()
        await db.refresh(new_event)

        # Логирование действия
        await log_admin_activity(db, current_admin.id, request, action="create_event")

        # Формирование ответа
        ticket_data = ticket
        response_data = EventCreate(
            id=new_event.id,
            title=new_event.title,
            description=new_event.description,
            start_date=new_event.start_date,
            end_date=new_event.end_date,
            location=new_event.location,
            image_url=new_event.image_url,
            price=float(new_event.price),
            published=new_event.published,
            created_at=new_event.created_at,
            updated_at=new_event.updated_at,
            status=new_event.status,
            ticket_type=TicketTypeCreate(
                name=ticket_data.name,
                price=float(ticket_data.price),
                available_quantity=ticket_data.available_quantity,
                free_registration=ticket_data.free_registration,
            ),
        )
        return response_data
    except ValueError as e:
        logger.error(f"Validation error in create_event: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось создать мероприятие: {str(e)}")

# Маршрут для обновления мероприятия
@router.put("/{event_id}", response_model=EventCreate)
async def update_event(
    event_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    start_date: str = Form(...),
    end_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    price: str = Form(...),
    published: bool = Form(False),
    created_at: str = Form(...),
    updated_at: str = Form(...),
    status: str = Form("draft"),
    ticket_type_name: str = Form("standart"),
    ticket_type_available_quantity: str = Form(...),
    ticket_type_free_registration: str = Form("false"),
    remove_image: str = Form("false"),
    image_file: Optional[UploadFile] = File(None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Обновление мероприятия."""
    async with get_async_db() as db:
        try:
            token = credentials.credentials
            current_admin = await get_current_admin(token, db)

            # Валидация и преобразование данных
            price_float = float(price)
            available_quantity = int(ticket_type_available_quantity)
            if available_quantity <= 0:
                raise HTTPException(status_code=422, detail="Количество мест должно быть больше 0")
            free_registration = ticket_type_free_registration.lower() == "true"
            remove_image_flag = remove_image.lower() == "true"

            # Парсинг дат
            start_date_dt = make_naive(datetime.fromisoformat(start_date.replace("Z", "+00:00")))
            end_date_dt = (
                make_naive(datetime.fromisoformat(end_date.replace("Z", "+00:00")))
                if end_date
                else None
            )
            created_at_dt = make_naive(datetime.fromisoformat(created_at.replace("Z", "+00:00")))
            updated_at_dt = make_naive(datetime.fromisoformat(updated_at.replace("Z", "+00:00")))

            # Находим мероприятие
            event = await db.get(Event, event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Мероприятие не найдено")

            # Обновляем поля мероприятия
            event.title = title
            event.description = description
            event.start_date = start_date_dt
            event.end_date = end_date_dt
            event.location = location
            event.price = price_float
            event.published = published
            event.created_at = created_at_dt
            event.updated_at = updated_at_dt
            event.status = status

            # Обработка изображения
            if remove_image_flag and event.image_url:
                file_path = event.image_url.replace("/images/", "private_media/")
                if os.path.exists(file_path):
                    os.remove(file_path)
                event.image_url = None
            elif image_file:
                if event.image_url:
                    file_path = event.image_url.replace("/images/", "private_media/")
                    if os.path.exists(file_path):
                        os.remove(file_path)
                file_extension = image_file.filename.split('.')[-1]
                unique_filename = f"{uuid.uuid4()}.{file_extension}"
                file_path = os.path.join("private_media", unique_filename)
                os.makedirs("private_media", exist_ok=True)
                with open(file_path, "wb") as f:
                    content = await image_file.read()
                    f.write(content)
                event.image_url = f"/images/{unique_filename}"

            # Обновляем ticket_type
            ticket_query = select(TicketType).where(TicketType.event_id == event_id)
            ticket = (await db.execute(ticket_query)).scalar_one_or_none()
            if ticket:
                ticket.name = ticket_type_name
                ticket.price = price_float
                ticket.available_quantity = available_quantity
                ticket.free_registration = free_registration
            else:
                ticket = TicketType(
                    event_id=event_id,
                    name=ticket_type_name,
                    price=price_float,
                    available_quantity=available_quantity,
                    free_registration=free_registration,
                    sold_quantity=0,
                )
                db.add(ticket)

            await db.commit()
            await db.refresh(event)

            # Логирование действия
            await log_admin_activity(db, current_admin.id, request, action=f"update_event_{event_id}")

            # Формирование ответа
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
                ) if ticket_data else None,
            )
            return response_data
        except ValueError as e:
            logger.error(f"Validation error in update_event: {str(e)}")
            await db.rollback()
            raise HTTPException(status_code=422, detail=str(e))
        except Exception as e:
            logger.error(f"Error updating event {event_id}: {str(e)}")
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Не удалось обновить мероприятие: {str(e)}")

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
@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
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
        await log_admin_activity(db, current_admin.id, request, action=f"delete_event_{event_id}")

        query = select(Event).where(Event.id == event_id)
        result = await db.execute(query)
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Мероприятие не найдено"
            )

        if event.status != EventStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Мероприятие можно удалить только в статусе 'черновик'"
            )

        ticket_query = delete(TicketType).where(TicketType.event_id == event_id)
        await db.execute(ticket_query)

        if event.image_url:
            try:
                file_path = event.image_url.replace("/images/", "private_media/")
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete image {event.image_url}: {str(e)}")

        await db.delete(event)
        await db.commit()

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

# Маршрут для получения изображения
@router.get("/images/{filename}")
async def get_image(
    filename: str,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    token = credentials.credentials
    await get_current_admin(token, db)  # Проверка авторизации
    file_path = os.path.join("private_media", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Изображение не найдено")
    return FileResponse(file_path)

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