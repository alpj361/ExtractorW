const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { processNitterComment } = require('../services/nitterComment');
const { extractTweetComments } = require('../services/tweetComments');

// POST /api/nitter-comment
router.post('/nitter-comment', verifyUserAccess, async (req, res) => {
  try {
    const { urls, reply_limit = 20, tweet_id, session_id } = req.body || {};

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, error: 'El parámetro "urls" es requerido (lista no vacía).' });
    }

    // Extraer y guardar en Supabase (si se provee tweet_id, resolver scrape y persistir)
    if (tweet_id) {
      const userId = req.user.id;
      const saveResult = await extractTweetComments(String(tweet_id), urls[0], userId, session_id);
      if (!saveResult.success) return res.status(502).json(saveResult);
      return res.json({ success: true, saved: saveResult.saved || 0 });
    }

    // Proxy simple si no se requiere persistencia
    const result = await processNitterComment(urls, parseInt(reply_limit));
    if (result.success) return res.json({ success: true, data: result.data });
    return res.status(502).json({ success: false, error: result.error });
  } catch (error) {
    console.error('Error en /nitter-comment:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

module.exports = router;

