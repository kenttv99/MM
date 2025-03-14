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