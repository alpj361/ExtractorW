# Dockerfile para Laura Memory Server
FROM python:3.11-slim

# Configurar directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias
COPY requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 5001

# Variables de entorno por defecto
ENV FLASK_ENV=production
ENV FLASK_APP=server.py

# Comando para ejecutar el servidor
CMD ["python", "server.py"]