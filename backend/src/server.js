const path = require('path');
const fs = require('fs');

// The project-root .env is the single source of configuration. Its values
// override anything inherited from the shell, so editing .env always takes effect.
const ENV_FILE = path.join(__dirname, '../../.env');
const envLoaded = fs.existsSync(ENV_FILE);
if (envLoaded) require('dotenv').config({ path: ENV_FILE, override: true, quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const llm = require('./ai/llm');
const agentPlatform = require('./ai/agentPlatform');
const { requireAuth } = require('./auth/middleware');

const app = express();
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');

// Google sign-in returns its result from a popup, which same-origin COOP would cut off
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(cors());
app.use(express.json({ limit: '8mb' })); // lab report photos arrive as base64

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0', ai: llm.status(), agentPlatform: agentPlatform.status() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/donors/:donorId/drop', requireAuth, require('./routes/drop'));
app.use('/api/donors/:donorId/intro', requireAuth, require('./routes/intro'));
app.use('/api/donors', requireAuth, require('./routes/donors'));
app.use('/api/demo', requireAuth, require('./routes/demo'));
app.use('/api', requireAuth, require('./routes/platform'));

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `No API route for ${req.method} ${req.originalUrl}` });
});

// Serve the built frontend (production / Docker); the SPA handles its own routes
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  const ai = llm.status();
  console.log(`Pratidaan API on http://localhost:${PORT}/api`);
  console.log(envLoaded ? `Config: ${ENV_FILE}` : `Config: no .env at ${ENV_FILE} — using shell environment only`);
  console.log(ai.live
    ? `AI: ${ai.model} via ${ai.endpoint} (budget ${ai.dailyTokenBudget} tokens/day, ${ai.rateLimitRps} req/s)`
    : `AI offline: ${ai.reason} — rule-based fallbacks active`);
  llm.verify().then((result) => console.log(result.ok ? `AI configured: ${ai.endpoint}; access checked on first request` : `AI check: ${result.reason}`));
});
