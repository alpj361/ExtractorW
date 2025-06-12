/**
 * Detecta una categoría basada en palabras clave presentes en el nombre de la tendencia
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} context - Contexto adicional (opcional)
 * @returns {string} - Categoría detectada
 */
function detectarCategoria(trendName, context = '') {
  const text = (trendName + ' ' + context).toLowerCase();
  
  const categorias = {
    'Política': ['presidente', 'congreso', 'gobierno', 'ministro', 'alcalde', 'elección', 'política', 'giammattei', 'aguirre', 'diputado'],
    'Deportes': ['fútbol', 'liga', 'serie a', 'napoli', 'mctominay', 'deporte', 'equipo', 'partido', 'futbol', 'uefa', 'champions', 'jugador', 'futbolista', 'retiro', 'transferencia', 'lukita'],
    'Música': ['cantante', 'banda', 'concierto', 'música', 'morat', 'álbum', 'canción', 'pop', 'rock'],
    'Entretenimiento': ['actor', 'película', 'serie', 'tv', 'famoso', 'celebridad', 'lilo', 'disney', 'cine', 'estreno'],
    'Justicia': ['corte', 'juez', 'tribunal', 'legal', 'derecho', 'satterthwaite', 'onu', 'derechos humanos'],
    'Sociedad': ['comunidad', 'social', 'cultural', 'santa maría', 'jesús', 'municipio', 'tradición'],
    'Internacional': ['mundial', 'internacional', 'global', 'extranjero', 'europa', 'italia'],
    'Religión': ['iglesia', 'religioso', 'santo', 'santa', 'dios', 'jesús', 'maría']
  };

  for (const [categoria, palabras] of Object.entries(categorias)) {
    if (palabras.some(palabra => text.includes(palabra))) {
      return categoria;
    }
  }

  return 'Otros';
}

module.exports = {
  detectarCategoria
}; 