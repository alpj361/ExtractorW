const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { verifyUserAccess } = require('../middlewares/auth');
const { logUsage } = require('../services/logs');
const supabase = require('../utils/supabase');

// Costo fijo para generación de sugerencias de proyecto
const SUGGESTIONS_COST = 5;

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/project-suggestions
 * Genera sugerencias inteligentes para un proyecto usando Gemini 1.5 Flash
 */
router.post('/', verifyUserAccess, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { project } = req.body;
    const user = req.user;
    
    if (!project) {
      return res.status(400).json({ error: 'Datos del proyecto requeridos' });
    }

    // Validar que tenemos la API key de Gemini
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    console.log(`💡 Usuario ${user.profile.email} solicitando sugerencias para proyecto: "${project.title}"`);

    // 1. VERIFICAR CRÉDITOS (excepto para admins)
    if (user.profile.role !== 'admin') {
      if (!user.profile.credits || user.profile.credits < SUGGESTIONS_COST) {
        console.log(`❌ Usuario ${user.profile.email} sin créditos suficientes: ${user.profile.credits || 0} < ${SUGGESTIONS_COST}`);
        return res.status(402).json({
          error: 'Créditos insuficientes',
          message: `Se requieren ${SUGGESTIONS_COST} créditos para generar sugerencias. Créditos actuales: ${user.profile.credits || 0}`,
          required_credits: SUGGESTIONS_COST,
          current_credits: user.profile.credits || 0
        });
      }
      console.log(`✅ Usuario ${user.profile.email} tiene créditos suficientes: ${user.profile.credits} >= ${SUGGESTIONS_COST}`);
    } else {
      console.log(`👑 Usuario admin ${user.profile.email} - acceso ilimitado`);
    }

    // Preparar contexto detallado de decisiones
    const decisionsContext = project.decisions && project.decisions.length > 0 ? 
      project.decisions.map(d => `
      - ${d.title} (Tipo: ${d.decision_type}, Secuencia: ${d.sequence_number})
        Descripción: ${d.description || 'Sin descripción'}
        Fecha: ${d.created_at ? new Date(d.created_at).toLocaleDateString('es-GT') : 'No especificada'}
      `).join('\n') : 'No se han tomado decisiones aún';

    // Generar análisis del progreso del proyecto
    const projectProgress = (() => {
      const decisionTypes = project.decisions ? project.decisions.map(d => d.decision_type) : [];
      const hasEnfoque = decisionTypes.includes('enfoque');
      const hasAlcance = decisionTypes.includes('alcance');
      const hasConfiguracion = decisionTypes.includes('configuracion');
      
      if (!hasEnfoque && !hasAlcance && !hasConfiguracion) return "inicio - sin decisiones estructurales";
      if (hasEnfoque && !hasAlcance && !hasConfiguracion) return "definición de enfoque completada";
      if (hasEnfoque && hasAlcance && !hasConfiguracion) return "enfoque y alcance definidos";
      if (hasEnfoque && hasAlcance && hasConfiguracion) return "estructura completa definida";
      return "progreso parcial";
    })();

    // Preparar el prompt especializado para auditoría
    const prompt = `
Eres un experto consultor en auditoría municipal de Guatemala con 15+ años de experiencia. 
Analiza este proyecto específico de auditoría y proporciona sugerencias muy específicas basadas en el contexto actual.

=== PROYECTO DE AUDITORÍA ===
Título: "${project.title}"
Descripción: ${project.description || 'No especificada'}
Estado actual: ${project.status} (Prioridad: ${project.priority})
Categoría de auditoría: ${project.category || 'General'}
Período: ${project.start_date || 'No definido'} → ${project.target_date || 'No definido'}
Etiquetas/Áreas: ${project.tags ? project.tags.join(', ') : 'No especificadas'}

=== PROGRESO ACTUAL ===
Fase del proyecto: ${projectProgress}
Decisiones tomadas hasta ahora:
${decisionsContext}

=== CONTEXTO DE TRABAJO ===
El auditor está trabajando en una plataforma que incluye:
- **Sondeos**: Para análizar temas específicos con múltiples fuentes de información
- **Tendencias**: Para monitorear menciones en redes sociales y medios
- **Noticias**: Para revisar cobertura mediática relevante
- **Codex**: Para gestionar documentos, evidencias y referencias
- **Decisiones por Capas**: Para estructurar el proceso (enfoque → alcance → configuración)

=== INSTITUCIONES Y MARCO LEGAL GUATEMALA ===
- Contraloría General de Cuentas (CGC) - ente rector de auditoría
- Ministerio Público (MP) - para casos penales
- SAT - para aspectos tributarios
- INFODIGTO - para transparencia y acceso a información
- Ley de Acceso a la Información Pública
- Ley de Probidad y Responsabilidades

=== INSTRUCCIONES ESPECÍFICAS ===
Basándote en el proyecto específico descrito, sus decisiones actuales y su fase de progreso:

1. Identifica las lagunas o próximos pasos lógicos específicos para ESTE proyecto
2. Considera qué decisiones faltan por tomar según la metodología de capas
3. Sugiere acciones concretas que aprovechen las herramientas disponibles
4. Incluye referencias específicas a instituciones guatemaltecas cuando sea relevante
5. Proporciona 3-5 sugerencias priorizadas y específicas para el contexto actual

IMPORTANTE: Las sugerencias deben ser específicas para este proyecto, no genéricas. Usa los datos del proyecto para contextualizar cada recomendación.

Responde en formato JSON válido:
{
  "analysis": "Análisis específico del estado actual de ESTE proyecto considerando las decisiones ya tomadas y lo que falta por hacer",
  "suggestions": [
    {
      "id": "suggestion_1",
      "title": "Título específico relacionado con el proyecto actual",
      "description": "Descripción que mencione aspectos específicos del proyecto y su contexto actual",
      "category": "analysis|research|platform|external|documentation",
      "priority": "high|medium|low",
      "action": "Acción muy específica que considere el estado actual del proyecto",
      "estimatedTime": "Tiempo realista para esta actividad específica",
      "tools": ["herramientas específicas a usar para este proyecto"]
    }
  ]
}
`;

    // Llamar a Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parsear la respuesta JSON
    let suggestionsData;
    try {
      // Limpiar la respuesta para extraer solo el JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestionsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON válido en la respuesta');
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.error('Raw response:', text);
      
      // Fallback con sugerencias específicas al proyecto
      const projectKeywords = project.tags ? project.tags.join(', ') : project.title;
      const nextDecisionType = (() => {
        const decisionTypes = project.decisions ? project.decisions.map(d => d.decision_type) : [];
        if (!decisionTypes.includes('enfoque')) return 'enfoque';
        if (!decisionTypes.includes('alcance')) return 'alcance';
        if (!decisionTypes.includes('configuracion')) return 'configuración';
        return 'implementación';
      })();

      suggestionsData = {
        analysis: `El proyecto "${project.title}" está en estado ${project.status} con prioridad ${project.priority}. Se han tomado ${project.decisions?.length || 0} decisiones. El siguiente paso recomendado es definir ${nextDecisionType}.`,
        suggestions: [
          {
            id: "suggestion_1",
            title: `Crear sondeo sobre "${projectKeywords}"`,
            description: `Utiliza la herramienta de sondeos para analizar específicamente el tema de ${project.title}, obteniendo contexto actual y tendencias relacionadas con ${projectKeywords}.`,
            category: "platform",
            priority: project.priority === 'high' ? "high" : "medium",
            action: `Crear un sondeo con las palabras clave: ${projectKeywords}`,
            estimatedTime: "30 minutos",
            tools: ["Sondeos", "Tendencias"]
          },
          {
            id: "suggestion_2", 
            title: `Definir decisión de ${nextDecisionType} para el proyecto`,
            description: `El proyecto necesita una decisión de tipo "${nextDecisionType}" para continuar con la metodología de auditoría por capas.`,
            category: "platform",
            priority: "high",
            action: `Usar el sistema de Decisiones por Capas para crear una decisión de ${nextDecisionType}`,
            estimatedTime: "20 minutos",
            tools: ["Decisiones por Capas"]
          },
          {
            id: "suggestion_3",
            title: `Revisar cobertura mediática de "${project.category || 'auditoría municipal'}"`,
            description: `Buscar noticias y menciones relacionadas con ${project.title} para identificar contexto público y posibles riesgos reputacionales.`,
            category: "research",
            priority: "medium",
            action: `Buscar en noticias con términos: ${projectKeywords}`,
            estimatedTime: "45 minutos",
            tools: ["Noticias", "Tendencias"]
          },
          {
            id: "suggestion_4",
            title: "Preparar documentación de evidencias",
            description: `Crear estructura de carpetas en Codex específica para ${project.title} y sus hallazgos de auditoría.`,
            category: "documentation", 
            priority: "medium",
            action: `Organizar Codex con categorías específicas para este proyecto de ${project.category || 'auditoría'}`,
            estimatedTime: "30 minutos",
            tools: ["Codex"]
          }
        ]
      };
    }

    // Agregar timestamp
    suggestionsData.generatedAt = new Date().toISOString();

    // 2. DEBITAR CRÉDITOS Y REGISTRAR LOGS (solo si no es admin)
    const responseTime = Date.now() - startTime;
    
    if (user.profile.role !== 'admin') {
      try {
        console.log(`💳 Debitando ${SUGGESTIONS_COST} créditos a ${user.profile.email}`);
        
        // Debitar créditos
        const { data: updatedProfile, error: debitError } = await supabase
          .from('profiles')
          .update({ 
            credits: user.profile.credits - SUGGESTIONS_COST,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select('credits')
          .single();

        if (debitError) {
          console.error('❌ Error debitando créditos:', debitError);
          throw new Error('Error procesando créditos');
        }

        console.log(`✅ Créditos actualizados: ${user.profile.credits} → ${updatedProfile.credits}`);
        
        // Registrar en logs
        await logUsage(
          user,
          '/api/project-suggestions',
          SUGGESTIONS_COST,
          req,
          {
            project_title: project.title,
            project_id: project.id || 'unknown',
            decisions_count: project.decisions?.length || 0,
            suggestions_count: suggestionsData.suggestions?.length || 0,
            response_time: responseTime,
            success: true
          }
        );

        console.log(`📝 Log registrado para generación de sugerencias de ${user.profile.email}`);
        
      } catch (creditError) {
        console.error('❌ Error en sistema de créditos:', creditError);
        // No fallar la respuesta, pero registrar el error
        await logUsage(
          user,
          '/api/project-suggestions',
          0, // No se cobraron créditos por el error
          req,
          {
            project_title: project.title,
            error: creditError.message,
            response_time: responseTime,
            success: false
          }
        );
        
        return res.status(500).json({
          error: 'Error procesando créditos',
          message: 'Las sugerencias se generaron pero hubo un problema con el sistema de créditos'
        });
      }
    } else {
      // Para admins, solo registrar el log sin cobrar créditos
      await logUsage(
        user,
        '/api/project-suggestions',
        0, // Admin no paga créditos
        req,
        {
          project_title: project.title,
          project_id: project.id || 'unknown',
          decisions_count: project.decisions?.length || 0,
          suggestions_count: suggestionsData.suggestions?.length || 0,
          response_time: responseTime,
          admin_access: true,
          success: true
        }
      );
      
      console.log(`📝 Log registrado para admin ${user.profile.email} (sin costo)`);
    }

    res.json(suggestionsData);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Error generating project suggestions:', error);
    
    // Registrar error en logs si tenemos usuario
    if (req.user) {
      try {
        await logUsage(
          req.user,
          '/api/project-suggestions',
          0, // No se cobraron créditos por el error
          req,
          {
            error: error.message,
            response_time: responseTime,
            success: false
          }
        );
      } catch (logError) {
        console.error('❌ Error registrando log de error:', logError);
      }
    }
    
    res.status(500).json({ 
      error: 'Error generando sugerencias del proyecto',
      details: error.message 
    });
  }
});

/**
 * GET /api/project-suggestions/cost
 * Obtiene el costo para generar sugerencias de proyecto
 */
router.get('/cost', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    const costInfo = {
      operation: 'project-suggestions',
      cost_credits: SUGGESTIONS_COST,
      cost_description: 'Generación de sugerencias inteligentes para proyecto usando Gemini AI',
      user_credits: user.profile.role === 'admin' ? 'ilimitado' : (user.profile.credits || 0),
      can_afford: user.profile.role === 'admin' || (user.profile.credits >= SUGGESTIONS_COST),
      admin_access: user.profile.role === 'admin'
    };
    
    console.log(`💰 Usuario ${user.profile.email} consultando costo de sugerencias: ${SUGGESTIONS_COST} créditos`);
    
    res.json(costInfo);
    
  } catch (error) {
    console.error('❌ Error obteniendo costo de sugerencias:', error);
    res.status(500).json({
      error: 'Error obteniendo información de costo',
      details: error.message
    });
  }
});

/**
 * GET /api/project-suggestions/stats
 * Obtiene estadísticas de uso de sugerencias del usuario
 */
router.get('/stats', verifyUserAccess, async (req, res) => {
  try {
    const user = req.user;
    
    if (!supabase) {
      return res.status(503).json({
        error: 'Base de datos no disponible',
        message: 'Supabase no está configurado'
      });
    }
    
    // Obtener estadísticas de uso de sugerencias
    const { data: usageLogs, error } = await supabase
      .from('usage_logs')
      .select('credits_consumed, timestamp, request_params')
      .eq('user_email', user.profile.email)
      .eq('operation', '/api/project-suggestions')
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return res.status(500).json({
        error: 'Error obteniendo estadísticas',
        message: error.message
      });
    }
    
    const stats = {
      total_suggestions_generated: usageLogs.length,
      total_credits_spent: usageLogs.reduce((sum, log) => sum + (log.credits_consumed || 0), 0),
      last_generation: usageLogs.length > 0 ? usageLogs[0].timestamp : null,
      recent_generations: usageLogs.slice(0, 10).map(log => ({
        timestamp: log.timestamp,
        credits_consumed: log.credits_consumed,
        project_title: log.request_params?.project_title || 'Proyecto sin título'
      }))
    };
    
    console.log(`📊 Estadísticas de sugerencias para ${user.profile.email}: ${stats.total_suggestions_generated} generaciones`);
    
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de sugerencias:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

module.exports = router; 