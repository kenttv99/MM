from sqlalchemy import create_engine, MetaData
from constants import DATABASE_URL

engine = create_engine(DATABASE_URL)
meta = MetaData()

# Отражение всех таблиц
meta.reflect(bind=engine)
meta.drop_all(bind=engine)

print("Все таблицы успешно удалены.")