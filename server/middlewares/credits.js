const { logUsage } = require('../services/logs');
const supabase = require('../utils/supabase');

/**
 * Middleware para debitar créditos al usuario antes de procesar la solicitud
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const debitCredits = async (req, res, next) => {
  try {
    const user = req.user;
    const operation = req.path.replace('/api/', '');
    
    // Definir costo por operación
    let credits = 0;
    
    switch (operation) {
      case 'sondeo':
        credits = 5;
        break;
      case 'processTrends':
        credits = 1;
        break;
      case 'document':
        credits = 10;
        break;
      default:
        credits = 1;
    }
    
    // Verificar si el usuario tiene suficientes créditos
    if (user.profile.credits < credits) {
      await logUsage(user, operation, 0, req);
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Créditos insuficientes',
        credits_required: credits,
        credits_available: user.profile.credits
      });
    }
    
    // Debitar créditos
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        credits: user.profile.credits - credits,
        last_operation: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error al debitar créditos:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error al procesar los créditos',
        details: error.message
      });
    }
    
    // Actualizar perfil en la solicitud
    req.user.profile = data;
    req.credits_used = credits;
    
    // Registrar uso
    await logUsage(user, operation, credits, req);
    
    // Marcar que ya se ha registrado el uso para evitar logs duplicados
    req.usage_logged = true;
    
    // Continuar con la solicitud
    next();
  } catch (error) {
    console.error('Error en debitCredits:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

module.exports = {
  debitCredits
}; 