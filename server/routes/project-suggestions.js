const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { verifyUserAccess } = require('../middlewares/auth');

// Middleware simplificado para pruebas de sugerencias
const simpleAuth = (req, res, next) => {
  // Para pruebas, permitir acceso básico
  if (!req.user) {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      profile: { role: 'user', credits: 100 }
    };
  }
  next();
};

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/project-suggestions
 * Genera sugerencias inteligentes para un proyecto usando Gemini 1.5 Flash
 */
router.post('/', simpleAuth, async (req, res) => {
  try {
    const { project } = req.body;
    
    if (!project) {
      return res.status(400).json({ error: 'Datos del proyecto requeridos' });
    }

    // Validar que tenemos la API key de Gemini
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
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

    res.json(suggestionsData);

  } catch (error) {
    console.error('Error generating project suggestions:', error);
    res.status(500).json({ 
      error: 'Error generando sugerencias del proyecto',
      details: error.message 
    });
  }
});

module.exports = router; 