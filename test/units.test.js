'use strict';

// Small parts of the update safety: drive activity, backups, health comparison, versions.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('drive work blocks updates while it lasts', () => {
  const activity = require('../server/lib/activity');
  activity.reset();
  assert.deepStrictEqual(activity.busy(), { busy: false, what: '' });
  activity.hold('run-1', 'Recipe "Homing" is running');
  assert.strictEqual(activity.busy().what, 'Recipe "Homing" is running');
  activity.release('run-1');
  assert.strictEqual(activity.busy().busy, false);
  // A lease that is not renewed runs out (closed browser).
  activity.hold('run-2', 'Recipe');
  assert.strictEqual(activity.busy(Date.now() + activity.LEASE_MS + 1).busy, false);
  // A write to a drive counts for a while.
  activity.noteWrite('A value was just written to a drive');
  assert.strictEqual(activity.busy().busy, true);
  assert.strictEqual(activity.busy(Date.now() + activity.WRITE_MS + 1).busy, false);
  activity.reset();
});

test('recipes and settings are copied before an update and can be put back', () => {
  const { backupUserData, restoreUserData, prune, BACKUP_DIR } = require('../server/lib/backup');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ect-backup-'));
  fs.writeFileSync(path.join(dir, 'recipe.json'), '{"v":1}');
  fs.writeFileSync(path.join(dir, 'history.json'), '[1]');
  const name = backupUserData(dir, 'before version 9.9.9');
  // The newer version changes both files.
  fs.writeFileSync(path.join(dir, 'recipe.json'), '{"v":2}');
  fs.writeFileSync(path.join(dir, 'history.json'), '[1,2]');
  const restored = restoreUserData(dir, name);
  assert.deepStrictEqual(restored, ['recipe.json']);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'recipe.json'), 'utf8'), '{"v":1}');
  // History keeps growing; it is never put back.
  assert.strictEqual(fs.readFileSync(path.join(dir, 'history.json'), 'utf8'), '[1,2]');
  // The newer files were kept in a second copy.
  const copies = fs.readdirSync(path.join(dir, BACKUP_DIR));
  assert.strictEqual(copies.length, 2);
  const newer = copies.find((c) => c.endsWith('before going back'));
  assert.strictEqual(fs.readFileSync(path.join(dir, BACKUP_DIR, newer, 'recipe.json'), 'utf8'), '{"v":2}');
  prune(dir, 1);
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, BACKUP_DIR)), [newer]);
  assert.throws(() => restoreUserData(dir, 'no such copy'), /not on this PC/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('health after an update only counts what worked before', () => {
  const { healthWorse, parseEthercatSlaves } = require('../server/lib/drives');
  assert.strictEqual(healthWorse({ controller: true, drives: 6 }, { controller: true, drives: 6 }), '');
  assert.match(healthWorse({ controller: true, drives: 6 }, { controller: false, drives: 6 }), /controller/);
  assert.match(healthWorse({ controller: true, drives: 6 }, { controller: true, drives: 4 }), /only 4 of 6/);
  assert.match(healthWorse({ controller: true, drives: 6 }, { controller: true, drives: 0 }), /none of the 6/);
  // Drives switched off before the update are not held against the new version.
  assert.strictEqual(healthWorse({ controller: false, drives: 0 }, { controller: false, drives: 0 }), '');
  assert.strictEqual(parseEthercatSlaves('0  0:0  OP  +  SV660N Servo Drive\n1  0:1  PREOP  +  SV660N Servo Drive').length, 2);
});

test('package.json, release-notes.json and the tag name the same version', () => {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const notes = JSON.parse(fs.readFileSync(path.join(root, 'release-notes.json'), 'utf8'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-[\w.]+)?$/);
  assert.strictEqual(notes.version, pkg.version, 'release-notes.json is for another version');
  assert.ok(Array.isArray(notes.changes) && notes.changes.length, 'release-notes.json lists no changes');
  const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '';
  if (tag) assert.strictEqual(tag, `${process.env.UPDATE_TAG_PREFIX || 'v'}${pkg.version}`, 'the tag does not match package.json');
});
