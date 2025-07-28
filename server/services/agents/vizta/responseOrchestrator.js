/**
 * Orquestador de Respuestas para Vizta
 * Unifica y formatea respuestas de múltiples agentes en una experiencia coherente
 */

class ResponseOrchestrator {
  constructor(viztaAgent) {
    this.vizta = viztaAgent;
  }

  /**
   * Orquestar respuesta unificada desde múltiples resultados de agentes
   */
  async orchestrateResponse(agentResults, originalQuery, routingDecision, conversation) {
    console.log(`[RESPONSE_ORCH] 🎼 Orquestando respuesta de ${agentResults.length} resultados`);
    
    const orchestratedResponse = {
      agent: 'Vizta',
      originalQuery: originalQuery,
      success: false,
      unifiedResponse: '',
      agentContributions: [],
      metadata: {
        agentsInvolved: [],
        totalExecutionTime: 0,
        confidence: routingDecision.confidence,
        timestamp: new Date().toISOString()
      }
    };
    
    // Separar resultados exitosos y con errores
    const successfulResults = agentResults.filter(r => r.success);
    const failedResults = agentResults.filter(r => !r.success);
    
    // Procesar contribuciones de cada agente
    for (const result of successfulResults) {
      const contribution = await this.processAgentContribution(result, originalQuery);
      if (contribution) {
        orchestratedResponse.agentContributions.push(contribution);
        orchestratedResponse.metadata.agentsInvolved.push(result.agent);
        orchestratedResponse.metadata.totalExecutionTime += result.executionTime;
      }
    }
    
    // Generar respuesta unificada
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 AgentContributions count:`, orchestratedResponse.agentContributions.length);
    orchestratedResponse.agentContributions.forEach((contrib, i) => {
      console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Contribution ${i}:`, {
        agent: contrib.agent,
        contentType: contrib.contentType,
        processedContentLength: contrib.processedContent?.length || 0,
        hasProcessedContent: !!contrib.processedContent
      });
    });
    
    if (orchestratedResponse.agentContributions.length > 0) {
      orchestratedResponse.unifiedResponse = await this.generateUnifiedResponse(
        orchestratedResponse.agentContributions,
        originalQuery,
        routingDecision
      );
      // IMPORTANTE: Asignar también a processedContent para compatibilidad con Vizta
      orchestratedResponse.processedContent = orchestratedResponse.unifiedResponse;
      orchestratedResponse.success = true;
      
      console.log(`[RESPONSE_ORCH_DEBUG] ✅ UnifiedResponse generada - length:`, orchestratedResponse.unifiedResponse?.length || 0);
      console.log(`[RESPONSE_ORCH_DEBUG] ✅ ProcessedContent asignado - length:`, orchestratedResponse.processedContent?.length || 0);
    } else {
      orchestratedResponse.unifiedResponse = this.generateErrorResponse(failedResults, originalQuery);
      // IMPORTANTE: Asignar también a processedContent para compatibilidad con Vizta
      orchestratedResponse.processedContent = orchestratedResponse.unifiedResponse;
      orchestratedResponse.success = false;
    }
    
    // Agregar información de errores si los hay
    if (failedResults.length > 0) {
      orchestratedResponse.metadata.errors = failedResults.map(r => ({
        agent: r.agent,
        error: r.error,
        taskId: r.taskId
      }));
    }
    
    // Enriquecer con contexto conversacional
    orchestratedResponse.conversationalContext = this.extractConversationalContext(conversation);
    
    console.log(`[RESPONSE_ORCH] ✅ Respuesta orquestada exitosamente`);
    
    return orchestratedResponse;
  }

  /**
   * Procesar contribución individual de un agente
   */
  async processAgentContribution(agentResult, originalQuery) {
    console.log(`[RESPONSE_ORCH_DEBUG] 🔧 Procesando contribución de ${agentResult.agent}`);
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 AgentResult keys:`, Object.keys(agentResult));
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 AgentResult.data keys:`, agentResult.data ? Object.keys(agentResult.data) : 'NO DATA');
    
    const contribution = {
      agent: agentResult.agent,
      taskId: agentResult.taskId,
      executionTime: agentResult.executionTime,
      contentType: 'unknown',
      processedContent: '',
      rawData: agentResult.data,
      confidence: 1.0
    };
    
    try {
      console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Comparing agentResult.agent: "${agentResult.agent}" === "laura"?`, agentResult.agent === 'laura');
      console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Agent type:`, typeof agentResult.agent);
      console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Agent length:`, agentResult.agent?.length);
      
      if (agentResult.agent === 'laura' || agentResult.agent === 'Laura') {
        console.log(`[RESPONSE_ORCH_DEBUG] ✅ Detectado agente Laura, procesando...`);
        contribution.contentType = agentResult.data.analysis_type || 'social_analysis';
        contribution.processedContent = await this.processLauraContribution(agentResult.data, originalQuery);
        contribution.confidence = this.calculateLauraConfidence(agentResult.data);
        console.log(`[RESPONSE_ORCH_DEBUG] 📤 Processed content length:`, contribution.processedContent?.length || 0);
      } else if (agentResult.agent === 'robert' || agentResult.agent === 'Robert') {
        console.log(`[RESPONSE_ORCH_DEBUG] ✅ Detectado agente Robert, procesando...`);
        contribution.contentType = 'document_analysis';
        contribution.processedContent = await this.processRobertContribution(agentResult.data, originalQuery);
        contribution.confidence = this.calculateRobertConfidence(agentResult.data);
      } else {
        console.log(`[RESPONSE_ORCH_DEBUG] ❌ Agente no reconocido: "${agentResult.agent}"`);
      }
      
      return contribution;
      
    } catch (error) {
      console.error(`[RESPONSE_ORCH] ❌ Error procesando contribución de ${agentResult.agent}:`, error);
      return null;
    }
  }

  /**
   * Procesar contribución de Laura
   */
  async processLauraContribution(lauraData, originalQuery) {
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Laura data analysis_type:`, lauraData.analysis_type);
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Laura data keys:`, Object.keys(lauraData));
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Laura data completa:`, JSON.stringify(lauraData, null, 2));
    
    let processedContent = '';
    
    if (lauraData.analysis_type === 'profile') {
      console.log(`[RESPONSE_ORCH_DEBUG] ✅ Detected profile analysis - calling formatProfileAnalysis`);
      processedContent = this.formatProfileAnalysis(lauraData);
    } else if (lauraData.analysis_type === 'monitoring' || lauraData.analysis_type === 'trending') {
      processedContent = this.formatTrendingAnalysis(lauraData);
    } else {
      processedContent = this.formatGeneralLauraAnalysis(lauraData);
    }
    
    return processedContent;
  }

  /**
   * Procesar contribución de Robert
   */
  async processRobertContribution(robertData, originalQuery) {
    let processedContent = '';
    
    if (robertData.collection === 'user_projects') {
      processedContent = this.formatProjectsAnalysis(robertData);
    } else if (robertData.collection === 'codex_items') {
      processedContent = this.formatCodexAnalysis(robertData);
    } else {
      processedContent = this.formatGeneralRobertAnalysis(robertData);
    }
    
    return processedContent;
  }

  /**
   * Formatear análisis de perfil de Laura
   */
  formatProfileAnalysis(lauraData) {
    console.log(`[VIZTA_DEBUG] 📊 LauraData completa:`, JSON.stringify(lauraData, null, 2));
    
    const findings = lauraData.findings || {};
    const profile = findings.profile || {};
    const tweets = findings.tweets || [];
    const geminiAnalysis = findings.gemini_analysis;
    
    console.log(`[VIZTA_DEBUG] 🔍 Findings:`, JSON.stringify(findings, null, 2));
    console.log(`[VIZTA_DEBUG] 🔍 Gemini analysis:`, JSON.stringify(geminiAnalysis, null, 2));
    console.log(`[VIZTA_DEBUG] 📝 Tweets count:`, tweets.length);
    
    let content = '';
    
    // Si tenemos análisis conversacional de Gemini, usarlo como respuesta principal
    if (geminiAnalysis && geminiAnalysis.conversational_response) {
      content += `${geminiAnalysis.resumen_ejecutivo}\n\n`;
      
      // Agregar nota sobre dónde encontrar más detalles
      content += `💡 *Para ver los tweets individuales y más detalles, revisa la sección **Actividad** en la aplicación.*`;
      
      return content;
    }
    
    // Fallback al formato anterior si no hay análisis de Gemini
    if (profile.name) {
      content += `📊 **Perfil analizado: ${profile.name}**\n\n`;
    }
    
    if (tweets.length > 0) {
      content += `🐦 **Actividad reciente: ${tweets.length} tweets analizados**\n`;
      
      if (findings.sentiment !== undefined) {
        const sentimentText = this.formatSentiment(findings.sentiment);
        content += `😊 **Sentimiento general:** ${sentimentText}\n`;
      }
      
      if (findings.key_topics && findings.key_topics.length > 0) {
        content += `🔍 **Temas principales:** ${findings.key_topics.slice(0, 3).map(t => t.topic).join(', ')}\n`;
      }
      
      content += `\n**Tweets destacados:**\n`;
      tweets.slice(0, 3).forEach((tweet, index) => {
        content += `${index + 1}. ${tweet.fecha_tweet}: ${tweet.texto.substring(0, 100)}...\n`;
      });
    }
    
    if (lauraData.perplexity_context) {
      content += `\n🌐 **Contexto adicional:**\n${lauraData.perplexity_context.context?.substring(0, 200)}...\n`;
    }
    
    return content;
  }

  /**
   * Formatear análisis de tendencias de Laura
   */
  formatTrendingAnalysis(lauraData) {
    const findings = lauraData.findings || {};
    
    let content = `📈 **Análisis de tendencias**\n\n`;
    
    if (findings.mentions) {
      content += `📊 **Menciones encontradas:** ${findings.mentions}\n`;
    }
    
    if (findings.sentiment !== undefined) {
      const sentimentText = this.formatSentiment(findings.sentiment);
      content += `😊 **Sentimiento general:** ${sentimentText}\n`;
    }
    
    if (findings.momentum !== undefined) {
      const momentumText = findings.momentum > 0.7 ? 'Alto' : findings.momentum > 0.3 ? 'Medio' : 'Bajo';
      content += `⚡ **Momentum:** ${momentumText} (${(findings.momentum * 100).toFixed(1)}%)\n`;
    }
    
    if (findings.key_actors && findings.key_actors.length > 0) {
      content += `👥 **Actores clave:** ${findings.key_actors.slice(0, 3).map(a => a.name).join(', ')}\n`;
    }
    
    if (findings.relevance_assessment) {
      content += `🎯 **Relevancia:** ${findings.relevance_assessment}\n`;
    }
    
    if (findings.top_posts && findings.top_posts.length > 0) {
      content += `\n**Posts destacados:**\n`;
      findings.top_posts.slice(0, 2).forEach((post, index) => {
        content += `${index + 1}. ${post.texto?.substring(0, 120)}...\n`;
      });
    }
    
    return content;
  }

  /**
   * Formatear análisis general de Laura
   */
  formatGeneralLauraAnalysis(lauraData) {
    let content = `🔍 **Análisis de redes sociales**\n\n`;
    
    if (lauraData.findings) {
      content += `📊 **Hallazgos principales:**\n`;
      Object.entries(lauraData.findings).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          content += `• ${key}: ${value}\n`;
        }
      });
    }
    
    if (lauraData.context_note) {
      content += `\n💡 **Contexto:** ${lauraData.context_note}\n`;
    }
    
    return content;
  }

  /**
   * Formatear análisis de proyectos de Robert
   */
  formatProjectsAnalysis(robertData) {
    const files = robertData.files || [];
    
    let content = `📁 **Proyectos del usuario**\n\n`;
    
    if (files.length === 0) {
      content += `No se encontraron proyectos activos.\n`;
    } else {
      content += `📊 **${files.length} proyectos encontrados:**\n\n`;
      
      files.slice(0, 5).forEach((file, index) => {
        content += `${index + 1}. **${file.title}**\n`;
        if (file.summary) {
          content += `   ${file.summary}\n`;
        }
        if (file.metadata?.status) {
          content += `   Estado: ${file.metadata.status}\n`;
        }
        content += '\n';
      });
    }
    
    return content;
  }

  /**
   * Formatear análisis de codex de Robert
   */
  formatCodexAnalysis(robertData) {
    const files = robertData.files || [];
    
    let content = `📚 **Documentos del códex**\n\n`;
    
    if (files.length === 0) {
      content += `No se encontraron documentos relevantes.\n`;
    } else {
      content += `📊 **${files.length} documentos encontrados:**\n\n`;
      
      files.slice(0, 5).forEach((file, index) => {
        content += `${index + 1}. **${file.title}**\n`;
        if (file.summary) {
          content += `   ${file.summary}\n`;
        }
        if (file.type) {
          content += `   Tipo: ${file.type}\n`;
        }
        content += '\n';
      });
    }
    
    return content;
  }

  /**
   * Formatear análisis general de Robert
   */
  formatGeneralRobertAnalysis(robertData) {
    let content = `📋 **Análisis de documentos**\n\n`;
    
    if (robertData.metadata) {
      content += `📊 **Resumen:**\n`;
      content += `• Total de elementos: ${robertData.metadata.total_items || 0}\n`;
      content += `• Tiempo de procesamiento: ${robertData.metadata.processing_time || 0}ms\n`;
    }
    
    return content;
  }

  /**
   * Generar respuesta unificada desde múltiples contribuciones
   */
  async generateUnifiedResponse(contributions, originalQuery, routingDecision) {
    let unifiedResponse = '';
    
    // Headers eliminados para respuesta conversacional
    
    // Consolidar contenido por agente
    const lauraContributions = contributions.filter(c => c.agent === 'laura' || c.agent === 'Laura');
    const robertContributions = contributions.filter(c => c.agent === 'robert' || c.agent === 'Robert');
    
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 LauraContributions found:`, lauraContributions.length);
    console.log(`[RESPONSE_ORCH_DEBUG] 🔍 RobertContributions found:`, robertContributions.length);
    
    // Agregar contribuciones de Laura
    if (lauraContributions.length > 0) {
      lauraContributions.forEach((contribution, index) => {
        console.log(`[RESPONSE_ORCH_DEBUG] 🔍 Laura contribution ${index}:`, {
          agent: contribution.agent,
          contentLength: contribution.processedContent?.length || 0,
          hasContent: !!contribution.processedContent
        });
        unifiedResponse += contribution.processedContent + '\n';
      });
      console.log(`[RESPONSE_ORCH_DEBUG] ✅ UnifiedResponse after Laura - length:`, unifiedResponse.length);
    }
    
    // Agregar contribuciones de Robert
    if (robertContributions.length > 0) {
      if (lauraContributions.length > 0) {
        unifiedResponse += '\n---\n\n';
      }
      robertContributions.forEach(contribution => {
        unifiedResponse += contribution.processedContent + '\n';
      });
    }
    
    // Footer eliminado para respuesta conversacional
    
    return unifiedResponse;
  }

  /**
   * Generar respuesta de error
   */
  generateErrorResponse(failedResults, originalQuery) {
    let errorResponse = `❌ **Lo siento, hubo problemas procesando tu consulta**\n\n`;
    
    if (failedResults.length > 0) {
      errorResponse += `**Detalles técnicos:**\n`;
      failedResults.forEach((result, index) => {
        errorResponse += `${index + 1}. Error en ${result.agent}: ${result.error}\n`;
      });
      errorResponse += '\n';
    }
    
    errorResponse += `Por favor, intenta reformular tu consulta o contacta al soporte técnico.\n`;
    
    return errorResponse;
  }

  /**
   * Generar footer de respuesta con metadata
   */
  generateResponseFooter(contributions, routingDecision) {
    let footer = '\n---\n\n';
    
    footer += `🤖 **Agentes participantes:** ${contributions.map(c => c.agent).join(', ')}\n`;
    
    const totalTime = contributions.reduce((sum, c) => sum + c.executionTime, 0);
    footer += `⏱️ **Tiempo de procesamiento:** ${totalTime}ms\n`;
    
    const avgConfidence = contributions.reduce((sum, c) => sum + c.confidence, 0) / contributions.length;
    footer += `📊 **Confianza promedio:** ${(avgConfidence * 100).toFixed(1)}%\n`;
    
    return footer;
  }

  /**
   * Formatear sentimiento
   */
  formatSentiment(sentiment) {
    if (sentiment >= 0.5) return 'Muy positivo 😄';
    if (sentiment >= 0.1) return 'Positivo 😊';
    if (sentiment >= -0.1) return 'Neutral 😐';
    if (sentiment >= -0.5) return 'Negativo 😔';
    return 'Muy negativo 😞';
  }

  /**
   * Calcular confianza de Laura
   */
  calculateLauraConfidence(lauraData) {
    let confidence = 0.5; // Base
    
    if (lauraData.success) confidence += 0.3;
    if (lauraData.findings?.mentions > 0) confidence += 0.1;
    if (lauraData.findings?.relevance_assessment === 'alta') confidence += 0.1;
    if (lauraData.llm_reasoning) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  /**
   * Calcular confianza de Robert
   */
  calculateRobertConfidence(robertData) {
    let confidence = 0.5; // Base
    
    if (robertData.files && robertData.files.length > 0) confidence += 0.3;
    if (robertData.metadata?.total_items > 5) confidence += 0.1;
    if (robertData.metadata?.processing_time < 1000) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  /**
   * Extraer contexto conversacional
   */
  extractConversationalContext(conversation) {
    if (!conversation) return null;
    
    return {
      sessionId: conversation.sessionId,
      messageCount: conversation.messageCount || 1,
      topicsDiscussed: conversation.topics || [],
      lastAgentUsed: conversation.lastAgent || null
    };
  }

  /**
   * Obtener estadísticas del orquestador
   */
  getStats() {
    return {
      name: 'ResponseOrchestrator',
      capabilities: [
        'multi_agent_response_unification',
        'content_formatting',
        'error_handling',
        'confidence_calculation',
        'conversational_context_integration'
      ]
    };
  }
}

module.exports = {
  ResponseOrchestrator
}; 