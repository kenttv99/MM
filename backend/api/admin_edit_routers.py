# backend/api/admin_edit_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from backend.schemas_enums.schemas import EventCreate, EventUpdate, UserResponse, UserUpdate, EventCreateForm
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
from typing import Optional, Tuple

router = APIRouter()

bearer_scheme = HTTPBearer()

def make_naive(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

# Кастомный dependency для парсинга формы в Pydantic-модель
async def parse_event_form(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    start_date: str = Form(...),
    end_date: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    price: str = Form(...),
    published: bool = Form(False),
    created_at: str = Form(...),
    updated_at: str = Form(...),
    status: EventStatus = Form(EventStatus.draft),
    ticket_type_name: str = Form("standart"),
    ticket_type_available_quantity: str = Form(...),
    ticket_type_free_registration: str = Form("false"),
    remove_image: str = Form("false"),  # Новый параметр для удаления обложки
) -> Tuple[EventCreateForm, str, int, bool, bool]:
    try:
        # Преобразуем строковые значения в нужные типы
        available_quantity = int(ticket_type_available_quantity)
        if available_quantity <= 0:
            raise ValueError("Количество мест должно быть больше 0")
        free_registration = ticket_type_free_registration.lower() == "true"
        remove_image_flag = remove_image.lower() == "true"

        # Создаем словарь из полученных данных
        form_data = {
            "title": title,
            "description": description,
            "start_date": start_date,
            "end_date": end_date,
            "location": location,
            "price": price,
            "published": published,
            "created_at": created_at,
            "updated_at": updated_at,
            "status": status,
        }
        # Преобразуем в Pydantic-модель
        event_form = EventCreateForm(**form_data)
        return event_form, ticket_type_name, available_quantity, free_registration, remove_image_flag
    except ValueError as e:
        logger.error(f"Validation error in parse_event_form: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in parse_event_form: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ошибка валидации данных формы")

# Маршрут для получения списка мероприятий
@router.get("/events", response_model=list[EventCreate])
async def get_admin_events(
    search: str = None,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    token = credentials.credentials
    # Минимальная проверка наличия токена, без полной валидации
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация"
        )
    
    try:
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

        # Логируем действие (предполагаем, что ID админа известен клиенту)
        admin_id = 1  # Здесь можно извлечь ID из токена, если он включён в payload
        await log_admin_activity(db, admin_id, request, action="access_events")
        logger.info(f"Admin accessed events list")
        return event_responses
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

        # Удаляем связанные записи в TicketType
        ticket_query = delete(TicketType).where(TicketType.event_id == event_id)
        await db.execute(ticket_query)

        # Удаляем обложку, если она существует
        if event.image_url:
            try:
                file_path = event.image_url.replace("/images/", "private_media/")
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete image {event.image_url}: {str(e)}")

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
        
@router.get("/images/{filename}")
async def get_image(
    filename: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db)
):
    try:
        # Проверяем авторизацию
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)

        # Проверяем, существует ли файл
        file_path = os.path.join("private_media", filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Изображение не найдено")

        # Возвращаем файл
        return FileResponse(file_path)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving image {filename}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")

# Маршрут для создания мероприятия
@router.post("", response_model=EventCreate, status_code=status.HTTP_201_CREATED)
async def create_event(
    form_data: Tuple[EventCreateForm, str, int, bool, bool] = Depends(parse_event_form),
    image_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    event_form, ticket_type_name, ticket_type_available_quantity, ticket_type_free_registration, _ = form_data

    try:
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)

        # Логируем полученные данные для отладки
        logger.info(f"Received form data: {event_form.dict()}")
        logger.info(f"TicketType data: name={ticket_type_name}, available_quantity={ticket_type_available_quantity}, free_registration={ticket_type_free_registration}")

        # Парсим строки в datetime
        start_date = datetime.fromisoformat(event_form.start_date.replace("Z", "+00:00"))
        end_date = datetime.fromisoformat(event_form.end_date.replace("Z", "+00:00")) if event_form.end_date else None
        created_at = datetime.fromisoformat(event_form.created_at.replace("Z", "+00:00"))
        updated_at = datetime.fromisoformat(event_form.updated_at.replace("Z", "+00:00"))

        # Конвертируем price из строки в float
        price = float(event_form.price)

        # Преобразуем все временные метки в timezone-naive
        start_date = make_naive(start_date)
        end_date = make_naive(end_date) if end_date else None
        created_at = make_naive(created_at)
        updated_at = make_naive(updated_at)

        # Обрабатываем загрузку файла
        image_url = None
        if image_file:
            file_extension = image_file.filename.split('.')[-1]
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            file_path = os.path.join("private_media", unique_filename)  # Изменяем директорию
            os.makedirs("private_media", exist_ok=True)
            with open(file_path, "wb") as f:
                content = await image_file.read()
                f.write(content)
            image_url = f"/images/{unique_filename}"  # URL для доступа через защищённый маршрут

        # Создаём объект EventCreate
        event_data = EventCreate(
            title=event_form.title,
            description=event_form.description,
            start_date=start_date,
            end_date=end_date,
            location=event_form.location,
            image_url=image_url,
            price=price,
            published=event_form.published,
            created_at=created_at,
            updated_at=updated_at,
            status=event_form.status or EventStatus.draft,
            ticket_type={
                "name": ticket_type_name,
                "price": price,
                "available_quantity": ticket_type_available_quantity,
                "free_registration": ticket_type_free_registration,
            }
        )

        # Создаём новое мероприятие
        new_event = Event(
            title=event_data.title,
            description=event_data.description,
            start_date=event_data.start_date,
            end_date=event_data.end_date,
            location=event_data.location,
            image_url=event_data.image_url,
            price=event_data.price,
            published=event_data.published,
            created_at=event_data.created_at,
            updated_at=event_data.updated_at,
            status=event_data.status or EventStatus.draft
        )

        db.add(new_event)
        await db.flush()  # Сохраняем событие в базе, чтобы получить ID

        # Создаём запись в TicketType
        ticket = TicketType(
            event_id=new_event.id,
            name=ticket_type_name,
            price=price,
            available_quantity=ticket_type_available_quantity,
            free_registration=ticket_type_free_registration,
            sold_quantity=0
        )
        db.add(ticket)

        await db.commit()
        await db.refresh(new_event)

        # Формируем ответ
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
            "status": new_event.status,
            "ticket_type": {
                "name": ticket.name,
                "price": float(ticket.price),
                "available_quantity": ticket.available_quantity,
                "free_registration": ticket.free_registration,
            }
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

@router.put("/{event_id}", response_model=EventCreate)
async def update_event(
    event_id: int,
    form_data: Tuple[EventCreateForm, str, int, bool, bool] = Depends(parse_event_form),
    image_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    event_form, ticket_type_name, ticket_type_available_quantity, ticket_type_free_registration, remove_image = form_data

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

        # Парсим строки в datetime
        start_date = datetime.fromisoformat(event_form.start_date.replace("Z", "+00:00"))
        end_date = datetime.fromisoformat(event_form.end_date.replace("Z", "+00:00")) if event_form.end_date else None
        created_at = datetime.fromisoformat(event_form.created_at.replace("Z", "+00:00"))
        updated_at = datetime.fromisoformat(event_form.updated_at.replace("Z", "+00:00"))

        # Конвертируем price из строки в float
        price = float(event_form.price)

        # Преобразуем все временные метки в timezone-naive
        start_date = make_naive(start_date)
        end_date = make_naive(end_date) if end_date else None
        created_at = make_naive(created_at)
        updated_at = make_naive(updated_at)

        # Обрабатываем загрузку файла
        image_url = event.image_url
        if remove_image and event.image_url:
            # Удаляем старый файл, если он существует
            try:
                file_path = event.image_url.replace("/images/", "private_media/")
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete old image {event.image_url}: {str(e)}")
            image_url = None
        if image_file:
            # Удаляем старый файл, если он существует
            if event.image_url:
                try:
                    file_path = event.image_url.replace("/images/", "private_media/")
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete old image {event.image_url}: {str(e)}")
            # Загружаем новый файл
            file_extension = image_file.filename.split('.')[-1]
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            file_path = os.path.join("private_media", unique_filename)
            os.makedirs("private_media", exist_ok=True)
            with open(file_path, "wb") as f:
                content = await image_file.read()
                f.write(content)
            image_url = f"/images/{unique_filename}"

        # Обновляем поля мероприятия
        event.title = event_form.title
        event.description = event_form.description
        event.start_date = start_date
        event.end_date = end_date
        event.location = event_form.location
        event.image_url = image_url
        event.price = price
        event.published = event_form.published
        event.created_at = created_at
        event.updated_at = updated_at
        event.status = event_form.status or EventStatus.draft

        # Обновляем или создаем запись в TicketType
        ticket_query = select(TicketType).where(TicketType.event_id == event_id)
        result = await db.execute(ticket_query)
        ticket = result.scalar_one_or_none()
        if ticket:
            ticket.name = ticket_type_name
            ticket.price = price
            ticket.available_quantity = ticket_type_available_quantity
            ticket.free_registration = ticket_type_free_registration
        else:
            ticket = TicketType(
                event_id=event_id,
                name=ticket_type_name,
                price=price,
                available_quantity=ticket_type_available_quantity,
                free_registration=ticket_type_free_registration,
                sold_quantity=0
            )
            db.add(ticket)

        await db.commit()
        await db.refresh(event)

        # Формируем ответ
        response_data = {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "start_date": event.start_date,
            "end_date": event.end_date,
            "location": event.location,
            "image_url": event.image_url,
            "price": float(event.price),
            "published": event.published,
            "created_at": event.created_at,
            "updated_at": event.updated_at,
            "status": event.status,
            "ticket_type": {
                "name": ticket.name,
                "price": float(ticket.price),
                "available_quantity": ticket.available_quantity,
                "free_registration": ticket.free_registration,
            }
        }

        await log_admin_activity(db, current_admin.id, request, action=f"update_event_{event_id}")
        logger.info(f"Admin {current_admin.email} updated event {event_id}")
        return response_data
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error updating event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось обновить мероприятие: {str(e)}"
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

# Новый маршрут для получения данных пользователя
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

# Новый маршрут для обновления данных пользователя
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

        # Находим пользователя
        query = select(User).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )

        # Обновляем поля пользователя
        update_data = user_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user, key, value)

        await db.commit()
        await db.refresh(user)

        await log_admin_activity(db, current_admin.id, request, action=f"update_user_{user_id}")
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