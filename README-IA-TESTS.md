# 🧪 Pruebas de IA para ExtractorW

Este directorio contiene scripts de prueba para evaluar diferentes enfoques de IA para procesar tendencias con contexto.

## 📁 Archivos Creados

### 1. `test-gpt4-turbo.js` - Web Scraping + GPT-4 Turbo
**🕷️ Enfoque híbrido: Scraping web + IA**

- **Scraping múltiple**: Google News, Wikipedia, sitios guatemaltecos
- **IA para categorización**: GPT-4 Turbo usando datos scrapeados
- **IA para resúmenes**: GPT-4 Turbo procesa información recopilada
- **Transparencia**: Muestra exactamente qué fuentes se consultaron

### 2. `test-perplexity.js` - Perplexity con búsqueda web nativa
**🔍 Búsqueda web nativa + procesamiento en lote**

- **Búsqueda integrada**: Perplexity busca automáticamente
- **Procesamiento eficiente**: Múltiples tendencias en una consulta
- **Información actualizada**: Datos en tiempo real

### 3. `test-comparison.js` - Comparación automática
**🔬 Evaluación lado a lado**

- **Comparación completa**: Rendimiento, calidad, fuentes
- **Métricas detalladas**: Tiempo, cantidad de fuentes, precisión
- **Recomendaciones**: Basadas en resultados reales

## 🚀 Configuración Inicial

### Paso 1: Configurar API Keys

```bash
# Copiar template de configuración
cp env-template.txt .env

# Editar .env con tus claves reales
nano .env
```

**Variables requeridas:**
```env
# Para Web Scraping + GPT-4 Turbo
OPENROUTER_API_KEY=tu_clave_openrouter_aqui

# Para Perplexity
PERPLEXITY_API_KEY=tu_clave_perplexity_aqui
```

### Paso 2: Verificar dependencias

```bash
# Ya instaladas en este proyecto
npm list cheerio     # Para web scraping
npm list node-fetch  # Para requests HTTP
```

## 🧪 Cómo Probar

### Opción 1: Comparación completa (recomendado)

```bash
# Compara ambos enfoques automáticamente
node test-comparison.js
```

**Salida esperada:**
- ⏱️ Tiempos de respuesta
- 🏷️ Categorías asignadas
- 🔍 Fuentes consultadas
- 📝 Calidad de información
- 💡 Recomendación final

### Opción 2: Probar solo Web Scraping + GPT-4

```bash
# Solo el enfoque híbrido
node test-comparison.js scraping
# o
node test-gpt4-turbo.js
```

**Características:**
- 🕷️ Scraping de Google News RSS
- 📚 Consulta a Wikipedia
- 🏛️ Búsqueda en sitios guatemaltecos
- 🤖 Procesamiento con GPT-4 Turbo

### Opción 3: Probar solo Perplexity

```bash
# Solo Perplexity
node test-comparison.js perplexity
# o  
node test-perplexity.js
```

**Características:**
- 🔍 Búsqueda web nativa
- ⚡ Procesamiento en lote
- 🌐 Información global actualizada

## 📊 Interpretando Resultados

### Métricas de Rendimiento

```
⏱️ RENDIMIENTO:
   Scraping + GPT-4: 15.23s
   Perplexity:       8.45s
   🏆 Más rápido: Perplexity
```

### Fuentes de Información

```
🔍 FUENTES DE INFORMACIÓN:
   Scraping + GPT-4:
     Guatemala: 3 artículos de [Google News, Wikipedia, Fuentes GT]
     
   Perplexity:
     Guatemala: Búsqueda web nativa (sonar)
```

### Categorización

```
🏷️ CATEGORIZACIÓN:
   Scraping + GPT-4:
     Guatemala → Política
     Congreso → Política
     
   Perplexity:
     Guatemala → Sociedad
     Congreso → Política
```

## 🎯 Cuándo Usar Cada Opción

### 🕷️ Web Scraping + GPT-4 Turbo

**✅ Mejor para:**
- Control total sobre fuentes específicas
- Noticias guatemaltecas locales
- Transparencia en fuentes consultadas
- Análisis detallado de tendencias específicas

**⚠️ Consideraciones:**
- Más lento (scraping + procesamiento)
- Costo: requests web + tokens GPT-4
- Puede fallar si sitios cambian estructura

### 🔍 Perplexity

**✅ Mejor para:**
- Rapidez y eficiencia
- Información global actualizada
- Procesamiento de muchas tendencias
- Búsqueda web optimizada

**⚠️ Consideraciones:**
- Menos control sobre fuentes específicas
- Costo por consulta
- Dependiente de la API de Perplexity

## 🔧 Personalización

### Agregar nuevas fuentes de scraping

En `test-gpt4-turbo.js`, función `scrapeGuatemalaNews()`:

```javascript
const sources = [
  'https://www.prensalibre.com',
  'https://www.soy502.com',
  'https://www.republica.gt',
  'https://tu-nueva-fuente.com'  // ← Agregar aquí
];
```

### Modificar categorías

En ambos archivos, actualizar `categoryMap`:

```javascript
const categoryMap = {
  'Política': ['política', 'gobierno', 'congreso'],
  'TuCategoria': ['palabra1', 'palabra2'],  // ← Nueva categoría
  // ...
};
```

### Ajustar prompts de IA

Para mejor categorización, modificar los prompts en:
- `categorizeTrendWithScrapedData()` (Web Scraping + GPT-4)
- `categorizeTrendWithPerplexity()` (Perplexity)

## 🚨 Troubleshooting

### Error: "API Key no configurada"
```bash
# Verificar que .env existe
ls -la .env

# Verificar contenido
cat .env | grep API_KEY
```

### Error: "cheerio no encontrado"
```bash
npm install cheerio
```

### Error: "Rate limiting"
```bash
# Los scripts incluyen pausas automáticas
# Para mayor pausa, modificar:
await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos
```

### Error de scraping: "403 Forbidden"
- Algunos sitios bloquean bots
- Los scripts incluyen User-Agent headers
- Considera usar proxies si es necesario

## 📈 Próximos Pasos

1. **Evalúa ambas opciones** con tus datos reales
2. **Mide costos** en tu contexto de uso
3. **Elige la mejor opción** según tus necesidades
4. **Integra al servidor principal** (`server.js`)

## 🤝 Integración al Servidor

Una vez que elijas la mejor opción, puedes:

1. **Importar funciones** al `server.js`:
```javascript
const { processWithScrapingPlusGPT4 } = require('./test-gpt4-turbo');
// o
const { processWithPerplexityBatch } = require('./test-perplexity');
```

2. **Reemplazar** la función actual `getAboutFromPerplexityBatch()`

3. **Actualizar** el endpoint `/api/processTrends`

---

¿Tienes preguntas o necesitas ajustar algo específico? ¡Los scripts están listos para probar! 🚀 