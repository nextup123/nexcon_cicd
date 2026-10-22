'use strict';

/**
 * `npm start` runs this. It starts the tool (server/index.js) and:
 *   - starts it again when the Update page's "Restart now" asks for it (exit code 75);
 *   - when a version that was just installed stops within a minute of starting
 *     (it crashed, or its health check found the drives worse than before the
 *     update), puts the previous version back and starts that one instead.
 * Ctrl+C stops both.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RESTART_CODE = 75;
const QUICK_FAIL_MS = 60000;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'user-data');
const STATE = path.join(DATA_DIR, 'update_state.json');

let child = null;
let stopping = false;

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const versionOnDisk = () => readJson(path.join(ROOT, 'package.json'))?.version;

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    stopping = true;
    if (child) child.kill(sig === 'SIGHUP' ? 'SIGTERM' : sig);
    else process.exit(0);
  });
}

function start() {
  const started = Date.now();
  child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, RUN_SUPERVISED: '1' },
  });
  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) process.exit(code ?? 0);
    if (code === RESTART_CODE) {
      console.log('[START] Restarting…');
      return start();
    }
    const state = readJson(STATE);
    const ran = Date.now() - started;
    if (code !== 0 && (ran < QUICK_FAIL_MS || state?.healthFailure) && state?.kind === 'update' && !state.confirmedAt
      && state.toVersion === versionOnDisk() && state.previous?.commit) {
      const why = state.healthFailure
        ? `Version ${state.toVersion} started, but ${state.healthFailure}.`
        : `Version ${state.toVersion} stopped ${Math.round(ran / 1000)} seconds after starting (${signal || `exit code ${code}`}).`;
      console.log(`[START] ${why} Putting version ${state.previous.version} back.`);
      const r = spawnSync(process.execPath, [path.join(ROOT, 'server', 'update-worker.js'), JSON.stringify({
        mode: 'rollback', auto: true, reason: why, root: ROOT, dataDir: DATA_DIR, stateFile: STATE,
        fromVersion: state.toVersion, mock: /^(1|true|yes|on)$/i.test(process.env.MOCK || ''),
      })], { cwd: ROOT, stdio: 'inherit' });
      if (r.status === 0) return start();
      console.log('[START] Could not put the previous version back. See the messages above.');
    }
    process.exit(code ?? 1);
  });
}

// A fresh git copy has no built screens yet.
if (!['dist', 'dist-next'].some((d) => fs.existsSync(path.join(ROOT, 'client', d, 'index.html')))) {
  console.log('[START] Building the screens (first start)…');
  const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

start();
