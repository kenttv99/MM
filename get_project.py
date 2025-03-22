import os
from pathlib import Path

# Путь к проекту (используем прямые слэши)
PROJECT_ROOT = "C:/Users/kentt/OneDrive/Desktop/projects/MM"

# Путь для сохранения итогового файла (используем прямые слэши)
OUTPUT_FILE = "C:/Users/kentt/OneDrive/Desktop/projects/MM/project_content.txt"

# Разрешенные расширения файлов (указывай с точкой)
INCLUDE_EXTENSIONS = [
    ".py",    # Python-файлы
    ".tsx",   # TypeScript React-файлы
    ".ts",    # TypeScript-файлы
    ".css",   # CSS-файлы
    ".md",    # Markdown-файлы (например, README.md)
]

# Разрешенные пути (только эти папки будут включены)
INCLUDE_PATHS = [
    "backend/",
    "frontend/src/",
    "servers/",
]

# Исключенные файлы и папки
EXCLUDE_PATHS = [
    "__pycache__",
    "frontend/public",
    ".git",
]

# Функция для нормализации путей (замена \ на /)
def normalize_path(path):
    return str(path).replace("\\", "/")

# Функция для проверки, нужно ли включить файл
def should_include(file_path):
    # Нормализуем путь
    file_path_str = normalize_path(file_path)
    # print(f"Проверка файла: {file_path_str}")  # Отладочный вывод
    
    # Проверяем, находится ли файл в исключенной папке
    for exclude_path in EXCLUDE_PATHS:
        if exclude_path in file_path_str:
            # print(f"Пропущен файл: {file_path_str} (в исключенной папке: {exclude_path})")
            return False
    
    # Проверяем, находится ли файл в разрешенной папке
    in_allowed_path = False
    for allowed_path in INCLUDE_PATHS:
        if file_path_str.startswith(allowed_path):
            in_allowed_path = True
            # print(f"Файл {file_path_str} находится в разрешенной папке: {allowed_path}")
            break
    
    # Если файл не в разрешенной папке, проверяем корневые файлы
    if not in_allowed_path:
        if file_path_str in ["constants.py", "README.md"]:
            in_allowed_path = True
            # print(f"Файл {file_path_str} разрешен как корневой файл")
        else:
            # print(f"Пропущен файл: {file_path_str} (не в разрешенной папке)")
            return False
    
    # Проверяем расширение
    extension = Path(file_path).suffix.lower()
    if extension not in INCLUDE_EXTENSIONS:
        # print(f"Пропущен файл: {file_path_str} (неподходящее расширение: {extension})")
        return False
    
    # Проверяем, не пустой ли __init__.py
    if Path(file_path).name == "__init__.py":
        full_path = Path(PROJECT_ROOT) / file_path
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:  # Если файл пустой
                    # print(f"Пропущен файл: {file_path_str} (пустой __init__.py)")
                    return False
        except Exception as e:
            print(f"Пропущен файл: {file_path_str} (ошибка чтения: {e})")
            return False
    
    # print(f"Включен файл: {file_path_str}")
    return True

# Функция для получения всех файлов проекта
def get_project_files(project_root):
    project_root = Path(project_root)
    all_files = []
    
    for root, dirs, files in os.walk(project_root):
        # Преобразуем путь в относительный
        rel_root = Path(root).relative_to(project_root)
        for file in files:
            file_path = rel_root / file
            all_files.append(file_path)
    
    return all_files

# Функция для записи содержимого файлов в текстовый файл
def write_project_content(project_root, output_file):
    project_root = Path(project_root)
    
    # Проверяем, существует ли корневая директория
    if not project_root.exists():
        raise FileNotFoundError(f"Директория проекта {project_root} не существует")
    
    # Получаем все файлы
    all_files = get_project_files(project_root)
    print(f"Всего файлов найдено: {len(all_files)}")  # Отладочный вывод
    # print(f"Список всех файлов: {[normalize_path(f) for f in all_files]}")  # Отладочный вывод
    
    # Фильтруем файлы
    filtered_files = []
    for file_path in all_files:
        if should_include(file_path):
            filtered_files.append(file_path)
    
    print(f"Файлов после фильтрации: {len(filtered_files)}")  # Отладочный вывод
    # print(f"Список отфильтрованных файлов: {[normalize_path(f) for f in filtered_files]}")  # Отладочный вывод
    
    # Записываем содержимое в файл
    with open(output_file, "w", encoding="utf-8") as out:
        out.write("Project Files Content\n")
        out.write("================\n")
        
        for file_path in filtered_files:
            full_path = project_root / file_path
            out.write(f"File: {file_path}\n")
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    out.write(content + "\n")
            except Exception as e:
                out.write(f"(Ошибка чтения файла: {e})\n")
            out.write("================\n")

# Запуск скрипта
if __name__ == "__main__":
    try:
        write_project_content(PROJECT_ROOT, OUTPUT_FILE)
        print(f"Содержимое проекта сохранено в {OUTPUT_FILE}")
    except Exception as e:
        print(f"Произошла ошибка: {e}")