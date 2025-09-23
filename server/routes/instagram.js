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

/**
 * ExtractorT service communication
 * Handles Instagram comment extraction by communicating with ExtractorT
 */

// Get ExtractorT URL from environment or use default
const EXTRACTOR_T_URL = process.env.EXTRACTOR_T_URL || process.env.EXTRACTORT_URL || 'http://localhost:8000';

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

    // Call ExtractorT service (correct endpoint is /api/instagram_comment/)
    const response = await fetch(`${EXTRACTOR_T_URL}/api/instagram_comment/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ExtractorW/2.0 (Instagram Comments)',
        'Authorization': 'Bearer extractorw-auth-token' // Required by ExtractorT
      },
      body: JSON.stringify({
        urls: [url], // ExtractorT expects urls array
        comment_limit: maxComments || 20,
        include_replies: includeReplies || false
      }),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`ExtractorT responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform ExtractorT response to match mobile app expectations
    // ExtractorT returns: { status, message, results: [{ url, comments: [{ user, text, likes, ... }] }] }
    const allComments = [];
    let totalCount = 0;

    if (data.results && data.results.length > 0) {
      const result = data.results[0]; // We only send one URL, so take first result
      totalCount = result.extracted_count || 0;

      const transformedComments = (result.comments || []).map(comment => ({
        id: `comment_${Date.now()}_${Math.random()}`,
        author: comment.user || comment.username || 'Unknown',
        text: comment.text || '',
        timestamp: comment.timestamp || Date.now(),
        likes: comment.likes || 0,
        verified: comment.is_verified || false,
        replies: [], // TODO: Handle replies if needed
        parentId: null
      }));

      allComments.push(...transformedComments);
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

    // Return structured error response
    return {
      success: false,
      comments: [],
      totalCount: 0,
      error: {
        message: error.message,
        code: 'EXTRACTION_FAILED',
        timestamp: new Date().toISOString()
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

module.exports = router;