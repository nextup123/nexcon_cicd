'use strict';

// Starts the tool on the simulated bus and checks the parts an update relies on.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

test('the tool starts on the simulated bus and guards updates', async (t) => {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ect-test-'));
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: { ...process.env, MOCK: '1', PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, HUB_URL: '', RUN_SUPERVISED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  t.after(() => { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

  const base = `http://127.0.0.1:${port}/api`;
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  let health = null;
  for (let i = 0; i < 60 && !health; i += 1) {
    health = await call('GET', '/health').then((r) => r.body).catch(() => null);
    if (!health) await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(health, `the server did not start:\n${out}`);
  assert.strictEqual(health.version, require('../package.json').version);
  assert.strictEqual(health.ros2, true);

  const slaves = await call('GET', '/slaves');
  assert.strictEqual(slaves.body.slaves.length, 6);

  // Operator files are seeded into the data folder.
  assert.ok(fs.existsSync(path.join(dataDir, 'recipe.json')));

  // While a recipe runs, Restart and Go back are refused with the reason.
  const pw = process.env.SDO_PASSWORD || '123';
  await call('POST', '/activity', { id: 't1', what: 'Recipe "Homing" is running', active: true });
  const status = await call('GET', '/updates/status');
  assert.strictEqual(status.body.busy.busy, true);
  const restart = await call('POST', '/updates/restart', { password: pw });
  assert.strictEqual(restart.status, 409);
  assert.match(restart.body.error, /Homing/);
  await call('POST', '/activity', { id: 't1', active: false });
  assert.strictEqual((await call('GET', '/updates/status')).body.busy.busy, false);

  // A problem report is kept on the PC when no report server is set.
  const rep = await call('POST', '/reports', { title: 'Test report', description: 'From the test', includeDetails: false });
  assert.strictEqual(rep.status, 200, JSON.stringify(rep.body));
  assert.strictEqual(rep.body.report.sendState, 'waiting');
});
