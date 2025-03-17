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