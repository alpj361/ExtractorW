// Servicio para proxy de nitter_comment hacia ExtractorT
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  fetch = global.fetch;
}

function getExtractorTUrl() {
  if (process.env.EXTRACTOR_T_URL) return process.env.EXTRACTOR_T_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction
    ? (process.env.EXTRACTORT_URL || 'https://api.standatpd.com')
    : (process.env.EXTRACTORT_LOCAL_URL || 'http://127.0.0.1:8000');
}

const EXTRACTOR_T_URL = getExtractorTUrl();

async function processNitterComment(urls = [], replyLimit = 20) {
  try {
    if (!Array.isArray(urls) || urls.length === 0) {
      return { success: false, error: 'urls debe ser una lista no vacía' };
    }

    const endpoint = `${EXTRACTOR_T_URL}/api/nitter_comment/`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, reply_limit: replyLimit })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`ExtractorT error: ${resp.status} ${resp.statusText} - ${text}`);
    }

    const data = await resp.json();
    if (data.status !== 'success') {
      return { success: false, error: data.message || 'Fallo al extraer comentarios' };
    }

    return { success: true, data };
  } catch (e) {
    console.error('processNitterComment error:', e);
    return { success: false, error: e.message };
  }
}

module.exports = { processNitterComment };

