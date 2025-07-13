# Implementación de Resolución de Usuarios con Perplexity

## Resumen del Proyecto

Estamos mejorando el sistema de agentes Laura (ExtractorW) para resolver usuarios ambiguos usando Perplexity antes de ejecutar `nitter_profile`. El objetivo es que cuando un usuario pida "tweets del congreso", el sistema use Perplexity para encontrar la cuenta oficial real de Twitter/X.

## Problema Original

**Flujo problemático:**
1. Usuario: `"extraeme tweets del usuario del congreso"`
2. Laura hardcodeaba: `@CongresoGt` 
3. Ejecutaba `nitter_profile` con username incorrecto
4. **DESPUÉS** intentaba Perplexity para "enhancement" pero fallaba por autenticación

## Solución Implementada

**Nuevo flujo mejorado:**
1. Usuario: `"extraeme tweets del congreso"`
2. Laura genera: `"username": "Congreso de Guatemala"` (descriptivo)
3. **ANTES** de `nitter_profile`: Sistema detecta usuario ambiguo
4. **Resolución con Perplexity**: `resolveAmbiguousUser()` busca cuenta oficial
5. **Ejecuta**: `nitter_profile` con username correcto (ej: `@congresoguate`)
6. **Enhancement**: Perplexity agrega contexto adicional

## Fixes Implementados

### 1. Fix de Autenticación ✅
**Problema**: `enhanceProfileWithPerplexity` no pasaba parámetro `user`
**Solución**: Agregado parámetro `user` en todas las llamadas (líneas 650, 831, 934, 1064)

### 2. Fix de Flujo de Resolución ✅ 
**Problema**: Perplexity se ejecutaba DESPUÉS de `nitter_profile`
**Solución**: Movida resolución ANTES de `nitter_profile` (líneas 660-670)

### 3. Función de Resolución de Usuarios ✅
**Archivo**: `agentesService.js:1030-1115`
**Función**: `resolveAmbiguousUser(username, user)`

**Lógica de detección**:
```javascript
const isAmbiguous = !username.startsWith('@') && (
  usernameLower.includes('congreso') ||
  usernameLower.includes('presidente') ||
  usernameLower.includes('ministro') ||
  usernameLower.includes('diputado') ||
  usernameLower.includes('gobierno') ||
  usernameLower.includes('oficial')
);
```

**Estrategias de resolución**:
1. **Perplexity primario**: Query optimizado para encontrar @username
2. **Regex @username**: Busca patrones `/@[a-zA-Z0-9_]+/g`
3. **Patrones alternativos**: `CongresoGt`, `congresoguate`, etc.
4. **Fallback hardcodeado**: Para casos conocidos

### 4. Prompt de Laura Mejorado ✅
**Cambios en buildLLMPlan**:

- **Removido hardcoding**: Eliminado `CongresoGt` de palabras clave
- **Agregadas instrucciones**: Resolución automática de usuarios ambiguos
- **Ejemplos actualizados**: Casos de uso con descripciones genéricas
- **Query Perplexity mejorado**: `"¿Cuál es el usuario oficial de Twitter/X del {entity} de Guatemala?"`

### 5. Manejo de Contenido Perplexity ✅
**Problema**: `perplexityResult.content` vs `perplexityResult.formatted_response`
**Solución**: Manejo de ambos formatos de respuesta

```javascript
const content = perplexityResult.content || perplexityResult.formatted_response;
```

## Archivos Modificados

### `/Users/pj/Desktop/ExtractorW/server/services/agentesService.js`

**Líneas principales modificadas**:
- `119`: Removido hardcoding CongresoGt 
- `146-149`: Instrucciones resolución usuarios ambiguos
- `266-293`: Ejemplos mejorados en prompt
- `660-670`: Resolución antes de nitter_profile
- `1030-1115`: Nueva función `resolveAmbiguousUser`
- `1064`: Fix parámetro user en `enhanceProfileWithPerplexity`

## Logs de Debug Implementados

**Flujo de resolución**:
```
[LAURA] 🔍 Verificando si usuario es ambiguo: "Congreso de Guatemala"
[LAURA] 🔍 Detectado usuario ambiguo: "Congreso de Guatemala" - resolviendo con Perplexity...
[LAURA] 📝 Query resolución: "¿Cuál es el usuario oficial de Twitter/X del Congreso de Guatemala de Guatemala?"
[LAURA] 📄 Contenido Perplexity recibido: "• Cuenta oficial de Twitter: @congresoguate..."
[LAURA] 🔍 Matches @username encontrados: ['@congresoguate']
[LAURA] ✅ Usuario resuelto exitosamente: congresoguate
[LAURA] 🔄 Usuario resuelto: "Congreso de Guatemala" → "@congresoguate"
```

## Casos de Prueba

### Test Principal
**Input**: `"extraeme tweets del congreso"`
**Flujo esperado**:
1. Laura genera: `"username": "Congreso de Guatemala"`
2. Sistema detecta ambigüedad
3. Perplexity resuelve: `@congresoguate` 
4. Ejecuta nitter_profile con cuenta oficial correcta

### Test de Fallback
**Si Perplexity falla**:
1. Intenta patrones alternativos
2. Usa fallback hardcodeado para casos conocidos
3. Mantiene funcionalidad básica

## Estado Actual

✅ **Completado**: Resolución básica de usuarios ambiguos
✅ **Completado**: Integración con Perplexity
✅ **Completado**: Manejo de errores y fallbacks
✅ **Completado**: Logging detallado para debug

🔄 **En testing**: Validación del flujo completo
📋 **Pendiente**: Fixes adicionales según resultados de pruebas

## Próximos Pasos

1. **Validar funcionamiento** con casos reales
2. **Optimizar queries Perplexity** según resultados
3. **Agregar más entidades** (presidente, ministros, etc.)
4. **Implementar caché** para usernames resueltos
5. **Fixes adicionales** según feedback del usuario

## Beneficios

- **Resolución dinámica**: No más usernames hardcodeados
- **Uso inteligente de Perplexity**: Para encontrar cuentas oficiales actualizadas
- **Fallbacks robustos**: Sistema funciona aunque Perplexity falle
- **Escalabilidad**: Fácil agregar nuevas entidades (ministros, embajadas, etc.)
- **Debugging**: Logs detallados para troubleshooting

## Arquitectura de la Solución

```
User Query → Laura LLM → Detección Ambigua → Perplexity → Username Oficial → nitter_profile → Tweets
                ↓                           ↓              ↓
            "congreso"              "¿username oficial?"   "@congresoguate"
```

Esta implementación convierte el sistema de estático a dinámico, permitiendo encontrar cuentas oficiales actualizadas usando búsqueda web inteligente.