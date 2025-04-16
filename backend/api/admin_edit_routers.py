# backend/api/admin_edit_routers.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request, Body, Query
from fastapi.responses import FileResponse
from backend.schemas_enums.schemas import EventCreate, TicketTypeCreate, UserResponse, UserUpdate, PaginatedResponse
from backend.config.auth import get_current_admin, log_admin_activity, get_last_user_activity
from backend.database.user_db import AsyncSession, NotificationTemplate, NotificationView, UserActivity, get_async_db, Event, User, TicketType, Registration, Media
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, delete, func, or_, asc, desc, case, cast, Integer, Float, outerjoin
from sqlalchemy.orm import selectinload
from backend.schemas_enums.enums import EventStatus, Status
from datetime import datetime, timedelta
import os
import uuid
from typing import Optional, List
import inspect
from pydantic import BaseModel, field_validator
import re
import io
from PIL import Image as PillowImage
import glob

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
    remove_image: str = "false"
    url_slug: Optional[str] = None
    
    class Config:
        from_attributes = True

def generate_slug_with_id(slug: str, event_id: int, start_date: datetime) -> str:
    """Генерирует базовый слаг без суффиксов года и ID."""
    # Проверка на валидность слага (только латиница, цифры, дефис)
    valid_slug = re.sub(r'[^a-z0-9-]', '-', slug.lower())
    # Замена множественных дефисов одним
    valid_slug = re.sub(r'-+', '-', valid_slug)
    # Удаление дефисов с начала и конца
    valid_slug = valid_slug.strip('-')
    
    # Если слаг пустой после очистки, используем 'event'
    if not valid_slug:
        valid_slug = 'event'
    
    # Возвращаем только базовый слаг без суффиксов
    return valid_slug

async def process_image(image_file: Optional[UploadFile], remove_image: bool, old_image_url: Optional[str] = None) -> Optional[str]:
    """
    Обрабатывает загруженное изображение, создает оптимизированные WebP версии
    и сохраняет их. Возвращает путь к оптимизированной версии среднего размера.
    Удаляет старые файлы при необходимости.
    """
    media_dir = "private_media"
    os.makedirs(media_dir, exist_ok=True)

    # --- Логика удаления старых файлов ---
    if (remove_image or image_file) and old_image_url:
        try:
            # Извлекаем имя файла без пути и расширения (предполагаем формат /images/uuid.ext)
            old_filename = os.path.basename(old_image_url)
            old_uuid_base = os.path.splitext(old_filename)[0]
            # Ищем все файлы с этим UUID в media_dir
            old_files_pattern = os.path.join(media_dir, f"{old_uuid_base}*")
            logger.info(f"Searching for old files to delete with pattern: {old_files_pattern}")
            for old_file_path in glob.glob(old_files_pattern):
                try:
                    os.remove(old_file_path)
                    logger.info(f"Deleted old image file: {old_file_path}")
                except OSError as e:
                    logger.error(f"Error deleting old image file {old_file_path}: {e}")
        except Exception as e:
            logger.error(f"Error processing old image URL {old_image_url} for deletion: {e}")

        # Если удаляем и нового файла нет, выходим
        if remove_image and not image_file:
            return None

    # --- Логика обработки нового файла ---
    if image_file:
        try:
            content = await image_file.read()
            img = PillowImage.open(io.BytesIO(content))
            img = img.convert("RGB") # Конвертируем в RGB для совместимости с WebP/JPEG

            unique_uuid = str(uuid.uuid4())

            # --- Сохранение оригинала ---
            original_extension = image_file.filename.split('.')[-1].lower()
            # Разрешаем только распространенные форматы
            allowed_extensions = ['jpg', 'jpeg', 'png']
            if original_extension not in allowed_extensions:
                 raise HTTPException(status_code=400, detail=f"Unsupported image format: {original_extension}. Allowed: {allowed_extensions}")

            original_filename = f"{unique_uuid}_original.{original_extension}"
            original_path = os.path.join(media_dir, original_filename)
            with open(original_path, "wb") as f:
                 f.write(content)
            logger.info(f"Saved original image: {original_path}")


            # --- Оптимизация и сохранение WebP версий ---
            optimized_paths = {}
            sizes = {
                "medium": 600,  # Ширина для карточек
                "large": 1200  # Ширина для детального просмотра (пример)
            }

            for size_name, width in sizes.items():
                img_copy = img.copy()
                # Рассчитываем высоту, сохраняя пропорции
                aspect_ratio = img_copy.height / img_copy.width
                new_height = int(width * aspect_ratio)
                img_copy.thumbnail((width, new_height)) # Используем thumbnail для сохранения качества

                webp_filename = f"{unique_uuid}_{size_name}.webp"
                webp_path = os.path.join(media_dir, webp_filename)
                img_copy.save(webp_path, format="WEBP", quality=80, optimize=True)
                optimized_paths[size_name] = f"/images/{webp_filename}"
                logger.info(f"Saved optimized {size_name} WebP image: {webp_path}")

            # Возвращаем путь к оптимизированной версии для карточки (medium)
            return optimized_paths.get("medium")

        except HTTPException as e:
             raise e # Перебрасываем HTTP исключения
        except Exception as e:
            logger.error(f"Error processing uploaded image: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Ошибка при обработке изображения.")

    # Если нового файла нет и старый не удалялся, возвращаем старый URL
    # Или если удаляли старый, но не было нового файла (remove_image=True), то вернется None выше
    return old_image_url if not remove_image else None

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

# НОВАЯ модель Pydantic для обновления данных (только изменяемые поля)
class EventUpdatePayload(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: str # Ожидаем строку ISO формата YYYY-MM-DDTHH:MM:SS
    end_date: Optional[str] = None # Ожидаем строку ISO формата YYYY-MM-DDTHH:MM:SS
    location: Optional[str] = None
    price: float # Используем float для цены
    published: bool = False
    status: str = "draft"
    ticket_type_name: str = "standart"
    ticket_type_available_quantity: int # Используем int
    remove_image: bool = False # Используем bool
    url_slug: Optional[str] = None

    @field_validator('start_date', 'end_date')
    def validate_iso_format(cls, value):
        if value is None: return value
        try:
            # Пробуем парсить как дату-время
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            return value
        except ValueError:
            raise ValueError("Date must be in ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SS)")

    @field_validator('status')
    def validate_status(cls, value):
        allowed_statuses = [s.value for s in EventStatus]
        if value not in allowed_statuses:
            raise ValueError(f"Invalid status. Allowed values: {allowed_statuses}")
        return value

    class Config:
        from_attributes = True

@router.post("/", response_model=EventCreate)
async def create_event(
    # Используем Form(...) для явного указания полей формы
    title: str = Form(...),
    description: Optional[str] = Form(None),
    start_date: str = Form(...), # Ожидаем строку YYYY-MM-DDTHH:MM:SS
    end_date: Optional[str] = Form(None), # Ожидаем строку YYYY-MM-DDTHH:MM:SS
    location: Optional[str] = Form(None),
    price: str = Form(...), # Цена как строка
    published: bool = Form(False),
    event_status: str = Form("draft"),
    ticket_type_name: str = Form("standart"),
    ticket_type_available_quantity: str = Form(...), # Количество как строка
    remove_image: str = Form("false"), # Как строка
    url_slug: Optional[str] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None,
    db: AsyncSession = Depends(get_async_db)
):
    try:
        logger.info(f"Create event request received. Auth header: {request.headers.get('Authorization')[:20] if request.headers.get('Authorization') else 'None'}")
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        logger.info(f"Admin authenticated: {current_admin.email}")

        # Валидация и подготовка данных вручную
        try:
            price_float = float(price)
            available_quantity = int(ticket_type_available_quantity)
            if available_quantity <= 0:
                raise HTTPException(status_code=422, detail="Количество мест должно быть больше 0")
            remove_image_bool = remove_image.lower() == "true"
            start_date_dt = make_naive(datetime.fromisoformat(start_date.replace("Z", "+00:00")))
            end_date_dt = None
            if end_date:
                end_date_dt = make_naive(datetime.fromisoformat(end_date.replace("Z", "+00:00")))
            # created_at/updated_at устанавливаются автоматически
            created_at_dt = datetime.utcnow()
            updated_at_dt = datetime.utcnow()

            # Валидация статуса
            allowed_statuses = [s.value for s in EventStatus]
            if event_status not in allowed_statuses:
                 raise HTTPException(status_code=422, detail=f"Invalid status. Allowed: {allowed_statuses}")

        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Invalid data format: {e}")

        image_url = await process_image(image_file, remove_image_bool)

        event = Event(
            title=title,
            description=description,
            start_date=start_date_dt,
            end_date=end_date_dt,
            location=location,
            image_url=image_url,
            price=price_float,
            published=published,
            created_at=created_at_dt, # Устанавливаем текущее время
            updated_at=updated_at_dt, # Устанавливаем текущее время
            status=event_status
        )
        db.add(event)
        await db.flush() # Получаем ID события

        # Генерация и сохранение url_slug после получения id
        if url_slug:
            event.url_slug = generate_slug_with_id(url_slug, event.id, start_date_dt)

        ticket = TicketType(
            event_id=event.id,
            name=ticket_type_name,
            price=price_float,
            available_quantity=available_quantity,
            free_registration=False, # По умолчанию
            sold_quantity=0
        )
        db.add(ticket)

        await db.commit()
        await db.refresh(event, attribute_names=["tickets"])

        if event.published and event.status != EventStatus.draft:
            await send_notifications(
                db,
                event,
                f"Новое мероприятие '{event.title}' опубликовано!",
                "publication"
            )

        await log_admin_activity(db, current_admin.id, request, action=f"create_event_{event.id}")

        response_data = EventCreate.from_orm(event)
        return response_data

    except HTTPException as http_exc:
        logger.error(f"HTTPException in create_event: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.exception(f"Unexpected error in create_event: {e}")
        await db.rollback() # Откат транзакции при ошибке
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.put("/{event_id}", response_model=EventCreate)
async def update_event(
    event_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    start_date: str = Form(...), # Ожидаем строку ISO формата
    end_date: Optional[str] = Form(None), # Ожидаем строку ISO формата
    location: Optional[str] = Form(None),
    price: float = Form(...), # Цена как float
    published: bool = Form(False),
    event_status: str = Form("draft"),
    ticket_type_name: str = Form("standart"),
    ticket_type_available_quantity: int = Form(...), # Количество как int
    remove_image: bool = Form(False), # Как bool
    url_slug: Optional[str] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None,
    db: AsyncSession = Depends(get_async_db)
):
    try:
        logger.info(f"Update event request received for ID: {event_id}. Auth header: {request.headers.get('Authorization')[:20] if request.headers.get('Authorization') else 'None'}")
        token = credentials.credentials
        current_admin = await get_current_admin(token, db)
        logger.info(f"Admin authenticated: {current_admin.email}")

        # ВАЖНО: Создаем объект payload ИЗ полей формы для валидации
        try:
            payload_data = {
                "title": title, "description": description, "start_date": start_date,
                "end_date": end_date, "location": location, "price": price,
                "published": published, "status": event_status, "ticket_type_name": ticket_type_name,
                "ticket_type_available_quantity": ticket_type_available_quantity,
                "remove_image": remove_image, "url_slug": url_slug
            }
            # Валидируем данные с помощью Pydantic модели
            payload = EventUpdatePayload(**payload_data)
        except Exception as validation_error: # Ловим ошибки валидации Pydantic
             logger.error(f"Validation error creating payload from form data: {validation_error}")
             # Можно вернуть более детальное сообщение об ошибке, если нужно
             raise HTTPException(status_code=422, detail=f"Invalid form data: {validation_error}")

        # Ищем существующее событие
        stmt = select(Event).where(Event.id == event_id).options(selectinload(Event.tickets))
        result = await db.execute(stmt)
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        # Валидация дат ИЗ payload (уже провалидированного)
        try:
            start_date_dt = make_naive(datetime.fromisoformat(payload.start_date.replace("Z", "+00:00")))
            end_date_dt = None
            if payload.end_date:
                end_date_dt = make_naive(datetime.fromisoformat(payload.end_date.replace("Z", "+00:00")))
                if end_date_dt < start_date_dt:
                    raise ValueError("End date cannot be earlier than start date")
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Invalid date format or logic: {e}")

        # Обработка изображения
        old_image_url = event.image_url
        # Используем payload.remove_image (уже bool)
        new_image_url = await process_image(image_file, payload.remove_image, old_image_url)

        # Обновляем поля события данными из payload
        event.title = payload.title
        event.description = payload.description
        event.start_date = start_date_dt
        event.end_date = end_date_dt
        event.location = payload.location
        event.image_url = new_image_url
        event.price = payload.price
        event.published = payload.published
        event.status = payload.status
        event.updated_at = datetime.utcnow() # Обновляем время изменения

        # Обработка URL slug
        original_slug = event.url_slug
        new_base_slug = None
        if payload.url_slug:
            new_base_slug = generate_slug_with_id(payload.url_slug, event.id, start_date_dt)
            if new_base_slug != original_slug:
                event.url_slug = new_base_slug
                logger.info(f"URL slug updated for event {event_id} from '{original_slug}' to '{new_base_slug}'")

        # Обновляем или создаем тип билета
        ticket = event.tickets[0] if event.tickets else None
        if ticket:
            ticket.name = payload.ticket_type_name
            ticket.price = payload.price # Используем float из payload
            ticket.available_quantity = payload.ticket_type_available_quantity # Используем int из payload
            # sold_quantity не обновляется здесь
        else:
            # Создаем новый билет, если его не было
            ticket = TicketType(
                event_id=event.id,
                name=payload.ticket_type_name,
                price=payload.price,
                available_quantity=payload.ticket_type_available_quantity,
                free_registration=False,
                sold_quantity=0
            )
            db.add(ticket)

        await db.commit()
        await db.refresh(event, attribute_names=["tickets"])

        # Логика уведомлений (если нужна)

        await log_admin_activity(db, current_admin.id, request, action=f"update_event_{event.id}")

        # Возвращаем данные в формате EventCreate
        response_data = EventCreate.from_orm(event)
        return response_data

    except HTTPException as http_exc:
        logger.error(f"HTTPException in update_event: {http_exc.detail}")
        await db.rollback() # Добавляем откат при HTTPException
        raise http_exc
    except Exception as e:
        logger.exception(f"Unexpected error in update_event: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.get("/events", response_model=PaginatedResponse[EventCreate])
async def get_admin_events(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="statusFilter"),
    start_date_filter: Optional[str] = Query(None, alias="startDateFilter"),
    end_date_filter: Optional[str] = Query(None, alias="endDateFilter"),
    sort_by: Optional[str] = Query("published", alias="sortBy"),
    sort_order: Optional[str] = Query("desc", alias="sortOrder"),
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    admin = await get_current_admin(credentials.credentials, db)
    if not admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    logger.info(f"Admin {admin.email} fetching events with params: search='{search}', statusFilter='{status_filter}', startDateFilter='{start_date_filter}', endDateFilter='{end_date_filter}', sortBy='{sort_by}', sortOrder='{sort_order}', skip={skip}, limit={limit}")

    # Базовый запрос с LEFT JOIN к TicketType для сортировки по заполненности
    base_query = select(Event).options(
        selectinload(Event.tickets),
        selectinload(Event.registrations)
    ).outerjoin(TicketType, Event.id == TicketType.event_id)

    # Запрос для подсчета общего количества (без join, т.к. он нужен только для сортировки)
    count_base_query = select(func.count()).select_from(Event)

    # Применяем фильтры (к обоим запросам, где это применимо)
    filters = []
    if search:
        search_term = f"%{search}%"
        filters.append(Event.title.ilike(search_term))

    if start_date_filter:
        try:
            start_dt = datetime.strptime(start_date_filter, "%Y-%m-%d")
            filters.append(Event.start_date >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date_filter format. Use YYYY-MM-DD.")

    if end_date_filter:
        try:
            end_dt = datetime.strptime(end_date_filter, "%Y-%m-%d")
            end_dt_exclusive = end_dt + timedelta(days=1)
            filters.append(Event.start_date < end_dt_exclusive)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date_filter format. Use YYYY-MM-DD.")

    if status_filter:
        allowed_statuses = [s.value for s in EventStatus]
        if status_filter in allowed_statuses:
             filters.append(Event.status == status_filter)
        else:
             logger.warning(f"Invalid status_filter provided: {status_filter}")

    # Применяем собранные фильтры
    if filters:
        base_query = base_query.where(or_(*filters))
        count_query = count_base_query.where(or_(*filters)) # Применяем те же фильтры к count
    else:
        count_query = count_base_query # Если фильтров нет, используем исходный count

    # Считаем общее количество после фильтрации
    total_count_result = await db.execute(count_query)
    total = total_count_result.scalar_one_or_none() or 0

    # Применяем сортировку
    order_func = desc if sort_order == "desc" else asc

    # --- Обновленная логика сортировки --- 
    sort_column = None
    if sort_by == "published":
        sort_column = Event.published
    elif sort_by == "occupancy":
        # Сортируем по количеству проданных билетов. Используем coalesce на случай отсутствия билета.
        sort_column = func.coalesce(TicketType.sold_quantity, 0)
    # created_at больше не опция

    # По умолчанию сортируем по published desc, если sort_by некорректный
    if sort_column is None:
        sort_column = Event.published
        order_func = desc # Явно ставим desc для дефолта

    # Добавляем вторичную сортировку по ID для стабильности
    query = base_query.order_by(order_func(sort_column), Event.id).offset(skip).limit(limit)
    # --- Конец обновленной логики --- 

    result = await db.execute(query)
    events = result.scalars().unique().all()

    event_responses = []
    for event in events:
        ticket = event.tickets[0] if event.tickets else None
        remaining_quantity = ticket.available_quantity - ticket.sold_quantity if ticket else 0
        
        base_slug = generate_slug_with_id(event.url_slug or event.title, event.id, event.start_date)
        formatted_slug = f"{base_slug}-{event.start_date.year}-{event.id}" if base_slug else None
        
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
            url_slug=formatted_slug,
            registrations_count=len(event.registrations),
            ticket_type=TicketTypeCreate(
                name=ticket.name if ticket else None,
                price=float(ticket.price) if ticket else 0.0,
                available_quantity=ticket.available_quantity if ticket else 0,
                free_registration=ticket.free_registration if ticket else False,
                remaining_quantity=remaining_quantity,
                sold_quantity=ticket.sold_quantity if ticket else 0
            ) if ticket else None
        )
        event_responses.append(event_response)

    return PaginatedResponse(
        items=event_responses,
        total=total,
        skip=skip,
        limit=limit
    )

@router.get("/users", response_model=PaginatedResponse[UserResponse])
async def get_admin_users(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    # Параметры сортировки для пользователей
    sort_by: Optional[str] = Query("created_at", alias="sortBy"),
    sort_order: Optional[str] = Query("asc", alias="sortOrder"),
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    admin = await get_current_admin(credentials.credentials, db)
    if not admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    logger.info(f"Admin {admin.email} fetching users with params: search='{search}', sortBy='{sort_by}', sortOrder='{sort_order}', skip={skip}, limit={limit}")

    base_query = select(User).options(selectinload(User.activities))
    count_query = select(func.count()).select_from(User)

    # Фильтр поиска
    if search:
        search_term = f"%{search}%"
        search_filter = or_(
            User.fio.ilike(search_term),
            User.email.ilike(search_term),
            User.telegram.ilike(search_term),
            User.whatsapp.ilike(search_term)
        )
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Считаем общее количество
    total_count_result = await db.execute(count_query)
    total = total_count_result.scalar_one_or_none() or 0

    # Применяем сортировку
    sort_column_map = {
        "created_at": User.created_at,
        "fio": User.fio,
        "email": User.email
        # last_active требует доп. логики (join или subquery)
    }
    sort_column = sort_column_map.get(sort_by, User.created_at)

    order_func = desc if sort_order == "desc" else asc
    
    # Добавляем вторичную сортировку по ID для стабильности
    query = base_query.order_by(order_func(sort_column), asc(User.id)).offset(skip).limit(limit)

    result = await db.execute(query)
    users = result.scalars().unique().all()

    user_responses = []
    for user in users:
        last_active_time = max((act.created_at for act in user.activities), default=None)
        user_responses.append(
            UserResponse(
                id=user.id,
                fio=user.fio,
                email=user.email,
                avatar_url=user.avatar_url,
                telegram=user.telegram,
                whatsapp=user.whatsapp,
                is_blocked=user.is_blocked,
                is_partner=user.is_partner,
                created_at=user.created_at,
                updated_at=user.updated_at,
                last_active=last_active_time
            )
        )

    return PaginatedResponse(
        items=user_responses,
        total=total,
        skip=skip,
        limit=limit
    )

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    force: bool = False,
    db: AsyncSession = Depends(get_async_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    request: Request = None
):
    """Удаление мероприятия (только в статусе черновик) с каскадным удалением связанных данных.
    
    Если параметр force=True, то мероприятие будет удалено вне зависимости от статуса.
    """
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

        # Проверка статуса (пропускаем, если force=True)
        if not force and event.status != EventStatus.draft:
            raise HTTPException(status_code=400, detail="Мероприятие можно удалить только в статусе 'черновик'. Используйте параметр force=true для принудительного удаления.")

        # 1. Находим и удаляем все NotificationView, связанные с шаблонами уведомлений для этого события
        logger.info(f"Finding notification templates for event {event_id}")
        notification_templates_query = select(NotificationTemplate).where(NotificationTemplate.event_id == event_id)
        notification_templates = (await db.execute(notification_templates_query)).scalars().all()
        
        for template in notification_templates:
            logger.info(f"Deleting notification views for template {template.id}")
            notification_views_query = delete(NotificationView).where(NotificationView.template_id == template.id)
            await db.execute(notification_views_query)
        
        # 2. Удаляем шаблоны уведомлений для этого события
        logger.info(f"Deleting notification templates for event {event_id}")
        notification_templates_query = delete(NotificationTemplate).where(NotificationTemplate.event_id == event_id)
        await db.execute(notification_templates_query)

        # 3. Удаляем все связанные регистрации
        logger.info(f"Deleting registrations for event {event_id}")
        registration_query = delete(Registration).where(Registration.event_id == event_id)
        await db.execute(registration_query)
        
        # 4. Удаляем все связанные медиа
        logger.info(f"Deleting media for event {event_id}")
        media_query = delete(Media).where(Media.event_id == event_id)
        await db.execute(media_query)

        # 5. Удаляем все связанные типы билетов
        logger.info(f"Deleting ticket types for event {event_id}")
        ticket_query = delete(TicketType).where(TicketType.event_id == event_id)
        await db.execute(ticket_query)

        # 6. Удаляем файл изображения, если он существует
        if event.image_url:
            file_path = event.image_url.replace("/images/", "private_media/")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Удалён файл изображения: {file_path}")
                except OSError as e:
                    logger.warning(f"Не удалось удалить файл {file_path}: {str(e)}")

        # 7. Удаляем само мероприятие
        logger.info(f"Deleting event {event_id}")
        await db.delete(event)
        await db.commit()

        logger.info(f"Admin {current_admin.email} deleted event {event_id}")
    except HTTPException as e:
        await db.rollback()
        raise e
    except Exception as e:
        logger.error(f"Error deleting event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось удалить мероприятие: {str(e)}"
        )
        
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
        
        # Получаем последнюю активность из user_activities
        last_activity = await get_last_user_activity(db, user.id)
        if last_activity:
            user.last_active = last_activity

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
            "status": event.status,
            "url_slug": event.url_slug
        }
        if event.tickets:
            ticket = event.tickets[0]
            event_dict["ticket_type"] = {
                "name": ticket.name,
                "price": float(ticket.price),
                "available_quantity": ticket.available_quantity,
                "sold_quantity": ticket.sold_quantity
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
        