import os
import fnmatch

text_extensions = {'.txt', '.py', '.js', '.html', '.css', '.md', '.json',
                        '.xml', '.csv', '.yaml', '.yml', '.ini', '.cfg', '.log',
                        '.sql', '.sh', '.bat', '.ps1', '.rst', '.toml', '.cfg',
                        '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs',
                        '.php', '.rb', '.swift', '.html', '.xhtml', '.ts', '.tsx', '.cs'}

# Стандартный список исключений
default_exclude = [
        '.git', '.github', '.vscode', '__pycache__', '.idea',
        '.DS_Store', 'Thumbs.db', '.gitignore', '.env',
        'node_modules', 'venv', 'env', '.venv',
        '*.pyc', '*.pyo', '*.pyd', '__pycache__',
        '.svn', '.hg', '.bzr',
        'build', 'dist', '*.egg-info',
        '.pytest_cache', '.coverage', 'htmlcov',
        '.tox', '.eggs', 'skins', 'bin', 'obj'
]

def get_files_tree_md(directory_path, output_var_name="files_content", exclude_list=None):
    """
    Получает дерево файлов в директории и записывает содержимое в формате Markdown

    Args:
        directory_path (str): Путь к директории
        output_var_name (str): Имя переменной для вывода
        exclude_list (list): Список файлов и директорий для исключения

    Returns:
        str: Строка с содержимым файлов в формате Markdown
    """

    def is_binary_file(file_path):
        """Проверяет, является ли файл бинарным"""
        try:
            with open(file_path, 'rb') as f:
                chunk = f.read(1024)
                # Проверяем на наличие нулевых байтов или других бинарных признаков
                if b'\x00' in chunk:
                    return True
                # Проверяем, содержит ли файл много нечитаемых символов
                non_text_ratio = sum(1 for byte in chunk if byte < 32 and byte not in (9, 10, 13)) / len(chunk)
                return non_text_ratio > 0.3
        except Exception:
            return False

    # Объединяем стандартные исключения с пользовательскими
    if exclude_list is None:
        exclude_list = default_exclude
    else:
        exclude_list = default_exclude + exclude_list

    def should_exclude(path, is_dir=False):
        """Проверяет, нужно ли исключить файл или директорию"""
        path_name = os.path.basename(path)

        # Проверяем по списку исключений
        for exclude_item in exclude_list:
            # Если это паттерн с *, проверяем совпадение
            if '*' in exclude_item:
                if fnmatch.fnmatch(path_name, exclude_item):
                    return True
            # Если точное совпадение имени
            elif path_name == exclude_item:
                return True
            # Проверяем полный путь
            elif exclude_item in path:
                return True
        return False

    def is_text_file(file_path):
        """Проверяет, является ли файл текстовым"""
        _, ext = os.path.splitext(file_path)
        return ext.lower() in text_extensions

    def read_file_content(file_path):
        """Читает содержимое файла с обработкой ошибок кодировки и проверкой на бинарность"""
        _, ext = os.path.splitext(file_path)

        # Если расширение в текстовых — всегда читаем как текст
        if ext.lower() in text_extensions:
            try:
                for encoding in ['utf-8', 'utf-16', 'cp1251', 'koi8-r']:
                    try:
                        with open(file_path, 'r', encoding=encoding) as f:
                            content = f.read()
                            # Проверяем, содержит ли файл бинарные признаки
                            if is_binary_file(file_path):
                                return "[Бинарный файл]"
                            return content
                    except UnicodeDecodeError:
                        continue
                return "[Ошибка чтения файла - неизвестная кодировка]"
            except Exception as e:
                return f"[Ошибка чтения файла: {str(e)}]"

        # Если расширение неизвестное — тогда проверяем бинарность
        if is_binary_file(file_path):
            return "[Бинарный файл]"

        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        except Exception as e:
            return f"[Ошибка чтения файла: {str(e)}]"

    def generate_tree_structure(dir_path, prefix="", is_last=True):
        """Генерирует текстовое представление дерева файлов"""
        tree_lines = []

        # Получаем список файлов и директорий
        try:
            items = os.listdir(dir_path)
            # Фильтруем исключения
            items = [item for item in items if not should_exclude(os.path.join(dir_path, item))]
            items.sort()
        except PermissionError:
            return [f"{prefix}├── [Нет доступа]"]

        # Разделяем файлы и директории
        dirs = []
        files = []

        for item in items:
            item_path = os.path.join(dir_path, item)
            if os.path.isdir(item_path):
                dirs.append(item)
            else:
                files.append(item)

        # Сначала директории, потом файлы
        all_items = dirs + files
        total_items = len(all_items)

        for i, item in enumerate(all_items):
            is_last_item = (i == total_items - 1)
            item_path = os.path.join(dir_path, item)

            if is_last_item:
                tree_lines.append(f"{prefix}└── {item}")
                new_prefix = f"{prefix}    "
            else:
                tree_lines.append(f"{prefix}├── {item}")
                new_prefix = f"{prefix}│   "

            # Если это директория, рекурсивно добавляем её содержимое
            if os.path.isdir(item_path) and not should_exclude(item_path, is_dir=True):
                sub_tree = generate_tree_structure(item_path, new_prefix, is_last_item)
                tree_lines.extend(sub_tree)

        return tree_lines

    # Начинаем формировать результат
    result = f"{output_var_name} = '''\n"

    # Добавляем дерево файлов в самом верху
    result += "# Структура проекта\n\n"
    result += "```\n"
    tree_lines = generate_tree_structure(directory_path)
    result += "\n".join(tree_lines)
    result += "\n```\n\n"

    # Проходим по всем файлам и папкам
    for root, dirs, files in os.walk(directory_path):
        # Проверяем, не нужно ли исключить текущую директорию
        if should_exclude(root, is_dir=True):
            continue

        # Фильтруем список директорий для обхода
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d), is_dir=True)]

        # Получаем относительный путь от начальной директории
        rel_path = os.path.relpath(root, directory_path)
        if rel_path == '.':
            rel_path = ''

        # Добавляем заголовок для директории
        if rel_path:
            result += f"\n## Директория: {rel_path}\n\n"
        else:
            result += f"\n## Корневая директория\n\n"

        # Обрабатываем файлы
        for file in files:
            file_path = os.path.join(root, file)

            # Проверяем, не нужно ли исключить файл
            if should_exclude(file_path):
                continue

            rel_file_path = os.path.relpath(file_path, directory_path)

            # Проверяем, является ли файл текстовым
            if is_text_file(file_path):
                content = read_file_content(file_path)
                # Проверяем, действительно ли это текстовый файл
                if content == "[Бинарный файл]":
                    result += f"### Файл: {rel_file_path} *(бинарный файл)*\n\n"
                else:
                    result += f"### Файл: {rel_file_path}\n"
                    result += f"```{os.path.splitext(file_path)[1][1:]}\n"
                    result += content
                    result += "\n```\n\n"
            else:
                # Для бинарных файлов просто указываем путь
                result += f"### Файл: {rel_file_path} *(бинарный файл)*\n\n"

    result += "'''"
    return result

def get_files_tree_md_old(directory_path, output_var_name="files_content", exclude_list=None):
    """
    Получает дерево файлов в директории и записывает содержимое в формате Markdown

    Args:
        directory_path (str): Путь к директории
        output_var_name (str): Имя переменной для вывода
        exclude_list (list): Список файлов и директорий для исключения

    Returns:
        str: Строка с содержимым файлов в формате Markdown
    """
    # Стандартный список исключений
    default_exclude = [
        '.git', '.github', '.vscode', '__pycache__', '.idea',
        '.DS_Store', 'Thumbs.db', '.gitignore', '.env',
        'node_modules', 'venv', 'env', '.venv',
        '*.pyc', '*.pyo', '*.pyd', '__pycache__',
        '.svn', '.hg', '.bzr',
        'build', 'dist', '*.egg-info',
        '.pytest_cache', '.coverage', 'htmlcov',
        '.tox', '.eggs', 'skins'
    ]

    def is_binary_file(file_path):
        """Проверяет, является ли файл бинарным"""
        try:
            with open(file_path, 'rb') as f:
                return b'\x00' in f.read(1024)
        except Exception:
            return False



    # Объединяем стандартные исключения с пользовательскими
    if exclude_list is None:
        exclude_list = default_exclude
    else:
        exclude_list = default_exclude + exclude_list

    def should_exclude(path, is_dir=False):
        """Проверяет, нужно ли исключить файл или директорию"""
        path_name = os.path.basename(path)

        # Проверяем по списку исключений
        for exclude_item in exclude_list:
            # Если это паттерн с *, проверяем совпадение
            if '*' in exclude_item:
                if fnmatch.fnmatch(path_name, exclude_item):
                    return True
            # Если точное совпадение имени
            elif path_name == exclude_item:
                return True
            # Проверяем полный путь
            elif exclude_item in path:
                return True
        return False

    def is_text_file(file_path):
        """Проверяет, является ли файл текстовым"""
        _, ext = os.path.splitext(file_path)
        return ext.lower() in text_extensions

    def read_file_content(file_path):
        """Читает содержимое файла с обработкой ошибок кодировки и проверкой на бинарность"""
        _, ext = os.path.splitext(file_path)

        # Если расширение в текстовых — всегда читаем как текст
        if ext.lower() in text_extensions:
            try:
                for encoding in ['utf-8', 'utf-16', 'cp1251', 'koi8-r']:
                    try:
                        with open(file_path, 'r', encoding=encoding) as f:
                            return f.read()
                    except UnicodeDecodeError:
                        continue
                return "[Ошибка чтения файла - неизвестная кодировка]"
            except Exception as e:
                return f"[Ошибка чтения файла: {str(e)}]"

        # Если расширение неизвестное — тогда проверяем бинарность
        if is_binary_file(file_path):
            return "[Бинарный файл]"

        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        except Exception as e:
            return f"[Ошибка чтения файла: {str(e)}]"



    def generate_tree_structure(dir_path, prefix="", is_last=True):
        """Генерирует текстовое представление дерева файлов"""
        tree_lines = []

        # Получаем список файлов и директорий
        try:
            items = os.listdir(dir_path)
            # Фильтруем исключения
            items = [item for item in items if not should_exclude(os.path.join(dir_path, item))]
            items.sort()
        except PermissionError:
            return [f"{prefix}├── [Нет доступа]"]

        # Разделяем файлы и директории
        dirs = []
        files = []

        for item in items:
            item_path = os.path.join(dir_path, item)
            if os.path.isdir(item_path):
                dirs.append(item)
            else:
                files.append(item)

        # Сначала директории, потом файлы
        all_items = dirs + files
        total_items = len(all_items)

        for i, item in enumerate(all_items):
            is_last_item = (i == total_items - 1)
            item_path = os.path.join(dir_path, item)

            if is_last_item:
                tree_lines.append(f"{prefix}└── {item}")
                new_prefix = f"{prefix}    "
            else:
                tree_lines.append(f"{prefix}├── {item}")
                new_prefix = f"{prefix}│   "

            # Если это директория, рекурсивно добавляем её содержимое
            if os.path.isdir(item_path) and not should_exclude(item_path, is_dir=True):
                sub_tree = generate_tree_structure(item_path, new_prefix, is_last_item)
                tree_lines.extend(sub_tree)

        return tree_lines

    # Начинаем формировать результат
    result = f"{output_var_name} = '''\n"

    # Добавляем дерево файлов в самом верху
    result += "# Структура проекта\n\n"
    result += "```\n"
    tree_lines = generate_tree_structure(directory_path)
    result += "\n".join(tree_lines)
    result += "\n```\n\n"

    # Проходим по всем файлам и папкам
    for root, dirs, files in os.walk(directory_path):
        # Проверяем, не нужно ли исключить текущую директорию
        if should_exclude(root, is_dir=True):
            continue

        # Фильтруем список директорий для обхода
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d), is_dir=True)]

        # Получаем относительный путь от начальной директории
        rel_path = os.path.relpath(root, directory_path)
        if rel_path == '.':
            rel_path = ''

        # Добавляем заголовок для директории
        if rel_path:
            result += f"\n## Директория: {rel_path}\n\n"
        else:
            result += f"\n## Корневая директория\n\n"

        # Обрабатываем файлы
        for file in files:
            file_path = os.path.join(root, file)

            # Проверяем, не нужно ли исключить файл
            if should_exclude(file_path):
                continue

            rel_file_path = os.path.relpath(file_path, directory_path)

            # Проверяем, является ли файл текстовым
            if is_text_file(file_path):
                result += f"### Файл: {rel_file_path}\n"
                result += f"```{os.path.splitext(file_path)[1][1:]}\n"
                content = read_file_content(file_path)
                result += content
                result += "\n```\n\n"
            else:
                # Для бинарных файлов просто указываем путь
                result += f"### Файл: {rel_file_path} *(бинарный файл)*\n\n"

    result += "'''"
    return result

# Пример использования:
if __name__ == "__main__":
    # Дополнительные исключения
    exclude_list = ['temp', 'cache', '*.log', '.env', 'venv', '__pycache__', 'node_modules', '.git', 'files_tree.md']

    # Получить дерево файлов с исключениями
    path_to_scan = rf'./'
    md_content = get_files_tree_md(path_to_scan, exclude_list=exclude_list)

    # Сохранить в файл
    start = md_content.find("'''") + 3
    end = md_content.rfind("'''")
    content = md_content[start:end]

    with open("files_tree.md", "w", encoding="utf-8") as f:
        f.write(content)

    print("Файл сохранен как files_tree.md")
