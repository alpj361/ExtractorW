/**
 * Motor de Análisis de Sentimientos
 * Analiza el sentimiento de tweets y contenido social
 */

class SentimentEngine {
  constructor(lauraAgent) {
    this.laura = lauraAgent;
    
    // Diccionarios de palabras para análisis de sentimiento
    this.positiveWords = new Set([
      'bueno', 'excelente', 'genial', 'increíble', 'fantástico', 'maravilloso',
      'perfecto', 'amor', 'feliz', 'alegría', 'éxito', 'victoria', 'ganar',
      'logro', 'progreso', 'mejora', 'esperanza', 'optimista', 'positivo',
      'bendición', 'agradecido', 'orgulloso', 'satisfecho', 'contento',
      'celebrar', 'triunfo', 'gloria', 'honor'
    ]);
    
    this.negativeWords = new Set([
      'malo', 'terrible', 'horrible', 'pésimo', 'desastre', 'fracaso',
      'error', 'problema', 'crisis', 'conflicto', 'guerra', 'violencia',
      'odio', 'tristeza', 'dolor', 'sufrimiento', 'corrupción', 'robo',
      'mentira', 'traición', 'injusticia', 'preocupado', 'triste', 'enojado',
      'furioso', 'decepcionado', 'frustrado', 'desesperado', 'perdida'
    ]);
    
    this.neutralWords = new Set([
      'normal', 'regular', 'común', 'estándar', 'típico', 'promedio',
      'usual', 'ordinario', 'neutro', 'balanceado', 'equilibrado'
    ]);
    
    // Modificadores de intensidad
    this.intensifiers = new Map([
      ['muy', 1.5],
      ['extremadamente', 2.0],
      ['súper', 1.8],
      ['bastante', 1.3],
      ['realmente', 1.4],
      ['totalmente', 1.6],
      ['absolutamente', 1.8],
      ['completamente', 1.7]
    ]);
    
    this.diminishers = new Map([
      ['poco', 0.5],
      ['apenas', 0.3],
      ['ligeramente', 0.4],
      ['algo', 0.6],
      ['relativamente', 0.7]
    ]);
    
    // Emojis y su sentimiento
    this.emojiSentiment = new Map([
      ['😊', 1], ['😃', 1], ['😄', 1], ['😁', 1], ['🙂', 0.5], ['😉', 0.5],
      ['😍', 1.5], ['🥰', 1.5], ['😘', 1], ['💕', 1], ['❤️', 1.2], ['💖', 1.2],
      ['👍', 1], ['👏', 1], ['🎉', 1.5], ['🥳', 1.5], ['✨', 1], ['⭐', 1],
      ['😢', -1], ['😭', -1.5], ['😞', -1], ['😔', -1], ['😩', -1.2], ['😫', -1.2],
      ['😡', -1.5], ['😠', -1.3], ['🤬', -2], ['😤', -1], ['💔', -1.5], ['😰', -1],
      ['🤔', 0], ['😐', 0], ['😑', 0], ['🤷', 0], ['🤷‍♂️', 0], ['🤷‍♀️', 0]
    ]);
  }

  /**
   * Calcular sentimiento de una colección de tweets
   */
  calculateSentiment(tweets) {
    if (!tweets || tweets.length === 0) return 0;
    
    let totalSentiment = 0;
    let validTweets = 0;
    
    tweets.forEach(tweet => {
      if (tweet.texto) {
        const sentiment = this.analyzeTweetSentiment(tweet.texto);
        totalSentiment += sentiment;
        validTweets++;
      }
    });
    
    if (validTweets === 0) return 0;
    
    const averageSentiment = totalSentiment / validTweets;
    
    // Normalizar a rango -1 a 1
    return Math.max(-1, Math.min(1, averageSentiment));
  }

  /**
   * Analizar sentimiento de un tweet individual
   */
  analyzeTweetSentiment(text) {
    if (!text || typeof text !== 'string') return 0;
    
    const normalizedText = this.normalizeText(text);
    const words = normalizedText.split(/\s+/);
    
    let sentimentScore = 0;
    let wordCount = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let wordSentiment = this.getWordSentiment(word);
      
      if (wordSentiment !== 0) {
        // Verificar modificadores antes de la palabra
        if (i > 0) {
          const prevWord = words[i - 1];
          const intensifier = this.intensifiers.get(prevWord);
          const diminisher = this.diminishers.get(prevWord);
          
          if (intensifier) {
            wordSentiment *= intensifier;
          } else if (diminisher) {
            wordSentiment *= diminisher;
          }
        }
        
        // Verificar negaciones
        if (this.hasNegation(words, i)) {
          wordSentiment *= -1;
        }
        
        sentimentScore += wordSentiment;
        wordCount++;
      }
    }
    
    // Analizar emojis
    const emojiSentiment = this.analyzeEmojiSentiment(text);
    sentimentScore += emojiSentiment;
    
    // Analizar signos de puntuación
    const punctuationSentiment = this.analyzePunctuationSentiment(text);
    sentimentScore += punctuationSentiment;
    
    // Normalizar por número de palabras con sentimiento
    if (wordCount > 0) {
      sentimentScore = sentimentScore / Math.max(1, wordCount);
    }
    
    // Ajustar por longitud del texto
    const lengthFactor = Math.min(1, text.length / 100);
    sentimentScore *= lengthFactor;
    
    return Math.max(-2, Math.min(2, sentimentScore));
  }

  /**
   * Normalizar texto para análisis
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remover puntuación pero conservar espacios
      .replace(/\s+/g, ' ')     // Normalizar espacios
      .trim();
  }

  /**
   * Obtener sentimiento de una palabra individual
   */
  getWordSentiment(word) {
    if (this.positiveWords.has(word)) return 1;
    if (this.negativeWords.has(word)) return -1;
    if (this.neutralWords.has(word)) return 0;
    
    // Verificar variaciones comunes
    const stemmed = this.stemWord(word);
    if (this.positiveWords.has(stemmed)) return 0.8;
    if (this.negativeWords.has(stemmed)) return -0.8;
    
    return 0;
  }

  /**
   * Stemming simple para español
   */
  stemWord(word) {
    // Remover sufijos comunes
    const suffixes = ['mente', 'ando', 'endo', 'ado', 'ido', 'ar', 'er', 'ir', 'es', 's'];
    
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }
    
    return word;
  }

  /**
   * Detectar negaciones
   */
  hasNegation(words, currentIndex) {
    const negationWords = ['no', 'nunca', 'jamás', 'sin', 'ni'];
    
    // Buscar negaciones en las 3 palabras anteriores
    for (let i = Math.max(0, currentIndex - 3); i < currentIndex; i++) {
      if (negationWords.includes(words[i])) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Analizar sentimiento de emojis
   */
  analyzeEmojiSentiment(text) {
    let emojiScore = 0;
    let emojiCount = 0;
    
    // Usar regex para encontrar emojis Unicode
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    
    const emojis = text.match(emojiRegex);
    
    if (emojis) {
      emojis.forEach(emoji => {
        const sentiment = this.emojiSentiment.get(emoji);
        if (sentiment !== undefined) {
          emojiScore += sentiment;
          emojiCount++;
        }
      });
    }
    
    return emojiCount > 0 ? emojiScore / emojiCount : 0;
  }

  /**
   * Analizar sentimiento de puntuación
   */
  analyzePunctuationSentiment(text) {
    let punctuationScore = 0;
    
    // Signos de exclamación (intensidad emocional)
    const exclamationMarks = (text.match(/!/g) || []).length;
    if (exclamationMarks > 0) {
      punctuationScore += Math.min(0.5, exclamationMarks * 0.1);
    }
    
    // Múltiples signos de interrogación (confusión/negatividad)
    const questionMarks = (text.match(/\?{2,}/g) || []).length;
    if (questionMarks > 0) {
      punctuationScore -= questionMarks * 0.2;
    }
    
    // Puntos suspensivos (neutralidad/duda)
    const ellipsis = (text.match(/\.{3,}/g) || []).length;
    if (ellipsis > 0) {
      punctuationScore -= ellipsis * 0.1;
    }
    
    // Letras mayúsculas excesivas (grito/negatividad)
    const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
    if (capsWords > 0) {
      punctuationScore -= capsWords * 0.3;
    }
    
    return punctuationScore;
  }

  /**
   * Clasificar sentimiento en categorías
   */
  classifySentiment(score) {
    if (score >= 0.5) return 'muy_positivo';
    if (score >= 0.1) return 'positivo';
    if (score >= -0.1) return 'neutral';
    if (score >= -0.5) return 'negativo';
    return 'muy_negativo';
  }

  /**
   * Analizar distribución de sentimientos en tweets
   */
  analyzeSentimentDistribution(tweets) {
    if (!tweets || tweets.length === 0) {
      return {
        muy_positivo: 0,
        positivo: 0,
        neutral: 0,
        negativo: 0,
        muy_negativo: 0,
        total: 0
      };
    }
    
    const distribution = {
      muy_positivo: 0,
      positivo: 0,
      neutral: 0,
      negativo: 0,
      muy_negativo: 0,
      total: tweets.length
    };
    
    tweets.forEach(tweet => {
      if (tweet.texto) {
        const sentiment = this.analyzeTweetSentiment(tweet.texto);
        const category = this.classifySentiment(sentiment);
        distribution[category]++;
      }
    });
    
    return distribution;
  }

  /**
   * Obtener tweets más positivos y negativos
   */
  getExtremesSentimentTweets(tweets, limit = 3) {
    if (!tweets || tweets.length === 0) {
      return { mostPositive: [], mostNegative: [] };
    }
    
    const tweetsWithSentiment = tweets
      .filter(tweet => tweet.texto)
      .map(tweet => ({
        ...tweet,
        sentimentScore: this.analyzeTweetSentiment(tweet.texto)
      }));
    
    // Ordenar por sentimiento
    const sortedBySentiment = [...tweetsWithSentiment]
      .sort((a, b) => b.sentimentScore - a.sentimentScore);
    
    return {
      mostPositive: sortedBySentiment.slice(0, limit),
      mostNegative: sortedBySentiment.slice(-limit).reverse()
    };
  }

  /**
   * Analizar evolución del sentimiento en el tiempo
   */
  analyzeSentimentEvolution(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    // Agrupar tweets por día
    const dailySentiment = new Map();
    
    tweets.forEach(tweet => {
      if (!tweet.fecha_tweet || !tweet.texto) return;
      
      const date = tweet.fecha_tweet.split('T')[0]; // YYYY-MM-DD
      const sentiment = this.analyzeTweetSentiment(tweet.texto);
      
      if (!dailySentiment.has(date)) {
        dailySentiment.set(date, { scores: [], date });
      }
      
      dailySentiment.get(date).scores.push(sentiment);
    });
    
    // Calcular promedio diario
    const evolution = Array.from(dailySentiment.values())
      .map(day => ({
        date: day.date,
        averageSentiment: day.scores.reduce((sum, score) => sum + score, 0) / day.scores.length,
        tweetCount: day.scores.length
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return evolution;
  }

  /**
   * Obtener estadísticas del motor
   */
  getStats() {
    return {
      name: 'SentimentEngine',
      positiveWordsCount: this.positiveWords.size,
      negativeWordsCount: this.negativeWords.size,
      emojiMappingsCount: this.emojiSentiment.size,
      intensifiersCount: this.intensifiers.size,
      capabilities: [
        'tweet_sentiment_analysis',
        'sentiment_distribution',
        'extreme_sentiment_detection',
        'sentiment_evolution',
        'emoji_analysis',
        'punctuation_analysis'
      ]
    };
  }
}

module.exports = {
  SentimentEngine
}; 