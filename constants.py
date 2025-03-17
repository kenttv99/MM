# constants.py

"""
Модуль с константами проекта
"""

# Используется в database/init_db.py и database/drop_db.py
DATABASE_URL = "postgresql+asyncpg://postgres:assasin88@localhost:5432/moscow_mellows"

# Все три константы используются в api/auth.py
SECRET_KEY = "123456789"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

RATE_LIMITS = {
    "register": "20/minute",  # 10 регистраций в минуту
    "login": "60/minute",    # 20 попыток входа в минуту
    "access_me": "60/minute" # 50 запросов к /me в минуту
}