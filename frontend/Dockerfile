# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_CONTAINER=true

# Копируем файлы package.json
COPY package.json package-lock.json* ./

# Устанавливаем зависимости
RUN npm ci

# Копируем весь код
COPY . .

# Собираем приложение
RUN npm run build

# Открываем порт для Next.js
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"] 