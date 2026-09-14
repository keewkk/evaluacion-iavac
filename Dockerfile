FROM node:18-alpine

WORKDIR /app

# Instalar dependencias de compilación para better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar package.json e instalar dependencias en /app/backend
COPY backend/package.json ./backend/
RUN cd backend && npm install

# Copiar el resto del código
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY database/ ./database/

# Configurar NODE_PATH para que require() encuentre los módulos desde cualquier subdirectorio
ENV NODE_PATH=/app/backend/node_modules

EXPOSE 3000

CMD ["node", "backend/server.js"]

