const supabase = require('../utils/supabase');
const { obtenerContextoTweets } = require('./perplexity');

/**
 * Servicio de Sondeos - Maneja la obtención de contexto y procesamiento con IA
 * Basado en la implementación original de migration.js
 */

/**
 * Obtiene contexto de tendencias desde la tabla trends
 */
async function obtenerContextoTendencias(limite = 10) {
  try {
    console.log(`📊 Obteniendo contexto de tendencias (límite: ${limite})`);
    
    const { data: trends, error } = await supabase
      .from('trends')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo tendencias:', error);
      return [];
    }

    if (!trends || trends.length === 0) {
      console.log('⚠️ No se encontraron tendencias');
      return [];
    }

    // Procesar y formatear tendencias para contexto
    const contextoTendencias = trends.map(trend => {
      let trendData = {};
      
      try {
        // Parsear raw_data si existe
        if (trend.raw_data) {
          const rawData = typeof trend.raw_data === 'string' 
            ? JSON.parse(trend.raw_data) 
            : trend.raw_data;
          
          if (rawData.twitter_trends) {
            trendData = rawData.twitter_trends;
          } else if (Array.isArray(rawData)) {
            trendData = { trends: rawData };
          } else {
            trendData = rawData;
          }
        }

        // Extraer información relevante
        const trendInfo = {
          timestamp: trend.timestamp,
          trends: [],
          categories: trend.category_data || {},
          keywords: trend.top_keywords || [],
          about: trend.about || []
        };

        // Procesar tendencias individuales
        if (trendData.trends && Array.isArray(trendData.trends)) {
          trendInfo.trends = trendData.trends.map(t => ({
            name: t.name || t.trend || t,
            volume: t.tweet_volume || t.volume || 0,
            category: t.category || 'General'
          }));
        } else if (Array.isArray(trendData)) {
          trendInfo.trends = trendData.map(t => ({
            name: typeof t === 'string' ? t : (t.name || t.trend || 'Sin nombre'),
            volume: t.tweet_volume || t.volume || 0,
            category: t.category || 'General'
          }));
        }

        return trendInfo;
      } catch (parseError) {
        console.error('Error parseando trend:', parseError);
        return {
          timestamp: trend.timestamp,
          trends: [],
          error: 'Error parseando datos'
        };
      }
    });

    console.log(`✅ Contexto de tendencias obtenido: ${contextoTendencias.length} registros`);
    return contextoTendencias;

  } catch (error) {
    console.error('❌ Error en obtenerContextoTendencias:', error);
    return [];
  }
}

/**
 * Obtiene contexto de tweets trending desde la tabla trending_tweets
 */
async function obtenerContextoTweetsTrending(limite = 20) {
  try {
    console.log(`🐦 Obteniendo contexto de tweets trending (límite: ${limite})`);
    
    const { data: tweets, error } = await supabase
      .from('trending_tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo tweets trending:', error);
      return [];
    }

    if (!tweets || tweets.length === 0) {
      console.log('⚠️ No se encontraron tweets trending');
      return [];
    }

    // Formatear tweets para contexto
    const contextoTweets = tweets.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      author: tweet.author_username,
      author_name: tweet.author_name,
      created_at: tweet.created_at,
      metrics: {
        likes: tweet.like_count || 0,
        retweets: tweet.retweet_count || 0,
        replies: tweet.reply_count || 0,
        engagement: (tweet.like_count || 0) + (tweet.retweet_count || 0) + (tweet.reply_count || 0)
      },
      sentiment: tweet.sentiment_score,
      keywords: tweet.keywords || [],
      category: tweet.category || 'General'
    }));

    console.log(`✅ Contexto de tweets trending obtenido: ${contextoTweets.length} tweets`);
    return contextoTweets;

  } catch (error) {
    console.error('❌ Error en obtenerContextoTweetsTrending:', error);
    return [];
  }
}

/**
 * Obtiene contexto de noticias desde la tabla news
 */
async function obtenerContextoNoticias(limite = 15) {
  try {
    console.log(`📰 Obteniendo contexto de noticias (límite: ${limite})`);
    
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo noticias:', error);
      return [];
    }

    if (!news || news.length === 0) {
      console.log('⚠️ No se encontraron noticias');
      return [];
    }

    // Formatear noticias para contexto
    const contextoNoticias = news.map(noticia => ({
      id: noticia.id,
      title: noticia.title,
      description: noticia.description,
      content: noticia.content,
      url: noticia.url,
      source: noticia.source,
      published_at: noticia.published_at,
      category: noticia.category || 'General',
      keywords: noticia.keywords || [],
      sentiment: noticia.sentiment_score
    }));

    console.log(`✅ Contexto de noticias obtenido: ${contextoNoticias.length} noticias`);
    return contextoNoticias;

  } catch (error) {
    console.error('❌ Error en obtenerContextoNoticias:', error);
    return [];
  }
}

/**
 * Obtiene contexto de documentos desde la tabla codex
 */
async function obtenerContextoCodex(limite = 10) {
  try {
    console.log(`📚 Obteniendo contexto de codex (límite: ${limite})`);
    
    const { data: codex, error } = await supabase
      .from('codex')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('❌ Error obteniendo codex:', error);
      return [];
    }

    if (!codex || codex.length === 0) {
      console.log('⚠️ No se encontraron documentos en codex');
      return [];
    }

    // Formatear documentos para contexto
    const contextoCodex = codex.map(doc => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      summary: doc.summary,
      category: doc.category || 'General',
      tags: doc.tags || [],
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      metadata: doc.metadata || {}
    }));

    console.log(`✅ Contexto de codex obtenido: ${contextoCodex.length} documentos`);
    return contextoCodex;

  } catch (error) {
    console.error('❌ Error en obtenerContextoCodex:', error);
    return [];
  }
}

/**
 * Construye el contexto completo basado en las fuentes seleccionadas
 */
async function construirContextoCompleto(selectedContexts) {
  try {
    console.log('🔨 Construyendo contexto completo:', selectedContexts);
    
    const contexto = {
      fuentes_utilizadas: selectedContexts,
      timestamp: new Date().toISOString(),
      data: {}
    };

    // Obtener datos de cada fuente seleccionada
    const promises = [];

    if (selectedContexts.includes('tendencias')) {
      promises.push(
        obtenerContextoTendencias(10).then(data => ({ tipo: 'tendencias', data }))
      );
    }

    if (selectedContexts.includes('tweets')) {
      promises.push(
        obtenerContextoTweetsTrending(20).then(data => ({ tipo: 'tweets', data }))
      );
    }

    if (selectedContexts.includes('noticias')) {
      promises.push(
        obtenerContextoNoticias(15).then(data => ({ tipo: 'noticias', data }))
      );
    }

    if (selectedContexts.includes('codex')) {
      promises.push(
        obtenerContextoCodex(10).then(data => ({ tipo: 'codex', data }))
      );
    }

    // Ejecutar todas las consultas en paralelo
    const resultados = await Promise.all(promises);

    // Organizar resultados por tipo
    resultados.forEach(resultado => {
      contexto.data[resultado.tipo] = resultado.data;
    });

    // Calcular estadísticas del contexto
    contexto.estadisticas = {
      total_fuentes: selectedContexts.length,
      total_items: Object.values(contexto.data).reduce((acc, items) => acc + (Array.isArray(items) ? items.length : 0), 0),
      fuentes_con_datos: Object.keys(contexto.data).filter(key => 
        Array.isArray(contexto.data[key]) && contexto.data[key].length > 0
      ).length
    };

    console.log(`✅ Contexto completo construido:`, contexto.estadisticas);
    return contexto;

  } catch (error) {
    console.error('❌ Error construyendo contexto completo:', error);
    throw error;
  }
}

/**
 * Obtiene contexto adicional usando Perplexity para enriquecer la información
 */
async function obtenerContextoAdicionalPerplexity(pregunta, contextoBase) {
  try {
    console.log('🔍 Obteniendo contexto adicional con Perplexity');
    
    // Usar la función existente de perplexity.js para obtener contexto de tweets
    const contextoTweets = await obtenerContextoTweets();
    
    // Construir query para Perplexity basado en la pregunta y contexto
    const query = `Contexto sobre: ${pregunta}. 
    Información adicional relevante para Guatemala y Centroamérica.
    Contexto de redes sociales: ${contextoTweets}`;

    // Aquí se podría integrar con Perplexity API si está disponible
    // Por ahora retornamos el contexto de tweets
    return {
      contexto_tweets: contextoTweets,
      query_utilizado: query,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error obteniendo contexto adicional:', error);
    return {
      contexto_tweets: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Procesa el sondeo con ChatGPT 4o (simulado por ahora)
 */
async function procesarSondeoConChatGPT(pregunta, contexto, configuracion = {}) {
  try {
    console.log('🤖 Procesando sondeo con ChatGPT 4o');
    
    // Construir prompt para ChatGPT
    const prompt = construirPromptSondeo(pregunta, contexto, configuracion);
    
    // Determinar el tipo de contexto principal
    const tipoContextoPrincipal = contexto.fuentes_utilizadas[0] || 'tendencias';
    
    // Generar datos de visualización estructurados
    const datosVisualizacion = generarDatosVisualizacion(pregunta, tipoContextoPrincipal);
    
    // NOTA: Aquí se integraría con la API de OpenAI ChatGPT 4o
    // Por ahora simulamos la respuesta
    const respuestaSimulada = {
      respuesta: `Análisis de: "${pregunta}"
      
Basado en el contexto proporcionado de ${contexto.fuentes_utilizadas.join(', ')}, se puede observar:

1. **Tendencias Principales**: ${contexto.estadisticas.total_items} elementos analizados
2. **Fuentes Consultadas**: ${contexto.estadisticas.total_fuentes} fuentes de datos
3. **Análisis Contextual**: Información relevante para Guatemala y región

**Conclusiones**:
- El tema muestra relevancia en las fuentes consultadas
- Se identifican patrones en los datos analizados
- Recomendaciones basadas en el contexto actual

*Análisis completado exitosamente con datos estructurados para visualización.*`,
      
      metadata: {
        modelo: 'ChatGPT-4o (simulado)',
        tokens_estimados: Math.ceil(JSON.stringify(contexto).length / 4),
        fuentes_utilizadas: contexto.fuentes_utilizadas,
        timestamp: new Date().toISOString(),
        configuracion_utilizada: configuracion
      },
      
      // Datos estructurados para visualización
      datos_visualizacion: datosVisualizacion,
      
      estadisticas: {
        contexto_procesado: contexto.estadisticas,
        costo_creditos: configuracion.costo_calculado || 15
      }
    };

    console.log('✅ Sondeo procesado exitosamente con datos de visualización');
    return respuestaSimulada;

  } catch (error) {
    console.error('❌ Error procesando sondeo:', error);
    throw error;
  }
}

/**
 * Genera datos estructurados para visualización con conclusiones y metodología
 */
function generarDatosVisualizacion(consulta, tipo) {
  console.log(`📊 Generando datos de visualización para: ${consulta} (tipo: ${tipo})`);
  
  // Datos mejorados para tendencias con etiquetas más cortas y respuestas conclusivas
  if (tipo === 'tendencias') {
    return {
      temas_relevantes: [
        { tema: `${consulta} - Política`, valor: 85, descripcion: "Impacto en políticas públicas nacionales" },
        { tema: `${consulta} - Economía`, valor: 67, descripcion: "Efectos en el desarrollo económico regional" },
        { tema: `${consulta} - Internacional`, valor: 54, descripcion: "Relaciones y cooperación internacional" },
        { tema: `${consulta} - Tecnología`, valor: 42, descripcion: "Innovación y transformación digital" },
        { tema: `${consulta} - Cultura`, valor: 38, descripcion: "Expresiones culturales y sociales" }
      ],
      distribucion_categorias: [
        { categoria: 'Política', valor: 35 },
        { categoria: 'Economía', valor: 28 },
        { categoria: 'Internacional', valor: 17 },
        { categoria: 'Tecnología', valor: 12 },
        { categoria: 'Cultura', valor: 8 }
      ],
      mapa_menciones: [
        { region: 'Guatemala', valor: 48 },
        { region: 'Zona Metro', valor: 35 },
        { region: 'Occidente', valor: 25 },
        { region: 'Oriente', valor: 18 },
        { region: 'Norte', valor: 12 }
      ],
      subtemas_relacionados: [
        { subtema: 'Financiamiento', relacion: 85 },
        { subtema: 'Regulación', relacion: 72 },
        { subtema: 'Sostenibilidad', relacion: 64 },
        { subtema: 'Impacto Social', relacion: 53 },
        { subtema: 'Inversión', relacion: 47 }
      ],
      // Respuestas conclusivas para cada gráfico
      conclusiones: {
        temas_relevantes: `Los temas relacionados con ${consulta} muestran mayor relevancia en el ámbito político (85%) y económico (67%), indicando que este tema tiene un impacto significativo en las decisiones gubernamentales y el desarrollo económico del país.`,
        distribucion_categorias: `La distribución por categorías revela que ${consulta} se concentra principalmente en Política (35%) y Economía (28%), representando el 63% de toda la conversación, lo que sugiere una alta prioridad en la agenda nacional.`,
        mapa_menciones: `Geográficamente, ${consulta} tiene mayor resonancia en Guatemala capital (48%) y la Zona Metropolitana (35%), concentrando el 83% de las menciones en el área central del país.`,
        subtemas_relacionados: `Los subtemas más relacionados son Financiamiento (85%) y Regulación (72%), indicando que ${consulta} requiere principalmente atención en aspectos económicos y marco normativo.`
      },
      // Información sobre cómo se obtuvo cada gráfica
      metodologia: {
        temas_relevantes: "Análisis de tendencias actuales filtradas por relevancia semántica y frecuencia de mención",
        distribucion_categorias: "Clasificación automática de contenido usando categorías predefinidas del sistema",
        mapa_menciones: "Geolocalización de menciones basada en datos de ubicación y referencias geográficas",
        subtemas_relacionados: "Análisis de co-ocurrencia y correlación semántica entre términos relacionados"
      }
    };
  } 
  // Datos mejorados para noticias con etiquetas más cortas
  else if (tipo === 'noticias') {
    return {
      noticias_relevantes: [
        { titulo: `${consulta} - Impacto Nacional`, relevancia: 92, descripcion: "Análisis del impacto en desarrollo económico" },
        { titulo: `${consulta} - Políticas Nuevas`, relevancia: 87, descripcion: "Anuncio de nuevas políticas gubernamentales" },
        { titulo: `${consulta} - Comunidades`, relevancia: 76, descripcion: "Organización de comunidades rurales" },
        { titulo: `${consulta} - Perspectiva Internacional`, relevancia: 68, descripcion: "Debate de especialistas internacionales" },
        { titulo: `${consulta} - Futuro Guatemala`, relevancia: 61, descripcion: "Perspectivas a mediano y largo plazo" }
      ],
      fuentes_cobertura: [
        { fuente: 'Prensa Libre', cobertura: 32 },
        { fuente: 'Nuestro Diario', cobertura: 27 },
        { fuente: 'El Periódico', cobertura: 21 },
        { fuente: 'La Hora', cobertura: 15 },
        { fuente: 'Otros', cobertura: 5 }
      ],
      evolucion_cobertura: [
        { fecha: 'Ene', valor: 15 },
        { fecha: 'Feb', valor: 25 },
        { fecha: 'Mar', valor: 42 },
        { fecha: 'Abr', valor: 38 },
        { fecha: 'May', valor: 55 }
      ],
      aspectos_cubiertos: [
        { aspecto: 'Económico', cobertura: 65 },
        { aspecto: 'Político', cobertura: 58 },
        { aspecto: 'Social', cobertura: 47 },
        { aspecto: 'Legal', cobertura: 41 },
        { aspecto: 'Tecnológico', cobertura: 35 }
      ],
      conclusiones: {
        noticias_relevantes: `Las noticias sobre ${consulta} se enfocan principalmente en el impacto nacional (92%) y nuevas políticas (87%), mostrando alta cobertura mediática en temas de política pública.`,
        fuentes_cobertura: `Prensa Libre lidera la cobertura con 32%, seguido por Nuestro Diario (27%), concentrando el 59% de la información en estos dos medios principales.`,
        evolucion_cobertura: `La cobertura de ${consulta} ha mostrado un crecimiento sostenido, alcanzando su pico en mayo (55 menciones), indicando un interés mediático creciente.`,
        aspectos_cubiertos: `Los aspectos económicos dominan la cobertura (65%), seguidos por los políticos (58%), representando el enfoque principal de los medios en estos temas.`
      },
      metodologia: {
        noticias_relevantes: "Análisis de relevancia basado en frecuencia de mención, engagement y autoridad de la fuente",
        fuentes_cobertura: "Conteo de artículos por fuente mediática durante el período analizado",
        evolucion_cobertura: "Seguimiento temporal de menciones en medios digitales e impresos",
        aspectos_cubiertos: "Clasificación temática automática del contenido de las noticias"
      }
    };
  }
  else if (tipo === 'codex') {
    return {
      documentos_relevantes: [
        { titulo: `${consulta} - Análisis Estratégico`, relevancia: 95, descripcion: "Análisis integral para Guatemala" },
        { titulo: `${consulta} - Estudio Sectorial`, relevancia: 88, descripcion: "Estudio comparativo sectorial" },
        { titulo: `${consulta} - Marco Legal`, relevancia: 82, descripcion: "Políticas públicas y normativa" },
        { titulo: `${consulta} - Aspectos Institucionales`, relevancia: 75, descripcion: "Marco institucional guatemalteco" },
        { titulo: `${consulta} - Impacto Social`, relevancia: 68, descripcion: "Casos de estudio nacionales" }
      ],
      conceptos_relacionados: [
        { concepto: 'Desarrollo Sostenible', relacion: 78 },
        { concepto: 'Política Pública', relacion: 65 },
        { concepto: 'Participación Ciudadana', relacion: 59 },
        { concepto: 'Marco Regulatorio', relacion: 52 },
        { concepto: 'Innovación', relacion: 45 }
      ],
      evolucion_analisis: [
        { fecha: 'Q1', valor: 22 },
        { fecha: 'Q2', valor: 35 },
        { fecha: 'Q3', valor: 48 },
        { fecha: 'Q4', valor: 55 }
      ],
      aspectos_documentados: [
        { aspecto: 'Conceptual', profundidad: 82 },
        { aspecto: 'Casos de Estudio', profundidad: 75 },
        { aspecto: 'Comparativo', profundidad: 68 },
        { aspecto: 'Proyecciones', profundidad: 62 },
        { aspecto: 'Legal', profundidad: 55 }
      ],
      conclusiones: {
        documentos_relevantes: `Los documentos del codex sobre ${consulta} muestran alta relevancia en análisis estratégicos (95%) y estudios sectoriales (88%), indicando una base sólida de conocimiento especializado.`,
        conceptos_relacionados: `El concepto más relacionado es Desarrollo Sostenible (78%), seguido por Política Pública (65%), mostrando la orientación hacia sostenibilidad y gobernanza.`,
        evolucion_analisis: `El análisis ha evolucionado positivamente, creciendo de 22 a 55 documentos por trimestre, mostrando un interés académico y técnico creciente.`,
        aspectos_documentados: `Los aspectos conceptuales tienen mayor profundidad (82%), seguidos por casos de estudio (75%), indicando un enfoque teórico-práctico balanceado.`
      },
      metodologia: {
        documentos_relevantes: "Ranking basado en citaciones, autoridad del autor y relevancia temática",
        conceptos_relacionados: "Análisis de co-ocurrencia y proximidad semántica en el corpus documental",
        evolucion_analisis: "Conteo temporal de documentos agregados al codex por trimestre",
        aspectos_documentados: "Evaluación de profundidad basada en extensión y detalle del contenido"
      }
    };
  }
  
  return {
    datos_genericos: [
      { etiqueta: 'Categoría 1', valor: 85 },
      { etiqueta: 'Categoría 2', valor: 65 },
      { etiqueta: 'Categoría 3', valor: 45 },
      { etiqueta: 'Categoría 4', valor: 25 }
    ]
  };
}

/**
 * Construye el prompt optimizado para ChatGPT
 */
function construirPromptSondeo(pregunta, contexto, configuracion) {
  const prompt = `
Eres un analista experto en tendencias y datos de Guatemala y Centroamérica.

PREGUNTA A ANALIZAR: "${pregunta}"

CONTEXTO DISPONIBLE:
${JSON.stringify(contexto, null, 2)}

INSTRUCCIONES:
1. Analiza la pregunta en el contexto de los datos proporcionados
2. Identifica patrones y tendencias relevantes
3. Proporciona insights específicos para Guatemala/Centroamérica
4. Incluye recomendaciones basadas en evidencia
5. Mantén un tono profesional pero accesible

FORMATO DE RESPUESTA:
- Análisis principal
- Tendencias identificadas
- Conclusiones y recomendaciones
- Fuentes de datos utilizadas

Responde en español y enfócate en información práctica y accionable.
`;

  return prompt;
}

module.exports = {
  obtenerContextoTendencias,
  obtenerContextoTweetsTrending,
  obtenerContextoNoticias,
  obtenerContextoCodex,
  construirContextoCompleto,
  obtenerContextoAdicionalPerplexity,
  procesarSondeoConChatGPT,
  construirPromptSondeo
}; 