# Usar Node.js oficial como base
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

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