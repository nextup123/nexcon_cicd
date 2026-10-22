'use strict';

/**
 * Copies of the operator's files (user-data/backups/<time> <why>/), made before
 * every update and before going back. "Go back" can put the recipes and drive
 * settings from before the update back, in case the newer version changed them.
 *
 * Only settings-like files are put back. History, the fault log and the problem
 * reports keep growing and are never replaced (they are in the copy all the same).
 */

const fs = require('fs');
const path = require('path');

const DIR = 'backups';
const KEEP = 10;
// Put back on "go back".
const RESTORED = ['driver_config.json', 'recipe.json', 'sequence.json', 'drive_profiles.json', 'update_settings.json'];
// Copied, never put back.
const ALSO_COPIED = ['history.json', 'error_log.json', 'machine.json'];

const safeName = (s) => String(s).replace(/[^A-Za-z0-9._ -]+/g, '_').slice(0, 80);

/** Copies the operator's files into a new backup folder; returns the folder's name. */
function backupUserData(dataDir, why) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', ' ').slice(0, 19);
  const name = safeName(`${stamp} ${why}`);
  let target = path.join(dataDir, DIR, name);
  for (let i = 2; fs.existsSync(target); i += 1) target = path.join(dataDir, DIR, `${name} (${i})`);
  fs.mkdirSync(target, { recursive: true });
  const copied = [];
  for (const file of [...RESTORED, ...ALSO_COPIED]) {
    const src = path.join(dataDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(target, file));
      copied.push(file);
    }
  }
  fs.writeFileSync(path.join(target, 'backup.json'), JSON.stringify({ why, at: new Date().toISOString(), files: copied }, null, 2));
  prune(dataDir);
  return path.basename(target);
}

/** Keeps the newest backups; older ones are removed. */
function prune(dataDir, keep = KEEP) {
  const root = path.join(dataDir, DIR);
  let names = [];
  try { names = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return; }
  // Oldest first, by the time written inside (two copies can share a name's second).
  const at = (n) => { try { return JSON.parse(fs.readFileSync(path.join(root, n, 'backup.json'), 'utf8')).at || n; } catch { return n; } };
  names = names.map((n) => [at(n), n]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, n]) => n);
  for (const old of names.slice(0, Math.max(0, names.length - keep))) fs.rmSync(path.join(root, old), { recursive: true, force: true });
}

/**
 * Puts the settings files of backup `name` back. The files as they are now are
 * copied first ("before going back"), so nothing is lost. Returns the files put back.
 */
function restoreUserData(dataDir, name, why = 'before going back') {
  const from = path.join(dataDir, DIR, safeName(name));
  if (!name || !fs.existsSync(from)) throw new Error(`The copy "${name}" is not on this PC any more`);
  backupUserData(dataDir, why);
  const restored = [];
  for (const file of RESTORED) {
    const src = path.join(from, file);
    if (!fs.existsSync(src)) continue;
    const tmp = path.join(dataDir, `${file}.${process.pid}.restore`);
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, path.join(dataDir, file));
    restored.push(file);
  }
  return restored;
}

module.exports = { backupUserData, restoreUserData, prune, RESTORED, ALSO_COPIED, BACKUP_DIR: DIR };
