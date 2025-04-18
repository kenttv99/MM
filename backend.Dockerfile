# backend.Dockerfile
# Используем официальный образ Python
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем переменные окружения для Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# Добавляем текущую директорию в PYTHONPATH
ENV PYTHONPATH="/app:$PYTHONPATH"

# Устанавливаем зависимости ОС, если они понадобятся (например, для psycopg2)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential libpq-dev \
#  && rm -rf /var/lib/apt/lists/*

# Копируем файл зависимостей и устанавливаем их
# Убедитесь, что requirements.txt находится в корне проекта
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем файл constants.py в корень рабочей директории
COPY constants.py .

# Копируем директорию backend и файлы серверов
COPY ./backend ./backend
COPY ./servers ./servers

# Создаем директорию для медиафайлов, если её нет
RUN mkdir -p ./private_media

# Открываем порты, которые используют серверы (по умолчанию 8000 и 8001)
# Эти порты будут доступны внутри Docker сети. Маппинг на хост будет в docker-compose.
EXPOSE 8000
EXPOSE 8001

# Команда по умолчанию (можно переопределить в docker-compose)
# CMD ["uvicorn", "servers.server_user:app", "--host", "0.0.0.0", "--port", "8000"] 