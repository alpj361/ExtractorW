# Configuración de Red Docker - ExtractorW y ExtractorT

## Problema
ExtractorW y ExtractorT están en contenedores Docker separados con sus propias redes. Cuando ExtractorW intenta conectarse a ExtractorT usando `localhost:8000`, falla porque `localhost` se refiere al contenedor local, no al host.

## Solución Implementada

### 1. Detección Automática de Entorno
Los servicios ahora detectan automáticamente si están ejecutándose en Docker y ajustan la URL de ExtractorT:

```javascript
function getExtractorTUrl() {
  if (process.env.EXTRACTOR_T_URL) {
    return process.env.EXTRACTOR_T_URL;
  }
  
  // Detectar si estamos en Docker
  if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true') {
    // En Docker, usar host.docker.internal o la IP del host
    return process.env.DOCKER_HOST_IP 
      ? `http://${process.env.DOCKER_HOST_IP}:8000`
      : 'http://host.docker.internal:8000';
  }
  
  // En desarrollo local
  return 'http://localhost:8000';
}
```

### 2. Configuración por Variables de Entorno

#### Opción 1: URL Específica
```bash
EXTRACTOR_T_URL=http://host.docker.internal:8000
```

#### Opción 2: IP del Host
```bash
DOCKER_HOST_IP=192.168.1.100
```

#### Opción 3: Variables de Entorno Docker
```bash
NODE_ENV=production
DOCKER_ENV=true
```

## Configuraciones por Plataforma

### Mac/Windows (Docker Desktop)
```bash
# En .env de ExtractorW
EXTRACTOR_T_URL=http://host.docker.internal:8000
```

### Linux
```bash
# En .env de ExtractorW
DOCKER_HOST_IP=172.17.0.1
# o usar la IP real del host
DOCKER_HOST_IP=192.168.1.100
```

### Producción (VPS)
```bash
# En .env de ExtractorW
EXTRACTOR_T_URL=http://api.standatpd.com
```

## Verificación
Los logs mostrarán la URL configurada al iniciar el servicio:
```
🔗 ExtractorT URL configurada: http://host.docker.internal:8000
🔗 ExtractorT URL configurada (MCP): http://host.docker.internal:8000
```

## Troubleshooting

### Error: ECONNREFUSED
1. Verificar que ExtractorT esté corriendo: `docker ps`
2. Verificar que el puerto 8000 esté expuesto
3. Probar conectividad: `docker exec -it extractorw-api curl http://host.docker.internal:8000`

### host.docker.internal no funciona
En Linux, usar la IP del host:
```bash
# Encontrar IP del host
docker network inspect bridge

# Configurar en .env
DOCKER_HOST_IP=172.17.0.1
```

### Alternativa: Red Externa Compartida
Si prefieres usar una red Docker compartida:

```yaml
# docker-compose.yml de ExtractorW
networks:
  shared-network:
    external: true

# docker-compose.yaml de ExtractorT
networks:
  shared-network:
    external: true
```

Crear la red:
```bash
docker network create shared-network
```

Y usar el nombre del servicio:
```bash
EXTRACTOR_T_URL=http://api:8000
``` 