'use strict';

/**
 * The operator's own files (recipes, drive settings, history, bug reports)
 * live in user-data/, outside the program files, so a software update never
 * replaces them. The first start copies them from data/: the starter files of
 * a new PC, or the files an earlier version kept there (they hold the
 * operator's changes). After that data/ only supplies the reference files
 * that come with each version (fault guide, parameter catalog).
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { restoreUserData } = require('./backup');

// Starter files every PC gets.
const SEED_FILES = ['driver_config.json', 'recipe.json', 'error_log.json', 'sequence.json'];
// Files earlier versions created in data/ on each PC.
const OWN_FILES = ['history.json', 'drive_profiles.json', 'problem_reports.json', 'update_log.json', 'update_settings.json', 'machine.json'];

function seedUserData() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  if (path.resolve(config.DATA_DIR) === path.resolve(config.BUNDLED_DATA_DIR)) return;
  for (const name of [...SEED_FILES, ...OWN_FILES]) {
    const target = path.join(config.DATA_DIR, name);
    const source = path.join(config.BUNDLED_DATA_DIR, name);
    if (!fs.existsSync(target) && fs.existsSync(source)) {
      fs.copyFileSync(source, target);
      console.log(`[DATA] ${name} copied into ${path.relative(config.ROOT, config.DATA_DIR) || config.DATA_DIR}`);
    }
  }
}

/**
 * "Go back" may ask for the recipes and settings from before the update. They are
 * put back here, at the start of the older version and before anything reads them.
 * Returns the files put back (also noted in update_state.json for the Update page).
 */
function applyPendingRestore() {
  const stateFile = path.join(config.DATA_DIR, 'update_state.json');
  let state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return []; }
  if (!state?.pendingRestart || !state.restoreData || state.dataRestoredAt || state.toVersion !== config.APP_VERSION) return [];
  let files = [];
  let error = '';
  try {
    files = restoreUserData(config.DATA_DIR, state.restoreData);
    console.log(`[DATA] recipes and settings put back from the copy "${state.restoreData}": ${files.join(', ')}`);
  } catch (err) {
    error = err.message;
    console.error(`[DATA] could not put back recipes and settings: ${err.message}`);
  }
  const next = { ...state, dataRestoredAt: new Date().toISOString(), dataRestored: files, dataRestoreError: error };
  const tmp = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, stateFile);
  return files;
}

module.exports = { seedUserData, applyPendingRestore, SEED_FILES };
