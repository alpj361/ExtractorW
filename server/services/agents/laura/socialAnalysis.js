/**
 * Motor de Análisis Social
 * Maneja análisis de conversaciones, filtros inteligentes y evaluación de relevancia
 */

const geminiService = require('../../gemini');

class SocialAnalysisEngine {
  constructor(lauraAgent) {
    this.laura = lauraAgent;
  }

  /**
   * Aplicar filtros inteligentes a queries de búsqueda social
   */
  applyIntelligentFilters(args, originalQuery) {
    const query = originalQuery || args.q || '';
    
    console.log(`[LAURA] 🔍 Query original: "${query}"`);
    
    // PASO 1: Acortar query larga a términos clave
    const shortQuery = this.shortenQuery(query);
    console.log(`[LAURA] ✂️  Query acortada: "${shortQuery}"`);
    
    // PASO 2: Aplicar filtros específicos por tema
    let filteredQuery = shortQuery;
    let includeTerms = [];
    
    if (shortQuery.includes('ley') || shortQuery.includes('proteccion') || shortQuery.includes('animal')) {
      includeTerms = ['ley', 'protección', 'animal', 'Guatemala'];
      filteredQuery = this.buildContextualQuery(shortQuery, includeTerms, []);
    } else if (shortQuery.includes('sismo') || shortQuery.includes('terremoto')) {
      includeTerms = ['sismo', 'terremoto', 'Guatemala'];
      filteredQuery = this.buildContextualQuery(shortQuery, includeTerms, []);
    } else if (shortQuery.includes('eleccion') || shortQuery.includes('politica')) {
      includeTerms = ['elección', 'política', 'Guatemala'];
      filteredQuery = this.buildContextualQuery(shortQuery, includeTerms, []);
    } else {
      // Para temas generales, solo usar la query acortada + Guatemala
      filteredQuery = shortQuery + ' Guatemala';
    }
    
    console.log(`[LAURA] 🎯 Query final: "${filteredQuery}"`);
    
    return {
      ...args,
      q: filteredQuery
    };
  }

  /**
   * Acortar query larga manteniendo términos clave
   */
  shortenQuery(query) {
    if (query.length <= 50) return query;
    
    // Extraer términos más importantes (sustantivos, nombres propios, términos específicos)
    const words = query.split(' ');
    const importantWords = words.filter(word => {
      return word.length > 2 && 
             !['que', 'del', 'las', 'los', 'una', 'uno', 'para', 'con', 'por', 'desde'].includes(word.toLowerCase());
    });
    
    // Tomar máximo 8 palabras importantes
    return importantWords.slice(0, 8).join(' ');
  }

  /**
   * Construir query contextual con términos de inclusión/exclusión
   */
  buildContextualQuery(baseQuery, includeTerms = [], excludeTerms = []) {
    let contextualQuery = baseQuery;
    
    // Agregar términos de inclusión si no están presentes
    includeTerms.forEach(term => {
      if (!contextualQuery.toLowerCase().includes(term.toLowerCase())) {
        contextualQuery += ` ${term}`;
      }
    });
    
    // TODO: Implementar exclusión de términos si es necesario
    // excludeTerms.forEach(term => {
    //   contextualQuery += ` -${term}`;
    // });
    
    return contextualQuery;
  }

  /**
   * Aplicar jerga social guatemalteca para mejorar búsquedas
   */
  enforceSocialJargon(query) {
    if (!query) return query;
    
    let enhancedQuery = query;
    
    // Mapeo de términos locales
    const localTerms = {
      'guatemala': ['#Guatemala', 'GT', 'Guate'],
      'congreso': ['#CongresoGt', 'congreso guatemala'],
      'presidente': ['presidente guatemala', '#PresidenciaGT'],
      'sismos': ['#SismosGT', 'terremoto guatemala'],
      'politica': ['política guatemala', '#PoliticaGT']
    };
    
    // Agregar hashtags relevantes si el query es genérico
    const words = enhancedQuery.toLowerCase().split(' ');
    if (words.length <= 2) {
      for (const [term, variations] of Object.entries(localTerms)) {
        if (enhancedQuery.toLowerCase().includes(term)) {
          enhancedQuery += ` ${variations[0]}`;
          break;
        }
      }
    }
    
    return enhancedQuery;
  }

  /**
   * Filtrar tweets recientes relevantes
   */
  filterRecentTweets(tweets, originalQuery) {
    if (!tweets || tweets.length === 0) return [];
    
    // Filtrar por fecha (últimos 30 días)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    let filteredTweets = tweets.filter(tweet => {
      if (!tweet.fecha_tweet) return true; // Incluir si no hay fecha
      
      const tweetDate = new Date(tweet.fecha_tweet);
      return tweetDate > thirtyDaysAgo;
    });
    
    // Evaluar relevancia y ordenar
    filteredTweets = filteredTweets.map(tweet => ({
      ...tweet,
      relevanceScore: this.calculateTweetRelevance(tweet, originalQuery)
    }));
    
    // Ordenar por relevancia y fecha
    filteredTweets.sort((a, b) => {
      const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (relevanceDiff !== 0) return relevanceDiff;
      
      // Si relevancia es igual, ordenar por fecha
      const dateA = new Date(a.fecha_tweet || 0);
      const dateB = new Date(b.fecha_tweet || 0);
      return dateB - dateA;
    });
    
    // Retornar top 50 más relevantes
    return filteredTweets.slice(0, 50);
  }

  /**
   * Calcular relevancia de un tweet individual
   */
  calculateTweetRelevance(tweet, query) {
    if (!tweet.texto || !query) return 0;
    
    const tweetText = tweet.texto.toLowerCase();
    const queryWords = query.toLowerCase().split(' ');
    
    let score = 0;
    
    // Puntuación por palabras coincidentes
    queryWords.forEach(word => {
      if (word.length > 2 && tweetText.includes(word)) {
        score += 1;
      }
    });
    
    // Bonificación por engagement
    const likes = parseInt(tweet.likes) || 0;
    const retweets = parseInt(tweet.retweets) || 0;
    const engagement = likes + (retweets * 2); // Retweets valen más
    
    if (engagement > 100) score += 3;
    else if (engagement > 50) score += 2;
    else if (engagement > 10) score += 1;
    
    // Bonificación por menciones o hashtags relevantes
    if (tweetText.includes('@') || tweetText.includes('#')) {
      score += 1;
    }
    
    // Penalización por contenido spam-like
    if (tweetText.includes('http') && tweetText.length < 50) {
      score -= 2;
    }
    
    return Math.max(0, score);
  }

  /**
   * Evaluar relevancia general de resultados
   */
  assessRelevance(results, originalQuery) {
    if (!results.tweets || results.tweets.length === 0) return 0;
    
    const tweets = results.tweets;
    const totalTweets = tweets.length;
    
    // Calcular relevancia promedio
    const totalRelevance = tweets.reduce((sum, tweet) => {
      return sum + this.calculateTweetRelevance(tweet, originalQuery);
    }, 0);
    
    const averageRelevance = totalRelevance / totalTweets;
    
    // Factores adicionales
    let relevanceScore = averageRelevance;
    
    // Bonificación por volumen de tweets
    if (totalTweets >= 20) relevanceScore += 2;
    else if (totalTweets >= 10) relevanceScore += 1;
    
    // Bonificación por diversidad de fechas
    const uniqueDates = new Set(tweets.map(t => t.fecha_tweet?.split('T')[0])).size;
    if (uniqueDates >= 5) relevanceScore += 1;
    
    // Normalizar a escala 0-10
    return Math.min(10, Math.max(0, relevanceScore));
  }

  /**
   * Extraer actores clave de tweets
   */
  extractKeyActors(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    const mentions = new Map();
    const hashtags = new Map();
    
    tweets.forEach(tweet => {
      if (!tweet.texto) return;
      
      // Extraer menciones @usuario
      const mentionMatches = tweet.texto.match(/@(\w+)/g);
      if (mentionMatches) {
        mentionMatches.forEach(mention => {
          const username = mention.substring(1);
          mentions.set(username, (mentions.get(username) || 0) + 1);
        });
      }
      
      // Extraer hashtags
      const hashtagMatches = tweet.texto.match(/#(\w+)/g);
      if (hashtagMatches) {
        hashtagMatches.forEach(hashtag => {
          hashtags.set(hashtag, (hashtags.get(hashtag) || 0) + 1);
        });
      }
    });
    
    // Ordenar por frecuencia y retornar top actores
    const topMentions = Array.from(mentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user, count]) => ({ type: 'user', name: `@${user}`, mentions: count }));
    
    const topHashtags = Array.from(hashtags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ type: 'hashtag', name: tag, mentions: count }));
    
    return [...topMentions, ...topHashtags];
  }

  /**
   * Extraer temas clave de tweets
   */
  extractKeyTopics(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    const topicWords = new Map();
    const commonWords = new Set(['que', 'del', 'las', 'los', 'una', 'uno', 'para', 'con', 'por', 'desde', 'hasta', 'como', 'muy', 'mas', 'todo', 'esta', 'este', 'son', 'fue', 'ser', 'han', 'hay', 'pero', 'solo', 'sin', 'mas', 'bien', 'vez', 'año', 'dia', 'hoy', 'ayer']);
    
    tweets.forEach(tweet => {
      if (!tweet.texto) return;
      
      // Limpiar y tokenizar
      const words = tweet.texto
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word));
      
      words.forEach(word => {
        topicWords.set(word, (topicWords.get(word) || 0) + 1);
      });
    });
    
    // Retornar top 10 temas más mencionados
    return Array.from(topicWords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ topic: word, frequency: count }));
  }

  /**
   * Análisis inteligente con Gemini
   */
  async analyzeWithGemini(tweets, originalQuery) {
    try {
      // Preparar contexto de tweets (usar todos los tweets disponibles, máximo 15)
      const tweetsContext = tweets.slice(0, Math.min(tweets.length, 15)).map((tweet, idx) => {
        // Manejar diferentes formatos de datos de tweets
        const fecha = tweet.fecha_tweet || tweet.date || 'fecha no disponible';
        const texto = tweet.texto || tweet.text || 'texto no disponible';
        const likes = tweet.likes || (tweet.metrics && tweet.metrics.likes) || 0;
        const retweets = tweet.retweets || (tweet.metrics && tweet.metrics.retweets) || 0;
        
        return `${idx + 1}. ${fecha}: ${texto} (${likes} likes, ${retweets} RTs)`;
      }).join('\n');
      
      const analysisPrompt = `Analiza ${tweets.length} tweets encontrados sobre "${originalQuery}":

TWEETS ANALIZADOS:
${tweetsContext}

INSTRUCCIONES:
Genera una respuesta conversacional como si fueras un analista experto explicándole a alguien lo que encontraste.

FORMATO REQUERIDO:
- Comienza con: "Lo encontrado sobre [persona/tema] fue..."
- Continúa con: "Lo que más habla/destaca es..."
- Incluye detalles específicos de los tweets más relevantes
- Menciona patrones, tendencias o temas recurrentes
- Concluye con insights útiles

RESPONDE EN ESPAÑOL, de forma natural y conversacional, NO en JSON.

Ejemplo de respuesta esperada:
"Lo encontrado sobre [nombre] fue principalmente contenido relacionado con [tema principal]. Los tweets analizados muestran que lo que más habla es sobre [tema específico], con [X] menciones de [tema]. Destaca especialmente [detalle específico]. Los patrones indican [insight] y esto sugiere [conclusión útil]."

Analiza ahora:`;

      console.log(`[LAURA] 🧠 Enviando ${tweets.length} tweets a Gemini para análisis`);
      
      // Usar el servicio de Gemini
      const messages = [
        { role: 'user', content: analysisPrompt }
      ];
      
      let geminiResponse;
      try {
        geminiResponse = await geminiService.generateContent(messages, {
          temperature: 0.3,
          max_tokens: 1000
        });
      } catch (geminiError) {
        console.log(`[LAURA] ❌ Error en Gemini: ${geminiError.message}`);
        return null;
      }

      if (geminiResponse) {
        console.log(`[LAURA] ✅ Análisis Gemini exitoso - respuesta conversacional generada`);
        return {
          resumen_ejecutivo: geminiResponse.trim(),
          conversational_response: true,
          tweet_count: tweets.length
        };
      } else {
        console.log(`[LAURA] ❌ Error en Gemini: respuesta vacía`);
        return null;
      }
      
    } catch (error) {
      console.error(`[LAURA] ❌ Error en análisis Gemini:`, error);
      return null;
    }
  }

  /**
   * Construir query precisa para búsquedas sociales
   */
  buildPreciseSocialQuery(originalQuery, webContext = '') {
    let precisQuery = originalQuery;
    
    // Si hay contexto web, extraer términos relevantes
    if (webContext && webContext.length > 0) {
      const contextWords = webContext
        .toLowerCase()
        .match(/\b\w{4,}\b/g) // Palabras de 4+ letras
        ?.slice(0, 3) // Top 3 palabras
        ?.join(' ') || '';
      
      if (contextWords) {
        precisQuery = `${originalQuery} ${contextWords}`;
      }
    }
    
    // Aplicar jerga social
    precisQuery = this.enforceSocialJargon(precisQuery);
    
    // Limitar longitud
    const words = precisQuery.split(' ');
    if (words.length > 10) {
      precisQuery = words.slice(0, 10).join(' ');
    }
    
    return precisQuery;
  }

  /**
   * Obtener estadísticas del motor
   */
  getStats() {
    return {
      name: 'SocialAnalysisEngine',
      capabilities: [
        'intelligent_filtering',
        'relevance_assessment',
        'key_actors_extraction',
        'topic_extraction',
        'gemini_analysis'
      ]
    };
  }
}

module.exports = {
  SocialAnalysisEngine
}; 