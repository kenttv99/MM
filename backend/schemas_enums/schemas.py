# backend/schemas_enums/schemas.py
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
    fio: str
    email: EmailStr
    telegram: str
    whatsapp: str
    is_blocked: bool  # Новое поле
    is_partner: bool  # Новое поле

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