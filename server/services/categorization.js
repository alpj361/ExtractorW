/**
 * Detecta una categoría basada en palabras clave presentes en el nombre de la tendencia
 * @param {string} trendName - Nombre de la tendencia
 * @param {string} context - Contexto adicional (opcional)
 * @returns {string} - Categoría detectada
 */
function detectarCategoria(trendName, context = '') {
  const text = (trendName + ' ' + context).toLowerCase();
  
  const categorias = {
    'Política': [
      'presidente', 'congreso', 'gobierno', 'ministro', 'alcalde', 'elección', 'política',
      'giammattei', 'aguirre', 'diputado', 'gobernador', 'senador', 'fiscal', 'estado',
      'campaña', 'candidato', 'voto', 'electoral', 'democracia', 'constitución', 'parlamento',
      'legislativo', 'ejecutivo', 'judicial', 'oposición', 'oficialismo', 'partido'
    ],
    'Deportes': [
      'fútbol', 'liga', 'serie a', 'napoli', 'mctominay', 'deporte', 'equipo', 'partido',
      'futbol', 'uefa', 'champions', 'jugador', 'futbolista', 'retiro', 'transferencia',
      'lukita', 'gol', 'estadio', 'copa', 'torneo', 'campeonato', 'mundial', 'atleta',
      'deportivo', 'club', 'premier', 'laliga', 'bundesliga', 'nba', 'mlb', 'tenis',
      'basquet', 'basket', 'baloncesto', 'béisbol', 'baseball', 'atletismo'
    ],
    'Música': [
      'cantante', 'banda', 'concierto', 'música', 'morat', 'álbum', 'canción', 'pop',
      'rock', 'artista', 'tour', 'gira', 'festival', 'spotify', 'single', 'lanzamiento',
      'disco', 'rap', 'reggaeton', 'hip hop', 'musical', 'dj', 'remix', 'feat',
      'ft', 'colaboración', 'videoclip', 'mv', 'música nueva', 'estreno musical'
    ],
    'Entretenimiento': [
      'actor', 'película', 'serie', 'tv', 'famoso', 'celebridad', 'lilo', 'disney',
      'cine', 'estreno', 'hollywood', 'netflix', 'prime', 'hbo', 'show', 'reality',
      'programa', 'temporada', 'episodio', 'premiere', 'trailer', 'drama', 'comedia',
      'película nueva', 'serie nueva', 'estrella', 'alfombra roja', 'oscar', 'emmy',
      'grammy', 'teatro', 'youtuber', 'influencer', 'viral', 'meme'
    ],
    'Justicia': [
      'corte', 'juez', 'tribunal', 'legal', 'derecho', 'satterthwaite', 'onu',
      'derechos humanos', 'justicia', 'fiscal', 'abogado', 'caso', 'sentencia',
      'juicio', 'demanda', 'denuncia', 'investigación', 'arresto', 'detención',
      'constitucional', 'suprema', 'apelación', 'audiencia', 'proceso'
    ],
    'Sociedad': [
      'comunidad', 'social', 'cultural', 'santa maría', 'jesús', 'municipio',
      'tradición', 'sociedad', 'pueblo', 'ciudad', 'barrio', 'vecinos', 'manifestación',
      'protesta', 'marcha', 'movimiento', 'activista', 'organización', 'ong',
      'fundación', 'caridad', 'voluntario', 'ayuda', 'solidaridad'
    ],
    'Internacional': [
      'mundial', 'internacional', 'global', 'extranjero', 'europa', 'italia',
      'estados unidos', 'usa', 'china', 'rusia', 'onu', 'otan', 'unión europea',
      'asia', 'áfrica', 'medio oriente', 'latinoamérica', 'américa latina',
      'brexit', 'cumbre', 'guerra', 'paz', 'tratado', 'acuerdo', 'diplomacia'
    ],
    'Religión': [
      'iglesia', 'religioso', 'santo', 'santa', 'dios', 'jesús', 'maría',
      'papa', 'vaticano', 'católico', 'cristiano', 'evangélico', 'misa',
      'oración', 'fe', 'biblia', 'pastor', 'sacerdote', 'templo', 'mezquita',
      'sinagoga', 'religión', 'espiritual', 'bendición'
    ],
    'Economía': [
      'economía', 'finanzas', 'banco', 'bolsa', 'mercado', 'dólar', 'euro',
      'quetzal', 'inversión', 'empresa', 'negocio', 'comercio', 'industria',
      'empleo', 'trabajo', 'crisis', 'inflación', 'precio', 'impuesto',
      'presupuesto', 'deuda', 'préstamo', 'financiero'
    ],
    'Tecnología': [
      'tecnología', 'tech', 'apple', 'google', 'microsoft', 'android', 'ios',
      'app', 'software', 'hardware', 'internet', 'web', 'digital', 'cyber',
      'hacker', 'programación', 'ia', 'inteligencia artificial', 'robot',
      'virtual', 'innovación', 'startup', 'blockchain', 'crypto'
    ],
    'Salud': [
      'salud', 'hospital', 'médico', 'doctor', 'enfermedad', 'virus',
      'pandemia', 'vacuna', 'medicina', 'tratamiento', 'emergencia',
      'clínica', 'paciente', 'síntoma', 'diagnóstico', 'covid',
      'coronavirus', 'epidemia', 'sanitario', 'bienestar'
    ]
  };

  // Primero intentamos encontrar una coincidencia exacta
  for (const [categoria, palabras] of Object.entries(categorias)) {
    if (palabras.some(palabra => text === palabra)) {
      return categoria;
    }
  }

  // Si no hay coincidencia exacta, buscamos coincidencias parciales
  for (const [categoria, palabras] of Object.entries(categorias)) {
    if (palabras.some(palabra => text.includes(palabra))) {
      return categoria;
    }
  }

  // Si el texto contiene números o símbolos especiales, podría ser una tendencia de redes sociales
  if (text.match(/[0-9#@]/)) {
    // Intentamos categorizar basados en el contexto
    const contextLower = context.toLowerCase();
    for (const [categoria, palabras] of Object.entries(categorias)) {
      if (palabras.some(palabra => contextLower.includes(palabra))) {
        return categoria;
      }
    }
  }

  return 'Otros';
}

module.exports = {
  detectarCategoria
}; 