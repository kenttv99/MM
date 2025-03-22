# backend/schemas_enums/enums.py
from enum import Enum

class MediaType(Enum):
    photo = 'photo'
    video = 'video'

class Status(Enum):
    pending = 'pending'
    approved = 'approved'
    rejected = 'rejected'

class Role(Enum):
    user = 'user'
    admin = 'admin'

class TicketTypeEnum(Enum):  # Новый enum для типов билетов
    free = 'free'
    standart = 'standart'
    vip = 'vip'
    org = 'org'
    
class EventStatus(Enum):
    draft = 'draft'
    registration_open = 'registration_open'
    registration_closed = 'registration_closed'
    completed = 'completed'