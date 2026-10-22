# EtherCAT Config Tool v2 (React + Express)

React (Vite) frontend and an Express backend that talks to the Innovance drives through
rclnodejs. It uses the same ROS 2 services as v1:

| What | Name |
|---|---|
| UI node | `ethercat_diag_ui_node` |
| SDO write | `/ethercat_manager/set_sdo` (`ethercat_msgs/srv/SetSdo`) |
| SDO read | `/ethercat_manager/get_sdo` (`ethercat_msgs/srv/GetSdo`) |
| SDO server node | `ros2 run ethercat_manager ethercat_sdo_srv_server` |
| Bus scan | `/usr/bin/ethercat slaves` |

## Run on the robot PC

The easy way (sources ROS 2 and your workspace, installs if needed, starts the server):

```bash
./start-robot.sh ~/ros2_ws/install/setup.bash   # path to the workspace that has ethercat_manager / ethercat_msgs
```

By hand:

```bash
source /opt/ros/humble/setup.bash
source ~/ros2_ws/install/setup.bash      # your workspace with ethercat_msgs; rclnodejs needs it to build and run
npm install                              # must run in this sourced shell, or rclnodejs will not build
npm start                                # http://<pc-ip>:3045 (client/dist is included in the zip)
```

If the header says **Controller offline**, the server console prints a boxed "Controller connection problem"
with the cause and the command that fixes it (ROS 2 not sourced, rclnodejs not installed, or ethercat_msgs
types missing).

You can open the UI from any machine on the network now; v1 only worked in a browser on the robot PC.

## Updates (v3.6): one button, no setup scripts

Set up a PC once like any Node app, preferably with git so it knows where updates come from:

```bash
git clone git@github.com:<you>/<repo>.git ethercat_config_tool && cd ethercat_config_tool
npm install
npm start            # or ./start-robot.sh, which sources ROS 2 first
```

On the Software update page: **Check for updates** lists newer version tags with their notes,
**Install** updates this folder (download, install what changed, build, test-start on a spare port),
**Restart now** starts the new version. If the new version stops within a minute, `npm start` puts the
previous one back by itself; **Go back to …** does it by hand. Any failed step puts the folder back.

- `npm start` runs `server/launcher.js`, which restarts the tool for **Restart now** and handles the
  automatic go-back. With `npm run dev` or `node server/index.js`, close and start the tool after an update.
- The operator's files (recipes, drive settings, history, reports, update settings) live in `user-data/`,
  which updates never touch. On the first start they are copied from `data/`.
- An unzipped copy works too: enter the repository address in Update settings, and the first update
  turns the folder into a git copy (after recording the current files so Go back works).
- An update refuses to run if program files were changed on that PC (e.g. a development copy with
  uncommitted work), so nothing is lost.
- Private repository: clone with SSH and a deploy key, or `https://<read-only-token>@github.com/...`.

### Releasing a version (v3.8: release check)

1. Bump `version` in `package.json`, describe it in `release-notes.json`, commit.
2. `git tag v3.8.1 && git push origin main v3.8.1`
3. The GitHub Action **Release check** (`.github/workflows/release.yml`) runs lint, build and `npm test`
   (simulated drives) and checks that the tag, `package.json` and `release-notes.json` agree. If all pass it
   adds the tag `verified/v3.8.1` on the same commit and sends the notes to the release server (secret
   `HUB_URL`). PCs only install versions with that tag; until then the Update page shows "Not checked yet".
   Watch it under the repository's **Actions** tab. A failed check: fix, bump to the next version, tag again.
4. The same checks run on every push and pull request, so problems show up before you tag.

Run the checks on your PC with `npm run lint && npm run build && npm test`.

**One-time GitHub settings** (Settings of the repository):
- **Rules → Rulesets → New tag ruleset**: target tags matching `v*`, turn on *Restrict creations*,
  *Restrict updates* and *Restrict deletions*, and add yourself (Repository admin) to the bypass list.
  Then only you can publish a version. Leave `verified/*` out of the ruleset: the Action creates those.
- **Actions → General → Workflow permissions**: *Read and write permissions* (the Action pushes the
  `verified/` tag).
- If the repository has no Action (e.g. the tool sits in a sub-folder of a bigger repository and the
  workflow was not moved to its root), untick *Only install versions that passed the release check* in
  Update settings, or every version stays "Not checked yet".

### Safety on each PC (v3.8)

- **Copy of recipes and settings** before every update, in `user-data/backups/` (newest 10 kept).
  **Go back** asks whether to put the recipes and drive settings from before the update back; the ones
  from the newer version are saved in another copy first. History, fault log and reports are never replaced.
- **No update while the drives are in use.** Install, Restart and Go back wait while a recipe runs, drive
  settings are being written, or a value was written to a drive in the last 15 s.
- **Health check after an update.** Before installing, the tool notes whether the drive controller is
  connected and how many drives answer. After the restart it checks again at 15, 25, 35 and 45 s. If
  something that worked before still fails at the last check, `npm start` puts the previous version (and
  the recipes and settings from before) back by itself; the Update page says why. Drives that were switched
  off before the update do not count against the new version.

## Develop without hardware

```bash
npm run dev:mock     # API on :3045 with a simulated 6-drive bus + Vite on :5173 (hot reload)
npm run start:mock   # serve the built UI against the simulated bus
MOCK_FAIL="0:0x200d:0x01" npm run start:mock   # same, with that write failing on drive 0
```

`MOCK=1` simulates the SDO services, the 0x200B fault log (drives J2, J4 and J6 have faults), `ethercat slaves`
and the node start/stop. No ROS install is needed.

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3045` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `SDO_PASSWORD` | `123` | Password for the SDO console and for starting the SDO server node (now checked on the server) |
| `ROS_SETUP` | `/opt/ros/humble/setup.bash` | Sourced before `ros2 run` |
| `WORKSPACE_SETUP` | (empty) | Workspace overlay sourced after `ROS_SETUP` when starting the SDO server |
| `ETHERCAT_BIN` | `/usr/bin/ethercat` | IgH EtherCAT CLI |
| `SERVICE_TIMEOUT_MS` | `5000` | Per SDO service call |
| `DATA_DIR` | `./user-data` | The operator's files (recipes, drive settings, history, reports); `data/` keeps the files that ship with each version |
| `MOCK` | off | `1` = simulated bus |
| `UPDATE_REPO`, `UPDATE_TAG_PREFIX` | empty, `v` | Defaults for Update settings (empty repository = the address the folder was cloned from) |
| `HUB_URL` | empty | Default report server address (no key needed for now) |
| `VITE_ENABLE_MONITOR` | off | Build-time: `VITE_ENABLE_MONITOR=1 npm run build` shows the Live monitor page (it was hidden in v1 too) |

## Layout

```
server/
  index.js          Express app, static hosting of client/dist
  ros.js            rclnodejs bridge (pooled clients, serialised SDO calls)
  mock.js           simulated bus for MOCK=1
  lib/              SDO helpers, node process manager, JSON file helpers
  routes/           system (health, slaves, node), sdo, data, recipes, error log, history, drive profiles
client/src/
  pages/            Overview, Recipes, Fault log, Driver config, SDO console, Fault codes, Network, History, Help, Monitor
  components/       shared UI (drive selector, dialogs, toasts…)
  lib/              formatting, fault DB lookup, expected-value checks, PDF report, theme, stores
data/               your existing JSON files, unchanged. The app creates two more on first use:
                    drive_profiles.json (per-drive config values) and history.json (activity log)
```

All v1 API routes still exist with the same request/response shapes, apart from `/api/node/start`, which now
needs `password` in the body. New routes: `GET /api/health`, `POST /api/auth/verify`,
`POST /api/faults/read-slot`, `POST /api/recipes/:id/executed`, `GET|POST /api/history`,
`GET|PUT /api/drive-profiles`, `PUT /api/driver-config` (replace the parameter list from the in-app editor).

The UI starts in the light theme; the moon/sun button at the bottom of the sidebar switches to light and the
choice is remembered per browser.

See [CHANGES.md](CHANGES.md) for the bugs that were fixed and the behaviour changes to check on the hardware.
