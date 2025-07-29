# Usar Node.js oficial como base
FROM node:18-alpine

# Instalar FFmpeg, Python y dependencias del sistema
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    python3-dev \
    py3-pip \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias Node.js
RUN npm ci --only=production && npm cache clean --force

# Copiar e instalar dependencias Python para Laura Memory
COPY server/services/laura_memory/requirements.txt ./server/services/laura_memory/
RUN pip3 install --break-system-packages -r ./server/services/laura_memory/requirements.txt

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S extractorw -u 1001

# Copiar código fuente
COPY --chown=extractorw:nodejs . .

# Exponer puerto
EXPOSE 8080

# Cambiar a usuario no-root
USER extractorw

# Comando de inicio
CMD ["npm", "start"] 