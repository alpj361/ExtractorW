const express = require('express');
const router = express.Router();
const { verifyUserAccess } = require('../middlewares/auth');
const { getTweetComments, deleteTweetComments } = require('../services/tweetComments');

// GET /api/tweet-comments/:tweet_id
router.get('/:tweet_id', verifyUserAccess, async (req, res) => {
  try {
    const { tweet_id } = req.params;
    const userId = req.user.id;
    if (!tweet_id) return res.status(400).json({ success: false, error: 'tweet_id es requerido' });
    const result = await getTweetComments(tweet_id, userId);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Error en GET /tweet-comments/:tweet_id:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// DELETE /api/tweet-comments/:tweet_id
router.delete('/:tweet_id', verifyUserAccess, async (req, res) => {
  try {
    const { tweet_id } = req.params;
    const userId = req.user.id;
    if (!tweet_id) return res.status(400).json({ success: false, error: 'tweet_id es requerido' });
    const result = await deleteTweetComments(tweet_id, userId);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Error en DELETE /tweet-comments/:tweet_id:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

module.exports = router;

