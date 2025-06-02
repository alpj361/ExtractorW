# 🚀 ExtractorW - Guía de Deployment con Docker

Esta guía te ayudará a deployar ExtractorW en tu VPS usando Docker, configurado específicamente para **server.standatpd.com**.

## 📋 Prerrequisitos

### En tu VPS:
- Ubuntu 20.04+ o CentOS 8+
- Docker y Docker Compose instalados
- Al menos 1GB RAM disponible
- Puerto 8080 libre
- Acceso SSH al servidor
- **DNS configurado**: `server.standatpd.com` → IP del VPS

### APIs requeridas:
- **Supabase**: Base de datos (obligatorio)
- **OpenRouter**: GPT-4 Turbo para análisis (opcional)
- **Perplexity**: Búsqueda web mejorada (opcional)

## 🔧 Instalación de Docker (si no está instalado)

### Ubuntu/Debian:
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reiniciar sesión o ejecutar:
newgrp docker
```

### CentOS/RHEL:
```bash
# Instalar Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

## 📁 Preparación del Proyecto

### 1. Subir archivos al VPS
```bash
# Opción 1: Git Clone (recomendado)
cd /opt
sudo git clone <tu-repositorio> extractorw
sudo chown -R $USER:$USER extractorw
cd extractorw

# Opción 2: SCP/SFTP
scp -r ./ExtractorW user@tu-vps:/opt/extractorw
```

### 2. Configurar variables de entorno
```bash
cd /opt/extractorw

# Crear archivo .env desde template
cp env-template.txt .env

# Editar con tus valores reales
nano .env
```

### Configuración mínima del .env:
```env
# === OBLIGATORIO ===
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# === RECOMENDADO ===
PORT=8080
USE_AI=true
LOCATION=Guatemala

# === OPCIONAL (para mejores resultados) ===
OPENROUTER_API_KEY=sk-or-v1-xxx...
PERPLEXITY_API_KEY=pplx-xxx...
VPS_API_URL=https://server.standatpd.com
```

## 🚀 Deployment Rápido para server.standatpd.com

### Método 1: Setup Completo Automático (Recomendado)
```bash
# Setup completo para server.standatpd.com
make quick-setup

# O si quieres usar otro dominio:
make setup-complete DOMAIN=otro.dominio.com
```

### Método 2: Paso a paso
```bash
# 1. Deploy del contenedor
make deploy

# 2. Configurar nginx para server.standatpd.com
make setup-subdomain

# 3. Configurar SSL
make ssl

# 4. Verificar todo
make check-subdomain
```

### Método 3: Script Manual
```bash
# Hacer ejecutable el script
chmod +x deploy.sh

# Ejecutar deployment
./deploy.sh

# Configurar subdominio
./setup-subdomain.sh
```

## 🔍 Verificación

### 1. Verificar que la aplicación está funcionando:
```bash
# Health check local
curl http://localhost:8080/health

# Health check público
curl http://server.standatpd.com/health

# Health check HTTPS (después de SSL)
curl https://server.standatpd.com/health

# Verificación completa
make quick-check
```

### 2. Ver logs:
```bash
# Logs de aplicación
make logs

# Logs de Nginx
make nginx-logs

# Últimos 50 logs
make logs-tail
```

### 3. Verificar contenedores:
```bash
make status
```

## 🔒 Configuración SSL (HTTPS)

### Instalar Certbot y configurar SSL:
```bash
# Instalar Certbot
sudo apt install snapd -y
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Configurar SSL para server.standatpd.com
make quick-ssl

# O manualmente:
sudo certbot --nginx -d server.standatpd.com
```

## 🌐 URLs de tu API

Después del deployment exitoso, tu API estará disponible en:

- **Health Check**: `https://server.standatpd.com/health`
- **Procesar Tendencias**: `https://server.standatpd.com/api/processTrends`
- **Últimas Tendencias**: `https://server.standatpd.com/api/latestTrends`
- **Trending Tweets**: `https://server.standatpd.com/api/trending-tweets`
- **Análisis Personalizado**: `https://server.standatpd.com/api/sondeo`

## 🔧 Comandos de Mantenimiento

### Comandos rápidos para server.standatpd.com:
```bash
# Setup completo
make quick-setup

# Configurar SSL
make quick-ssl

# Verificar estado
make quick-check
```

### Logs y Debugging:
```bash
# Ver logs de aplicación
make logs

# Ver logs de Nginx
make nginx-logs

# Acceder al contenedor
make shell

# Backup de logs
make backup-logs
```

### Actualizaciones:
```bash
# Actualizar aplicación
make update

# Reiniciar servicios
make restart
```

### Monitoreo:
```bash
# Estado de contenedores
make status

# Verificar salud
make health

# Limpiar sistema
make clean
```

## 🔥 Firewall

### UFW (Ubuntu):
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### firewalld (CentOS):
```bash
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## 📊 Configuración para tu Frontend/Scraper

En tu aplicación frontend o scraper, usa:

```env
VPS_API_URL=https://server.standatpd.com
```

### Endpoints disponibles:
```javascript
// Health check
GET https://server.standatpd.com/health

// Procesar tendencias
POST https://server.standatpd.com/api/processTrends
{
  "rawData": { /* datos de tendencias */ }
}

// Obtener últimas tendencias
GET https://server.standatpd.com/api/latestTrends

// Obtener trending tweets con sentimiento
GET https://server.standatpd.com/api/trending-tweets

// Análisis personalizado
POST https://server.standatpd.com/api/sondeo
{
  "contexto": { /* contexto */ },
  "pregunta": "¿Qué opinas sobre...?"
}
```

## ❗ Troubleshooting

### Problema: Contenedor no inicia
```bash
# Ver logs detallados
make logs

# Verificar .env
cat .env

# Reconstruir imagen
make update
```

### Problema: DNS no resuelve
```bash
# Verificar DNS
nslookup server.standatpd.com

# Verificar configuración completa
make quick-check
```

### Problema: SSL no funciona
```bash
# Reconfigurar SSL
make quick-ssl

# Ver logs de Nginx
make nginx-logs
```

### Problema: Puerto ocupado
```bash
# Ver qué usa el puerto 8080
sudo lsof -i :8080

# Cambiar puerto en docker-compose.yml si es necesario
```

## 📞 Soporte

- **Logs**: `make logs` o `make nginx-logs`
- **Health**: `make quick-check`
- **Restart**: `make restart`
- **Clean**: `make clean`

## 🎯 Verificación Final

```bash
# Verificar que todo funciona correctamente
make quick-check

# Deberías ver:
# ✅ DNS resuelve
# ✅ HTTP responde (200)
# ✅ HTTPS responde (200)
# ✅ Configuración Nginx válida
```

¡Tu ExtractorW está listo en **https://server.standatpd.com**! 🎉 