import { AlertOctagon, BookOpen, CloudDownload, Cpu, History, LayoutDashboard, Network, SlidersHorizontal, Terminal } from 'lucide-react';

const SECTIONS = [
  { id: 'what', title: 'What this tool is for' },
  { id: 'start', title: 'Getting started' },
  { id: 'pages', title: 'The pages' },
  { id: 'config', title: 'Configuring drives' },
  { id: 'faults', title: 'Finding faults' },
  { id: 'update', title: 'Updates and problem reports' },
  { id: 'trouble', title: 'Troubleshooting' },
  { id: 'terms', title: 'Terms' },
];

const PAGES = [
  { icon: LayoutDashboard, name: 'Home', go: 'overview', text: 'Everything at a glance: is the controller connected and drive communication on, which drives are ready, which drives had a fault at the last check, and what was done recently. Each drive card has shortcuts to its faults, its settings and a fault reset.' },
  { icon: BookOpen, name: 'Recipes', go: 'recipes', text: 'Saved step-by-step jobs (homing, resets, mode changes) that run on several drives at once. You see the result of every step on every drive as it runs. If a step fails, the rest of that drive’s steps are skipped by default, and History records exactly which step failed on which drive.' },
  { icon: AlertOctagon, name: 'Faults', go: 'faults', text: 'Reads the last 9 faults each drive remembers and explains every code: the cause, what to check, how to fix it, and the speed, voltage and inputs at the moment it happened.' },
  { icon: SlidersHorizontal, name: 'Drive settings', go: 'config', text: 'Set values for each drive, review what will change, and write all drives in one click. Values are read back afterwards to confirm they were saved.' },
  { icon: History, name: 'History', go: 'history', text: 'A record of everything this tool changed on the drives: recipe runs (with the failed step and drive), settings changes, manual writes, fault reads and resets. Searchable and exportable as a spreadsheet (CSV).' },
  { icon: Cpu, name: 'Fault guide', go: 'codes', text: 'Every Inovance fault and warning code with its causes and fixes, searchable by code or name, without reading anything from the drives.' },
  { icon: Network, name: 'Drives & connection', go: 'network', text: 'The drives found on the network cable with their name and state, plus the controller connection and drive communication switch.' },
  { icon: CloudDownload, name: 'Software update', go: 'update', text: 'Shows your version, checks for a newer one and lists what changed in it (new, improved, fixed). Installs it with one button and keeps the previous version so you can go back. Also the place to report a problem and see what happened to your reports.' },
  { icon: Terminal, name: 'Manual read/write', go: 'sdo', text: 'For advanced checks: read or change one value on one drive by its address. Password protected. Anything you repeat belongs in a recipe.' },
];

export default function HelpPage({ navigate }) {
  const jump = (id) => document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="page help">
      <nav className="help-toc" aria-label="On this page">
        <div className="eyebrow">On this page</div>
        {SECTIONS.map((s) => <button key={s.id} className="help-toc-item" onClick={() => jump(s.id)}>{s.title}</button>)}
      </nav>

      <article className="help-body">
        <section id="help-what" className="help-section">
          <h2>What this tool is for</h2>
          <p>
            The robot&apos;s joints are driven by Inovance servo drives connected by an EtherCAT network cable. Each drive is set up
            through numbered <strong>settings</strong> (for example gear ratio, input functions and limits) and keeps a record of its
            faults. Changing these by hand on six drives is slow and easy to get wrong.
          </p>
          <p>This tool talks to the drives through the robot&apos;s drive controller and lets you:</p>
          <ul>
            <li>see the state of every drive on the bus,</li>
            <li>keep one configuration per drive and write all of them in one step, with a check afterwards,</li>
            <li>run saved step-by-step jobs (recipes) on several drives,</li>
            <li>read and understand fault histories, and reset faults,</li>
            <li>keep a record of every change made.</li>
          </ul>
        </section>

        <section id="help-start" className="help-section">
          <h2>Getting started</h2>
          <ol className="help-steps">
            <li><strong>Check the header.</strong> The first item shows the controller connection (green means connected). The switch turns <em>drive communication</em> on; most actions need it on. The last chip shows how many drives are in OP.</li>
            <li><strong>Find drives</strong> with the refresh button at the top right if no drives are listed.</li>
            <li><strong>Open Home</strong> to see each drive. A red tile means the last fault read found an active fault.</li>
            <li><strong>Do the job</strong>: configure drives, run a recipe, or read faults. Every write is listed under History.</li>
          </ol>
        </section>

        <section id="help-pages" className="help-section">
          <h2>The pages</h2>
          <div className="help-pages">
            {PAGES.map((p) => (
              <button key={p.name} className="help-page" onClick={() => navigate(p.go)}>
                <p.icon size={18} />
                <span><strong>{p.name}</strong><span>{p.text}</span></span>
              </button>
            ))}
          </div>
        </section>

        <section id="help-config" className="help-section">
          <h2>Configuring drives</h2>
          <p>The Drive settings page is a grid: settings down the side, drives across the top.</p>
          <ol className="help-steps">
            <li><strong>Choose the drives</strong> at the top. Untick a drive to leave it out of this job.</li>
            <li><strong>Read all drives</strong> to load what is on them now. A cell whose drive value differs from the one you want shows <span className="help-diff">drive: 5000</span> under it.</li>
            <li><strong>Set values.</strong> The <em>All drives</em> column is the value for every drive. Type in a drive&apos;s cell to give that drive its own value (shown in bold with a reset arrow). The grid saves itself.</li>
            <li><strong>Review &amp; apply.</strong> The review lists, per drive, each value that will change from what to what. Apply writes every drive, then reads each value back. Drives end as <em>verified</em> or <em>failed</em>; <em>Retry failed</em> resends only what did not land.</li>
          </ol>
          <h3>Adding parameters</h3>
          <p>
            Click <strong>Edit list</strong> on the Drive settings page to add, edit, reorder or remove parameters. In <strong>Add parameter</strong>,
            search the <em>Pick from the SV660N manual</em> list by name, H-code (e.g. <code>H03.02</code>) or register
            (e.g. <code>2005:08</code>). Picking one fills in the index, sub-index, data type, default, limits, units and description
            from the drive manual; you can still change any field. Parameters that the manual gives named values for (such as DI
            functions) show as a list in the grid instead of a number box.
          </p>
          <p>
            You can also fill the form by hand: name, index and sub-index in hex, data type and default are required. Limits are
            checked before anything is written. The list is saved in <code>data/driver_config.json</code>.
          </p>
          <p className="callout callout-info small">&ldquo;Changed values&rdquo; mode writes only what differs from what was read. If a drive was not read, every selected parameter is written to it.</p>
        </section>

        <section id="help-faults" className="help-section">
          <h2>Finding faults</h2>
          <p>Each drive remembers its last nine faults. Record 1 is the most recent; record 9 the oldest.</p>
          <ul>
            <li><strong>Read latest fault</strong> reads record 1 on every drive: a quick &ldquo;what is wrong now&rdquo; check.</li>
            <li><strong>Read full history</strong> reads all nine records and lets you save a PDF report.</li>
            <li>The <strong>fault map</strong> shows drives as rows and records as columns, newest on the left. Red is a fault, amber a warning, a dot means no fault. Click any fault for its cause, the speed, bus voltage and I/O at the time, and the fix.</li>
            <li><strong>Faults found</strong> groups the same code across drives. A code on several drives usually points to a shared cause such as supply voltage or wiring.</li>
            <li>A drive with an active resettable fault has a <strong>Reset</strong> button. Reset clears the fault state; the history stays.</li>
          </ul>
        </section>

        <section id="help-update" className="help-section">
          <h2>Updates and problem reports</h2>
          <h3>Installing a new version</h3>
          <ol>
            <li>Open <strong>Software update</strong> and press <strong>Check for updates</strong>. Newer versions are listed with what changed.</li>
            <li>Press <strong>Install</strong> and enter the password. The new version is downloaded and prepared while this one keeps running. Nothing changes on the drives.</li>
            <li>When it says the version is ready, press <strong>Restart now</strong> (not during a recipe). The page reloads in the new version.
              If there is no Restart now button, close the tool and start it again.</li>
          </ol>
          <p>
            If the new version does not start, or the drives answer worse than before the update, the tool goes back to the previous
            version by itself and says so on the Software update page. You can also go back by hand with <strong>Go back to …</strong>.
            Before every update a copy of your recipes and drive settings is saved, and going back can put them back as well.
          </p>
          <p>
            Install, Restart now and Go back wait while a recipe runs or drive settings are being written. Only versions marked as
            checked can be installed; a version shown as <strong>Not checked yet</strong> is still being checked by the maintainer.
          </p>
          <h3>Setting up a PC (maintainer)</h3>
          <p>
            Download the tool with <code>git clone</code> (or unzip it), then <code>npm install</code> and <code>npm start</code>.
            Nothing else is needed: an update changes the tool&apos;s own folder. In <strong>Update settings</strong> at the bottom of the
            Software update page enter the report server address, and the repository address if the tool was unzipped instead of
            cloned. With <code>npm start</code> the <strong>Restart now</strong> button works; with <code>npm run dev</code> close and
            start the tool again after an update.
          </p>
          <h3>Reporting a problem</h3>
          <p>
            Fill in <strong>Report a problem</strong> on the Software update page. Without internet the report is kept on this PC and sent
            when the connection is back. <strong>My reports</strong> shows each report&apos;s number and what the maintainer did,
            for example &quot;Being fixed&quot; or &quot;Fixed in version 3.6.0&quot;. You can add up to 5 pictures with
            <strong> Add picture</strong>, or paste a screenshot into the form; they are sent with the report.
          </p>
        </section>

        <section id="help-trouble" className="help-section">
          <h2>Troubleshooting</h2>
          <dl className="help-faq">
            <dt>&ldquo;App server offline&rdquo; in the header</dt>
            <dd>The tool&apos;s server is not running or the browser cannot reach it. Start the tool again on the robot PC.</dd>
            <dt>&ldquo;Controller offline&rdquo;</dt>
            <dd>The tool started but could not connect to the drive controller software. Check the controller is installed and running on the robot PC, then restart the tool.</dd>
            <dt>Reads or writes fail on every drive</dt>
            <dd>Drive communication is off. Turn on the switch in the header (it asks for the password).</dd>
            <dt>One drive fails</dt>
            <dd>Check its state on the Drives &amp; connection page. A drive must be <em>Ready</em> or <em>Starting</em> to answer; <em>Not ready</em> usually means a cable or power problem.</dd>
            <dt>A drive is greyed out when I run a recipe</dt>
            <dd>The recipe is limited to other drives. Edit the recipe and change <em>Drives this recipe can run on</em>.</dd>
            <dt>A software reset step shows as failed</dt>
            <dd>The drive restarts while it handles the reset, so it cannot confirm it. Recipes recognise the software reset (H0D.00 = 1) and any step marked <em>The drive restarts after this step</em>: they wait until the drive answers again (up to 30 s) and then continue.</dd>
            <dt>A value is written but does not verify</dt>
            <dd>Some parameters only take effect after a power cycle, or are clamped by the drive. Check the drive manual for that object.</dd>
          </dl>
        </section>

        <section id="help-terms" className="help-section">
          <h2>Terms</h2>
          <dl className="help-terms">
            <dt>Easy code (H-code)</dt><dd>The code the drive panel and the SV660N manual use, e.g. <code>H05.07</code> or <code>H0D.00</code>. Every search box accepts it (<code>H5.7</code> and <code>h05.07</code> work too, and <code>H05</code> lists the whole group), and steps, settings and history show it next to the address.</dd>
            <dt>Setting address</dt><dd>Where a value lives on the drive, e.g. <code>2005:08</code>. An easy code maps to it directly: <code>Hxx.yy</code> is index <code>20xx</code>, sub-index <code>yy + 1</code>, so <code>H05.07</code> = <code>2005:08</code>. Objects outside the 2000 range (such as <code>6041:00</code>) have no easy code.</dd>
            <dt>Ready / Starting / Safe mode / Not ready</dt><dd>Drive states on the network (technically OP / PREOP / SAFEOP / INIT). Ready means fully running.</dd>
            <dt>J1…J6</dt><dd>Joint labels. J1 is the drive at bus position 0.</dd>
            <dt>All drives value</dt><dd>The value of a setting used by every drive that has no value of its own.</dd>
            <dt>Recipe</dt><dd>A saved list of read and write steps run in order on selected drives.</dd>
            <dt>Recipe drives</dt><dd>Set in the recipe editor under <em>Drives this recipe can run on</em>. <em>All drives</em> lets it run on any group. <em>Only some drives</em> limits it to the ticked drives: tick J1, J2 and J5 and you can run it on any group of those three; tick one drive and it runs on that drive only. Other drives are greyed out on the run screen. Recipes made before this option run on all drives until you change them.</dd>
          </dl>
        </section>
      </article>
    </div>
  );
}
