// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://91c7d718c3680f8c38c326d8566bdfea@o4509526696984576.ingest.us.sentry.io/4509532430204928",

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Performance Monitoring
  tracesSampleRate: 0.1, // Capture 10% of the transactions

  // Release and Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Error filtering
  beforeSend(event) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_ENABLE_DEV) {
      return null;
    }
    return event;
  },
});

module.exports = Sentry; 