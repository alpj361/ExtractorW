# Análisis de Filtros de Laura Agent para Nitter Context

## 📋 Resumen Ejecutivo

**Laura Agent** es un agente especializado en monitoreo de redes sociales que utiliza IA (Gemini 1.5 Flash) para procesar y enviar consultas optimizadas a Nitter Context. Su sistema de filtros está diseñado para obtener contenido relevante del contexto guatemalteco y reducir el ruido.

---

## 🔍 **Sistema de Filtros Inteligentes de Laura**

### **Método Principal: `applyIntelligentFilters()`**

```javascript
// Ubicación: server/services/agentesService.js líneas 443-476
applyIntelligentFilters(args, originalQuery) {
    const query = originalQuery || args.q || '';
    
    // Palabras problemáticas que traen ruido
    const excludeTerms = ['GT', 'game', 'gaming', 'gamer', 'tweet', 'twitter', 'social'];
    
    // Contexto guatemalteco específico
    const guatemalanContext = ['Guatemala', 'guatemalteco', 'Guate', 'Chapin', 'GuatemalaGob'];
```

---

## 🚫 **Palabras que EXCLUYE (Filtros de Ruido)**

| Término | Razón de Exclusión |
|---------|-------------------|
| `GT` | Se confunde con "Gaming/Gran Turismo" |
| `game` | Contenido de videojuegos |
| `gaming` | Contenido de videojuegos |
| `gamer` | Contenido de videojuegos |
| `tweet` | Meta-referencias a Twitter |
| `twitter` | Meta-referencias a Twitter |
| `social` | Demasiado genérico |

---

## ✅ **Contexto Guatemalteco que INCLUYE**

| Término | Uso |
|---------|-----|
| `Guatemala` | País completo |
| `guatemalteco` | Gentilicio |
| `Guate` | Forma coloquial |
| `Chapin` | Forma coloquial guatemalteca |
| `GuatemalaGob` | Cuenta oficial del gobierno |

---

## 🎯 **Filtros Específicos por Tema**

### **1. Leyes y Protección Animal**
```javascript
if (query.includes('ley') || query.includes('proteccion') || query.includes('animal')) {
  includeTerms = ['ley', 'protección', 'animal', 'Guatemala', 'congreso'];
}
```

### **2. Sismos y Terremotos**
```javascript
if (query.includes('sismo') || query.includes('terremoto')) {
  includeTerms = ['sismo', 'terremoto', 'Guatemala', 'INSIVUMEH', 'CONRED'];
}
```

### **3. Política y Elecciones**
```javascript
if (query.includes('eleccion') || query.includes('politica')) {
  includeTerms = ['elección', 'política', 'Guatemala', 'TSE', 'voto'];
}
```

---

## 🧠 **Mapeo Semántico Inteligente**

Laura utiliza un sistema de **relaciones semánticas** para expandir búsquedas:

```javascript
const semanticMappings = {
  'ley': ['legislación', 'proyecto', 'iniciativa', 'propuesta', 'congreso', 'diputados'],
  'protección': ['proteger', 'cuidado', 'bienestar', 'derechos', 'seguridad'],
  'animal': ['animales', 'mascotas', 'fauna', 'especies', 'perros', 'gatos'],
  'guatemala': ['guatemalteco', 'guatemaltecos', 'gt', 'guate', 'chapin'],
  'sismo': ['terremoto', 'temblor', 'movimiento', 'telúrico', 'epicentro'],
  'política': ['gobierno', 'presidente', 'congreso', 'elecciones', 'partidos'],
  'economía': ['económico', 'finanzas', 'mercado', 'precios', 'inflación']
}
```

---

## 🔄 **Términos Alternativos Automáticos**

Cuando Laura detecta baja relevancia, **automáticamente genera términos alternativos**:

```javascript
const termMappings = {
  'sismo': ['temblor', 'terremoto', 'movimiento sismico', 'seismo'],
  'reacciones': ['opiniones', 'comentarios', 'respuestas', 'reaccion'],
  'gobierno': ['presidencia', 'ejecutivo', 'administracion'],
  'presidente': ['mandatario', 'jefe de estado', 'ejecutivo'],
  'elecciones': ['votaciones', 'comicios', 'sufragio', 'TSE']
}
```

---

## 📊 **Análisis con IA (Gemini 1.5 Flash)**

Cada tweet capturado es analizado por IA para determinar:

- **Sentimiento**: positivo/negativo/neutral (-1 a +1)
- **Intención Comunicativa**: informativo, opinativo, humorístico, crítico, etc.
- **Entidades Mencionadas**: personas, organizaciones, lugares, eventos
- **Contexto Local**: Referencias específicas guatemaltecas
- **Score de Confianza**: Nivel de certeza del análisis

---

## ⚠️ **PROBLEMAS DETECTADOS para Lenguaje de X/Twitter**

### **1. Filtros Demasiado Restrictivos**
- Excluir `GT` puede eliminar tweets legítimos de Guatemala
- Excluir `social` elimina contexto de "redes sociales", "problema social", etc.

### **2. Falta de Lenguaje Coloquial de X**
Laura NO incluye términos comunes de Twitter como:
- `#` (hashtags)
- `@` (menciones)
- `RT` (retweets)
- Emojis y abreviaciones
- Jerga específica de redes sociales

### **3. Mapeo Semántico Limitado**
No incluye:
- **Sarcasmo/Ironía**: Común en Twitter
- **Memes**: Lenguaje viral
- **Abreviaciones guatemaltecas**: "xq", "q", "k", etc.
- **Emojis contextuales**: 🇬🇹, 🏛️, 📰

---

## 🛠️ **RECOMENDACIONES PARA MEJORAR**

### **1. Ampliar Contexto Guatemalteco**
```javascript
// AGREGAR:
const guatemalanSlang = ['xela', 'guate', 'gt', '502', 'chapines', 'guateque'];
const institutions = ['mp', 'tse', 'usac', 'url', 'insivumeh', 'conred'];
const politicians = ['arevalo', 'giammattei', 'torres', 'sandoval'];
```

### **2. Incluir Lenguaje de Redes Sociales**
```javascript
// AGREGAR:
const socialMediaTerms = ['trending', 'viral', 'hashtag', 'mencion'];
const twitterSlang = ['rt', 'dm', 'thread', 'ratio'];
```

### **3. Mejorar Filtros de Exclusión**
```javascript
// MODIFICAR:
const excludeTerms = ['game', 'gaming', 'gamer']; // Remover 'GT' y 'social'
```

### **4. Incluir Emojis y Contexto Visual**
```javascript
// AGREGAR:
const guatemalanEmojis = ['🇬🇹', '🏛️', '📰', '⚖️', '🌋'];
const contextualEmojis = ['😂', '😭', '💔', '🔥', '👏'];
```

---

## 📈 **MÉTRICAS DE EVALUACIÓN ACTUAL**

Laura evalúa la relevancia con:
- **Score de Relevancia**: 0-10 basado en coincidencias semánticas
- **Ratio de Tweets Relevantes**: % de tweets útiles vs ruido
- **Tiempo de Respuesta**: Eficiencia de la consulta
- **Tokens de IA Utilizados**: Costo computacional

---

## 🎯 **CONCLUSIONES**

### ✅ **Fortalezas**
- Sistema inteligente de filtros por tema
- Análisis de IA sofisticado por tweet
- Mapeo semántico contextual
- Enfoque específico en Guatemala

### ❌ **Debilidades para Lenguaje de X**
- **Filtros demasiado restrictivos** que eliminan contenido legítimo
- **Falta de comprensión del lenguaje coloquial** de Twitter
- **No maneja sarcasmo, memes, o ironía** común en redes sociales
- **Ausencia de contexto visual** (emojis, hashtags)

### 🚀 **Recomendación Principal**

**Laura necesita un módulo adicional de "Lenguaje de Redes Sociales"** que:
1. Reconozca jerga guatemalteca de Twitter
2. Interprete sarcasmo e ironía
3. Incluya emojis contextuales
4. Maneje hashtags y menciones
5. Entienda memes y referencias virales

Esto aseguraría que las consultas a Nitter Context capturen **realmente** cómo se habla en X, no solo términos formales.