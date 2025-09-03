const express = require('express');
const router = express.Router();

// Helper to build mobile deep link
function buildMobileRedirectUrl(params) {
  const scheme = process.env.MOBILE_REDIRECT_SCHEME || 'com.vibecode.app';
  const path = process.env.MOBILE_REDIRECT_PATH || 'oauth';
  const query = new URLSearchParams(params).toString();
  return `${scheme}://${path}?${query}`;
}

// Google OAuth redirect handler: HTTPS → deep link to the mobile app
router.get('/auth/google/callback', (req, res) => {
  try {
    const { code, state, scope, error, error_description } = req.query || {};

    if (error) {
      return res.status(400).send(`OAuth error: ${error}${error_description ? ' - ' + error_description : ''}`);
    }

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const redirectUrl = buildMobileRedirectUrl({
      provider: 'google',
      code,
      ...(state ? { state } : {}),
      ...(scope ? { scope } : {}),
    });

    res.set('Cache-Control', 'no-store');
    return res.redirect(302, redirectUrl);
  } catch (e) {
    return res.status(500).send('Internal error handling OAuth callback');
  }
});

// Simple health endpoint for verification
router.get('/auth/health', (_req, res) => {
  res.json({ ok: true, service: 'ExtractorW OAuth Bridge' });
});

module.exports = router;


