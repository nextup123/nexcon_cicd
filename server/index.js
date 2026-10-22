'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { setBridge } = require('./lib/sdo');
const nodeManager = require('./lib/nodeManager');
const { seedUserData, applyPendingRestore } = require('./lib/userData');

seedUserData();
if (!process.env.UPDATE_SMOKE_TEST) applyPendingRestore();
// Screens built by a software update (client/dist-next) are used from this start on.
if (!process.env.UPDATE_SMOKE_TEST && !process.env.CLIENT_DIST && require('./lib/gitUpdate').swapInNewScreens(config.ROOT)) {
  console.log('[UPDATE] New screens are in place');
}

const bridge = config.MOCK ? require('./mock') : require('./ros');
setBridge(bridge);
if (bridge.mock) nodeManager.useMock(bridge);
// When the SDO server process exits, its service clients are dead too.
nodeManager.setOnExit(() => bridge.destroyAllClients());

const app = express();
app.use(cors());
// Black-box snapshots are bigger than Express' 100 KB default.
app.use(express.json({ limit: '5mb' }));

// Operators never see ROS wording (node/service names, "ROS 2").
app.use('/api', require('./lib/plainWords').middleware);
app.use('/api', require('./routes/system'));
app.use('/api', require('./routes/sdo'));
app.use('/api', require('./routes/data'));
app.use('/api', require('./routes/recipes'));
app.use('/api', require('./routes/errorLog'));
app.use('/api', require('./routes/history'));
app.use('/api', require('./routes/profiles'));
app.use('/api', require('./routes/updates'));

app.use('/api', (req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));

// Serve the built React app (npm run build) with SPA fallback.
if (fs.existsSync(config.CLIENT_DIST)) {
  app.use(express.static(config.CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(config.CLIENT_DIST, 'index.html')));
} else {
  app.get('/', (req, res) => res.type('text').send('Frontend not built yet. Run "npm run build", or "npm run dev" for development.'));
}

// Malformed JSON bodies etc. → JSON error instead of an HTML stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[HTTP]', err);
  res.status(status).json({ success: false, error: err.message, sdo_return_message: err.message });
});

let server;
async function shutdown(signal, code = 0) {
  console.log(`[SHUTDOWN] ${signal} received`);
  nodeManager.killOnShutdown();
  await bridge.shutdown();
  if (server) server.close();
  process.exit(code);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// Update page → Restart now. `npm start` (server/launcher.js) starts the tool again on this exit code.
process.on('ect:restart', () => shutdown('restart', config.RESTART_EXIT_CODE));

bridge.init().then(() => {
  server = app.listen(config.PORT, config.HOST, () => {
    console.log('\n  ═══════════════════════════════════════');
    console.log(`  EtherCAT Config Tool v${config.APP_VERSION}`);
    console.log(`  → http://localhost:${config.PORT}`);
    console.log(`  → ROS2: ${bridge.mock ? 'MOCK (simulated bus)' : bridge.isReady() ? (bridge.issue() ? '⚠ connected, but see the problem above' : '✓ connected') : '✗ not connected (see the problem above)'}`);
    console.log('  ═══════════════════════════════════════\n');
    require('./lib/updater').onStartup().catch((err) => console.error('[UPDATE]', err.message));
    require('./lib/hub').start();
  });
});

module.exports = app;
