# backend/schemas_enums.schemas.py
from datetime import datetime
from typing import Optional, List, ForwardRef
from pydantic import BaseModel, EmailStr
from backend.schemas_enums.enums import EventStatus, TicketTypeEnum, Status

#------------------------
# ADMINS
#------------------------

class AdminCreate(BaseModel):
    fio: str
    email: EmailStr
    password: str

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminResponse(BaseModel):
    id: int
    fio: str
    email: EmailStr

    class Config:
        from_attributes = True

#------------------------
# USERS
#------------------------   

class UserCreate(BaseModel):
    fio: str
    email: EmailStr
    password: str
    telegram: str
    whatsapp: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    
class ChangePassword(BaseModel):
    current_password: str
    new_password: str
    
class ChangePasswordResponse(BaseModel):
    message: str

class UserResponse(BaseModel):
    id: int
    fio: Optional[str]
    email: str
    telegram: Optional[str]
    whatsapp: Optional[str]
    avatar_url: Optional[str] = None
    is_blocked: bool = False
    is_partner: bool = False

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    fio: Optional[str] = None
    email: Optional[EmailStr] = None
    telegram: Optional[str] = None
    whatsapp: Optional[str] = None
    is_blocked: Optional[bool] = None
    is_partner: Optional[bool] = None

    class Config:
        from_attributes = True

#------------------------
# EVENTS
#------------------------

class TicketTypeCreate(BaseModel):
    name: TicketTypeEnum
    price: float
    available_quantity: int
    free_registration: Optional[bool] = False
    remaining_quantity: Optional[int] = None  # Новое поле
    sold_quantity: Optional[int] = None

    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    price: float
    published: Optional[bool] = False
    created_at: datetime
    updated_at: datetime
    status: Optional[EventStatus] = EventStatus.draft
    url_slug: Optional[str] = None
    ticket_type: Optional[TicketTypeCreate] = None

    class Config:
        from_attributes = True

class EventCreateForm(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: str  # Изменено на str, так как фронтенд отправляет строку
    end_date: Optional[str] = None  # Изменено на str
    location: Optional[str] = None
    price: str  # Изменено на str, так как фронтенд отправляет строку
    published: bool = False
    created_at: str  # Изменено на str
    updated_at: str  # Изменено на str
    status: EventStatus = EventStatus.draft
    url_slug: Optional[str] = None

    class Config:
        from_attributes = True

class EventUpdate(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    published: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    status: Optional[EventStatus] = None
    url_slug: Optional[str] = None

    class Config:
        from_attributes = True

class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    price: float
    published: bool = False
    created_at: datetime
    updated_at: datetime
    status: EventStatus
    url_slug: Optional[str] = None

    class Config:
        from_attributes = True

#------------------------
# REGISTRATION
#------------------------

class RegistrationRequest(BaseModel):
    event_id: int
    user_id: int

class CancelRegistrationRequest(BaseModel):
    event_id: int
    user_id: int

class RegistrationResponse(BaseModel):
    message: str
        
#------------------------
# Notifications
#------------------------
        
class NotificationTemplateBase(BaseModel):
    message: str
    type: str
    event_id: int
    is_public: bool

class NotificationTemplateResponse(NotificationTemplateBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationViewBase(BaseModel):
    template_id: int
    is_viewed: bool

class NotificationViewResponse(NotificationViewBase):
    id: int
    user_id: Optional[int] = None
    fingerprint: Optional[str] = None
    viewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

#------------------------
# TICKETS
#------------------------

class UserTicketResponse(BaseModel):
    id: int
    event: EventResponse
    ticket_type: str
    registration_date: datetime
    status: Status
    cancellation_count: int = 0
    ticket_number: Optional[str] = None

    class Config:
        from_attributes = True