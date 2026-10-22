import { useState } from 'react';
import { Network, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { api } from '../api';
import { useApp, useHealth } from '../context/AppContext';
import NodeSwitch from '../components/NodeSwitch';
import { toast } from '../components/Toasts';
import { confirmDialog, Empty, StateBadge } from '../components/ui';
import { formatDateTime, jointLabel } from '../lib/format';
import { setIntent } from '../lib/store';

// Plain advice for each problem the server can detect at start-up.
const CONTROLLER_ISSUES = {
  no_ros_env: 'This tool was started without the drive controller environment loaded. Start it with start-robot.sh.',
  not_installed: 'The drive controller software is not installed in this tool\'s folder. Run start-robot.sh, which installs it.',
  no_msg_types: 'The tool is connected, but cannot build drive requests because the drive message definitions are missing. Start it with start-robot.sh and your workspace.',
  init_failed: 'The tool could not connect to the drive controller.',
};

export default function NetworkPage({ navigate }) {
  const { slaves, scan, scanning, scanError, masterId, selected, setSelected } = useApp();
  const health = useHealth();
  const [resetting, setResetting] = useState(null);
  const node = health.node || {};

  const reset = async (pos) => {
    const ok = await confirmDialog({
      title: `Fault reset ${jointLabel(pos)}?`,
      message: 'Sends a DS402 fault reset (0x6040 = 0x80) to clear the fault state and return the drive to Ready.',
      detail: `Master: ${masterId}   Drive: ${jointLabel(pos)} (pos ${pos})`,
      confirmText: 'Reset fault',
      tone: 'warn',
    });
    if (!ok) return;
    setResetting(pos);
    try {
      const r = await api.resetDrive(masterId, pos);
      toast(r?.success ? `${jointLabel(pos)}: fault reset sent` : `Reset failed: ${r?.sdo_return_message}`, r?.success ? 'success' : 'error');
    } catch (err) {
      toast(`Reset failed: ${err.message}`, 'error');
    } finally {
      setResetting(null);
    }
  };

  const configure = (pos) => {
    setIntent('config', { pos });
    navigate('config');
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <div className="card-title">Controller</div>
          <div className="card-actions"><NodeSwitch variant="button" /></div>
        </div>
        <div className="card-body">
          <dl className="kv-inline">
            <div><dt>Connection</dt><dd>{health.state !== 'online' ? 'App server offline' : health.mock ? 'Simulated' : health.ros2 ? 'Connected' : 'Not connected'}</dd></div>
            <div><dt>Drive communication</dt><dd><span className={`badge ${node.running ? 'badge-ok' : ''}`}>{node.running ? 'On' : 'Off'}</span></dd></div>
            {node.lastCrash && <div><dt>Stopped unexpectedly</dt><dd style={{ color: 'var(--danger)' }}>{formatDateTime(node.lastCrash)}</dd></div>}
          </dl>
          {!health.mock && (health.controllerIssue || health.rosError) && (
            <div className="callout callout-danger small" style={{ marginTop: 12 }}>
              {CONTROLLER_ISSUES[health.controllerIssue] || CONTROLLER_ISSUES.init_failed} The console window on the robot PC shows the exact cause and the command that fixes it.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Drives found</div>
          <span className="muted small">master {masterId}</span>
          <div className="card-actions">
            <button className="btn btn-sm" onClick={() => scan()} disabled={scanning}>
              <RefreshCw size={13} className={scanning ? 'spin' : ''} /> {scanning ? 'Scanning…' : 'Scan'}
            </button>
          </div>
        </div>
        {scanError && <div className="card-body" style={{ paddingBottom: 0 }}><div className="callout callout-warn small">{scanError}</div></div>}
        {slaves.length === 0 ? (
          <Empty icon={Network} title="No drives found">Press Find drives to look for drives on the network cable.</Empty>
        ) : (
          <table className="table table-stack">
            <thead>
              <tr>
                <th style={{ width: 44 }} />
                <th style={{ width: 70 }}>Joint</th>
                <th style={{ width: 80 }} title="Order on the network cable, starting at 0">Position</th>
                <th>Name</th>
                <th style={{ width: 100 }}>State</th>
                <th style={{ width: 220 }} />
              </tr>
            </thead>
            <tbody>
              {slaves.map((s) => (
                <tr key={s.position}>
                  <td data-label="Selected">
                    <label className="checkbox" title="Include in drive selection">
                      <input type="checkbox" checked={selected.has(s.position)}
                        onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(s.position); else n.delete(s.position); return n; })} />
                    </label>
                  </td>
                  <td data-label="Joint"><span className="joint">{jointLabel(s.position)}</span></td>
                  <td data-label="Position" className="mono">{s.position}</td>
                  <td data-label="Name">{s.name || 'Unknown'}</td>
                  <td data-label="State"><StateBadge state={s.state} /></td>
                  <td className="actions-cell">
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={() => configure(s.position)}><SlidersHorizontal size={13} /> Settings</button>
                      <button className="btn btn-sm" onClick={() => reset(s.position)} disabled={resetting !== null}>
                        {resetting === s.position ? <span className="spinner" /> : <RotateCcw size={13} />} Fault reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
