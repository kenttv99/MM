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