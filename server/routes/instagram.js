const express = require('express');
const router = express.Router();

/**
 * ExtractorT service communication
 * Handles Instagram comment extraction by communicating with ExtractorT
 */

// Get ExtractorT URL from environment or use default
const EXTRACTOR_T_URL = process.env.EXTRACTORT_URL || 'http://localhost:8000';

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

    // Call ExtractorT service
    const response = await fetch(`${EXTRACTOR_T_URL}/api/instagram/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ExtractorW/2.0 (Instagram Comments)'
      },
      body: JSON.stringify({
        url,
        includeReplies,
        maxComments,
        sortBy,
        source: 'extractorw'
      }),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`ExtractorT responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform ExtractorT response to match mobile app expectations
    const transformedComments = (data.comments || []).map(comment => ({
      id: comment.id || `comment_${Date.now()}_${Math.random()}`,
      author: comment.author || comment.username || 'Unknown',
      text: comment.text || comment.content || '',
      timestamp: comment.timestamp || comment.created_at || Date.now(),
      likes: comment.likes || comment.like_count || 0,
      verified: comment.verified || comment.is_verified || false,
      replies: comment.replies ? comment.replies.map(reply => ({
        id: reply.id || `reply_${Date.now()}_${Math.random()}`,
        author: reply.author || reply.username || 'Unknown',
        text: reply.text || reply.content || '',
        timestamp: reply.timestamp || reply.created_at || Date.now(),
        likes: reply.likes || reply.like_count || 0,
        verified: reply.verified || reply.is_verified || false,
        parentId: comment.id
      })) : [],
      parentId: comment.parent_id || null
    }));

    return {
      success: true,
      comments: transformedComments,
      totalCount: data.total_count || data.count || transformedComments.length,
      metadata: {
        url,
        extractedAt: new Date().toISOString(),
        source: 'extractorT',
        processingTime: data.processing_time || null
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