import os
from pathlib import Path
import zlib

# Константы без изменений
PROJECT_ROOT = "C:/Users/kentt/OneDrive/Desktop/projects/MM"
OUTPUT_FILE = "C:/Users/kentt/OneDrive/Desktop/projects/MM/project_content/project_content.txt"
INCLUDE_EXTENSIONS = [".py", ".tsx", ".ts", ".css", ".md"]
INCLUDE_PATHS = ["backend/", "frontend/src/", "servers/"]
EXCLUDE_PATHS = ["__pycache__", "frontend/public", ".git"]
INCLUDE_FILES = [
    "constants.py",
    "README.md",
]

def normalize_path(path):
    return str(path).replace("\\", "/").replace(PROJECT_ROOT.replace("\\", "/"), "").lstrip("/")

def should_include(file_path):
    file_path_str = normalize_path(file_path)
    for exclude_path in EXCLUDE_PATHS:
        if exclude_path in file_path_str:
            return False
    if file_path_str in [normalize_path(f) for f in INCLUDE_FILES]:
        return True
    if not any(p in file_path_str for p in INCLUDE_PATHS):
        return False
    if Path(file_path).suffix.lower() not in INCLUDE_EXTENSIONS:
        return False
    if file_path.name == "__init__.py" and not (Path(PROJECT_ROOT) / file_path).read_text(encoding="utf-8").strip():
        return False
    return True

def compress_content(content):
    lines = [line.rstrip() for line in content.splitlines() if line.strip()]
    compressed = "\n".join(lines).encode("utf-8")
    hex_content = zlib.compress(compressed).hex()
    return "\n".join(hex_content[i:i+80] for i in range(0, len(hex_content), 80))

def write_project_content(project_root, output_file_base):
    project_root = Path(project_root)
    if not project_root.exists():
        raise FileNotFoundError(f"Директория {project_root} не существует")

    all_files = [Path(root).relative_to(project_root) / f for root, _, files in os.walk(project_root) for f in files]
    filtered_files = [f for f in all_files if should_include(f)]
    print(f"Всего файлов: {len(all_files)}, после фильтрации: {len(filtered_files)}")

    MAX_LINES = 1000
    file_counter = 1
    current_lines = 0
    output_file = f"{output_file_base[:-4]}_{file_counter}.txt"

    out = open(output_file, "w", encoding="utf-8")  # Открываем первый файл
    out.write("Compressed Project Files (zlib+hex)\n================\n")
    current_lines += 2

    for file_path in filtered_files:
        full_path = project_root / file_path
        file_header = f"File: {normalize_path(file_path)}\n"
        try:
            content = full_path.read_text(encoding="utf-8")
            compressed = compress_content(content)
            block_lines = compressed.count("\n") + 3  # Заголовок + содержимое + разделитель

            if current_lines + block_lines > MAX_LINES and current_lines > 2:
                out.write("================\n")
                out.close()  # Закрываем текущий файл
                file_counter += 1
                output_file = f"{output_file_base[:-4]}_{file_counter}.txt"
                out = open(output_file, "w", encoding="utf-8")  # Открываем новый
                out.write("Compressed Project Files (zlib+hex)\n================\n")
                current_lines = 2

            out.write(file_header + compressed + "\n================\n")
            current_lines += block_lines
            print(f"Записан: {file_path} (строк: {block_lines})")
        except Exception as e:
            print(f"Ошибка в {file_path}: {e}")
            continue

    out.close()  # Закрываем последний файл
    print(f"Сохранено в: {output_file_base[:-4]}_1.txt и далее ({file_counter} файлов)")

if __name__ == "__main__":
    try:
        write_project_content(PROJECT_ROOT, OUTPUT_FILE)
    except Exception as e:
        print(f"Ошибка: {e}")