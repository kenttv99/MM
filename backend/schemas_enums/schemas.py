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
        from_attributes = True  # Для совместимости с SQLAlchemy
        
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

    class Config:
        from_attributes = True  # Для совместимости с SQLAlchemy
        
        
#------------------------
# EVENTS
#------------------------

class TicketTypeCreate(BaseModel):
    name: TicketTypeEnum  # Заменяем str на TicketTypeEnum
    price: float  # Цена билета
    available_quantity: int  # Доступное количество
    free_registration: Optional[bool] = False  # Бесплатная регистрация (по умолчанию False)

    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    id: Optional[int] = None  # Добавляем поле id как опциональное
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
    status: Optional[EventStatus] = EventStatus.draft  # По умолчанию 'draft'
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
    status: Optional[EventStatus] = None  # Позволяем обновлять статус

    class Config:
        from_attributes = True
        
