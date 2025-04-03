import os
from pathlib import Path

# Путь к проекту
PROJECT_ROOT = "C:/Users/kentt/OneDrive/Desktop/projects/MM"

# Путь для сохранения итогового файла
OUTPUT_FILE = "C:/Users/kentt/OneDrive/Desktop/projects/MM/project_content/project_content.txt"

# Разрешенные расширения файлов
INCLUDE_EXTENSIONS = [
    ".py", ".tsx", ".ts", ".css", ".md",
]

# Разрешенные пути
INCLUDE_PATHS = [
    "backend/",
    # "frontend/src/",
    "servers/",
    # "frontend/src/",
    "frontend/src/components",
    # "frontend/src/hooks",
    "frontend/src/utils",
    # "frontend/src/app",
    "frontend/src/types",
    "frontend/src/contexts",
    # "frontend/src/app/(public)/",
    # "frontend/src/app/(auth)/"
]

# Конкретные файлы для включения (относительные пути)
INCLUDE_FILES = [
    # "constants.py",
    # "README.md",
    "frontend/next.config.ts",
    "frontend/tailwind.config.ts",
    #  "frontend/src/app/globals.css",
    "frontend/src/app/(admin)/dashboard/page.tsx",
    # "frontend/src/app/(admin)/edit-user/page.tsx",
    "frontend/src/components/EditEventForm.tsx",
    # "frontend/src/components/Notifications.tsx",
    "frontend/src/app/(admin)/edit-events/page.tsx",
    # "frontend/src/app/(public)/event/[slug]/page.tsx",
    # "frontend/src/app/(public)/events/page.tsx",
    # "frontend/src/utils/api.ts"
    # "frontend/src/contexts/PageLoadContext.tsx",
    # "frontend/src/hooks/useLoadingReset.ts"
]

# Исключенные файлы и папки
EXCLUDE_PATHS = [
    "__pycache__",
    "frontend/public",
    ".git",
    "get_project_encode.py",
    "get_project.py",
    "frontend/package-lock.json",
    # "frontend/src/components/common"
]

def normalize_path(path):
    return str(path).replace("\\", "/")

def should_include(file_path):
    file_path_str = normalize_path(file_path)
    
    # Проверяем исключенные пути
    for exclude_path in EXCLUDE_PATHS:
        if exclude_path in file_path_str:
            return False
    
    # Проверяем конкретные файлы для включения
    if file_path_str in INCLUDE_FILES:
        return True
    
    # Проверяем разрешенные пути
    in_allowed_path = False
    for allowed_path in INCLUDE_PATHS:
        if file_path_str.startswith(allowed_path):
            in_allowed_path = True
            break
    
    if not in_allowed_path:
        return False
    
    # Проверяем расширение
    extension = Path(file_path).suffix.lower()
    if extension not in INCLUDE_EXTENSIONS:
        return False
    
    # Проверяем пустой __init__.py
    if Path(file_path).name == "__init__.py":
        full_path = Path(PROJECT_ROOT) / file_path
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                if not f.read().strip():
                    return False
        except Exception as e:
            print(f"Пропущен файл: {file_path_str} (ошибка чтения: {e})")
            return False
    
    return True

def get_project_files(project_root):
    project_root = Path(project_root)
    all_files = []
    
    for root, dirs, files in os.walk(project_root):
        rel_root = Path(root).relative_to(project_root)
        for file in files:
            file_path = rel_root / file
            all_files.append(file_path)
    
    return all_files

def write_project_content(project_root, output_file_base):
    project_root = Path(project_root)
    output_dir = Path(output_file_base).parent
    
    if not project_root.exists():
        raise FileNotFoundError(f"Директория проекта {project_root} не существует")
    
    if output_dir.exists():
        for file in output_dir.glob("project_content_*.txt"):  # Удаляем только файлы с шаблоном project_content_*.txt
            try:
                file.unlink()
            except Exception as e:
                print(f"Не удалось удалить файл {file}: {e}")
    
    all_files = get_project_files(project_root)
    print(f"Всего файлов найдено: {len(all_files)}")
    
    filtered_files = [file_path for file_path in all_files if should_include(file_path)]
    print(f"Файлов после фильтрации: {len(filtered_files)}")
    
    LINES_PER_FILE = 1900
    file_counter = 1
    line_counter = 0
    output_file = f"{output_file_base[:-4]}_{file_counter}.txt"
    out = open(output_file, "w", encoding="utf-8")
    
    out.write("Project Files Content\n================\n")
    line_counter += 2
    
    for file_path in filtered_files:
        full_path = project_root / file_path
        file_header = f"File: {file_path}\n"
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
                content_lines = content.split('\n')
                num_lines = len(content_lines) + 2  # Учитываем заголовок и разделитель
                
                # Если текущий файл плюс новый контент превышает лимит
                if line_counter + num_lines > LINES_PER_FILE:
                    out.close()
                    file_counter += 1
                    output_file = f"{output_file_base[:-4]}_{file_counter}.txt"
                    out = open(output_file, "w", encoding="utf-8")
                    line_counter = 0
                
                # Записываем весь файл целиком
                out.write(file_header)
                out.write(content + "\n")
                out.write("================\n")
                line_counter += num_lines
                
        except Exception as e:
            error_message = f"(Ошибка чтения файла: {e})\n"
            error_lines = len(error_message.split('\n')) + 2
            
            if line_counter + error_lines > LINES_PER_FILE:
                out.close()
                file_counter += 1
                output_file = f"{output_file_base[:-4]}_{file_counter}.txt"
                out = open(output_file, "w", encoding="utf-8")
                line_counter = 0
                
            out.write(file_header)
            out.write(error_message)
            out.write("================\n")
            line_counter += error_lines
    
    out.close()
    print(f"Содержимое проекта сохранено в файлах: {output_file_base[:-4]}_1.txt и последующих")
    
    
if __name__ == "__main__":
    try:
        write_project_content(PROJECT_ROOT, OUTPUT_FILE)
    except Exception as e:
        print(f"Произошла ошибка: {e}")