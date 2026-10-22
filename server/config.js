'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PKG = require(path.join(ROOT, 'package.json'));

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT) || 3045,
  HOST: process.env.HOST || '0.0.0.0',

  // Data files are resolved from the project root, not the shell's cwd,
  // so `node server/index.js` works from any directory.
  // The operator's own files (recipes, drive settings, history, reports). Kept out of
  // the program files, so a software update never replaces them.
  DATA_DIR: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'user-data'),
  CLIENT_DIST: process.env.CLIENT_DIST ? path.resolve(process.env.CLIENT_DIST) : path.join(ROOT, 'client', 'dist'),
  // Reference data that ships with each version (fault guide, parameter catalog).
  // Always read from the running version, so an update brings new fault texts.
  BUNDLED_DATA_DIR: path.join(ROOT, 'data'),

  APP_ID: 'ethercat_config_tool',
  APP_VERSION: PKG.version,

  // `npm start` (server/launcher.js) starts the server again when it exits with this code.
  RESTART_EXIT_CODE: 75,
  SUPERVISED: envBool('RUN_SUPERVISED', false),

  // Defaults for the Update page settings; the page can change them (saved in DATA_DIR/update_settings.json).
  UPDATE_REPO: process.env.UPDATE_REPO || '',
  UPDATE_TAG_PREFIX: process.env.UPDATE_TAG_PREFIX || 'v',
  HUB_URL: process.env.HUB_URL || '',

  // UI interlock password for SDO console + starting the ROS node.
  // Checked on the server now (it used to sit in the browser bundle).
  SDO_PASSWORD: process.env.SDO_PASSWORD || '123',

  // MOCK=1 simulates the EtherCAT bus + SDO services so the UI can be
  // developed and demoed without ROS 2 or drives attached.
  MOCK: envBool('MOCK', false),

  ROS_NODE_NAME: process.env.ROS_NODE_NAME || 'ethercat_diag_ui_node',
  ROS_SETUP: process.env.ROS_SETUP || '/opt/ros/humble/setup.bash',
  // Optional overlay with ethercat_manager / ethercat_msgs (e.g. ~/ros2_ws/install/setup.bash).
  // Sourced after ROS_SETUP when starting the SDO server, so the tool also works
  // when it was not launched from a shell that sourced the workspace.
  WORKSPACE_SETUP: process.env.WORKSPACE_SETUP || '',
  ETHERCAT_BIN: process.env.ETHERCAT_BIN || '/usr/bin/ethercat',

  SDO_SET_SERVICE: { type: 'ethercat_msgs/srv/SetSdo', name: '/ethercat_manager/set_sdo' },
  SDO_GET_SERVICE: { type: 'ethercat_msgs/srv/GetSdo', name: '/ethercat_manager/get_sdo' },
  SERVICE_TIMEOUT_MS: Number(process.env.SERVICE_TIMEOUT_MS) || 5000,

  DEFAULT_NODE: { node_name: 'ethercat_sdo_srv_server', package_name: 'ethercat_manager' },

  FAULT_RESET: { index: 0x6040, subindex: 0x00, dtype: 'uint16', value: '128' },

  MAX_LOG_SNAPSHOTS: 500,
};
