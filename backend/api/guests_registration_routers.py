# backend/api/guests_registration_routers.py
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from backend.database.user_db import AsyncSession, Event, get_async_db, Registration, TicketType
from backend.config.auth import get_current_user
from sqlalchemy.future import select

from backend.schemas_enums.enums import EventStatus

router = APIRouter(tags=["Registration"])

@router.post("/register")
async def register_for_event(
    data: dict,
    db: AsyncSession = Depends(get_async_db),
    current_user = Depends(get_current_user)
):
    event_id = data.get("event_id")
    user_id = data.get("user_id")

    if not event_id or not user_id:
        raise HTTPException(status_code=400, detail="Event ID and User ID are required")

    # Проверка статуса мероприятия и доступных мест
    event = await db.get(Event, event_id)
    if not event or event.status != "registration_open":
        raise HTTPException(status_code=400, detail="Registration is not open for this event")

    ticket = (await db.execute(select(TicketType).where(TicketType.event_id == event_id))).scalars().first()
    if not ticket or ticket.available_quantity <= ticket.sold_quantity:
        # Обновляем статус мероприятия, если мест больше нет
        event.status = EventStatus.registration_closed
        await db.commit()
        raise HTTPException(status_code=400, detail="No available tickets")

    # Создание записи о регистрации
    registration = Registration(
        user_id=user_id,
        event_id=event_id,
        ticket_type_id=ticket.id,
        ticket_number=f"TICKET-{event_id}-{user_id}-{datetime.utcnow().timestamp()}",
        payment_status=False,
        amount_paid=0 if ticket.free_registration else ticket.price,
    )
    db.add(registration)
    ticket.sold_quantity += 1
    
    # Проверка после увеличения sold_quantity
    if ticket.available_quantity <= ticket.sold_quantity:
        event.status = EventStatus.registration_closed
    
    await db.commit()
    return {"message": "Successfully registered"}