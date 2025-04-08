# backend/api/guests_registration_routers.py
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.database.user_db import AsyncSession, Event, get_async_db, Registration, TicketType
from backend.config.auth import get_current_user, log_user_activity
from sqlalchemy.future import select
from backend.config.logging_config import logger
from pydantic import BaseModel

from backend.schemas_enums.enums import EventStatus, Status

router = APIRouter()
bearer_scheme = HTTPBearer()

class RegistrationRequest(BaseModel):
    event_id: int
    user_id: int

@router.post("/register")
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

    # Проверка существующей регистрации
    existing_registration = await db.execute(
        select(Registration).where(
            Registration.user_id == user_id,
            Registration.event_id == event_id
        )
    )
    if existing_registration.scalars().first():
        raise HTTPException(status_code=400, detail="Вы уже зарегистрировались на это мероприятие")

    # Остальной код остается без изменений
    event = await db.get(Event, event_id)
    if not event or event.status.value != "registration_open":
        raise HTTPException(status_code=400, detail="Registration is not open for this event")

    ticket = (await db.execute(select(TicketType).where(TicketType.event_id == event_id))).scalars().first()
    if not ticket or ticket.available_quantity <= ticket.sold_quantity:
        event.status = EventStatus.registration_closed
        await db.commit()
        raise HTTPException(status_code=400, detail="No available tickets")

    registration = Registration(
        user_id=user_id,
        event_id=event_id,
        ticket_type_id=ticket.id,
        ticket_number=f"TICKET-{event_id}-{user_id}-{datetime.utcnow().timestamp()}",
        payment_status=False,
        status=Status.approved.name,
        amount_paid=0 if ticket.free_registration else ticket.price,
    )
    db.add(registration)
    ticket.sold_quantity += 1
    await log_user_activity(db, current_user.id, request, action="register_event")
    
    if ticket.available_quantity <= ticket.sold_quantity:
        event.status = EventStatus.registration_closed
    
    await db.commit()
    return {"message": "Successfully registered"}