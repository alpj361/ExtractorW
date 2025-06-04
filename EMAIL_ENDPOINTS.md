# 📧 Endpoints de Email - ExtractorW

Los endpoints de email están ahora disponibles en el servidor ExtractorW con **detección automática** de frontend y corrección de caracteres especiales.

## 🚀 Endpoints Disponibles

### 1. `POST /api/send-email` - Enviar Email
Envía un email usando configuración SMTP dinámica.

**URL:** `http://localhost:8080/api/send-email`

**Body de ejemplo:**
```json
{
  "to": "destinatario@gmail.com",
  "subject": "Asunto del email",
  "html": "<h1>Email HTML</h1><p>Contenido del email</p>",
  "text": "Contenido del email en texto plano",
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "auth": {
      "user": "contacto@standatpd.com",
      "pass": "tfjl zyol rbna sbmg"
    }
  },
  "from": {
    "name": "PulseJournal",
    "email": "contacto@standatpd.com"
  }
}
```

### 2. `POST /api/test-email` - Probar Configuración SMTP
Prueba la configuración SMTP y envía un email de prueba.

**URL:** `http://localhost:8080/api/test-email`

**Body de ejemplo:**
```json
{
  "to": "pablojosea361@gmail.com",
  "subject": "Prueba SMTP - ExtractorW",
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "auth": {
      "user": "contacto@standatpd.com",
      "pass": "tfjl zyol rbna sbmg"
    }
  },
  "from": {
    "name": "PulseJournal",
    "email": "contacto@standatpd.com"
  }
}
```

## 🔧 Características Principales

### ✅ Detección Automática de Frontend
- **CURL**: Usa el password tal como viene
- **Frontend (browsers)**: Detecta automáticamente User-Agent `Mozilla` y corrige caracteres especiales

### ✅ Corrección de Caracteres Especiales
- Detecta espacios Unicode (código 160) vs espacios normales (código 32)
- Corrige automáticamente passwords con caracteres especiales del frontend
- Logging detallado byte por byte para debugging

### ✅ Configuración SMTP Flexible
- Soporte para Gmail (ports 587 y 465)
- Configuración TLS/SSL automática según el puerto
- Autenticación con App Passwords de Gmail

## 🧪 Pruebas con CURL

### Probar configuración SMTP:
```bash
curl -X POST http://localhost:8080/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "pablojosea361@gmail.com",
    "subject": "Test desde CURL",
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "auth": {
        "user": "contacto@standatpd.com",
        "pass": "tfjl zyol rbna sbmg"
      }
    },
    "from": {
      "name": "ExtractorW",
      "email": "contacto@standatpd.com"
    }
  }'
```

### Enviar email real:
```bash
curl -X POST http://localhost:8080/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "pablojosea361@gmail.com",
    "subject": "Email desde ExtractorW",
    "html": "<h1>Hola</h1><p>Este email fue enviado desde ExtractorW</p>",
    "text": "Hola, este email fue enviado desde ExtractorW",
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "auth": {
        "user": "contacto@standatpd.com",
        "pass": "tfjl zyol rbna sbmg"
      }
    },
    "from": {
      "name": "ExtractorW",
      "email": "contacto@standatpd.com"
    }
  }'
```

### Verificar estado del servidor:
```bash
curl http://localhost:8080/health
```

## 🔍 Debugging y Logs

Los endpoints incluyen logging detallado:
- 🔍 **Origen detectado**: CURL vs FRONTEND
- 🔬 **Comparación byte por byte** de passwords
- 🔧 **Configuración de transporte** SMTP
- ✅ **Estado de conexión** y envío

## 📋 Respuestas de Ejemplo

### Éxito:
```json
{
  "success": true,
  "message": "Email enviado exitosamente",
  "messageId": "<1234567890@standatpd.com>"
}
```

### Error:
```json
{
  "success": false,
  "error": "Invalid login: 535-5.7.8 Username and Password not accepted",
  "details": "Error desconocido"
}
```

## 🌐 Uso desde Frontend (PulseJ)

El frontend debe configurar la URL del servidor ExtractorW:

```javascript
// En AdminPanel.tsx, cambiar la URL de:
const response = await fetch('http://localhost:3001/api/send-email', {
// A:
const response = await fetch('http://localhost:8080/api/send-email', {
```

La detección automática de frontend funcionará y corregirá automáticamente los caracteres especiales.

## ⚙️ Instalación en VPS

```bash
# En el directorio ExtractorW del VPS:
./install-email-deps.sh

# O manualmente:
npm install nodemailer
node server.js
```

Los endpoints estarán disponibles en `http://tu-vps:8080/api/send-email` y `http://tu-vps:8080/api/test-email`. 