# config/logging_config.py
import logging
from logging.handlers import RotatingFileHandler


def setup_logging():
    """Настройка логирования для приложения."""
    # Создание логгера root для перехвата всех логов
    logger = logging.getLogger()  # root logger вместо "JE"
    logger.setLevel(logging.INFO)  # Уровень логирования

    # Проверка, есть ли уже обработчики, чтобы избежать дублирования
    if not logger.handlers:
        # Обработчик для консоли
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)

        # Обработчик для файла с ротацией
        file_handler = RotatingFileHandler("app.log", maxBytes=10**6, backupCount=3)
        file_handler.setLevel(logging.ERROR)  # Логировать только ошибки в файл

        # Форматтер
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)

        # Добавление обработчиков к логгеру
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

    return logger

# Инициализация логирования при импорте этого модуля
logger = setup_logging()