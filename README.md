# ExtractorW - Backend para PulseJ

Este backend proporciona servicios para el dashboard PulseJ, procesando y almacenando datos de tendencias.

## Características principales

- Extracción de datos de tendencias
- Procesamiento con o sin IA (configurable)
- Almacenamiento en Supabase
- Garantiza siempre 10 keywords por consulta

## Instalación

1. Clona este repositorio
2. Instala las dependencias:

```bash
npm install
```

3. Crea el archivo `.env` con tus credenciales:

```bash
npm run create-env
```

4. Edita el archivo `.env` generado para añadir tus credenciales reales.

## Configuración

### Variables de entorno

El archivo `.env` generado contiene las siguientes variables que debes configurar:

```
# API Keys y credenciales
OPENROUTER_API_KEY=tu_api_key_aqui
VPS_API_URL=tu_url_aqui

# Supabase
SUPABASE_URL=https://tuproyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui

# Configuración
USE_AI=false  # true para usar IA, false para procesamiento local

# Puerto del servidor
PORT=8080
```

## Uso

### Iniciar el servidor

Para producción:
```bash
npm start
```

Para desarrollo (con valores por defecto y verificación de variables):
```bash
npm run dev
```

> El modo desarrollo verifica que todas las variables necesarias estén configuradas y usa valores por defecto cuando es posible. Es el método recomendado durante la etapa de desarrollo.

### Procesar datos históricos

Si deseas actualizar los datos históricos en Supabase para asegurar que todos tengan 10 keywords:

```bash
npm run process-historical
```

## API Endpoints

### POST /api/processTrends

Procesa datos de tendencias y los almacena en Supabase.

**Parámetros:**

- `rawData` (opcional): Datos crudos de tendencias. Si no se proporcionan, se intentarán obtener de VPS_API_URL.

**Respuesta:**

```json
{
  "wordCloudData": [...],
  "topKeywords": [...],  // Siempre 10 elementos
  "categoryData": [...],
  "timestamp": "2023-01-01T00:00:00Z"
}
```

## Estructura de Supabase

La tabla `trends` debe tener la siguiente estructura:

```sql
CREATE TABLE public.trends (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  timestamp TIMESTAMP WITH TIME ZONE,
  word_cloud_data JSONB,
  top_keywords JSONB,
  category_data JSONB,
  raw_data JSONB
);

-- Índice para búsquedas rápidas por timestamp
CREATE INDEX trends_timestamp_idx ON public.trends(timestamp DESC);
```

## Integración con PulseJ (Frontend)

Este backend está diseñado para trabajar con el dashboard PulseJ. Asegúrate de configurar la URL correcta en el frontend. 