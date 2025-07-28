/**
 * Motor de Monitoreo de Tendencias
 * Analiza momentum, viralidad y patrones temporales en redes sociales
 */

class TrendMonitoringEngine {
  constructor(lauraAgent) {
    this.laura = lauraAgent;
  }

  /**
   * Calcular momentum de una tendencia basado en tweets
   */
  calculateMomentum(tweets) {
    if (!tweets || tweets.length === 0) return 0;
    
    // Agrupar tweets por intervalos de tiempo
    const timeWindows = this.groupTweetsByTimeWindows(tweets);
    
    if (timeWindows.length < 2) return 0;
    
    // Calcular aceleración de la tendencia
    const momentum = this.calculateAcceleration(timeWindows);
    
    // Normalizar a escala 0-1
    return Math.max(0, Math.min(1, momentum));
  }

  /**
   * Agrupar tweets por ventanas de tiempo
   */
  groupTweetsByTimeWindows(tweets, windowSizeHours = 2) {
    const windows = new Map();
    
    tweets.forEach(tweet => {
      if (!tweet.fecha_tweet) return;
      
      const tweetDate = new Date(tweet.fecha_tweet);
      const windowKey = Math.floor(tweetDate.getTime() / (windowSizeHours * 60 * 60 * 1000));
      
      if (!windows.has(windowKey)) {
        windows.set(windowKey, {
          startTime: windowKey * windowSizeHours * 60 * 60 * 1000,
          tweets: [],
          engagement: 0
        });
      }
      
      const window = windows.get(windowKey);
      window.tweets.push(tweet);
      window.engagement += (parseInt(tweet.likes) || 0) + (parseInt(tweet.retweets) || 0);
    });
    
    // Convertir a array ordenado por tiempo
    return Array.from(windows.values())
      .sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Calcular aceleración de la tendencia
   */
  calculateAcceleration(timeWindows) {
    if (timeWindows.length < 3) return 0;
    
    let totalAcceleration = 0;
    let validComparisons = 0;
    
    for (let i = 2; i < timeWindows.length; i++) {
      const current = timeWindows[i];
      const previous = timeWindows[i - 1];
      const beforePrevious = timeWindows[i - 2];
      
      // Calcular velocidad actual vs anterior
      const currentVelocity = current.tweets.length + (current.engagement / 10);
      const previousVelocity = previous.tweets.length + (previous.engagement / 10);
      const beforeVelocity = beforePrevious.tweets.length + (beforePrevious.engagement / 10);
      
      // Calcular aceleración (cambio en velocidad)
      const acceleration1 = currentVelocity - previousVelocity;
      const acceleration2 = previousVelocity - beforeVelocity;
      
      const averageAcceleration = (acceleration1 + acceleration2) / 2;
      totalAcceleration += averageAcceleration;
      validComparisons++;
    }
    
    if (validComparisons === 0) return 0;
    
    const averageAcceleration = totalAcceleration / validComparisons;
    
    // Normalizar (ajustar según contexto)
    return averageAcceleration / 10;
  }

  /**
   * Detectar patrones virales en tweets
   */
  detectViralPatterns(tweets) {
    if (!tweets || tweets.length === 0) {
      return {
        isViral: false,
        viralScore: 0,
        patterns: []
      };
    }
    
    const patterns = [];
    let viralScore = 0;
    
    // Patrón 1: Engagement ratio alto
    const highEngagementTweets = tweets.filter(tweet => {
      const likes = parseInt(tweet.likes) || 0;
      const retweets = parseInt(tweet.retweets) || 0;
      return (likes + retweets) > 100;
    });
    
    if (highEngagementTweets.length > tweets.length * 0.1) {
      patterns.push('high_engagement_ratio');
      viralScore += 0.3;
    }
    
    // Patrón 2: Retweets superan likes (indicador de viralidad)
    const retweetDominantTweets = tweets.filter(tweet => {
      const likes = parseInt(tweet.likes) || 0;
      const retweets = parseInt(tweet.retweets) || 0;
      return retweets > likes && retweets > 10;
    });
    
    if (retweetDominantTweets.length > tweets.length * 0.05) {
      patterns.push('retweet_dominant');
      viralScore += 0.25;
    }
    
    // Patrón 3: Concentración temporal (muchos tweets en poco tiempo)
    const timeConcentration = this.analyzeTimeConcentration(tweets);
    if (timeConcentration > 0.7) {
      patterns.push('time_concentration');
      viralScore += 0.2;
    }
    
    // Patrón 4: Diversidad de usuarios
    const uniqueUsers = this.countUniqueUsers(tweets);
    const userDiversityRatio = uniqueUsers / tweets.length;
    if (userDiversityRatio > 0.8 && tweets.length > 10) {
      patterns.push('user_diversity');
      viralScore += 0.15;
    }
    
    // Patrón 5: Presencia de hashtags trending
    const hashtagDensity = this.calculateHashtagDensity(tweets);
    if (hashtagDensity > 0.3) {
      patterns.push('hashtag_trending');
      viralScore += 0.1;
    }
    
    return {
      isViral: viralScore > 0.5,
      viralScore: Math.min(1, viralScore),
      patterns: patterns,
      details: {
        highEngagementCount: highEngagementTweets.length,
        retweetDominantCount: retweetDominantTweets.length,
        timeConcentration: timeConcentration,
        userDiversityRatio: userDiversityRatio,
        hashtagDensity: hashtagDensity
      }
    };
  }

  /**
   * Analizar concentración temporal de tweets
   */
  analyzeTimeConcentration(tweets) {
    if (tweets.length < 2) return 0;
    
    const timestamps = tweets
      .filter(tweet => tweet.fecha_tweet)
      .map(tweet => new Date(tweet.fecha_tweet).getTime())
      .sort((a, b) => a - b);
    
    if (timestamps.length < 2) return 0;
    
    const totalTimeSpan = timestamps[timestamps.length - 1] - timestamps[0];
    const averageInterval = totalTimeSpan / (timestamps.length - 1);
    
    // Calcular desviación estándar de intervalos
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    
    const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - meanInterval, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Concentración alta = baja desviación relativa
    const coefficientOfVariation = standardDeviation / meanInterval;
    
    // Invertir y normalizar
    return Math.max(0, Math.min(1, 1 - (coefficientOfVariation / 2)));
  }

  /**
   * Contar usuarios únicos
   */
  countUniqueUsers(tweets) {
    const users = new Set();
    
    tweets.forEach(tweet => {
      if (tweet.usuario) {
        users.add(tweet.usuario.toLowerCase());
      } else if (tweet.author) {
        users.add(tweet.author.toLowerCase());
      }
    });
    
    return users.size;
  }

  /**
   * Calcular densidad de hashtags
   */
  calculateHashtagDensity(tweets) {
    if (tweets.length === 0) return 0;
    
    let totalHashtags = 0;
    let totalTweets = 0;
    
    tweets.forEach(tweet => {
      if (tweet.texto) {
        const hashtags = (tweet.texto.match(/#\w+/g) || []).length;
        totalHashtags += hashtags;
        totalTweets++;
      }
    });
    
    return totalTweets > 0 ? totalHashtags / totalTweets : 0;
  }

  /**
   * Analizar evolución temporal de una tendencia
   */
  analyzeTrendEvolution(tweets, intervalHours = 1) {
    if (!tweets || tweets.length === 0) return [];
    
    const timeWindows = this.groupTweetsByTimeWindows(tweets, intervalHours);
    
    return timeWindows.map((window, index) => {
      const windowDate = new Date(window.startTime);
      
      return {
        timestamp: windowDate.toISOString(),
        hour: windowDate.getHours(),
        tweetCount: window.tweets.length,
        totalEngagement: window.engagement,
        averageEngagement: window.tweets.length > 0 ? window.engagement / window.tweets.length : 0,
        momentum: index > 0 ? this.calculateWindowMomentum(timeWindows, index) : 0
      };
    });
  }

  /**
   * Calcular momentum de una ventana específica
   */
  calculateWindowMomentum(timeWindows, currentIndex) {
    if (currentIndex === 0) return 0;
    
    const current = timeWindows[currentIndex];
    const previous = timeWindows[currentIndex - 1];
    
    const currentActivity = current.tweets.length + (current.engagement / 10);
    const previousActivity = previous.tweets.length + (previous.engagement / 10);
    
    if (previousActivity === 0) return currentActivity > 0 ? 1 : 0;
    
    const change = (currentActivity - previousActivity) / previousActivity;
    
    // Normalizar entre -1 y 1
    return Math.max(-1, Math.min(1, change));
  }

  /**
   * Predecir próximo pico de actividad
   */
  predictNextPeak(tweets) {
    if (!tweets || tweets.length < 10) {
      return {
        predictedTime: null,
        confidence: 0,
        reasoning: 'Insuficientes datos para predicción'
      };
    }
    
    const evolution = this.analyzeTrendEvolution(tweets, 1);
    
    if (evolution.length < 5) {
      return {
        predictedTime: null,
        confidence: 0,
        reasoning: 'Histórico insuficiente para análisis de patrones'
      };
    }
    
    // Buscar patrones cíclicos en las horas
    const hourlyPattern = this.analyzeHourlyPatterns(evolution);
    const peakHours = this.identifyPeakHours(hourlyPattern);
    
    if (peakHours.length === 0) {
      return {
        predictedTime: null,
        confidence: 0,
        reasoning: 'No se detectaron patrones horarios consistentes'
      };
    }
    
    // Predecir próximo pico
    const now = new Date();
    const currentHour = now.getHours();
    
    let nextPeakHour = peakHours.find(hour => hour > currentHour);
    if (!nextPeakHour) {
      nextPeakHour = peakHours[0] + 24; // Próximo día
    }
    
    const predictedTime = new Date(now);
    predictedTime.setHours(nextPeakHour % 24, 0, 0, 0);
    
    if (nextPeakHour >= 24) {
      predictedTime.setDate(predictedTime.getDate() + 1);
    }
    
    // Calcular confianza basada en consistencia del patrón
    const confidence = this.calculatePatternConfidence(hourlyPattern);
    
    return {
      predictedTime: predictedTime.toISOString(),
      confidence: confidence,
      reasoning: `Patrón detectado en horas: ${peakHours.join(', ')}`,
      peakHours: peakHours
    };
  }

  /**
   * Analizar patrones horarios
   */
  analyzeHourlyPatterns(evolution) {
    const hourlyStats = new Array(24).fill(0).map(() => ({
      hour: 0,
      totalActivity: 0,
      occurrences: 0,
      averageActivity: 0
    }));
    
    evolution.forEach(window => {
      const hour = window.hour;
      const activity = window.tweetCount + (window.totalEngagement / 10);
      
      hourlyStats[hour].hour = hour;
      hourlyStats[hour].totalActivity += activity;
      hourlyStats[hour].occurrences++;
    });
    
    // Calcular promedios
    hourlyStats.forEach(stat => {
      if (stat.occurrences > 0) {
        stat.averageActivity = stat.totalActivity / stat.occurrences;
      }
    });
    
    return hourlyStats;
  }

  /**
   * Identificar horas pico
   */
  identifyPeakHours(hourlyPattern) {
    const activities = hourlyPattern.map(stat => stat.averageActivity);
    const maxActivity = Math.max(...activities);
    const threshold = maxActivity * 0.7; // 70% del máximo
    
    const peakHours = [];
    
    hourlyPattern.forEach(stat => {
      if (stat.averageActivity >= threshold && stat.occurrences >= 2) {
        peakHours.push(stat.hour);
      }
    });
    
    return peakHours.sort((a, b) => a - b);
  }

  /**
   * Calcular confianza del patrón
   */
  calculatePatternConfidence(hourlyPattern) {
    const validHours = hourlyPattern.filter(stat => stat.occurrences >= 2);
    
    if (validHours.length < 5) return 0.1;
    
    const activities = validHours.map(stat => stat.averageActivity);
    const mean = activities.reduce((sum, act) => sum + act, 0) / activities.length;
    const variance = activities.reduce((sum, act) => sum + Math.pow(act - mean, 2), 0) / activities.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;
    
    // Mayor variación = mayor confianza en patrones
    const variationConfidence = Math.min(1, coefficientOfVariation);
    
    // Más datos = mayor confianza
    const dataConfidence = Math.min(1, validHours.length / 24);
    
    return (variationConfidence + dataConfidence) / 2;
  }

  /**
   * Obtener resumen de trending
   */
  getTrendingSummary(tweets) {
    const viralAnalysis = this.detectViralPatterns(tweets);
    const momentum = this.calculateMomentum(tweets);
    const evolution = this.analyzeTrendEvolution(tweets);
    const prediction = this.predictNextPeak(tweets);
    
    return {
      momentum: momentum,
      isViral: viralAnalysis.isViral,
      viralScore: viralAnalysis.viralScore,
      viralPatterns: viralAnalysis.patterns,
      trendEvolution: evolution,
      peakPrediction: prediction,
      summary: {
        totalTweets: tweets.length,
        uniqueUsers: this.countUniqueUsers(tweets),
        averageEngagement: this.calculateAverageEngagement(tweets),
        hashtagDensity: this.calculateHashtagDensity(tweets),
        timeSpan: this.calculateTimeSpan(tweets)
      }
    };
  }

  /**
   * Calcular engagement promedio
   */
  calculateAverageEngagement(tweets) {
    if (tweets.length === 0) return 0;
    
    const totalEngagement = tweets.reduce((sum, tweet) => {
      return sum + (parseInt(tweet.likes) || 0) + (parseInt(tweet.retweets) || 0);
    }, 0);
    
    return totalEngagement / tweets.length;
  }

  /**
   * Calcular tiempo total cubierto
   */
  calculateTimeSpan(tweets) {
    if (tweets.length === 0) return 0;
    
    const timestamps = tweets
      .filter(tweet => tweet.fecha_tweet)
      .map(tweet => new Date(tweet.fecha_tweet).getTime());
    
    if (timestamps.length < 2) return 0;
    
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    return (maxTime - minTime) / (1000 * 60 * 60); // Horas
  }

  /**
   * Obtener estadísticas del motor
   */
  getStats() {
    return {
      name: 'TrendMonitoringEngine',
      capabilities: [
        'momentum_calculation',
        'viral_pattern_detection',
        'trend_evolution_analysis',
        'peak_prediction',
        'hourly_pattern_analysis',
        'engagement_analysis'
      ]
    };
  }
}

module.exports = {
  TrendMonitoringEngine
}; 