# backend/api/guests_registration_routers.py
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.database.user_db import AsyncSession, Event, get_async_db, Registration, TicketType
from backend.config.auth import get_current_user, log_user_activity
from sqlalchemy.future import select
from backend.config.logging_config import logger
from backend.schemas_enums.schemas import RegistrationRequest, CancelRegistrationRequest, RegistrationResponse
from backend.schemas_enums.enums import EventStatus, Status
from sqlalchemy import func
from typing import Callable, List

router = APIRouter()
bearer_scheme = HTTPBearer()

async def get_next_ticket_number(db: AsyncSession, event_id: int) -> str:
    """
    Generate a ticket number in the format n-n where:
    - First n is the event ID
    - Second n is a unique sequential number for this event (no length restriction)
    """
    # Get the count of existing registrations for this event
    result = await db.execute(
        select(func.count(Registration.id)).where(Registration.event_id == event_id)
    )
    count = result.scalar() or 0
    
    # Generate the next ticket number (event_id-count+1)
    # No length restriction for the sequential number
    ticket_number = f"{event_id}-{count + 1}"
    
    return ticket_number

@router.post("/register", response_model=RegistrationResponse)
async def register_for_event(
    data: RegistrationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    token = credentials.credentials
    current_user = await get_current_user(token, db)
    event_id = data.event_id
    user_id = data.user_id
    
    # Проверка существующей активной регистрации
    existing_active_reg = await db.execute(
        select(Registration).where(
            Registration.user_id == user_id,
            Registration.event_id == event_id,
            Registration.status != Status.cancelled.name  # Используем .name
        )
    )
    
    if existing_active_reg.scalars().first():
        raise HTTPException(status_code=400, detail="Вы уже зарегистрированы на это мероприятие")
    
    # Проверяем, есть ли отмененная регистрация для этого пользователя и мероприятия
    cancelled_reg_query = await db.execute(
        select(Registration).where(
            Registration.user_id == user_id,
            Registration.event_id == event_id,
            Registration.status == Status.cancelled.name
        ).order_by(Registration.submission_time.desc())
    )
    
    cancelled_reg = cancelled_reg_query.scalars().first()
    
    # Проверка лимита отмен регистраций
    if cancelled_reg and cancelled_reg.cancellation_count >= 3:
        raise HTTPException(status_code=400, detail="Превышен лимит отмен регистраций на это мероприятие (максимум 3)")
    
    # Получаем данные о мероприятии и билете
    event = await db.get(Event, event_id)
    if not event or event.status.value != "registration_open":
        raise HTTPException(status_code=400, detail="Регистрация на это мероприятие недоступна")
    
    # Получаем доступный билет
    ticket_query = await db.execute(
        select(TicketType).where(TicketType.event_id == event_id)
    )
    ticket = ticket_query.scalars().first()
    
    if not ticket or ticket.available_quantity <= ticket.sold_quantity:
        event.status = EventStatus.registration_closed
        raise HTTPException(status_code=400, detail="Билеты на это мероприятие распроданы")
    
    # Создаем номер билета
    ticket_number = await get_next_ticket_number(db, event_id)
    
    # Если есть отмененная регистрация, обновляем ее, иначе создаем новую
    if cancelled_reg:
        # Обновляем существующую отмененную регистрацию
        cancelled_reg.status = Status.approved.name
        cancelled_reg.ticket_type_id = ticket.id
        cancelled_reg.ticket_number = ticket_number
        cancelled_reg.payment_status = ticket.free_registration
        cancelled_reg.amount_paid = 0 if ticket.free_registration else ticket.price
        cancelled_reg.submission_time = datetime.utcnow()  # Обновляем время регистрации
        registration = cancelled_reg
    else:
        # Регистрируем нового участника
        registration = Registration(
            user_id=user_id,
            event_id=event_id,
            ticket_type_id=ticket.id,
            ticket_number=ticket_number,
            payment_status=ticket.free_registration,
            status=Status.approved.name,
            amount_paid=0 if ticket.free_registration else ticket.price,
            cancellation_count=0  # Явно указываем счетчик отмен
        )
        db.add(registration)
    
    # Увеличиваем количество проданных билетов
    ticket.sold_quantity += 1
    await log_user_activity(db, current_user.id, request, action="register_event")
    
    if ticket.available_quantity <= ticket.sold_quantity:
        event.status = EventStatus.registration_closed
    
    await db.commit()
    return RegistrationResponse(message="Successfully registered")

@router.post("/cancel", response_model=RegistrationResponse)
async def cancel_registration(
    data: CancelRegistrationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    token = credentials.credentials
    current_user = await get_current_user(token, db)
    event_id = data.event_id
    user_id = data.user_id

    # Проверка существующей регистрации
    registration_query = await db.execute(
        select(Registration).where(
            Registration.user_id == user_id,
            Registration.event_id == event_id,
            Registration.status != Status.cancelled.name  # Используем .name
        )
    )
    registration = registration_query.scalars().first()
    
    if not registration:
        raise HTTPException(status_code=404, detail="Активная регистрация не найдена")
    
    # Получаем информацию о билете и мероприятии
    ticket = await db.get(TicketType, registration.ticket_type_id)
    event = await db.get(Event, event_id)
    
    if not ticket or not event:
        raise HTTPException(status_code=404, detail="Билет или мероприятие не найдены")
    
    # Проверяем, можно ли отменить регистрацию
    if event.status.value == "completed":
        raise HTTPException(status_code=400, detail="Нельзя отменить регистрацию на завершенное мероприятие")
    
    # Уменьшаем счетчик проданных билетов
    ticket.sold_quantity -= 1
    
    # Если мероприятие было закрыто из-за отсутствия мест, открываем его снова
    if event.status.value == "registration_closed" and ticket.available_quantity > ticket.sold_quantity:
        event.status = EventStatus.registration_open
    
    # Обновляем запись о регистрации вместо удаления
    registration.status = Status.cancelled.name  # Используем .name для получения строкового значения
    registration.cancellation_count += 1
    
    # Логируем действие пользователя
    await log_user_activity(db, current_user.id, request, action="cancel_registration")
    
    await db.commit()
    return RegistrationResponse(message="Регистрация успешно отменена")