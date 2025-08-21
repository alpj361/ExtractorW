const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');

// GET /api/knowledge/documents
router.get('/documents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pk_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ documents: data || [] });
  } catch (err) {
    console.error('Knowledge documents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

