const express = require('express');
const router = express.Router();

// Import fetch for Node.js compatibility
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  // Fallback for Node.js 18+ that has native fetch
  fetch = global.fetch;
}

let AbortControllerCtor = global.AbortController;
if (!AbortControllerCtor) {
  try {
    // eslint-disable-next-line global-require
    AbortControllerCtor = require('abort-controller');
  } catch (error) {
    AbortControllerCtor = undefined;
  }
}

/**
 * ExtractorT service communication
 * Handles Instagram comment extraction by communicating with ExtractorT
 */

// Get ExtractorT URL from environment or use default
const EXTRACTOR_T_URL = process.env.EXTRACTOR_T_URL || process.env.EXTRACTORT_URL || 'http://localhost:8000';
const EXTRACTOR_T_TIMEOUT_MS = parseInt(process.env.EXTRACTOR_T_TIMEOUT_MS || process.env.EXTRACTORT_TIMEOUT_MS || '120000', 10);

console.log(`🔧 [Instagram] ExtractorT URL configured: ${EXTRACTOR_T_URL}`);
console.log(`🔧 [Instagram] ExtractorT timeout: ${EXTRACTOR_T_TIMEOUT_MS}ms`);

/**
 * Extract Instagram comments from a post URL
 * @param {string} url - Instagram post URL
 * @param {object} options - Extraction options
 * @returns {Promise<object>} - Comments data
 */
async function extractInstagramComments(url, options = {}) {
  try {
    const {
      includeReplies = true,
      maxComments = 100,
      sortBy = 'popular' // popular, newest, oldest
    } = options;

    console.log(`📱 [Instagram] Extracting comments from: ${url}`);
    console.log(`📡 [Instagram] Using ExtractorT at: ${EXTRACTOR_T_URL}`);

    const requestBody = {
      urls: [url], // ExtractorT expects urls array
      comment_limit: maxComments || 20,
      include_replies: includeReplies || false
    };

    console.log(`📤 [Instagram] Request body:`, JSON.stringify(requestBody, null, 2));

    // Call ExtractorT service (correct endpoint is /api/instagram_comment/)
    const controller = AbortControllerCtor ? new AbortControllerCtor() : null;
    const timeoutId = controller
      ? setTimeout(() => {
          controller.abort();
        }, EXTRACTOR_T_TIMEOUT_MS)
      : null;

    let response;

    try {
      response = await fetch(`${EXTRACTOR_T_URL}/api/instagram_comment/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ExtractorW/2.0 (Instagram Comments)',
          'Authorization': 'Bearer extractorw-auth-token' // Required by ExtractorT
        },
        body: JSON.stringify(requestBody),
        signal: controller ? controller.signal : undefined
      });
    } catch (fetchError) {
      if (controller && fetchError.name === 'AbortError') {
        throw new Error(`ExtractorT request timed out after ${EXTRACTOR_T_TIMEOUT_MS}ms`);
      }
      throw fetchError;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    if (!response.ok) {
      throw new Error(`ExtractorT responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform ExtractorT response to match mobile app expectations
    // ExtractorT returns: { status, message, results: [{ url, comments: [{ user, text, likes, ... }] }] }
    const allComments = [];
    let totalCount = 0;

    console.log(`📊 [Instagram] ExtractorT response status: ${data.status}`);
    console.log(`📊 [Instagram] ExtractorT response message: ${data.message}`);
    console.log(`📊 [Instagram] ExtractorT results count: ${data.results?.length || 0}`);

    if (data.results && data.results.length > 0) {
      const result = data.results[0]; // We only send one URL, so take first result
      totalCount = result.extracted_count || 0;

      console.log(`📊 [Instagram] Result extracted_count: ${result.extracted_count}`);
      console.log(`📊 [Instagram] Result comments array length: ${result.comments?.length || 0}`);

      const transformedComments = (result.comments || []).map((comment, index) => {
        console.log(`🔄 [Instagram] Transforming comment ${index + 1}: user="${comment.user}", text="${comment.text?.substring(0, 50)}..."`);

        return {
          id: `comment_${Date.now()}_${Math.random()}`,
          author: comment.user || comment.username || 'Unknown',
          text: comment.text || '',
          timestamp: comment.timestamp || Date.now(),
          likes: comment.likes || 0,
          verified: comment.is_verified || false,
          replies: [], // TODO: Handle replies if needed
          parentId: null
        };
      });

      console.log(`✅ [Instagram] Transformed ${transformedComments.length} comments successfully`);
      allComments.push(...transformedComments);
    } else {
      console.log(`❌ [Instagram] No results found in ExtractorT response. Full response:`, JSON.stringify(data, null, 2));
    }

    return {
      success: true,
      comments: allComments,
      totalCount: totalCount,
      metadata: {
        url,
        extractedAt: new Date().toISOString(),
        source: 'extractorT',
        extractorTStatus: data.status || 'unknown'
      }
    };

  } catch (error) {
    console.error('❌ [Instagram] Error extracting comments:', error);
    console.error('❌ [Instagram] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    });

    // Return structured error response
    return {
      success: false,
      comments: [],
      totalCount: 0,
      error: {
        message: error.message,
        code: 'EXTRACTION_FAILED',
        timestamp: new Date().toISOString(),
        details: {
          extractorTUrl: EXTRACTOR_T_URL,
          errorType: error.name
        }
      }
    };
  }
}

/**
 * POST /api/instagram/comments
 * Extract comments from Instagram post
 */
router.post('/comments', async (req, res) => {
  const startTime = Date.now();

  try {
    const { url, includeReplies, maxComments, sortBy } = req.body;

    // Validate request
    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'URL is required',
          code: 'MISSING_URL',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate Instagram URL
    if (!url.includes('instagram.com')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid Instagram URL',
          code: 'INVALID_URL',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Extract comments using ExtractorT
    const result = await extractInstagramComments(url, {
      includeReplies,
      maxComments,
      sortBy
    });

    const processingTime = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ [Instagram] Successfully extracted ${result.comments.length} comments in ${processingTime}ms`);

      res.json({
        ...result,
        processingTime: `${processingTime}ms`
      });
    } else {
      console.log(`❌ [Instagram] Failed to extract comments: ${result.error.message}`);

      res.status(500).json({
        ...result,
        processingTime: `${processingTime}ms`
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ [Instagram] Unexpected error:', error);

    res.status(500).json({
      success: false,
      comments: [],
      totalCount: 0,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      },
      processingTime: `${processingTime}ms`
    });
  }
});

/**
 * GET /api/instagram/health
 * Health check for Instagram services
 */
router.get('/health', async (req, res) => {
  try {
    // Check ExtractorT connectivity
    const response = await fetch(`${EXTRACTOR_T_URL}/health`, {
      method: 'GET',
      timeout: 5000
    });

    const extractorTHealthy = response.ok;

    res.json({
      status: 'healthy',
      services: {
        extractorT: {
          url: EXTRACTOR_T_URL,
          healthy: extractorTHealthy,
          status: extractorTHealthy ? 'online' : 'offline'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      services: {
        extractorT: {
          url: EXTRACTOR_T_URL,
          healthy: false,
          status: 'offline',
          error: error.message
        }
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/instagram/media
 * Lightweight wrapper to fetch media for an Instagram post via ExtractorT
 * Tries the enhanced media endpoint first, then falls back to legacy /download_media
 */
router.post('/media', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'URL is required', code: 'MISSING_URL', timestamp: new Date().toISOString() }
      });
    }

    if (!url.includes('instagram.com')) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid Instagram URL', code: 'INVALID_URL', timestamp: new Date().toISOString() }
      });
    }

    // Helper to safely fetch JSON with timeout
    const doFetch = async (endpoint, body, timeoutMs = 45000) => {
      const controller = AbortControllerCtor ? new AbortControllerCtor() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ExtractorW/2.0 (Instagram Media)',
            'Authorization': 'Bearer extractorw-auth-token',
          },
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined,
        });
        const ok = r.ok;
        let json = null;
        try { json = await r.json(); } catch (_) { json = null; }
        return { ok, status: r.status, json };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // First try: Enhanced media endpoint
    const enhancedEndpoint = `${EXTRACTOR_T_URL.replace(/\/$/, '')}/enhanced-media/instagram/process`;
    const enhancedBody = { url, save_to_codex: false, transcribe: false };
    let media = null;
    let triedEnhanced = false;
    try {
      const resp = await doFetch(enhancedEndpoint, enhancedBody, 45000);
      triedEnhanced = true;
      if (resp.ok && resp.json) {
        media = normalizeFromEnhanced(resp.json, url);
      }
    } catch (e) {
      // Continue to fallback
    }

    // Fallback: legacy download_media if enhanced failed or returned nothing useful
    if (!media || (!media.video_url && !(media.images && media.images.length))) {
      const legacyEndpoint = `${EXTRACTOR_T_URL.replace(/\/$/, '')}/download_media`;
      const legacyBody = { tweet_url: url, download_videos: true, download_images: true, quality: 'medium' };
      try {
        const legacyResp = await doFetch(legacyEndpoint, legacyBody, 45000);
        if (legacyResp.ok && legacyResp.json) {
          media = normalizeFromLegacy(legacyResp.json, url, EXTRACTOR_T_URL);
        }
      } catch (e) {
        // If both fail, propagate at the end
      }
    }

    if (!media) {
      return res.status(502).json({
        success: false,
        error: {
          message: 'Unable to fetch media from ExtractorT',
          code: triedEnhanced ? 'E_MEDIA_FALLBACK_FAILED' : 'E_MEDIA_ENHANCED_FAILED',
          extractorTUrl: EXTRACTOR_T_URL,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.json({ success: true, ...media });
  } catch (error) {
    console.error('❌ [Instagram] /media wrapper error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

function extractPostId(instagramUrl) {
  try {
    const { pathname } = new URL(instagramUrl);
    const parts = pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => ['p', 'reel', 'tv'].includes(p.toLowerCase()));
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    return parts[parts.length - 1] || '';
  } catch (_) {
    return '';
  }
}

function normalizeFromEnhanced(json, sourceUrl) {
  try {
    const files = Array.isArray(json.media_files) ? json.media_files : [];
    // Build absolute URLs for files; prefer HTTP(S). If we get a local path like /app/temp_media, build /media/:filename
    const base = String(EXTRACTOR_T_URL).replace(/\/$/, '');
    const toRemote = (f) => {
      let u = f.url || f.remote_url || f.public_url || f.media_url;
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) return u;
      if (typeof u === 'string' && u.startsWith('/media/')) return `${base}${u}`;
      // If only have a local path, try to construct from filename
      const filename = f.filename || (typeof f.path === 'string' ? f.path.split('/').pop() : undefined) || (typeof f.filepath === 'string' ? f.filepath.split('/').pop() : undefined);
      if (filename) return `${base}/media/${encodeURIComponent(filename)}`;
      return null;
    };

    const normalizedFiles = files.map((f) => ({ ...f, _remoteUrl: toRemote(f) })).filter((f) => !!f._remoteUrl);
    const images = normalizedFiles.filter((f) => (String(f.type || '')).toLowerCase() === 'image');
    const videos = normalizedFiles.filter((f) => (String(f.type || '')).toLowerCase() === 'video');
    const postId = extractPostId(sourceUrl);
    let type = 'unknown';
    if (videos.length) type = 'video';
    else if (images.length > 1) type = 'carousel';
    else if (images.length === 1) type = 'image';
    const firstVideo = videos[0];
    return {
      post_id: postId,
      type,
      video_url: firstVideo?._remoteUrl || undefined,
      audio_url: json.transcription?.audio_url || undefined,
      images: images.map((i) => i._remoteUrl).slice(0, 3),
      thumbnail_url: json.content?.thumbnail || json.thumbnail_url || undefined,
      duration: firstVideo?.duration || undefined,
      caption: json.content?.caption || json.content?.description || undefined,
    };
  } catch (_) {
    return null;
  }
}

function normalizeFromLegacy(json, sourceUrl, baseUrl) {
  try {
    const files = (json.data?.downloaded_files || json.downloaded_files || []).map((f) => {
      let url = f.url;
      if (url && url.startsWith('/media/')) {
        url = `${String(baseUrl).replace(/\/$/, '')}${url}`;
      }
      return { ...f, url };
    });
    const images = files.filter((f) => (f.type || '').toLowerCase() === 'image');
    const videos = files.filter((f) => (f.type || '').toLowerCase() === 'video');
    const postId = extractPostId(sourceUrl);
    let type = 'unknown';
    if (videos.length) type = 'video';
    else if (images.length > 1) type = 'carousel';
    else if (images.length === 1) type = 'image';
    const firstVideo = videos[0];
    return {
      post_id: postId,
      type,
      video_url: firstVideo?.url || undefined,
      images: images.map((i) => i.url).slice(0, 3),
      thumbnail_url: undefined,
      duration: undefined,
      caption: undefined,
    };
  } catch (_) {
    return null;
  }
}

module.exports = router;
