/**
 * Helpers de NLP para clasificación de intenciones
 * Determina si la consulta es casual, funcional o requiere agentes especializados
 */

function detectCasualConversation(text) {
  const casualPatterns = [
    /hola/i, /hi/i, /hello/i, /buenos días/i, /buenas tardes/i, /buenas noches/i,
    /cómo estás/i, /como estas/i, /qué tal/i, /que tal/i, /saludos/i,
    /gracias/i, /thank you/i, /de nada/i, /perfecto/i, /genial/i,
    /adiós/i, /adios/i, /bye/i, /hasta luego/i, /nos vemos/i
  ];
  
  return casualPatterns.some(pattern => pattern.test(text));
}

function detectBotCapabilities(text) {
  const capabilityPatterns = [
    /qué puedes hacer/i, /que puedes hacer/i, /quién eres/i, /quien eres/i,
    /para qué sirves/i, /para que sirves/i, /qué haces/i, /que haces/i,
    /ayuda/i, /help/i, /comandos/i, /funciones/i, /capacidades/i,
    /cómo funciona/i, /como funciona/i, /explícame/i, /explicame/i
  ];
  
  return capabilityPatterns.some(pattern => pattern.test(text));
}

function detectStructuredIntent(text) {
  // Intenciones para Laura (análisis social y búsquedas)
  if (/buscar en twitter|buscar tweets|nitter|trending|tendencia|viral|hashtag/i.test(text)) {
    return "nitter_search";
  }
  
  if (/analiza.*twitter|analiza.*tweets|sentimiento.*twitter|qué dicen en twitter/i.test(text)) {
    return "twitter_analysis";
  }
  
  if (/busca a.*en twitter|perfil de.*twitter|tweets de.*usuario/i.test(text)) {
    return "twitter_profile";
  }
  
  if (/información sobre|investiga sobre|busca información|búsqueda web/i.test(text)) {
    return "web_search";
  }
  
  // Intenciones para Robert (datos personales)
  if (/mi codex|mis documentos|codex|archivos|documentos personales/i.test(text)) {
    return "search_codex";
  }
  
  if (/mis proyectos|proyectos activos|estado de proyectos|proyecto/i.test(text)) {
    return "search_projects";
  }
  
  if (/analiza este documento|resumen del documento|procesa documento/i.test(text)) {
    return "analyze_document";
  }
  
  // Intenciones mixtas (Laura + Robert)
  if (/compara.*mis.*con|relaciona.*proyecto.*twitter|analiza en base a mi/i.test(text)) {
    return "mixed_analysis";
  }
  
  return null;
}

function detectUrgency(text) {
  const urgentPatterns = [
    /urgente/i, /rápido/i, /inmediato/i, /ahora mismo/i, /ya/i, /pronto/i
  ];
  
  return urgentPatterns.some(pattern => pattern.test(text));
}

function detectLocation(text) {
  const locationPatterns = [
    /guatemala/i, /guate/i, /chapín/i, /guatemalteco/i, /gt/i,
    /ciudad de guatemala/i, /antigua/i, /quetzaltenango/i
  ];
  
  return locationPatterns.some(pattern => pattern.test(text));
}

function classifyIntent(text) {
  const intent = {
    isCasual: detectCasualConversation(text),
    isCapabilityQuery: detectBotCapabilities(text),
    structuredIntent: detectStructuredIntent(text),
    isUrgent: detectUrgency(text),
    hasLocation: detectLocation(text),
    confidence: 0.0
  };
  
  // Calcular confianza
  if (intent.isCasual) intent.confidence = 0.9;
  else if (intent.isCapabilityQuery) intent.confidence = 0.85;
  else if (intent.structuredIntent) intent.confidence = 0.8;
  else intent.confidence = 0.3;
  
  return intent;
}

module.exports = {
  detectCasualConversation,
  detectBotCapabilities,
  detectStructuredIntent,
  detectUrgency,
  detectLocation,
  classifyIntent
}; 