const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const mcpService = require('../services/mcp');
const recentScrapesService = require('../services/recentScrapes');
const memoriesService = require('../services/memories');
const agentesService = require('../services/agentesService');
const supabase = require('../utils/supabase');

// ===================================================================
// VIZTA CHAT ROUTES
// Endpoints para el chat inteligente con integración MCP
// ===================================================================

/**
 * Post-procesa respuestas del chat para asegurar formato consistente
 */
function formatChatResponse(response, toolResult = null) {
  try {
    // Limpiar respuesta muy larga
    if (response.length > 2000) {
      console.log('⚠️ Respuesta muy larga, truncando...');
      response = response.substring(0, 1800) + '\n\n*[Respuesta truncada para mejor legibilidad]*';
    }

    // Asegurar que tenga formato markdown básico si no lo tiene
    if (!response.includes('##') && !response.includes('###')) {
      const lines = response.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        let formatted = `## 📊 Análisis\n\n`;
        formatted += lines.join('\n\n');
        
        // Agregar resumen de datos si disponible
        if (toolResult && toolResult.tweets_found) {
          formatted += `\n\n### 📊 Datos analizados:\n• ${toolResult.tweets_found} tweets encontrados`;
          if (toolResult.analysis_metadata?.sentiment_distribution) {
            const sentiments = Object.entries(toolResult.analysis_metadata.sentiment_distribution);
            if (sentiments.length > 0) {
              formatted += `\n• Sentimientos: ${sentiments.map(([s, c]) => `${s} (${c})`).join(', ')}`;
            }
          }
        }
        
        response = formatted;
      }
    }

    // Limpiar texto muy corrido (sin espacios entre párrafos)
    response = response
      .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea consecutivos
      .replace(/(\w)(\n)(### |## |\*\*)/g, '$1\n\n$3') // Espacios antes de headers
      .replace(/(\w)(\n)(• )/g, '$1\n\n$3') // Espacios antes de bullets
      .trim();

    // Asegurar que los emojis tengan espacio después
    response = response.replace(/([📊📈💭⚡🎯🔍])([A-Za-z])/g, '$1 $2');

    return response;

  } catch (error) {
    console.error('❌ Error formateando respuesta:', error);
    return response; // Devolver original si hay error
  }
}

// Cargar dependencias de forma condicional
let OpenAI, openai, uuidv4;

try {
  OpenAI = require('openai');
  const { v4 } = require('uuid');
  uuidv4 = v4;
  
  // Configurar OpenAI
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  console.log('✅ Dependencias de Vizta Chat cargadas correctamente');
} catch (error) {
  console.warn('⚠️ Dependencias de Vizta Chat no disponibles:', error.message);
  console.warn('📦 Instala las dependencias con: npm install openai uuid');
}

/**
 * POST /api/vizta-chat/query
 * Endpoint principal para consultas de Vizta Chat
 */
router.post('/query', verifyUserAccess, async (req, res) => {
  try {
    // Verificar que las dependencias estén disponibles
    if (!openai || !uuidv4) {
      // Fallback temporal sin OpenAI
      console.log('⚠️ Usando fallback sin OpenAI para Vizta Chat');
      
      const fallbackSessionId = sessionId || `fallback_${Date.now()}`;
      
      // Usar directamente nitter_context como herramienta por defecto
      try {
        const toolResult = await mcpService.executeTool('nitter_context', {
          q: message,
          location: 'guatemala',
          limit: 5
        }, req.user);
        
        if (toolResult.success && toolResult.tweets) {
          // Guardar en recent_scrapes
          await recentScrapesService.saveScrape({
            queryOriginal: message,
            queryClean: message,
            herramienta: 'nitter_context',
            categoria: 'General',
            tweets: toolResult.tweets,
            userId: userId,
            sessionId: fallbackSessionId,
            mcpRequestId: `fallback_${Date.now()}`,
            mcpExecutionTime: 0,
            location: 'guatemala'
          });
          
          return res.json({
            success: true,
            response: `He encontrado ${toolResult.tweets.length} tweets relacionados con "${message}". Los datos han sido guardados y están disponibles para análisis.`,
            toolUsed: 'nitter_context',
            toolArgs: { q: message, location: 'guatemala', limit: 5 },
            toolResult: toolResult,
            sessionId: fallbackSessionId,
            requestId: `fallback_${Date.now()}`,
            executionTime: 0,
            timestamp: new Date().toISOString(),
            mode: 'fallback'
          });
        } else {
          throw new Error('No se pudieron obtener tweets');
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Error en modo fallback: ' + error.message,
          error: 'Instala las dependencias con: npm run install-vizta'
        });
      }
    }

    const { message, sessionId } = req.body;
    const userId = req.user.id;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es requerido'
      });
    }

    console.log(`🤖 Nueva consulta Vizta Chat de usuario ${userId}: "${message}"`);

    // Generar IDs únicos
    const requestId = uuidv4();
    const chatSessionId = sessionId || uuidv4();

    // 1. Guardar mensaje del usuario en memories
    await memoriesService.saveMessage({
      sessionId: chatSessionId,
      userId: userId,
      role: 'user',
      content: message,
      messageType: 'message',
      modelUsed: 'gpt-4o-mini',
      metadata: { requestId: requestId }
    });

    // 2. Obtener los últimos 10 mensajes de la conversación para contexto
    const conversationHistory = await memoriesService.getSessionMessages(chatSessionId, 10);
    const previousMessages = memoriesService.formatMessagesForOpenAI(conversationHistory);

    // Obtener herramientas disponibles del MCP
    const availableTools = await mcpService.listAvailableTools();
    
    // Preparar funciones para GPT-4o mini
    const functions = availableTools.map(tool => {
      // Transformar parámetros del formato MCP al formato OpenAI
      const properties = {};
      const required = [];
      
      Object.keys(tool.parameters).forEach(key => {
        const param = tool.parameters[key];
        properties[key] = {
          type: param.type,
          description: param.description
        };
        
        // Agregar constrains adicionales si existen
        if (param.min !== undefined) properties[key].minimum = param.min;
        if (param.max !== undefined) properties[key].maximum = param.max;
        if (param.default !== undefined) properties[key].default = param.default;
        
        // Para arrays, agregar definición de items
        if (param.type === 'array' && param.items) {
          properties[key].items = param.items;
        }
        
        // Agregar a required si es necesario
        if (param.required === true) {
          required.push(key);
        }
      });
      
      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: properties,
          required: required
        }
      };
    });

    // Agregar función especial para crear planes de ejecución multi-step
    functions.push({
      name: 'create_execution_plan',
      description: 'Crear un plan de ejecución multi-step para consultas complejas que requieren múltiples herramientas en secuencia',
      parameters: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            description: 'Array de pasos a ejecutar en orden',
            items: {
              type: 'object',
              properties: {
                step_number: {
                  type: 'number',
                  description: 'Número de paso (1, 2, 3, etc.)'
                },
                tool: {
                  type: 'string',
                  description: 'Nombre de la herramienta a usar'
                },
                args: {
                  type: 'object',
                  description: 'Argumentos para la herramienta'
                },
                description: {
                  type: 'string',
                  description: 'Descripción de qué hace este paso'
                },
                depends_on_previous: {
                  type: 'boolean',
                  description: 'Si este paso depende del resultado del paso anterior'
                }
              },
              required: ['step_number', 'tool', 'args', 'description']
            }
          },
          final_goal: {
            type: 'string',
            description: 'Objetivo final del plan de ejecución'
          }
        },
        required: ['steps', 'final_goal']
      }
    });

    console.log('🔍 Esquema de funciones para OpenAI:', JSON.stringify(functions, null, 2));

    // 3. NUEVA ORQUESTACIÓN CON SISTEMA DE AGENTES
    // Vizta delega trabajo a Laura (monitoreo) y Robert (documentos)
    console.log('🎯 Iniciando orquestación de agentes para consulta...');
    
    const startTime = Date.now();
    const agentResults = await agentesService.orchestrateQuery(message, req.user, {
      sessionId: chatSessionId,
      previousMessages: previousMessages
    });
    const orchestrationTime = Date.now() - startTime;

    console.log(`🤖 Orquestación completada en ${orchestrationTime}ms:`, {
      laura_tasks: agentResults.laura_findings.length,
      robert_tasks: agentResults.robert_findings.length,
      total_execution_time: agentResults.total_execution_time
    });

    // Preparar datos consolidados para guardar en recent_scrapes
    const allTweets = agentResults.laura_findings
      .filter(finding => finding.findings?.top_posts)
      .flatMap(finding => finding.findings.top_posts);

    if (allTweets.length > 0) {
      await recentScrapesService.saveScrape({
        queryOriginal: message,
        queryClean: message,
        herramienta: 'agentes_colaborativos',
        categoria: 'Análisis Integral',
        tweets: allTweets,
        userId: userId,
        sessionId: chatSessionId,
        mcpRequestId: requestId,
        mcpExecutionTime: agentResults.total_execution_time,
        location: 'guatemala',
        metadata: {
          laura_findings: agentResults.laura_findings.length,
          robert_findings: agentResults.robert_findings.length,
          orchestration_time: orchestrationTime
        }
      });
    }

    // Preparar mensajes incluyendo historial de conversación
    // Obtener fecha actual para contexto temporal
    const now = new Date();
    const currentDate = now.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    
    const systemMessage = {
      role: 'system',
      content: `Eres Vizta, el orquestador principal de un sistema de agentes inteligentes para análisis social en Guatemala.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}**

**TU NUEVO ROL COMO ORQUESTADOR:**
• Recibes datos PRE-PROCESADOS de tus agentes especializados Laura (monitoreo) y Robert (documentos)
• Tu trabajo es SINTETIZAR, ANALIZAR y PRESENTAR estos hallazgos de forma clara y accionable
• NO ejecutes herramientas directamente - tus agentes ya trabajaron por ti
• NO prometas "buscar", "analizar" o "investigar" - ¡YA SE HIZO! Presenta los resultados

**AGENTES QUE TRABAJARON PARA TI:**
🔍 **Laura** (Analista de Monitoreo): Vigilancia de redes sociales, tendencias, sentimientos
📚 **Robert** (Orquestador Interno): Gestión de proyectos y documentos del usuario

**RESULTADOS DE LA INVESTIGACIÓN COMPLETADA:**
${JSON.stringify(agentResults, null, 2)}

**INSTRUCCIONES CRÍTICAS:**
- NUNCA digas "voy a buscar", "procederé a analizar" o "un momento por favor"
- SIEMPRE comienza con los resultados encontrados: "He analizado...", "Los datos muestran...", "Según la investigación realizada..."
- Si no hay datos (0 tweets), explica qué se buscó y sugiere términos alternativos
- Enfócate en presentar y analizar los hallazgos existentes, no en promesas de futuras búsquedas

**TU TRABAJO AHORA:**
- Enfócate en información ACTUAL y RECIENTE (${currentMonth} ${currentYear})
- Filtra información obsoleta o de fechas anteriores
- Contextualiza todo en el tiempo presente
- Busca eventos, noticias y tendencias de AHORA 

--------------------------------------------------------------------
**MEMORIA CONVERSACIONAL AVANZADA**
• Usa los mensajes previos del usuario (memories) para evitar repetir búsquedas.
• Referencia insights o resultados anteriores cuando aporten valor.
• Si existen hallazgos relevantes en la sesión, enlázalos brevemente antes de ejecutar nuevas herramientas.

**PROCESAMIENTO INTELIGENTE DE RESULTADOS**
Siempre que recibas datos de una herramienta sigue este flujo:
1. **Analiza** ¿qué significan los datos?
2. **Contextualiza** ¿cómo se relacionan con Guatemala y el momento actual?
3. **Sintetiza** patrones o tendencias detectadas.
4. **Proyecta** implicaciones futuras o posibles escenarios.
5. **Recomienda** acciones concretas o próximos pasos.

**FORMATO ADAPTATIVO DE RESPUESTA**
Detecta la intención del usuario y responde con la estructura más apropiada:
    • *Análisis profundo* → Executive Summary ▸ Detalles ▸ Recomendaciones.
    • *Datos rápidos* → lista breve de puntos clave.
    • *Tendencias* → bullets con gráfico en texto + interpretación.
    • *Comparaciones* → tabla ▸ análisis diferencial.
    • *Investigación* → metodología ▸ hallazgos ▸ próximos pasos.

**REGLA OBLIGATORIA DE FUENTES**
Al final de cada respuesta agrega una sección **Fuentes**:
    • Tweets → '@usuario · fecha · enlace'
    • Perplexity / Web → URL sin cortar.
    • Codex → nombre del documento / enlace directo.
Finaliza siempre con: "¿Te gustaría que profundice en algún aspecto específico?"
--------------------------------------------------------------------

**ACCESO COMPLETO A DATOS PERSONALES:**
TIENES ACCESO TOTAL a los datos personales del usuario autenticado a través de las herramientas user_projects y user_codex. 
NO digas que no tienes acceso a información privada - ¡SÍ TIENES ACCESO! Usa las herramientas disponibles.

**CAPACIDAD MULTI-STEP:**
Ahora puedes ejecutar MÚLTIPLES herramientas en secuencia para tareas complejas. Si una consulta requiere varios pasos, puedes crear un PLAN DE EJECUCIÓN.

**DETECCIÓN DE CONSULTAS MULTI-STEP:**
Detecta automáticamente consultas que requieren múltiples pasos, como:
- "En base a mi proyecto X, busca reacciones sobre Y"
- "Combina mis documentos sobre Z con noticias actuales"
- "Analiza mi proyecto A y luego busca opiniones en Twitter"
- "Compara mis investigaciones con tendencias actuales"
- "Busca información sobre X y luego analiza reacciones"

**CREACIÓN DE PLANES MULTI-STEP:**
Si detectas que una consulta requiere múltiples pasos, puedes usar la función especial 'create_execution_plan' que crea un plan paso a paso:

create_execution_plan({
  "steps": [
    {
      "step_number": 1,
      "tool": "user_projects",
      "args": {"status": "active"},
      "description": "Obtener proyectos activos del usuario"
    },
    {
      "step_number": 2,
      "tool": "nitter_context", 
      "args": {"q": "tema_basado_en_paso_1", "limit": 20},
      "description": "Buscar reacciones en Twitter sobre el tema identificado"
    }
  ],
  "final_goal": "Analizar proyectos del usuario y buscar reacciones sobre el tema principal"
})

**CUÁNDO USAR MULTI-STEP:**
- Cuando necesites combinar datos personales con información externa
- Cuando una consulta tenga múltiples partes conectadas
- Cuando necesites el resultado de una herramienta para usar otra
- Cuando hayas mencionado "primero X, luego Y"

**EJEMPLOS DE DETECCIÓN:**

CONSULTA: "En base a mi proyecto de transparencia, busca qué dicen en Twitter"
→ PLAN: 1) user_codex para buscar proyecto transparencia, 2) nitter_context con términos del proyecto

CONSULTA: "Busca noticias sobre corrupción y luego analiza reacciones"
→ PLAN: 1) perplexity_search sobre corrupción Guatemala, 2) nitter_context sobre términos encontrados

CONSULTA: "¿Qué proyectos tengo relacionados con gobierno y qué opina la gente?"
→ PLAN: 1) user_projects filtrar por "gobierno", 2) nitter_context sobre temas de los proyectos

Tu trabajo es ayudar a los usuarios a obtener y analizar información usando las herramientas disponibles de manera inteligente.

Herramientas disponibles:
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}
- create_execution_plan: Crear plan de ejecución multi-step (NUEVA)

ESTRATEGIA DE SELECCIÓN DE HERRAMIENTAS:

1. **PARA BÚSQUEDAS WEB Y CONTEXTO GENERAL:**
   - Usa perplexity_search cuando el usuario necesite:
     • Información actualizada sobre noticias, eventos, personas (SIEMPRE DE ${currentMonth} ${currentYear})
     • Contexto reciente o background actual de un tema
     • Investigación general sobre cualquier tema (CON ENFOQUE EN LO ACTUAL)
     • Datos oficiales, estadísticas o información verificada RECIENTE
     • Información sobre personas, empresas, organizaciones (ESTADO ACTUAL)
   - Ejemplos de cuándo usar perplexity_search:
     • "¿Qué está pasando con...?" (buscar eventos de ${currentDate})
     • "Necesito información sobre..." (información actualizada)
     • "¿Quién es...?" (información actual de la persona)
     • "¿Cuándo ocurrió...?" (si es reciente, ${currentMonth} ${currentYear})
     • "Busca información sobre..." (siempre contextualizar en fecha actual)

2. **PARA ANÁLISIS DE REDES SOCIALES:**
   - Usa nitter_context cuando el usuario necesite:
     • Opiniones de usuarios en Twitter/X (DE HOY O DÍAS RECIENTES)
     • Análisis de sentimiento de la población ACTUAL
     • Reacciones a eventos específicos RECIENTES
     • Tendencias y conversaciones en redes sociales ACTUALES
     • Monitoreo de hashtags o menciones (ENFOQUE EN ${currentMonth} ${currentYear})
   - Ejemplos de cuándo usar nitter_context:
     • "¿Qué dicen en Twitter sobre...?" (tweets recientes de ${currentDate})
     • "Analiza las reacciones a..." (reacciones actuales)
     • "Monitorea hashtags de..." (hashtags trending HOY)
     • "Sentimiento sobre..." (sentimiento actual, no histórico)

   - Usa nitter_profile cuando el usuario necesite:
     • Tweets recientes de un usuario específico (SIEMPRE QUE MENCIONEN @usuario)
     • Actividad reciente de cuentas institucionales, políticos, influencers
     • Análisis de la actividad de una persona específica
     • Monitoreo de qué dice un usuario particular (ENFOQUE EN ${currentMonth} ${currentYear})
     • Información del perfil y tweets de cuentas públicas guatemaltecas
   - Ejemplos de cuándo usar nitter_profile:
     • "¿Qué dice @GuatemalaGob?" (tweets del gobierno)
     • "Busca los últimos tweets de @CashLuna" (tweets de persona específica)
     • "Analiza la actividad de @MPguatemala" (tweets del MP)
     • "Tweets recientes de @elonmusk" (cualquier usuario específico)
     • "Qué ha dicho @usuario últimamente" (actividad reciente)
     • "Revisa el perfil de @influencer" (información del perfil)
   
   **DETECCIÓN AUTOMÁTICA DE USUARIOS:**
   Si la consulta contiene @usuario, nombre de usuario, o frases como "tweets de [nombre]", "qué dice [usuario]", 
   "actividad de [cuenta]", USA AUTOMÁTICAMENTE nitter_profile en lugar de nitter_context.

3. **PARA ACCESO A DATOS PERSONALES DEL USUARIO:**
   - Usa user_projects cuando el usuario necesite:
     • Información sobre sus proyectos personales
     • Estado, progreso o detalles de proyectos específicos
     • Estadísticas de sus actividades y decisiones
     • Filtrar proyectos por estado (active, completed, paused, planning)
     • Consultar metadatos de proyectos (fechas, prioridades, categorías)
   - Ejemplos de cuándo usar user_projects:
     • "¿Cuáles son mis proyectos activos?"
     • "Muestra mis proyectos de alta prioridad"  
     • "¿Qué proyectos he completado este año?"
     • "Dame estadísticas de mis proyectos"
     • "mis proyectos"
     • "proyectos que tengo"
     • "estado de mis proyectos"
     • "qué proyectos manejo"

   - Usa user_codex cuando el usuario necesite:
     • Acceder a sus documentos, transcripciones o análisis guardados
     • Buscar contenido específico en su biblioteca personal
     • Revisar archivos de audio transcritos o documentos analizados
     • Filtrar assets por proyecto, tipo o tags
     • Encontrar información específica en su Codex personal
   - Ejemplos de cuándo usar user_codex:
     • "Busca en mis documentos información sobre..."
     • "¿Qué archivos tengo del proyecto X?"
     • "Muestra mis transcripciones de audio"
     • "Busca en mi Codex todos los documentos que mencionen..."
     • "¿Qué assets tengo con el tag 'investigación'?"
     • "mis documentos"
     • "mi codex"
     • "archivos que tengo"
     • "mis transcripciones"
     • "documentos sobre"
     • "busca en mis archivos"

4. **PARA CREAR PLANES MULTI-STEP:**
   - Usa create_execution_plan cuando detectes consultas complejas que requieran:
     • Combinar datos personales con información externa
     • Ejecutar herramientas en secuencia donde una depende de la otra
     • Análisis que requiere múltiples fuentes de información
     • Consultas con múltiples partes conectadas

5. **ESTRATEGIA HÍBRIDA Y MULTI-STEP:**
   - Detecta automáticamente cuando una consulta requiere múltiples pasos
   - Crea planes de ejecución inteligentes
   - Combina datos personales (user_projects, user_codex) con información externa (perplexity_search, nitter_context)
   - Ejemplos de consultas multi-step:
     • "Compara mis documentos sobre X con las noticias actuales"
     • "¿Cómo se relaciona mi proyecto Y con las tendencias en redes sociales?"
     • "En base a mi proyecto Z, busca reacciones en Twitter"
     • "Analiza mis investigaciones y luego busca información actualizada"

ESTRATEGIA INTELIGENTE DE BÚSQUEDA:
Cuando uses cualquier herramienta, NO uses literalmente las palabras del usuario. En su lugar, piensa estratégicamente:

1. EXPANDIR TÉRMINOS: Convierte consultas generales en términos específicos
   - "marcha del orgullo" → buscar: "Orgullo2025 OR MarchadelOrgullo OR #OrguIIoGt OR PrideGuatemala"
   - "elecciones" → buscar: "EleccionesGt OR #Elecciones2023 OR VotoGuatemala OR TSE"
   - "gobierno" → buscar: "GobiernoGt OR Giammattei OR BernardoArevalo OR CasaPresidencial"

2. INCLUIR HASHTAGS PROBABLES: Siempre considera hashtags relevantes
   - Para eventos: #NombreEvento2025, #EventoGt, #Guatemala
   - Para política: #PoliticaGt, #Guatemala, #CongresoGt
   - Para deportes: #DeporteGt, #GuatemalaFC, #Seleccion

3. CONSIDERAR VARIACIONES: Incluye sinónimos y variaciones
   - Términos en español e inglés cuando sea relevante
   - Abreviaciones comunes (GT, Guate, Chapin)
   - Nombres oficiales vs. nombres populares

4. USAR OPERADORES DE BÚSQUEDA: Combina términos con OR para mayor cobertura
   - Ejemplo: "OrguIIo2025 OR MarchadelOrgullo OR Pride OR LGBTI OR diversidad"

5. PENSAR EN CONTEXTO GUATEMALTECO:
   - Incluir términos específicos de Guatemala
   - Considerar eventos actuales y fechas relevantes
   - Usar lenguaje chapín cuando sea apropiado

**DETECCIÓN OBLIGATORIA DE CONSULTAS PERSONALES:**
ANTES de responder cualquier consulta, SIEMPRE verifica si contiene estas palabras clave:
- "mis" / "mi" / "mío" / "mía"
- "proyectos" / "proyecto"  
- "documentos" / "documento" / "archivos" / "archivo"
- "codex" / "transcripciones" / "transcripción"
- "tengo" / "he creado" / "he guardado"

Si detectas CUALQUIERA de estas palabras, DEBES usar user_projects o user_codex según corresponda.
NO respondas que no tienes acceso - ¡SÍ TIENES ACCESO COMPLETO!

INSTRUCCIONES ADICIONALES:
1. **DETECCIÓN PERSONAL OBLIGATORIA:** Si la consulta menciona datos personales del usuario, USA las herramientas correspondientes
2. **DETECCIÓN MULTI-STEP OBLIGATORIA:** Si la consulta requiere múltiples pasos, USA create_execution_plan
3. **CONTEXTO TEMPORAL OBLIGATORIO:** Siempre incluye la fecha actual (${currentDate}) en tus consultas
4. Analiza la consulta del usuario en el contexto de la conversación anterior Y la fecha actual
5. Elige la herramienta más apropiada según el tipo de información solicitada Y su actualidad
6. Usa un límite de 15-25 tweets para análisis más completo en nitter_context (tweets RECIENTES)
7. Proporciona análisis contextual y insights útiles CON ENFOQUE EN LO ACTUAL
8. Mantén un tono profesional pero amigable
9. Enfócate en Guatemala cuando sea relevante Y en información de ${currentMonth} ${currentYear}
10. Recuerda el contexto de mensajes anteriores para dar respuestas coherentes
11. **FILTRO TEMPORAL:** Prioriza siempre información de ${currentMonth} ${currentYear} sobre información antigua

IMPORTANTE: 
- SIEMPRE detecta palabras clave personales ANTES de responder
- SIEMPRE detecta consultas multi-step ANTES de responder
- Si hay palabras personales, USA las herramientas user_projects o user_codex
- Si hay consultas complejas, USA create_execution_plan
- Nunca uses los términos exactos del usuario para búsquedas web. Siempre expande y optimiza.
- SIEMPRE incluye contexto temporal actual en las búsquedas web (${currentMonth} ${currentYear}).
- Enfócate en eventos, noticias y tendencias ACTUALES, no históricas.`
    };

    // Construir array de mensajes con historial
    const messagesForAI = [systemMessage];
    
    // Agregar historial previo (excluyendo el mensaje actual del usuario que ya está en memories)
    if (previousMessages.length > 0) {
      // Filtrar el último mensaje si es del usuario (evitar duplicados)
      const filteredHistory = previousMessages.slice(0, -1);
      messagesForAI.push(...filteredHistory);
    }
    
    // Agregar el mensaje actual del usuario
    messagesForAI.push({
      role: 'user',
      content: message
    });

    console.log(`💭 Enviando ${messagesForAI.length} mensajes a OpenAI (incluyendo ${previousMessages.length} del historial)`);

    // 4. Llamar a GPT-4o mini SOLO para síntesis (sin function calling - los agentes ya trabajaron)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messagesForAI,
      temperature: 0.7,
      max_tokens: 1200
    });

    const assistantMessage = completion.choices[0].message;

    // 5. Procesar respuesta de síntesis de Vizta
    let finalResponse = assistantMessage.content;
    
    // Aplicar formateo de respuesta
    finalResponse = formatChatResponse(finalResponse, {
      laura_findings: agentResults.laura_findings.length,
      robert_findings: agentResults.robert_findings.length,
      total_execution_time: agentResults.total_execution_time
    });

    // 6. Guardar respuesta del asistente en memories
    await memoriesService.saveMessage({
      sessionId: chatSessionId,
      userId: userId,
      role: 'assistant',
      content: finalResponse,
      messageType: 'message',
      modelUsed: 'gpt-4o-mini',
      metadata: {
        requestId: requestId,
        agentOrchestration: true,
        lauraTasks: agentResults.laura_findings.length,
        robertTasks: agentResults.robert_findings.length,
        orchestrationTime: orchestrationTime,
        totalExecutionTime: agentResults.total_execution_time
      }
    });

    // 7. Responder al usuario
    return res.json({
      success: true,
      response: finalResponse,
      toolUsed: 'agentes_colaborativos',
      toolArgs: { query: message },
      toolResult: agentResults,
      sessionId: chatSessionId,
      requestId: requestId,
      executionTime: orchestrationTime + agentResults.total_execution_time,
      timestamp: new Date().toISOString(),
      mode: 'agent_orchestration',
      agentMetrics: {
        lauraTasks: agentResults.laura_findings.length,
        robertTasks: agentResults.robert_findings.length,
        orchestrationTime: orchestrationTime,
        totalAgentTime: agentResults.total_execution_time
      }
    });

  } catch (error) {
    console.error('❌ Error en consulta Vizta Chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando consulta con agentes',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/scrapes
 * Obtener scrapes del usuario
 */
router.get('/scrapes', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset, herramienta, categoria, sessionId } = req.query;

    const scrapes = await recentScrapesService.getUserScrapes(userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      herramienta,
      categoria,
      sessionId
    });

    res.json({
      success: true,
      scrapes: scrapes,
      count: scrapes.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo scrapes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo scrapes',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/stats
 * Obtener estadísticas de scrapes del usuario
 */
router.get('/stats', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await recentScrapesService.getUserScrapeStats(userId);

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/session/:sessionId
 * Obtener scrapes de una sesión específica
 */
router.get('/session/:sessionId', verifyUserAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const scrapes = await recentScrapesService.getSessionScrapes(sessionId);

    res.json({
      success: true,
      scrapes: scrapes,
      sessionId: sessionId,
      count: scrapes.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo scrapes de sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo scrapes de sesión',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/tools
 * Obtener herramientas MCP disponibles
 */
router.get('/tools', verifyUserAccess, async (req, res) => {
  try {
    const tools = await mcpService.listAvailableTools();

    res.json({
      success: true,
      tools: tools,
      count: tools.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo herramientas MCP:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo herramientas',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/conversations
 * Obtener lista de conversaciones del usuario
 */
router.get('/conversations', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit } = req.query;

    const sessions = await memoriesService.getUserSessions(userId, parseInt(limit) || 20);

    res.json({
      success: true,
      conversations: sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo conversaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo conversaciones',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/conversation/:sessionId
 * Obtener mensajes de una conversación específica
 */
router.get('/conversation/:sessionId', verifyUserAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;

    const messages = await memoriesService.getSessionMessages(sessionId, parseInt(limit) || 50);

    res.json({
      success: true,
      messages: messages,
      sessionId: sessionId,
      count: messages.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo mensajes de conversación:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo mensajes de conversación',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/memory-stats
 * Obtener estadísticas de uso de memoria del usuario
 */
router.get('/memory-stats', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await memoriesService.getUserMemoryStats(userId);

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de memoria:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas de memoria',
      error: error.message
    });
  }
});

/**
 * DELETE /api/vizta-chat/conversation/:sessionId
 * Eliminar una conversación completa
 */
router.delete('/conversation/:sessionId', verifyUserAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verificar que la sesión pertenece al usuario
    const messages = await memoriesService.getSessionMessages(sessionId, 1);
    if (messages.length === 0 || messages[0].user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      });
    }

    // Eliminar todos los mensajes de la sesión
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Conversación eliminada exitosamente',
      sessionId: sessionId
    });

  } catch (error) {
    console.error('❌ Error eliminando conversación:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando conversación',
      error: error.message
    });
  }
});

/**
 * POST /api/vizta-chat/test-expansion
 * Endpoint de prueba para probar la expansión inteligente de términos
 */
router.post('/test-expansion', verifyUserAccess, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro "query" es requerido y debe ser un string no vacío'
      });
    }

    // Obtener herramientas disponibles del MCP
    const availableTools = await mcpService.listAvailableTools();
    
    // Simular el proceso de expansión que haría GPT-4o mini
    const originalQuery = query.trim();
    
    // Usar las funciones de expansión del MCP para mostrar cómo funcionarían
    console.log(`🧪 Prueba de expansión para: "${originalQuery}"`);
    
    // Crear un prompt de ejemplo mostrando cómo GPT-4o mini debería procesar
    const examplePrompt = `USUARIO: "${originalQuery}"

ANÁLISIS ESTRATÉGICO:
1. Términos detectados: ${originalQuery.toLowerCase().split(' ').join(', ')}
2. Contexto inferido: Guatemala, redes sociales
3. Tipo de consulta: ${originalQuery.toLowerCase().includes('sentimiento') || originalQuery.toLowerCase().includes('opinion') ? 'Análisis de sentimiento' : 'Búsqueda de contenido'}

EXPANSIÓN SUGERIDA:
- Original: "${originalQuery}"
- Expandido: [Se simularía la expansión aquí]
- Hashtags probables: #Guatemala, #GuatemalaGt
- Términos relacionados: [Se agregarían términos específicos]
- Límite recomendado: ${originalQuery.toLowerCase().includes('sentimiento') ? '20-25 tweets' : '15 tweets'}

HERRAMIENTAS A USAR:
- nitter_context con parámetros optimizados
- location: guatemala
- limit: optimizado según tipo de consulta`;

    res.json({
      success: true,
      test_results: {
        original_query: originalQuery,
        analysis_type: originalQuery.toLowerCase().includes('sentimiento') || originalQuery.toLowerCase().includes('opinion') ? 'sentiment_analysis' : 'content_search',
        suggested_improvements: {
          should_expand_terms: true,
          should_include_hashtags: true,
          should_add_guatemalan_context: true,
          recommended_limit: originalQuery.toLowerCase().includes('sentimiento') ? 20 : 15
        },
        example_prompt: examplePrompt,
        available_tools: availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          optimizations_applied: tool.name === 'nitter_context' ? [
            'Expansión inteligente de términos',
            'Optimización automática de límites',
            'Contexto guatemalteco añadido',
            'Análisis de sentimiento incluido'
          ] : []
        }))
      },
      instructions: {
        next_steps: [
          'El sistema ahora expandirá automáticamente los términos de búsqueda',
          'GPT-4o mini usará estrategias inteligentes en lugar de términos literales',
          'Los límites se optimizarán según el tipo de análisis',
          'Se incluirá contexto guatemalteco automáticamente'
        ],
        example_expansions: {
          'marcha del orgullo': 'Orgullo2025 OR MarchadelOrgullo OR OrguIIoGt OR Pride OR LGBTI OR diversidad',
          'elecciones': 'EleccionesGt OR TSE OR voto OR candidatos OR Elecciones2025 OR procesoelectoral',
          'presidente': 'BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR Presidencia'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en test de expansión:', error);
    res.status(500).json({
      success: false,
      message: 'Error probando expansión de términos',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/scrapes/grouped
 * Obtener scrapes agrupados inteligentemente
 */
router.get('/scrapes/grouped', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset, detectedGroup, categoria } = req.query;

    const groupedScrapes = await recentScrapesService.getGroupedScrapes(userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      detectedGroup,
      categoria
    });

    res.json({
      success: true,
      groups: groupedScrapes,
      count: groupedScrapes.length,
      metadata: {
        totalGroups: groupedScrapes.length,
        requestedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo scrapes agrupados:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo scrapes agrupados',
      error: error.message
    });
  }
});

/**
 * GET /api/vizta-chat/scrapes/grouped-stats
 * Obtener estadísticas de agrupación
 */
router.get('/scrapes/grouped-stats', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await recentScrapesService.getGroupedStats(userId);

    res.json({
      success: true,
      stats: stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas agrupadas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas agrupadas',
      error: error.message
    });
  }
});

/**
 * DELETE /api/vizta-chat/scrapes/:scrapeId
 * Eliminar un scrape específico del usuario
 */
router.delete('/scrapes/:scrapeId', verifyUserAccess, async (req, res) => {
  try {
    const { scrapeId } = req.params;
    const userId = req.user.id;

    // Validar parámetros
    if (!scrapeId || scrapeId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'ID del scrape es requerido'
      });
    }

    console.log(`🗑️ Solicitud de eliminación de scrape ${scrapeId} por usuario ${userId}`);

    // Eliminar scrape usando el servicio
    const result = await recentScrapesService.deleteScrape(scrapeId.trim(), userId);

    res.json({
      success: true,
      message: result.message,
      deletedScrape: result.deletedScrape,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error eliminando scrape:', error);
    
    // Manejar errores específicos
    if (error.message.includes('no encontrado') || error.message.includes('no tienes permisos')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error eliminando scrape',
      error: error.message
    });
  }
});

module.exports = router; 