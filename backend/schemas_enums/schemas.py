from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

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

class EventCreate(BaseModel):
    id: Optional[int] = None  # id опционален, так как не передается в запросе
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    price: float
    published: Optional[bool] = False
    created_at: datetime  # Добавляем created_at
    updated_at: datetime  # Добавляем updated_at
    
    class Config:
        from_attributes = True
    
    
class EventUpdate(BaseModel):
    id: Optional[int] = None  # id опционален, так как не передается в запросе
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    published: Optional[bool] = None
    created_at: Optional[datetime] = None  # Добавляем created_at как опциональное
    updated_at: Optional[datetime] = None  # Добавляем updated_at как опциональное
    
    class Config:
        from_attributes = True