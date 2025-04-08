from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from backend.schemas_enums.schemas import UserTicketResponse
from backend.database.user_db import AsyncSession, get_async_db, User, Registration, Event, TicketType
from backend.config.auth import get_current_user, log_user_activity
from backend.config.logging_config import logger
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import selectinload

router = APIRouter()
bearer_scheme = HTTPBearer()

@router.get("/my-tickets", response_model=List[UserTicketResponse])
async def get_user_tickets(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
) -> List[UserTicketResponse]:
    """
    Get all tickets for the current user.
    """
    try:
        token = credentials.credentials
        current_user = await get_current_user(token, db)
        
        # Query registrations for the current user with event and ticket type details
        query = (
            select(Registration)
            .where(Registration.user_id == current_user.id)
            .join(Event)
            .join(TicketType)
            .options(selectinload(Registration.event), selectinload(Registration.ticket_type))
        )
        result = await db.execute(query)
        registrations = result.scalars().all()
        
        # Log user activity
        await log_user_activity(db, current_user.id, request, action="view_tickets")
        logger.info(f"User {current_user.email} viewed their tickets")
        
        return [
            UserTicketResponse(
                id=registration.id,
                event=registration.event,
                ticket_type=registration.ticket_type.name,
                registration_date=registration.created_at,
                status=registration.status
            )
            for registration in registrations
        ]
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error fetching user tickets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user tickets: {str(e)}"
        ) 