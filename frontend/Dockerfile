# --- Этап 1: сборка SPA ---
FROM node:20-alpine AS build
WORKDIR /app

# Устанавливаем зависимости (кэшируемый слой)
COPY package*.json ./
RUN npm ci

# Собираем статику (tsc -b && vite build)
COPY . .
RUN npm run build

# --- Этап 2: раздача статики через nginx + прокси /api -> backend ---
FROM nginx:1.27-alpine
# Кастомный конфиг: SPA-fallback + проксирование /api на сервис backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
