const supabase = require('../utils/supabase');
const { processNitterComment } = require('./nitterComment');

// Obtiene comentarios guardados para un tweet/scrape
async function getTweetComments(tweetId, userId) {
  try {
    const actualScrapeId = await resolveScrapeId(tweetId, userId);
    if (!actualScrapeId) {
      return { success: true, comments: [], count: 0 };
    }

    const { data: comments, error } = await supabase
      .from('tweet_comments')
      .select('*')
      .eq('parent_tweet_id', actualScrapeId)
      .eq('user_id', userId)
      .order('extracted_at', { ascending: true });

    if (error) throw new Error('Error obteniendo comentarios: ' + error.message);

    return { success: true, comments: comments || [], count: comments ? comments.length : 0 };
  } catch (error) {
    console.error('Error en getTweetComments:', error);
    return { success: false, error: error.message, comments: [], count: 0 };
  }
}

// Elimina comentarios guardados
async function deleteTweetComments(tweetId, userId) {
  try {
    const actualScrapeId = await resolveScrapeId(tweetId, userId);
    if (!actualScrapeId) {
      return { success: true, message: 'No se encontraron comentarios para eliminar' };
    }

    const { error } = await supabase
      .from('tweet_comments')
      .delete()
      .eq('parent_tweet_id', actualScrapeId)
      .eq('user_id', userId);

    if (error) throw new Error('Error eliminando comentarios: ' + error.message);

    return { success: true, message: 'Comentarios eliminados exitosamente' };
  } catch (error) {
    console.error('Error en deleteTweetComments:', error);
    return { success: false, error: error.message };
  }
}

// Resuelve UUID del scrape desde un tweetId (puede ser numérico o UUID)
async function resolveScrapeId(tweetId, userId) {
  try {
    // Si ya es UUID (tiene guiones)
    if (typeof tweetId === 'string' && tweetId.includes('-')) return tweetId;

    // Buscar por tweet_id directo en recent_scrapes
    const { data: directMatch } = await supabase
      .from('recent_scrapes')
      .select('id')
      .eq('tweet_id', tweetId)
      .eq('user_id', userId)
      .maybeSingle();

    if (directMatch && directMatch.id) return directMatch.id;

    // Buscar dentro del JSONB tweets
    const { data: jsonbMatches } = await supabase
      .from('recent_scrapes')
      .select('id, tweets')
      .eq('user_id', userId);

    if (Array.isArray(jsonbMatches)) {
      for (const row of jsonbMatches) {
        if (Array.isArray(row.tweets) && row.tweets.some(t => String(t.tweet_id) === String(tweetId))) {
          return row.id;
        }
      }
    }
  } catch (e) {
    console.warn('resolveScrapeId warning:', e.message);
  }
  return null;
}

module.exports = { getTweetComments, deleteTweetComments };
/**
 * Extrae comentarios vía ExtractorT y los guarda en Supabase
 */
async function extractTweetComments(tweetId, tweetUrl, userId, sessionId = null) {
  try {
    const actualScrapeId = await resolveScrapeId(tweetId, userId);
    if (!actualScrapeId) throw new Error('Scrape no encontrado para el tweet especificado');

    // Determinar URL final
    let finalUrl = tweetUrl;
    if (!finalUrl) {
      // Buscar dentro del scrape para construir URL
      const { data: scrape } = await supabase
        .from('recent_scrapes')
        .select('tweets, usuario')
        .eq('id', actualScrapeId)
        .maybeSingle();

      if (scrape) {
        if (Array.isArray(scrape.tweets) && scrape.tweets.length > 0) {
          let target = scrape.tweets[0];
          if (tweetId && !String(tweetId).includes('-')) {
            const found = scrape.tweets.find(t => String(t.tweet_id) === String(tweetId));
            if (found) target = found;
          }
          if (target?.enlace) finalUrl = target.enlace;
          else if (target?.usuario && target?.tweet_id) finalUrl = `https://x.com/${String(target.usuario).replace('@','')}/status/${target.tweet_id}`;
        }
      }
    }

    if (!finalUrl) throw new Error('No se pudo determinar la URL del tweet para extraer comentarios');

    // Llamar a ExtractorT
    const result = await processNitterComment([finalUrl], 20);
    if (!result.success || !result.data || !result.data.results || result.data.results.length === 0) {
      throw new Error(result.error || 'Fallo al extraer comentarios');
    }

    const r = result.data.results[0];
    const comments = Array.isArray(r.comments) ? r.comments : [];

    if (comments.length === 0) {
      return { success: true, message: 'Sin comentarios encontrados', saved: 0 };
    }

    const rows = comments.map(c => ({
      parent_tweet_id: actualScrapeId,
      parent_tweet_url: finalUrl,
      comment_user: c.user,
      comment_text: c.text,
      comment_likes: c.likes || 0,
      original_likes: r.likes || 0,
      original_replies: r.replies || 0,
      original_reposts: r.reposts || 0,
      original_views: r.views || 0,
      user_id: userId,
      session_id: sessionId || `comment_session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    }));

    const { data: saved, error: saveError } = await supabase
      .from('tweet_comments')
      .insert(rows)
      .select();

    if (saveError) throw new Error('Error guardando comentarios: ' + saveError.message);

    return { success: true, saved: saved?.length || 0 };
  } catch (error) {
    console.error('extractTweetComments error:', error);
    return { success: false, error: error.message };
  }
}

module.exports.extractTweetComments = extractTweetComments;

