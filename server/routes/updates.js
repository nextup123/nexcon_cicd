'use strict';

const express = require('express');
const config = require('../config');
const updater = require('../lib/updater');
const hub = require('../lib/hub');
const settings = require('../lib/settings');
const activity = require('../lib/activity');
const { getBridge } = require('../lib/sdo');

const router = express.Router();

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  if (!err.status || err.status >= 500) console.error('[UPDATE]', err.message);
  res.status(err.status || 500).json({ success: false, error: err.message });
});

// Installing, going back, restarting and changing the update source need the tool password.
function needPassword(req, res, next) {
  if (typeof req.body?.password === 'string' && req.body.password === config.SDO_PASSWORD) return next();
  res.status(401).json({ success: false, error: 'Incorrect password' });
}

router.get('/updates/status', wrap(async (req, res) => {
  res.json({ ...(await updater.status()), hub: await hub.status(), settings: await settings.getPublic() });
}));

router.post('/updates/check', wrap(async (req, res) => {
  res.json(await updater.check());
}));

router.post('/updates/install', needPassword, wrap(async (req, res) => {
  res.json({ success: true, job: await updater.start(req.body.version) });
}));

router.post('/updates/rollback', needPassword, wrap(async (req, res) => {
  res.json({ success: true, job: await updater.rollback({ restoreData: req.body.restoreData !== false }) });
}));

router.post('/updates/restart', needPassword, wrap(async (req, res) => {
  if (!config.SUPERVISED) {
    return res.status(409).json({ success: false, error: 'This copy was not started with "npm start", so it cannot restart itself. Close it and start it again.' });
  }
  updater.refuseWhileBusy('Restarting');
  res.json({ success: true });
  // Let the answer reach the browser, then exit; `npm start` (server/launcher.js) starts it again.
  setTimeout(() => process.emit('ect:restart'), 300);
}));

// The screens say when a recipe run or a settings write starts and ends (renewed every few
// seconds while it runs), so updates and restarts wait for it.
router.post('/activity', (req, res) => {
  const { id, what, active } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'id is required' });
  if (active === false) activity.release(id);
  else activity.hold(id, what);
  res.json({ success: true, busy: activity.busy() });
});

router.get('/updates/settings', wrap(async (req, res) => res.json(await settings.getPublic())));
router.put('/updates/settings', needPassword, wrap(async (req, res) => {
  const saved = await settings.save(req.body || {});
  hub.flush().catch(() => {});
  res.json({ success: true, settings: saved });
}));

router.get('/updates/history', wrap(async (req, res) => {
  res.json({ updates: (await hub.listUpdates()).map(({ log, ...u }) => u) });
}));

// ── Problem reports ───────────────────────────────────────────
router.get('/reports', wrap(async (req, res) => {
  res.json({ reports: (await hub.listReports()).map(({ context, ...r }) => r), hub: await hub.status() });
}));

router.post('/reports', wrap(async (req, res) => {
  const bridge = getBridge();
  const report = await hub.createReport(req.body || {}, {
    controllerConnected: bridge.isReady(),
    simulated: !!bridge.mock,
  });
  const { context, ...rest } = report;
  res.json({ success: true, report: rest, hub: await hub.status() });
}));

router.post('/reports/send', wrap(async (req, res) => {
  res.json(await hub.flush());
}));

module.exports = router;
