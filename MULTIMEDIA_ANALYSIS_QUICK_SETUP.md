# Setup Rápido - Sistema de Análisis Automático de Enlaces Multimedia

## ⚡ Configuración en 5 minutos

### 1. Verificar Dependencias
```bash
# En ExtractorW - Verificar que axios ya esté instalado
cd ExtractorW
npm list axios

# En ExtractorT - Verificar que esté ejecutándose
curl http://localhost:8000/
```

### 2. Configurar Variables de Entorno
```bash
# En ExtractorW/.env
EXTRACTORT_URL=http://localhost:8000
GEMINI_API_KEY=your_gemini_api_key_here

# En ExtractorT/.env (si no existe)
NITTER_INSTANCES=https://nitter.poast.org,https://nitter.net
```

### 3. Probar el Sistema
```bash
# Ejecutar script de prueba
cd ExtractorW
node test-pending-analysis.js
```

### 4. Usar desde PulseJ
1. Agregar enlaces al codex
2. ✅ Marcar "¿Analizar enlaces?"
3. Los enlaces se etiquetan como "pendiente-analisis"
4. Llamar al endpoint para procesarlos

## 🚀 Endpoints Principales

### Obtener estadísticas
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/pending-analysis/pending-stats
```

### Procesar enlaces
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"processAll": true}' \
  http://localhost:3000/api/pending-analysis/analyze-pending-links
```

## 💰 Costos de Créditos

| Tipo | Costo | Incluye |
|------|-------|---------|
| 📱 Multimedia | 25 créditos | Descarga + Transcripción/Análisis |
| 📄 Básico | 5 créditos | Análisis descriptivo simple |

## 🔧 Troubleshooting Rápido

**Error: ExtractorT no disponible**
```bash
# Verificar que esté ejecutándose
cd ExtractorT
python -m uvicorn app.main:app --reload --port 8000
```

**Error: Créditos insuficientes**
```sql
-- Verificar créditos del usuario
SELECT credits_balance FROM profiles WHERE id = 'user-id';
```

**Error: No se procesan enlaces**
```sql
-- Verificar enlaces pendientes
SELECT * FROM codex_items 
WHERE etiquetas @> '["pendiente-analisis"]';
```

## 📋 Checklist de Verificación

- [ ] ExtractorW ejecutándose (puerto 3000)
- [ ] ExtractorT ejecutándose (puerto 8000)
- [ ] Variable EXTRACTORT_URL configurada
- [ ] Variable GEMINI_API_KEY configurada
- [ ] Rutas registradas en routes/index.js
- [ ] Usuario tiene créditos suficientes
- [ ] Enlaces marcados como "pendiente-analisis"

## 🎯 Flujo Completo

1. **PulseJ**: Usuario agrega enlaces con checkbox ✅
2. **ExtractorW**: Detecta URLs multimedia vs básicas
3. **ExtractorT**: Descarga medios temporalmente
4. **ExtractorW**: Procesa con Gemini AI
5. **Base de datos**: Actualiza item con transcripción
6. **Créditos**: Debita según tipo de procesamiento

## 📞 Soporte

- **Documentación completa**: `MULTIMEDIA_ANALYSIS_SYSTEM.md`
- **Script de prueba**: `test-pending-analysis.js`
- **Logs**: Revisar consola de ExtractorW y ExtractorT

¡Listo para usar! 🎉 