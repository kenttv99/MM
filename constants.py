# constants.py

"""
Модуль с константами проекта
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRIVATE_MEDIA_DIR = os.path.join(BASE_DIR, "private_media")
USERS_AVATARS_DIR = os.path.join(PRIVATE_MEDIA_DIR, "users_avatars")

# Используется в database/init_db.py и database/drop_db.py
DATABASE_URL = "postgresql+asyncpg://postgres:assasin88@localhost:5432/moscow_mellows"

# Все три константы используются в api/auth.py
SECRET_KEY = "123456789"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

RATE_LIMITS = {
    "register": "20/minute",      # 20 регистраций в минуту
    "login": "60/minute",         # 60 попыток входа в минуту
    "access_me": "60/minute",     # 60 запросов к /me в минуту
    "verify_token": "600/minute",  # 600 запросов проверки токена в минуту (10 в секунду)
    "verify_token_admin": "100/minute"
}