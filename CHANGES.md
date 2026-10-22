# v2 changes

## v3.8.0: safer updates (2026-10-22)

- **Release check.** `.github/workflows/release.yml` now runs lint, build and `npm test` on every push, pull
  request and version tag. On a tag that passes (and matches `package.json` and `release-notes.json`) it adds
  `verified/<tag>` on the same commit, then publishes the notes. The Update page marks other tags "Not checked
  yet" and Install refuses them (setting *Only install versions that passed the release check*, on by default;
  the worker checks again after downloading). New tests in `test/` (`npm test`): drive activity, backups,
  health comparison, versions, and a start of the tool on the simulated bus.
- **Copy of recipes and settings before each update** (`server/lib/backup.js`, new update step "Save a copy of
  recipes and settings") into `user-data/backups/<time> before version X/`, newest 10 kept. Go back asks
  whether to put them back (default yes); after an automatic go-back they are always put back. The restore
  happens at the next start (`applyPendingRestore` in `userData.js`) so the running version cannot write over
  it, and the files of the newer version are copied first. Only settings-like files are put back
  (driver_config, recipe, sequence, drive_profiles, update_settings); history, fault log and reports never.
- **Updates wait while the drives are in use** (`server/lib/activity.js`). The recipe run and the settings
  write hold a lease (`POST /api/activity`, renewed every 8 s, ends 20 s after the last renewal); any drive
  write counts for 15 s. Install, Restart and Go back answer 409 with the reason; the page shows it and
  disables the buttons.
- **Health check after an update** (`server/lib/drives.js`). Install records controller connected + number of
  drives answering. After the restart the new version checks at 15/25/35/45 s; if something that worked
  before still fails, it records why and exits, and the launcher puts the previous version back. Started
  without `npm start`, it says so on the Update page instead.
- `MOCK_DRIVES=n` sets the number of simulated drives.
- Tested end to end with a local test repository: unchecked tag refused, Install refused during a "recipe",
  update with backup, Go back with recipes put back, and a version that loses two drives going back by itself
  after 45 s. Not tested with GitHub Actions itself (the workflow was checked for syntax and its commands run
  locally) or on the robot.

## v3.7.0: clearer Software update page, pictures that wait say why (2026-10-21)

- **Software update has three tabs**: Updates (this PC, available versions, updates on this PC, Update settings),
  Report a problem (the form in two columns), and My reports (a table: problem, number, date, pictures, status).
  The tab remembers where you were; My reports shows how many reports wait to be sent.
- **Pictures that wait say why.** If the report server is older than v3.6.1 it has no address for pictures and
  answers "No route". The tool used to keep them as "(sending)" without a reason. Now each report shows
  "2 waiting" with the reason (the release server needs the new release_hub), and a note appears above the
  report tabs. The pictures go out by themselves once the server is updated. Other errors are shown the same way.
- Release server 1.1.0: `/api/v1/health` now includes `version` and `features: ["pictures"]`, and the start
  message shows the version, so it is easy to see which server is running.
- Tested against a real MongoDB 7: report and pictures stored; an old server (no picture routes) gave the
  "older version" message; after switching to the new server on the same database both pictures arrived.

## v3.6.1: pictures on problem reports (2026-10-21)

- **Report a problem** has a Pictures row: up to 5 pictures from the file chooser, or paste a screenshot
  (Ctrl+V) anywhere in the form. Each is shrunk in the browser (longest side 1600 px, about 300 KB JPEG)
  and shown as a thumbnail with a remove button.
- The pictures are saved as files in `user-data/report_images/` with the report. After the report has its
  number they are sent to the release server one at a time (a lost answer or a retry never stores one twice);
  the local file is removed once it is sent. "Reports from this PC" shows the picture count and "(sending)".
- Offline: the report and its pictures wait on the PC and go out together when the server is reachable.
- Release server: new `POST /bugs/:number/attachments` (also under `/apps/:appId/`), `GET /attachments/:id`,
  collection `attachments`, listed on the bug as `attachments[]` with a `url`. JPEG, PNG, WebP or GIF only
  (checked by content), at most 5 per bug, 700 KB each.
- Tested with simulated drives against the in-memory hub: two pictures, a refused non-picture, and a report
  made while the server was down.

## v3.6: one-button updates, no setup scripts (2026-10-21)

- **No install.sh or run.sh any more.** Set a PC up like any Node app (`git clone`, `npm install`, `npm start`,
  or `./start-robot.sh` which sources ROS 2 first). An unzipped copy works too once the repository address is
  entered in Update settings.
- **Install** updates the tool's own folder: download the tag, check that no program files were changed on
  this PC, put the new files in place, install parts only when the dependencies changed, build the screens
  (into `client/dist-next`, swapped in at the next start so the running screens keep working), and test-start
  the new version on a spare port with simulated drives. Any failed step puts the folder back as it was.
  The work runs in its own process (`server/update-worker.js`), so it also survives a restart by nodemon.
- **Restart now** works when the tool was started with `npm start`, which now runs `server/launcher.js`.
  Started any other way (`npm run dev`, `node server/index.js`), the page asks to close and start the tool again.
- **Goes back by itself:** if a new version stops within a minute of starting, the launcher puts the previous
  version back and starts it; the Software update page says so. **Go back to …** does it by hand.
- **The operator's files moved to `user-data/`** (recipes, drive settings, history, reports, update settings),
  copied once from `data/` on the first start, so updates never replace them. `data/` keeps only the files
  that ship with each version.
- An update refuses to run on a copy with changed program files (e.g. a development copy with uncommitted
  work) and says which files, so nothing is overwritten.
- `npm start` builds the screens on the first start of a fresh clone; `client/dist` is no longer meant to be committed.
- The "Folder in the repository" setting is gone; it is worked out from the git copy.
- Tested on a simulated bus with a local test repository: update, restart, go back, an update that does not
  start, refused update with local changes, and an unzipped copy. Not yet run against the real GitHub repository.

## v3.5: software updates from GitHub, and problem reports

### Software update page (Tools → Software update)
- Shows this PC's version, name and whether the report server is reachable.
- **Check for updates** fetches the version tags from the repository and lists every newer version
  with its release notes grouped as New, Improved, Fixed, Safety, Needs attention and Known problem,
  plus any "Before you update" notes.
- **Install** (password) downloads that tag and prepares it **next to the running version**:
  download, unpack, install parts, build the screens, check that it starts (on a spare port with
  simulated drives and a copy of the data, plus a load test of the drive controller library), then
  point `current` at it. The running tool is not touched. Steps and a log are shown live; a failure
  says which step failed and leaves everything as it was.
- **Restart now** (password) restarts into the new version. The page reloads by itself.
- If the new version stops within a minute of starting, run.sh points `current` back at the previous
  version and starts it; the page then says the update did not start, and the broken version is removed.
- **Go back to …** switches to the previous version (kept on the PC) on the next restart.
- Only tagged versions are installed (tag = prefix + version, e.g. `v3.5.1`); the tag's
  `package.json` must say the same version. Unchanged lock files reuse the installed parts, so most
  updates need no npm download.
- **Updates on this PC** lists every update and roll-back with its result.
- **Update settings** (for maintainers, password): repository address, tag prefix, folder in the
  repository, report server address, name of this PC, customer or site. Saved in
  `data/update_settings.json`; repository tokens are never sent to the browser.
- The report server needs no key for now (removed on 2026-10-20; sign-in comes later). Only its
  address is set, e.g. `https://your-server.onrender.com`.

### Problem reports
- **Report a problem** form: what went wrong, what happened, what you were doing, kind of problem,
  where, how bad, how often, name, company, phone. Optionally adds the drive list and the last 20
  History entries.
- Reports are saved on the PC first (`data/problem_reports.json`) and sent to the report server
  when it can be reached (straight away, then every minute). **Reports from this PC** shows each
  report's number and what the maintainer did ("Being fixed", "Fixed in version 3.6.0").
- Updates and reports appear in History.
- Works with a report server on Render's free plan, which sleeps when idle: requests wait up to 70 s
  for it to wake, and a new report stops waiting after 8 s and is sent in the background.

### Install layout (one-time `install.sh` per PC)
- `~/ethercat_config_tool/releases/<version>/`, `current` and `previous` links, `data/` (recipes,
  settings, history, reports: kept across updates), `repo.git/`, `logs/`, `robot.env`, `run.sh`.
- `run.sh` sources ROS 2 and the workspace from `robot.env`, starts `current`, restarts on the Update
  page's request and falls back to `previous` if a new version stops right after starting.
  `install.sh --service` adds a systemd user service.
- Reference data (fault guide, parameter catalog, presets) now always comes from the running version,
  so updates bring new fault texts; the operator's files come from `DATA_DIR`.
- New: `release-notes.json` (notes for this version), `scripts/publish-release.js`,
  `.github/workflows/release.yml` (build check and notes upload on a version tag).
- The release server (`release_hub/`, Express + MongoDB) is a separate deliverable; see its
  DATA_MODEL.md.

## v3.4: easy codes (H-codes) everywhere, and recipes limited to chosen drives

### Easy codes
- Every parameter now shows its SV660N easy code next to the address, e.g. `H0D.00 · 200D:01`: recipe steps
  (editor, recipe page, run window, results CSV), Drive settings (grid, CSV, review and apply), the parameter
  editor, Manual read/write and History (old History entries get the code added when shown).
- Mapping: `Hxx.yy` = index `0x2000 + xx`, sub-index `yy + 1`. Checked against all 426 H-parameters in the
  catalog with no mismatch. CiA402 and communication objects (`6xxx`, `1xxx`) have no easy code and show the
  address only.
- All parameter searches (add a recipe step, Drive settings, parameter editor catalog, Manual read/write)
  use one list: the SV660N catalog plus the older preset list, one entry per address. Search accepts a name,
  an easy code in any spelling (`H0D.00`, `h0d.0`, `H5.7`, `H05-07`), a whole group (`H05` lists every H05
  parameter) or an address (`200D`, `200D:01`, `0x200D`). Each result shows code, name and address.
- Manual read/write has an **Easy code** box: type `H0D.00` and index, sub-index and data type fill in;
  type an address and the easy code appears. The buttons read **Read** and **Write**.
- Adding a read-only parameter as a recipe step makes it a Read step; write steps start at the manual's
  default value.

### Recipes limited to chosen drives
- New **Drives this recipe can run on** in the recipe editor: *All drives* (any group, as before) or
  *Only some drives* with a tick per drive. Tick J1, J2, J5 and the recipe can run on any group of those
  three; tick one drive and it runs on that drive only (that drive is ticked for you on the run screen).
- The run screen greys out drives the recipe is not set up for, shows "For J1, J2, J5 only", and lists
  allowed drives that are not on the bus right now. The recipe list and details show the drives.
  "Re-run on failed" stays within the allowed drives.
- Saved as `drives: [0, 1, 4]` (bus positions) in `recipe.json`. **Recipes without a list, including every
  recipe made before v3.4, run on all drives until someone edits them.** The server rejects an empty or
  invalid list, and the script endpoint `POST /recipes/execute` refuses drives outside the list.

## v3.3.1: software reset no longer breaks recipes

- **Cause:** step 2 of the Homing recipe is H0D.00 Software reset (200D:01 = 1). The SV660N reboots while
  it handles that write ("similar to the program reset upon power-on", Commissioning Guide 4.13), so it never
  sends the confirmation. The drive controller's SDO service then returns `success = false`
  ("Failed to download SDO: Input/output error") although the reset happened. The app treated that as a
  failure and, with "stop drive on first error" on, skipped the rest of that drive's steps. Even without
  skipping, the next step could reach the drive while it was still rebooting.
- **Fix:** a write that restarts the drive is recognised (200D:01 = 1 automatically, or any step with the
  new "The drive restarts after this step" box in the recipe editor). A missing confirmation is expected;
  only a real refusal from the drive counts as a failure. The run waits the step's delay (at least 2 s),
  then reads the drive's status word every second until it answers again (up to 30 s), and continues.
  The run window shows "Waiting for J1, J2 to restart". If a drive does not come back, that step fails
  with a clear message and History records it.
- Controller messages in plain words: "SDO transfer aborted: …" reads "Drive refused: …", and
  "Failed to download SDO: Input/output error" reads "No confirmation from the drive (it may be
  restarting or disconnected)".
- The simulated bus now behaves like the real drive on a software reset (no confirmation, no answers for 4 s).
- `ethercat_manager_sdo_fixes.patch` (for the drive controller package, apply with `patch -p1` in
  `ethercat_driver_ros2/`): an unknown or vendor-specific abort code made the SDO server read past the end
  of its abort-code table (undefined behaviour, can crash it); it now prints the code. Also frees the
  transfer buffer when a transfer fails. Not required for the fix above.

## v3.3: easier to read, and History shows which step failed

### History: exact failed step per drive
- A recipe run now records every failed step: drive, step number, step name, what was sent (address and
  value) and the drive's reason, plus how many later steps were skipped on that drive. History shows
  "Failed: J1 step 2" on the entry; opening it shows a table. Settings writes record the failed setting per
  drive the same way.
- The run window lists "What failed" under the results grid, so you no longer need to hover red cells.
- CSV export has one row per failed step (columns: failed drive, failed step, operation, address, value,
  error), so it can be filtered in a spreadsheet. Older entries still show their text detail.
- Drive refusals are translated: "SDO abort 0x08000022 …" reads "Drive refused: the drive is in the wrong
  state for this change (try with the drive stopped) (code 0x08000022)". Common abort codes are covered.

### Plainer wording for operators
- Pages renamed: Home, Recipes, Faults, Drive settings, History (daily work) and Fault guide, Drives &
  connection, Manual read/write, Help (tools). Every page subtitle says what the page is for.
- Drive states in words: Ready (OP), Starting (PREOP), Safe mode (SAFEOP), Not ready (INIT); the EtherCAT
  state is in the tooltip. Header shows "5/6 ready".
- Recipe steps read "Write · Set to 1 · wait 5 s" instead of "SET 0x200D:01 = 1 +5000ms"; the address is
  still shown, in grey. "Template" column is "All drives"; "slots" are "records"; "Scan" is "Find drives";
  "SDO" no longer appears outside Manual read/write. Help page rewritten to match.

### Look
- Light sidebar with a blue active item, so the screen reads as one calm surface (dark theme unchanged).
- Each page title has an icon; the Home status strip has icons; History outcomes have icons and words
  (Done, Some failed, Failed, Cancelled).
- Less monospace: dates, recipe details and step descriptions use the normal font; mono is kept for
  addresses and values.
- Configuration groups use the manual's group names (e.g. "H03 Terminal Input") instead of "0x2003".

### For testing
- `MOCK_FAIL="0:0x200d:0x01"` makes that write fail on the simulated bus (drive position 0), to try out
  error handling and History.

## v3.2.1: controller connection on the robot PC

- **Why the controller could stay offline:** since v2, `rclnodejs` was an *optional* dependency, so an
  `npm install` run in a shell without ROS 2 sourced skipped it silently and the tool started with the
  controller offline. It is a normal dependency again (as in v1): installing without ROS 2 sourced now fails
  loudly instead. The connection code itself (node name, services, message types) is unchanged since v1.
- The server console now prints a boxed **Controller connection problem** with the cause and the fix:
  ROS 2 not sourced, rclnodejs not installed/built, or ethercat_msgs types missing (it tries to generate them
  once by itself). The Network page shows the same in plain words.
- New `start-robot.sh [workspace/install/setup.bash]`: sources ROS 2 and your workspace, installs if needed,
  builds the UI if needed, starts the server. Optional `WORKSPACE_SETUP` is also sourced when starting the
  SDO server.
- The zip includes the built UI (`client/dist`) again, so `npm start` serves the page without a build.

## v3.2: codes and parameters from the SV660N manuals

### Fault codes
- Checked every fault and warning code in the SV660N Advanced User Guide tables against the app: all 108 were
  already there. The manuals mention 8 more codes without describing them: **E108.4, E120.3, E120.9, EB01.0,
  E939.0, E939.1, E939.2, E939.3**. They are now in `data/faults.json`, marked *Limited info*, with what the
  Commissioning Guide does say (related parameters, masking bits). Their full descriptions are in the separate
  SV660N Troubleshooting Guide (19011908), which was not supplied.
- Fixed: E140.0/E140.1 and E640.0/E640.1 report the same code from the drive, so the fault log always showed the
  first one. It now shows both ("E640.0 / E640.1") with causes for both and a note explaining why.
- Reset is offered for a limited-info fault in slot 1 (the drive refuses if it is not resettable).

### Parameter catalog
- New `data/parameter_catalog.json`: 484 parameters from the SV660N Commissioning Guide (H00 to H31 groups and
  the CiA402 6000h objects) with register, data type, limits, default, units, change condition and the values
  the manual names. Served at `GET /api/parameter-catalog`.
- Parameters editor: **Pick from the SV660N manual** search (364 settable parameters). One pick fills name,
  index, sub-index, type, default, min/max, units, group and description; every field stays editable.
- Parameters with named values (DI/DO functions, modes, etc.) keep them, and the config grid shows a list
  ("31 · Home switch") instead of a number box. `driver_config.json` entries may now carry `param` and `options`.

## v3.1: tighter layout, no ROS wording

### Space
- Smaller page margins, card padding, header and sidebar; pages use the full window width instead of a centred
  column (History, Network, SDO console, Fault codes were capped at ~1000 px).
- Overview: the four status boxes are one compact strip; all six drive tiles fit on one row on a laptop screen,
  two per row on a phone. Tables, config grid, fault map and help sections are denser.

### No ROS wording for the operator
- UI text: "ROS 2" / "backend" became **Controller** (Connected / Not connected / App server offline); the
  "SDO server" node switch became **Drive communication** (On / Off). Node, package, service names, PID and the
  launch command are no longer shown anywhere; the Network page has one plain **Controller** card.
- Server: every JSON response from `/api` passes through `server/lib/plainWords.js`, which rewrites ROS error
  text (e.g. "Service '/ethercat_manager/set_sdo' not available" → "Drive communication is not running",
  timeouts → "The drive did not answer within … ms"). History entries are rewritten the same way.
- Nothing changed in how the server talks to the hardware: node, package and service names are the same
  internally. Server console logs still use the technical names for whoever maintains the PC.
- Your own recipe notes are left as written (the "Homing Recipe" note mentions a node).

## v3.0: calmer look, editable parameters, fault map, help

### Look
- **Light by default**: white work surfaces on a cool grey canvas, so cards, tables and inputs separate clearly.
  In v2.2 the graphite surfaces were within a few percent of each other, which is why everything blended.
  Dark is still one click away (bottom of the sidebar) and has more contrast between layers than before.
- **Dark slate sidebar** in both themes to anchor navigation; **one blue accent** for "act here / selected".
  Green, amber and red appear only for machine state that needs attention.
- **Less on screen:** the sidebar bus panel and header clock are gone (both duplicated other views); header status
  is one quiet strip; uppercase micro-labels replaced by sentence-case titles; KPIs show label and value only;
  drive tiles lost their boxes and show Reset only when a drive has an active fault; config cells only show the
  drive value when it differs.

### Driver config: add your own parameters
- **Parameters** button opens an editor: add, edit, reorder and remove parameters with name, index/sub-index (hex),
  data type, default, and optional units, min/max, group and description.
- Saved to `data/driver_config.json` (same file and format v1 used; the new fields are optional), validated
  server-side (`PUT /api/driver-config`): hex ranges, known data type, default within min/max, no duplicate register.
- Min/max are enforced on every cell before anything can be written. Groups replace the index heading when set.

### Fault log, redesigned
- **Read latest fault** (slot 1 on every drive), **Read all 9 slots**, or read one chosen slot.
- One **fault map**: drives as rows, slots as columns, newest on the left. Faults red, warnings amber, empty slots a dot.
- Click a cell for a **detail panel**: the fault, severity, resettable or not, the drive state when it happened
  (speed, bus voltage, I/O, timestamp, 603Fh/203Fh) and numbered causes with Check / Fix steps.
- **Faults found** groups the same code across drives and slots, most frequent first.
- One-line summary: active faults, drives with past faults only, clear, unreadable.
- Overview now counts only **active** faults (slot 1); older ones show as "past faults".
- The read log is hidden behind "Show read log". PDF export and the `error_log.json` snapshots are unchanged.

### Help page
- What the tool is for, getting started, every page, configuring drives (incl. adding parameters), finding faults,
  troubleshooting and terms.

### Check on the real drives
- Add a parameter you know (from the manual) and confirm it reads back the drive's value.
- Tested only on the simulated bus.

## v2.2: per-drive configuration, new look, phone and tablet

### Driver config: set every drive, apply once
- The page is now a grid of **parameters × drives**. Each cell is the value you want on that drive. A **Template**
  column holds the default (from `driver_config.json`); a drive only stores a value when it differs from the
  template, and "use for all" copies the template across.
- **Read all drives** shows what is on each drive under every cell. Cells that differ from the drive are amber.
- **Review & apply** writes every drive in one go. The review lists, per drive, each register with
  `drive value → new value`. "Changed values" mode (default) skips registers that already match;
  "All selected" writes everything ticked.
- After each drive is written, the values are **read back and checked**. Each drive ends as verified, mismatch or
  failed, and **Retry failed** re-sends only what didn't land.
- Per-drive menu: read this drive, use the values read from it, copy its values to all drives, reset to template.
- Values are saved automatically to `data/drive_profiles.json`, so they survive restarts. Export/import as JSON and
  export as CSV are under **More**.
- On a phone the page switches to a one-drive-at-a-time view with drive tabs.

### New look
- **Industrial HMI style:** graphite background, one teal accent, and green/amber/red reserved for drive state, so
  colour always means something. Dark is the default (easier on a shop-floor screen), with a light theme toggle.
- **IBM Plex Sans and IBM Plex Mono** replace Inter. Plex was drawn for technical UIs; the mono face is used for
  register addresses, values and positions so digits line up. Bundled locally (OFL), so it works offline.
- Status chips with LEDs in the header (backend, SDO server, drives in OP) and a bus panel in the sidebar.

### Functional improvements
- **Overview page** (new start page): backend/SDO server/drives-in-OP/fault KPIs, a tile per drive with its state
  and last fault, and one-click Faults, Config and Fault reset per drive.
- **History page**: every recipe run, configuration write, fault read, fault reset, manual SDO write and SDO server
  start/stop is logged to `data/history.json` (newest 1000 kept), searchable and exportable as CSV.
- **Fault log**: reset button on faulted drives; results feed the overview tiles.
- **Recipes**: after a run, export the result matrix as CSV and **re-run on the drives that failed**. Recipes can be
  duplicated.
- **Network page**: "Configure" opens that drive in Driver config.

### Responsive
- Below 1180 px the sidebar becomes an icon rail; below 760 px it becomes a slide-out menu, tables stack into
  cards, dialogs become bottom sheets and recipes switch between list and detail.

### Check on the real drives
- The read-back verify after apply: confirm the values read back match what was written for every data type.
- "Changed values" mode relies on a fresh read; if a drive wasn't read, every selected register is written.
- Tested only on the simulated bus (`npm run dev:mock`).

## Visual refresh (v2.1)

Only the look changed in this round. No API or behaviour changes.
- **Shell:** a navy sidebar with a live bus panel that colours each drive by EtherCAT state (green is OP, amber is PREOP/SAFEOP/INIT, red is error). The header shows the page icon and title, and status pills are coloured by state.
- **Colour:** blue-indigo accent, gradient primary, run and stop buttons, cards on a cool tinted canvas, and stronger state badges.
- **Pages:**
  - The fault log has stat cards with icons and a colour bar, and faulted drives are tinted red.
  - The run matrix shows check icons and a green summary.
  - Activity logs are dark consoles.
  - Drive chips show a state dot.
- **Motion:** sections fade in, cards lift on hover and progress bars animate. All of this turns off when the OS "reduce motion" setting is on.
- **Font:** Inter is bundled locally (48 KB, SIL Open Font License in `client/src/assets/fonts/`), so it works on an offline PC.

## Check these on the real drives first

These behave differently from v1 on purpose. They were only tested against the simulated bus.

1. **Recipe step delay runs once per step, not once per drive.** v1 waited after every drive, so a 5 s
   "Software reset" step on 6 drives took 30 s. Now every selected drive gets the step, then the delay runs once,
   so each drive still gets at least the full delay before its next step. This matches the server-side
   `/api/recipes/execute` that v1 already had.
2. **"Stop a drive's sequence after its first failed step"** is on by default in the run dialog. If step 2 fails
   on J3, the rest of J3's steps are skipped and the other drives carry on. Untick it to get v1's behaviour.
3. **Locked recipes can be run.** v1's lock dialog said "execution is still possible", but the Run button was
   disabled. Locking now only blocks editing and deleting.
4. **SDO calls are serialised in the backend.** Only one SDO request goes to `ethercat_manager` at a time. This
   stops the fault-log "select slot, then read" sequence being interleaved with other traffic. If you relied on
   parallel SDO calls for speed, this will be slower.
5. **The password is checked by the server** (`SDO_PASSWORD`, default still `123`). The old one could be read from
   the browser's JavaScript.

## Bugs fixed

### Backend
- **Command injection:** `/api/node/start` pasted `package_name` / `node_name` from the request into a bash command.
  They are now validated and passed as arguments, and starting the node needs the password on the server.
- **Fake rate limiting in `/api/recipes/execute`:** every drive's request started at once, and the "200 ms stagger"
  only awaited promises that were already running. The requests now really run one after another.
- **Shared client destroyed on timeout:** a timed-out service call destroyed the pooled client while other calls were
  still waiting on it, so those calls hung until they timed out too.
- **Recipe data loss:** a corrupt `recipe.json` was read as "no recipes". The UI then created and saved a fresh
  recipe over it. Now the error is shown, nothing is overwritten, and every save keeps `recipe.json.bak`.
- **Black-box log too large:** each snapshot carried the full fault-database text for every slot. A full run could
  exceed Express's 100 KB body limit, so the save failed, and the log grew by about 100 KB per run. Snapshots now
  store a reference to the fault entry, and the body limit is 5 MB.
- **`/api/slaves`:** the command had no timeout, and a missing `ethercat` binary could answer the request twice,
  which can crash the server with "headers already sent".
- **Wrong working directory:** `data/` and `public/` were resolved from the shell's current directory, so starting
  the server from anywhere else broke it.
- **Homing results:** batch homing always returned `success: true`, single homing ignored the drive's reply, and the
  4 s settle delay was skipped after a failed step.
- **Node stop timers:** the 3 s and 7 s safety timers could reset the state of a node started again in the meantime.
- **SDO validation:** an SDO write with an empty value sent `""` to the drive, and invalid indexes weren't
  rejected clearly. Both now return 400 with a message.
- **Error responses:** malformed JSON requests returned an HTML error page, and `crashedRecently` returned
  null or a number instead of a boolean.

### Fault log
- **Wrong "no fault" result:** with the SDO node down, every read failed but each drive was reported "EMPTY",
  and the stats said all drives were OK. Failed reads are now shown as communication errors.
- **Slot selection failure ignored:** if the write to `0x200B:22` failed, the previous slot's data was shown as the
  requested slot. The read now stops with an error.
- **Missing warnings:** fault codes in the `warnings` part of `faults.json` showed as "not in fault DB".
- **Hard-coded drive count:** it always read 6 drives instead of the drives found by the scan. It still falls back
  to 6 when there is no scan.
- **Stale stats:** the stat cards didn't update when switching between Single slot and Black box.
- **PDF report:** the ✓ and ⚠ symbols printed as garbage, because jsPDF's Helvetica doesn't have them. jsPDF also
  came from a CDN, which fails on an offline shop-floor PC. It is now bundled and loaded only when you export.

### Driver config
- **Defaults saved after failed writes:** edited values were stored as new defaults in `driver_config.json` even
  when the write to the drive failed. Now that happens only if the write succeeded on every target drive.
- **Result and progress:** the result column showed only the last drive's result. Progress jumped from 0 to 100 %
  because it was one request. Each write now updates progress live, the result column shows `ok/total`, and you
  can cancel.
- **Current value:** the column spun forever until you pressed Refresh. It now shows "—" until you read values,
  and you can pick which drive to read from.
- **No value checks:** there was no type or range check, so 70000 could be sent to a `uint16` register.

### Recipes
- **Expected values:** negative values ("-5") and ranges with negatives ("-1-5", which your Homing Recipe uses)
  were treated as malformed and always passed. Hex values ("0x1F") read as 0.
- **Failed step skipped its delay:** the next step then hit the drive immediately.
- **Deleting wasn't saved:** a deleted recipe came back after a reload.
- **Discard and unlock:** "Discard" reloaded everything and jumped to the first recipe. Cancelling "Unlock & edit"
  left the recipe unlocked in memory.
- **Run count:** saving the run count re-saved the whole recipe book, including any half-typed edits.
- **Status changed on load:** a recipe set to "Draft" was forced back to "Ready" on every load.
- **Empty values:** the value field was a number input, so an empty value became 0 and was written to the drive.
- **Ctrl+S:** it also fired outside edit mode.

### General UI
- **Localhost only:** the API URL was hard-coded to `http://localhost:3045`, so the UI only worked in a browser on
  the robot PC.
- **Password visible:** `sdoPassword: '123'` was in the browser JavaScript.
- **Clashing script names:** `recipe-book-multidriver.js` redefined `toast()` and `fetchPresets()` from
  `app.js` / `api.js`, and only worked because of script load order.
- **Slave table columns:** the header said STATUS then NAME but rows rendered name then status. The JOINT column
  showed the 0-based position while the batch panel called the same drive J1. Drives are now J1 = position 0
  everywhere, with the position shown next to it.
- **Unsafe search highlighting:** Fault Lookup inserted unescaped text into the page, so any `<` or `&` in the
  database broke it. The filter also crashed on entries without `faultRange`.
- **Polling:** two status pollers (5 s and 3 s) ran even in background tabs. Now one poller runs only while the
  tab is visible.

## Why the UI is lighter
- **Fewer moving parts:** one sidebar, one page at a time. Before, three columns, a drawer and about ten modals
  were in the DOM all the time.
- **Smaller downloads:** pages and jsPDF load on demand. The first screen loads about 70 KB gzipped. v1 loaded about
  10,000 lines of CSS and JS up front, plus Google Fonts and jsPDF from CDNs.
- **Less re-rendering:** the fault-code reference renders a fault's causes only when you open it. Status polling
  no longer re-renders the open page.
