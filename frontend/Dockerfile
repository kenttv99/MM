# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_CONTAINER=true
# Отключаем watch-режим для предотвращения циклов
ENV WATCHPACK_POLLING=false
ENV CHOKIDAR_USEPOLLING=false

# Копируем файлы package.json
COPY package.json package-lock.json* ./

# Устанавливаем зависимости
RUN npm ci --production

# Копируем весь код
COPY . .

# Устанавливаем NODE_OPTIONS для ограничения памяти и предотвращения зависаний
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Собираем приложение с оптимизациями для предотвращения зацикливания
RUN DISABLE_ESLINT_PLUGIN=true npm run build

# Открываем порт для Next.js
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"] 