const { logUsage } = require('../services/logs');
const supabase = require('../utils/supabase');

// Costos por operación (en créditos)
const CREDIT_COSTS = {
  'processTrends': 3,
  'sondeo': { min: 15, max: 40 }, // Actualizado: 15-40 créditos según tamaño del contexto
  'create-document': { min: 2, max: 5 },
  'send-email': 0, // Gratis
  'trending-tweets': 0, // Gratis
  'test-email': 0 // Gratis (testing)
};

// Operaciones que NO requieren verificación de créditos
const FREE_OPERATIONS = [
  'send-email',
  'test-email',
  'trending-tweets',
  'health',
  'diagnostics',
  'searchTrendInfo',
  'analyzeTrendWithTweets',
  'processingStatus',
  'latestTrends',
  'credits/status',
  'credits/history',
  'credits/add'
];

/**
 * Calcula el costo en créditos para el endpoint de sondeo
 * El costo se basa en la cantidad de contexto proporcionado
 */
function calculateSondeoCost(contexto) {
  try {
    const costs = CREDIT_COSTS['sondeo'];
    
    // Si no hay contexto, usar el mínimo
    if (!contexto) {
      return costs.min;
    }
    
    // Calcular tamaño aproximado del contexto
    const contextoJSON = JSON.stringify(contexto);
    const contextoSize = contextoJSON.length;
    
    console.log(`📏 Tamaño del contexto para sondeo: ${contextoSize} caracteres`);
    
    // Escala de costos basada en tamaño:
    if (contextoSize < 2000) {
      return costs.min; // Contexto pequeño -> costo mínimo (15)
    } else if (contextoSize < 5000) {
      // Contexto pequeño-mediano -> 20-25 créditos
      const ratio = (contextoSize - 2000) / 3000;
      return Math.floor(costs.min + ratio * 10); // 15 + (0-10) = 15-25
    } else if (contextoSize < 10000) {
      // Contexto mediano -> 25-35 créditos
      const ratio = (contextoSize - 5000) / 5000;
      return Math.floor(25 + ratio * 10); // 25 + (0-10) = 25-35
    } else {
      return costs.max; // Contexto grande -> costo máximo (40)
    }
  } catch (error) {
    console.error('Error calculando costo de sondeo:', error);
    return CREDIT_COSTS['sondeo'].min; // Fallback al mínimo
  }
}

/**
 * Middleware para debitar créditos al usuario después de operación exitosa
 * Ahora maneja costos variables y se ejecuta después del procesamiento
 */
const debitCredits = async (req, res, next) => {
  // Solo ejecutar si la response fue exitosa
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(data) {
    handleCreditDebit.call(this, data, req, 'send');
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    handleCreditDebit.call(this, data, req, 'json');
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Función auxiliar para manejar el débito de créditos
 */
async function handleCreditDebit(data, req, responseType) {
  try {
    // Evitar doble registro cuando res.json llama internamente a res.send
    if (req.usage_logged) {
      return; // Ya se registró un log para esta petición
    }

    if (this.statusCode >= 200 && this.statusCode < 300) {
      const user = req.user;
      const operation = req.path.replace('/api/', '');

      // Verificar si la operación requiere créditos
      const isFreeOperation = FREE_OPERATIONS.some(freeOp => operation.includes(freeOp));
      
      if (isFreeOperation) {
        console.log(`🆓 Operación gratuita: ${operation}`);
        return;
      }

      // Calcular costo real basado en la respuesta según el endpoint
      let finalCost = 0;
      let tokensEstimados = 0;
      
      if (operation === 'sondeo') {
        // Para sondeos, usar el costo que se calculó en el endpoint
        // Si está disponible en req.calculatedCost, usarlo, sino usar el mínimo
        finalCost = req.calculatedCost || CREDIT_COSTS['sondeo'].min;
        
        // Estimar tokens usados si hay información disponible
        if (req.body && req.body.pregunta) {
          const promptSize = (req.body.pregunta?.length || 0) + 1000; // Estimación base
          tokensEstimados = Math.ceil(promptSize / 4); // ~4 caracteres por token
          
          console.log(`📊 Sondeo: Costo calculado ${finalCost} créditos, aprox. ${tokensEstimados} tokens`);
          
          // Guardar info de tokens en request para logs
          req.tokens_estimados = tokensEstimados;
        }
      } else {
        // Para otras operaciones, usar costo fijo
        const operationCost = CREDIT_COSTS[operation];
        if (typeof operationCost === 'object') {
          finalCost = operationCost.min;
        } else {
          finalCost = operationCost || 1;
        }
      }

      // SIEMPRE registrar log de uso (tanto para admin como usuarios normales)
      await logUsage(user, req.path, finalCost, req);

      // Marcar como registrado para evitar duplicado en llamadas subsecuentes dentro de la misma respuesta
      req.usage_logged = true;

      // Solo debitar créditos si NO es admin y la operación tiene costo
      if (user.profile.role !== 'admin' && finalCost > 0) {
        console.log(`💳 Debitando ${finalCost} créditos de ${user.profile.email}`);

        // Debitar créditos en la base de datos
        const { data: updateResult, error } = await supabase
          .from('profiles')
          .update({ credits: user.profile.credits - finalCost })
          .eq('id', user.id)
          .select('credits')
          .single();

        if (error) {
          console.error('❌ Error debitando créditos:', error);
        } else {
          console.log(`✅ Créditos debitados. Nuevo saldo: ${updateResult.credits}`);

          // Verificar si necesita alerta de créditos bajos
          if (updateResult.credits <= 10 && updateResult.credits > 0) {
            console.log(`⚠️  Alerta: Usuario ${user.profile.email} tiene ${updateResult.credits} créditos restantes`);
          }
        }
      } else if (user.profile.role === 'admin') {
        console.log(`👑 Admin ${user.profile.email} ejecutó ${req.path} - Log registrado, sin débito de créditos`);
      }
    }
  } catch (error) {
    console.error('❌ Error en handleCreditDebit:', error);
  }
}

/**
 * Middleware para verificar créditos ANTES de procesar (solo verificación)
 */
const checkCredits = async (req, res, next) => {
  try {
    const user = req.user;
    const operation = req.path.replace('/api/', '');
    
    // Verificar si la operación requiere créditos
    const isFreeOperation = FREE_OPERATIONS.some(freeOp => operation.includes(freeOp));
    
    if (isFreeOperation) {
      console.log(`🆓 Operación gratuita: ${operation}`);
      return next();
    }

    // Verificar si el usuario es admin (acceso ilimitado)
    if (user.profile.role === 'admin') {
      console.log(`👑 Usuario admin con acceso ilimitado: ${user.profile.email}`);
      return next();
    }

    // Calcular costo estimado para verificación
    let estimatedCost = 0;
    
    if (operation === 'sondeo') {
      // Para sondeos, usar el costo mínimo para verificación inicial
      // El costo real se calculará después de construir el contexto
      estimatedCost = CREDIT_COSTS['sondeo'].min;
    } else {
      const operationCost = CREDIT_COSTS[operation];
      if (typeof operationCost === 'object') {
        estimatedCost = operationCost.min;
      } else {
        estimatedCost = operationCost || 1;
      }
    }

    if (user.profile.credits < estimatedCost) {
      console.log(`💸 Créditos insuficientes para ${user.profile.email}: ${user.profile.credits} < ${estimatedCost}`);

      return res.status(402).json({
        error: 'Créditos insuficientes',
        message: `No tienes suficientes créditos para esta operación. Necesitas ${estimatedCost} créditos, tienes ${user.profile.credits}.`,
        credits_required: estimatedCost,
        credits_available: user.profile.credits,
        low_credits_alert: user.profile.credits <= 10
      });
    }

    console.log(`✅ Usuario autorizado: ${user.profile.email} (${user.profile.credits} créditos, costo estimado: ${estimatedCost})`);
    next();

  } catch (error) {
    console.error('❌ Error en checkCredits:', error);
    res.status(500).json({
      error: 'Error interno de verificación',
      message: 'Error verificando créditos de usuario'
    });
  }
};

/**
 * Función utilitaria para verificar créditos de manera programática
 */
async function checkCreditsFunction(userId, requiredCredits) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('credits, role')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Admin tiene acceso ilimitado
    if (profile.role === 'admin') {
      return {
        hasCredits: true,
        isAdmin: true,
        currentCredits: profile.credits
      };
    }

    return {
      hasCredits: profile.credits >= requiredCredits,
      isAdmin: false,
      currentCredits: profile.credits
    };
  } catch (error) {
    console.error('Error verificando créditos:', error);
    return {
      hasCredits: false,
      isAdmin: false,
      currentCredits: 0,
      error: error.message
    };
  }
}

/**
 * Función utilitaria para debitar créditos de manera programática
 */
async function debitCreditsFunction(userId, amount, operation, metadata = {}) {
  try {
    // Primero verificar si es admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits, role, email')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Admin no paga créditos, pero sí loggeamos
    if (profile.role === 'admin') {
      console.log(`👑 Admin ${profile.email} ejecutó ${operation} - No se debitan créditos`);
      
      // Registrar log sin débito
      await logUsage({ id: userId, profile }, operation, amount, { 
        body: metadata,
        path: operation 
      });
      
      return {
        success: true,
        newBalance: profile.credits,
        isAdmin: true
      };
    }

    // Debitar créditos del usuario normal
    const { data: updateResult, error: updateError } = await supabase
      .from('profiles')
      .update({ credits: profile.credits - amount })
      .eq('id', userId)
      .select('credits')
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log(`✅ ${amount} créditos debitados de ${profile.email}. Nuevo saldo: ${updateResult.credits}`);

    // Registrar log de uso
    await logUsage({ id: userId, profile }, operation, amount, { 
      body: metadata,
      path: operation 
    });

    return {
      success: true,
      newBalance: updateResult.credits,
      isAdmin: false
    };
  } catch (error) {
    console.error('Error debitando créditos:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  debitCredits,
  checkCredits,
  calculateSondeoCost,
  CREDIT_COSTS,
  FREE_OPERATIONS,
  checkCreditsFunction,
  debitCreditsFunction
}; 