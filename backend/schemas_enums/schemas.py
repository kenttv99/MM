# backend/schemas_enums.schemas.py
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from backend.schemas_enums.enums import EventStatus, TicketTypeEnum

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

    class Config:
        from_attributes = True