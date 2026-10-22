import { useEffect, useState } from 'react';
import { Activity, AlertOctagon, ArrowRight, Cpu, Plug, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { api } from '../api';
import { useApp, useHealth } from '../context/AppContext';
import NodeSwitch from '../components/NodeSwitch';
import { toast } from '../components/Toasts';
import { confirmDialog, Empty } from '../components/ui';
import { jointLabel, plural, stateLabel, stateTone } from '../lib/format';
import { faultStatus, setIntent, useStore } from '../lib/store';
import { HistoryRow } from './HistoryPage';

export default function OverviewPage({ navigate }) {
  const { slaves, scan, scanning, masterId } = useApp();
  const health = useHealth();
  const faults = useStore(faultStatus);
  const [history, setHistory] = useState(null);
  const [resetting, setResetting] = useState(null);

  useEffect(() => {
    api.history(8).then((r) => setHistory(r?.entries || [])).catch(() => setHistory([]));
  }, []);

  const opCount = slaves.filter((s) => stateTone(s.state) === 'ok').length;
  // Slot 1 is the drive's current fault; older slots are history.
  const isActive = (f) => f?.faults?.some((x) => x.slot === 1);
  const faulted = slaves.filter((s) => isActive(faults[s.position])).length;
  const nodeRunning = !!health.node?.running;

  const reset = async (pos) => {
    const ok = await confirmDialog({
      title: `Fault reset ${jointLabel(pos)}?`,
      message: 'Sends a DS402 fault reset (0x6040 = 0x80) to clear the fault state.',
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

  const openConfig = (pos) => { setIntent('config', { pos }); navigate('config'); };
  const openFaults = (pos) => { setIntent('faults', { pos }); navigate('faults'); };

  return (
    <div className="page">
      <div className="kpi-row">
        <Kpi icon={Plug} label="Controller" value={health.state === 'online' ? (health.mock ? 'Simulated' : health.ros2 ? 'Connected' : 'Not connected') : health.state === 'offline' ? 'App server offline' : '…'}
          tone={health.state === 'online' && health.ros2 ? 'ok' : health.state === 'connecting' ? '' : 'danger'} />
        <div className={`kpi ${nodeRunning ? 'ok' : 'warn'}`}>
          <span className="kpi-icon"><Activity size={16} /></span>
          <div className="kpi-text">
            <div className="kpi-label">Drive communication</div>
            <div className="kpi-value">{nodeRunning ? 'On' : 'Off'} <NodeSwitch variant="button" /></div>
          </div>
        </div>
        <Kpi icon={Cpu} label="Drives ready" value={slaves.length ? `${opCount} / ${slaves.length}` : '—'} tone={!slaves.length ? '' : opCount === slaves.length ? 'ok' : 'warn'} />
        <Kpi icon={AlertOctagon} label="Drives with a fault now" value={Object.keys(faults).length ? String(faulted) : '—'} tone={!Object.keys(faults).length ? '' : faulted ? 'danger' : 'ok'}
          hint={Object.keys(faults).length ? 'at the last fault read' : 'Read faults to fill this in'} />
      </div>

      {!nodeRunning && health.state === 'online' && (
        <div className="callout callout-warn">Drive communication is off. Recipes, configuration and fault reads need it on.</div>
      )}

      <section className="card">
        <div className="card-head">
          <div className="card-title">Drives</div>
          <span className="card-sub">{slaves.length ? plural(slaves.length, 'drive') : 'none scanned'}</span>
          <div className="card-actions">
            <button className="btn btn-sm" onClick={() => scan()} disabled={scanning}><RefreshCw size={13} className={scanning ? 'spin' : ''} /> Find drives</button>
          </div>
        </div>
        {slaves.length === 0 ? (
          <Empty title="No drives found">Press Find drives to look for drives on the network cable.</Empty>
        ) : (
          <div className="drive-grid">
            {slaves.map((s) => {
              const tone = stateTone(s.state);
              const f = faults[s.position];
              const hasFault = isActive(f);
              const past = !hasFault && f?.faults?.length > 0;
              return (
                <div key={s.position} className={`drive-tile ${hasFault ? 'fault' : tone}`}>
                  <div className="drive-tile-head">
                    <span className="drive-tile-id">{jointLabel(s.position)}</span>
                    <span className={`state-pill ${tone}`} title={`EtherCAT state: ${s.state}`}>{stateLabel(s.state)}</span>
                  </div>
                  <div className="drive-tile-name" title={`Bus position ${s.position}`}>{s.name || 'Unknown drive'}</div>
                  <div className={`drive-tile-fault ${hasFault ? 'fault' : f?.error ? 'warn' : ''}`}>
                    {!f ? 'Faults not read' : f.error ? `Read error: ${f.error}` : hasFault ? f.faults[0].label.replace(/^(Slot|Record) 1: /, '') : past ? `No active fault · ${plural(f.faults.length, 'past fault')}` : 'No fault'}
                    {hasFault && f.faults.length > 1 && <span className="muted"> +{f.faults.length - 1} in history</span>}
                  </div>
                  <div className="drive-tile-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => openFaults(s.position)} title="Read this drive's fault log"><AlertOctagon size={13} /> Faults</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => openConfig(s.position)} title="Open this drive's settings"><SlidersHorizontal size={13} /> Settings</button>
                    {hasFault && (
                      <button className="btn btn-sm btn-ghost" onClick={() => reset(s.position)} disabled={resetting !== null || !nodeRunning} title="Clear the active fault">
                        {resetting === s.position ? <span className="spinner" /> : <RotateCcw size={13} />} Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">Recent activity</div>
          <div className="card-actions"><button className="btn btn-ghost btn-sm" onClick={() => navigate('history')}>All history <ArrowRight size={13} /></button></div>
        </div>
        {history === null ? <div className="card-body muted">Loading…</div>
          : history.length === 0 ? <Empty title="Nothing yet">Recipe runs, settings changes, fault resets and manual writes show up here.</Empty>
            : <div className="history-list compact">{history.slice(0, 6).map((e) => <HistoryRow key={e.id} entry={e} compact />)}</div>}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, hint }) {
  return (
    <div className={`kpi ${tone || ''}`}>
      {Icon && <span className="kpi-icon"><Icon size={16} /></span>}
      <div className="kpi-text">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {hint && <div className="kpi-hint">{hint}</div>}
      </div>
    </div>
  );
}
