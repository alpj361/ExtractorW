# ExtractorW - Estructura Modular

Esta es la versión modular del servidor de ExtractorW, que ha sido refactorizada para mejorar la mantenibilidad y escalabilidad del código.

## Estructura de Directorios

```
ExtractorW/
├── server/
│   ├── index.js             # Punto de entrada principal
│   ├── routes/              # Definiciones de rutas
│   │   ├── index.js         # Configuración de todas las rutas
│   │   ├── trends.js        # Rutas de tendencias
│   │   └── admin.js         # Rutas de administración
│   ├── controllers/         # Controladores (lógica de negocio)
│   ├── services/            # Servicios (lógica reutilizable)
│   │   ├── categorization.js # Servicio de categorización
│   │   ├── logs.js          # Servicio de logs
│   │   └── perplexity.js    # Servicios de Perplexity
│   ├── middlewares/         # Middlewares
│   │   ├── index.js         # Configuración de middlewares
│   │   ├── auth.js          # Middleware de autenticación
│   │   ├── credits.js       # Middleware de créditos
│   │   └── utils.js         # Middlewares de utilidad
│   ├── utils/               # Utilidades
│   │   ├── constants.js     # Constantes globales
│   │   └── supabase.js      # Configuración de Supabase
│   └── models/              # Modelos de datos (opcional)
├── server.js                # Servidor monolítico original (backup)
├── server.js.bak            # Respaldo del servidor original
└── migrate-to-modular.js    # Script de migración
```

## Migración desde Versión Monolítica

Para migrar desde la versión monolítica a la versión modular, se ha creado un script de migración:

```bash
node migrate-to-modular.js
```

Este script:
1. Crea la estructura de directorios necesaria
2. Hace un respaldo del archivo `server.js` original
3. Actualiza `package.json` para usar la nueva estructura

## Ejecutando el Servidor

Para ejecutar el servidor modular:

```bash
npm start
```

Para ejecutar el servidor original (monolítico):

```bash
npm run start:original
```

## Ventajas de la Estructura Modular

1. **Mantenibilidad**: Cada componente tiene una responsabilidad clara
2. **Escalabilidad**: Facilita agregar nuevas funcionalidades sin afectar el código existente
3. **Testabilidad**: Permite probar componentes de forma aislada
4. **Colaboración**: Facilita el trabajo en equipo al tener archivos más pequeños y específicos

## Componentes Principales

### Rutas (`routes/`)

Las rutas definen los endpoints de la API y conectan las solicitudes HTTP con los controladores adecuados.

### Servicios (`services/`)

Los servicios contienen la lógica de negocio reutilizable, como:
- Categorización de tendencias
- Interacción con APIs externas (Perplexity)
- Registro de logs

### Middlewares (`middlewares/`)

Los middlewares procesan las solicitudes antes de llegar a los controladores:
- Autenticación y autorización
- Debitado de créditos
- Utilidades comunes

### Utilidades (`utils/`)

Funciones y configuraciones de uso general:
- Conexión a Supabase
- Constantes globales

## Migrando Código Existente

Si desarrollas nuevas funcionalidades, deberías seguir esta estructura:

1. Crea servicios para la lógica de negocio reutilizable
2. Define rutas para los nuevos endpoints
3. Utiliza middlewares para validación y procesamiento común
4. Mantén las utilidades separadas del código específico

## Solución de Problemas

Si encuentras algún problema después de la migración:

1. Verifica las rutas en `server/routes/`
2. Comprueba que todos los servicios estén correctamente importados
3. Asegúrate de que las dependencias estén instaladas
4. En caso necesario, puedes restaurar la versión original desde el respaldo 