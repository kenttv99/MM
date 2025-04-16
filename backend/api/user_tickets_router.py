from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy import select, func
from backend.schemas_enums.schemas import UserTicketResponse
from backend.database.user_db import AsyncSession, get_async_db, User, Registration, Event, TicketType
from backend.config.auth import get_current_user, log_user_activity
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import selectinload

router = APIRouter()
bearer_scheme = HTTPBearer()

@router.get("/my-tickets", response_model=Dict[str, Any])
async def get_user_tickets(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(10, ge=1, le=100, description="Количество билетов на странице")
) -> Dict[str, Any]:
    """
    Get all tickets for the current user with pagination.
    """
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
        # Предварительно получаем email, чтобы избежать lazy loading в логгере
        user_email = current_user.email
        
        # Query to count total tickets for the user
        count_query = (
            select(func.count())
            .select_from(Registration)
            .where(Registration.user_id == current_user.id)
        )
        total_count_result = await db.execute(count_query)
        total_count = total_count_result.scalar_one()

        # Query registrations for the current user with event and ticket type details, applying pagination
        offset = (page - 1) * per_page
        query = (
            select(Registration)
            .where(Registration.user_id == current_user.id)
            .join(Event)
            .join(TicketType)
            .options(selectinload(Registration.event), selectinload(Registration.ticket_type))
            .order_by(Registration.submission_time.desc())
            .offset(offset)
            .limit(per_page)
        )
        result = await db.execute(query)
        registrations = result.scalars().all()
        
        # Log user activity
        await log_user_activity(db, current_user.id, request, action="view_tickets")
        logger.info(f"User {user_email} viewed their tickets (page {page}, per_page {per_page})")
        
        # Обновим записи с NULL cancellation_count до возврата данных
        for reg in registrations:
            if not hasattr(reg, 'cancellation_count') or reg.cancellation_count is None:
                reg.cancellation_count = 0
                await db.commit()

        tickets_response = [
            UserTicketResponse(
                id=registration.id,
                event=registration.event,
                ticket_type=registration.ticket_type.name,
                registration_date=registration.submission_time,
                status=registration.status,
                cancellation_count=getattr(registration, 'cancellation_count', 0) or 0,
                ticket_number=registration.ticket_number
            )
            for registration in registrations
        ]

        return {
            "tickets": tickets_response,
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
            "has_more": (offset + len(registrations)) < total_count
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error fetching user tickets (page {page}, per_page {per_page}): {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user tickets: {str(e)}"
        ) 