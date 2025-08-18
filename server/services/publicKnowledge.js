const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const Tesseract = require('tesseract.js');
const { createClient } = require('@supabase/supabase-js');
// Token estimator simple para evitar dependencia de gpt-3-encoder
function estimateTokens(text) { return Math.ceil((text || '').length / 4); }

// Supabase service (service role)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// estimateTokens ya definido arriba

async function extractText({ mimeType, buffer }) {
  if (mimeType.includes('pdf')) {
    const data = await pdfParse(buffer);
    return { text: data.text || '', pages: data.numpages || 0 };
  }
  if (mimeType.includes('word') || mimeType.includes('docx')) {
    const data = await mammoth.extractRawText({ buffer });
    return { text: data.value || '', pages: null };
  }
  if (mimeType.includes('html')) {
    const html = buffer.toString('utf8');
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    return { text: $('body').text(), pages: null };
  }
  if (mimeType.includes('text') || mimeType.includes('plain') || mimeType.includes('csv')) {
    return { text: buffer.toString('utf8'), pages: null };
  }
  // OCR fallback
  const { data: ocr } = await Tesseract.recognize(buffer, 'spa+eng');
  return { text: ocr.text || '', pages: null };
}

function normalizeText(raw) {
  const text = (raw || '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return text;
}

function chunkTextHybrid(text, opts = {}) {
  const maxTokens = opts.maxTokens || 1000; // 800–1200 target
  const overlap = opts.overlap || 160; // 120–200
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    const candidate = current ? current + '\n\n' + p : p;
    if (estimateTokens(candidate) <= maxTokens) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (estimateTokens(p) <= maxTokens) {
        current = p;
      } else {
        // split long paragraph by sentences
        const sentences = p.split(/(?<=[.!?])\s+/);
        let sBuf = '';
        for (const s of sentences) {
          const sc = sBuf ? sBuf + ' ' + s : s;
          if (estimateTokens(sc) <= maxTokens) sBuf = sc; else { if (sBuf) chunks.push(sBuf); sBuf = s; }
        }
        if (sBuf) current = sBuf; else current = '';
      }
    }
  }
  if (current) chunks.push(current);

  // add overlap
  if (overlap > 0 && chunks.length > 1) {
    const withOverlap = [];
    for (let i = 0; i < chunks.length; i++) {
      const prev = withOverlap.at(-1);
      if (!prev) { withOverlap.push(chunks[i]); continue; }
      const prevTail = prev.split(/\s+/).slice(-Math.ceil(overlap * 4)).join(' ');
      withOverlap.push((prevTail + ' ' + chunks[i]).trim());
    }
    return withOverlap.map((c, idx) => ({ content: c, chunk_index: idx, tokens: estimateTokens(c) }));
  }
  return chunks.map((c, idx) => ({ content: c, chunk_index: idx, tokens: estimateTokens(c) }));
}

async function embed(text) {
  // OpenAI text-embedding-3-large (3072d) excede ivfflat límite=2000. Usaremos text-embedding-3-small (1536d) por compatibilidad con pgvector index.
  // Si deseas usar 3-large, necesitarás cambiar a flat (sin ivfflat) o reducir dimensión.
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const input = (text || '').slice(0, 8000); // evitar textos muy largos
    const resp = await client.embeddings.create({ model: 'text-embedding-3-small', input });
    const arr = resp.data[0]?.embedding;
    if (Array.isArray(arr)) return arr.map(Number);
  } catch (e) {
    console.warn('[KNOWLEDGE] embedding error, fallback to null:', e.message);
  }
  return null;
}

async function upsertDocumentMeta({ title, sourceUrl, fileHash, mimetype, language, pages, tags }) {
  const { data, error } = await supabase
    .from('pk_documents')
    .upsert({
      file_sha256: fileHash,
      title,
      source_url: sourceUrl,
      mimetype,
      language,
      pages,
      tags,
      status: 'processed'
    }, { onConflict: 'file_sha256' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function insertChunks(documentId, chunks) {
  // Opcional: generar embedding por chunk (cuidado con costos). Aquí embebemos solo primeros N.
  const rows = [];
  for (const c of chunks) {
    let v = null;
    if (process.env.KNOWLEDGE_EMBED_ON_INGEST === 'true') {
      v = await embed(c.content);
    }
    rows.push({ document_id: documentId, section_id: null, chunk_index: c.chunk_index, content: c.content, tokens: c.tokens, embedding: v });
  }
  const { error } = await supabase.from('pk_chunks').insert(rows);
  if (error) throw error;
  return rows.length;
}

async function ingestDocument({ fileName, mimeType, fileBuffer, fileHash, sourceUrl, titleOverride, tags = [], user }) {
  const extracted = await extractText({ mimeType, buffer: fileBuffer });
  const normalized = normalizeText(extracted.text);
  const chunks = chunkTextHybrid(normalized);
  const documentId = await upsertDocumentMeta({
    title: titleOverride || (fileName || 'Documento sin título'),
    sourceUrl,
    fileHash,
    mimetype: mimeType,
    language: 'es',
    pages: extracted.pages || null,
    tags
  });
  const chunkCount = await insertChunks(documentId, chunks);
  return { documentId, chunkCount, pages: extracted.pages || null };
}

async function searchKnowledge({ query, topK = 8, filters = {}, rerank = true }) {
  // Usa la función SQL knowledge_search (vector + fallback)
  // Si hay embeddings, usa RPC de vector; si no, usa lexical fallback
  let data, error;
  if (process.env.KNOWLEDGE_USE_VECTOR === 'true') {
    const v = await embed(query);
    if (v && Array.isArray(v)) {
      ({ data, error } = await supabase.rpc('knowledge_search_emb', { qvec: v, top_k: topK }));
    }
  }
  if (!data) ({ data, error } = await supabase.rpc('knowledge_search', { q: query, top_k: topK }));
  if (error) throw error;
  return data || [];
}

module.exports = {
  ingestDocument,
  searchKnowledge,
  listDocuments
};

async function listDocuments({ limit = 20, offset = 0, q = '' } = {}) {
  let qb = supabase
    .from('pk_documents')
    .select('id, title, tags, status, pages, version, mimetype, source_url, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (q && q.length > 0) {
    qb = qb.ilike('title', `%${q}%`);
  }
  const { data, error } = await qb;
  if (error) throw error;
  return data || [];
}

