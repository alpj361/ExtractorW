const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { verifyUserAccess } = require('../middlewares/auth');
const knowledgeService = require('../services/publicKnowledge');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// POST /api/knowledge/upload - multipart
router.post('/upload', verifyUserAccess, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo requerido en campo "file"' });
    }

    const { originalname, mimetype, buffer } = req.file;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const { tags = '', source_url = null, title = null } = req.body || {};
    const parsedTags = typeof tags === 'string' && tags.length > 0 ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const result = await knowledgeService.ingestDocument({
      fileName: originalname,
      mimeType: mimetype,
      fileBuffer: buffer,
      fileHash: sha256,
      sourceUrl: source_url || null,
      titleOverride: title || null,
      tags: parsedTags,
      user: req.user
    });

    return res.json({ success: true, document_id: result.documentId, chunks: result.chunkCount, pages: result.pages });
  } catch (error) {
    console.error('[KNOWLEDGE] upload error:', error);
    return res.status(500).json({ error: 'Error procesando documento', message: error.message });
  }
});

// POST /api/knowledge/search
router.post('/search', verifyUserAccess, async (req, res) => {
  try {
    const { query, top_k = 8, filters = {}, rerank = true } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query requerido' });
    }

    const results = await knowledgeService.searchKnowledge({ query, topK: Number(top_k) || 8, filters, rerank: !!rerank });
    return res.json({ success: true, results });
  } catch (error) {
    console.error('[KNOWLEDGE] search error:', error);
    return res.status(500).json({ error: 'Error buscando en conocimiento', message: error.message });
  }
});

module.exports = router;

// GET /api/knowledge/documents
router.get('/documents', verifyUserAccess, async (req, res) => {
  try {
    const { limit = '20', offset = '0', q = '' } = req.query || {};
    const docs = await knowledgeService.listDocuments({ limit: Number(limit), offset: Number(offset), q });
    return res.json({ success: true, documents: docs });
  } catch (error) {
    console.error('[KNOWLEDGE] list documents error:', error);
    return res.status(500).json({ error: 'Error listando documentos', message: error.message });
  }
});

