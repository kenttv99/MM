# frontend/Dockerfile
# Этап 1: Сборка приложения
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json (или yarn.lock)
COPY package.json package-lock.json* ./ 
# Если используете yarn, замените на:
# COPY package.json yarn.lock ./ 

# Устанавливаем зависимости
# Используйте npm ci для более детерминированной установки из lock-файла
RUN npm ci 
# Если используете yarn:
# RUN yarn install --frozen-lockfile

# Копируем остальной код приложения
COPY . .

# Копируем .env.local для сборки (если нужно)
# Убедитесь, что в нем нет секретов, или используйте аргументы сборки (ARG)
# COPY .env.local .

# Устанавливаем переменные окружения для сборки (если нужны)
# ENV NEXT_PUBLIC_API_URL=http://localhost:8000 # Пример

# Собираем приложение
RUN npm run build
# Если используете yarn:
# RUN yarn build

# Этап 2: Запуск приложения
FROM node:18-alpine

WORKDIR /app

# Устанавливаем переменные окружения
ENV NODE_ENV=production
# Добавьте другие необходимые переменные окружения для запуска
# ENV NEXT_PUBLIC_API_URL=http://localhost:8000 # Пример

# Копируем собранное приложение из этапа сборки
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
# Копируем next.config.js, если он нужен для запуска production сервера
COPY --from=builder /app/next.config.js ./next.config.js

# Открываем порт, на котором работает Next.js (по умолчанию 3000)
EXPOSE 3000

# Команда для запуска приложения
CMD ["npm", "start"]
# Если используете yarn:
# CMD ["yarn", "start"] 