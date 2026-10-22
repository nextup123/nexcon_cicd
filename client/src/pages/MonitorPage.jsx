import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { Empty } from '../components/ui';
import { jointLabel, timeNow } from '../lib/format';

const REGISTERS = [
  { sub: '0x40', name: 'Not ready state', dtype: 'uint16', unit: '' },
  { sub: '0x43', name: 'Encoder temperature', dtype: 'int16', unit: '°C' },
  { sub: '0x01', name: 'Motor speed', dtype: 'int16', unit: 'rpm' },
  { sub: '0x14', name: 'Power-on time', dtype: 'int32', unit: '×0.1 h' },
  { sub: '0x1B', name: 'Bus voltage', dtype: 'uint16', unit: 'V' },
  { sub: '0x2A', name: 'Module temperature', dtype: 'int16', unit: '°C' },
];

/**
 * Polls 0x200B status registers. Off until you press Start, pauses while
 * the tab is hidden, and the next poll only starts after the previous one
 * finished — so it never piles up requests on the SDO service.
 */
export default function MonitorPage() {
  const { slaves, selected, masterId } = useApp();
  const [running, setRunning] = useState(false);
  const [interval, setIntervalMs] = useState(2000);
  const [values, setValues] = useState({});
  const [stats, setStats] = useState({ polls: 0, errors: 0, last: null });
  const runRef = useRef(false);

  const drives = slaves.filter((s) => selected.size === 0 || selected.has(s.position)).map((s) => s.position);

  useEffect(() => {
    runRef.current = running;
    if (!running) return undefined;
    let timer;
    const poll = async () => {
      if (!runRef.current) return;
      if (!document.hidden) {
        let errors = 0;
        for (const pos of drives) {
          for (const reg of REGISTERS) {
            if (!runRef.current) return;
            try {
              const r = await api.sdoGet({ master_id: masterId, slave_position: pos, sdo_index: 0x200b, sdo_subindex: reg.sub, sdo_data_type: reg.dtype }, { timeout: 6000 });
              setValues((v) => ({ ...v, [`${pos}:${reg.sub}`]: r?.success ? { v: r.sdo_return_value } : { err: r?.sdo_return_message || 'failed' } }));
              if (!r?.success) errors++;
            } catch (err) {
              errors++;
              setValues((v) => ({ ...v, [`${pos}:${reg.sub}`]: { err: err.message } }));
            }
          }
        }
        setStats((s) => ({ polls: s.polls + 1, errors: s.errors + errors, last: timeNow() }));
      }
      if (runRef.current) timer = setTimeout(poll, interval);
    };
    poll();
    return () => { runRef.current = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, interval, drives.join(','), masterId]);

  return (
    <div className="page">
      <div className="card">
        <div className="card-body row-wrap">
          <button className={`btn ${running ? '' : 'btn-primary'}`} onClick={() => setRunning(!running)} disabled={!drives.length}>
            {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start polling</>}
          </button>
          <select className="select input" style={{ width: 120 }} value={interval} onChange={(e) => setIntervalMs(Number(e.target.value))}>
            {[1000, 2000, 5000, 10000].map((ms) => <option key={ms} value={ms}>every {ms / 1000} s</option>)}
          </select>
          <span className="spacer" />
          <span className="muted small">{stats.polls} polls · {stats.errors} errors · last {stats.last || '—'}</span>
        </div>
      </div>
      {!drives.length && <Empty title="No drives">Scan the bus first. Selected drives are monitored (all when none is selected).</Empty>}
      {drives.map((pos) => (
        <div className="card" key={pos}>
          <div className="card-head"><div className="card-title">{jointLabel(pos)}</div><span className="muted small">position {pos}</span></div>
          <div className="card-body mon-grid">
            {REGISTERS.map((reg) => {
              const v = values[`${pos}:${reg.sub}`];
              return (
                <div key={reg.sub} className={`card mon-cell ${v?.err ? 'err' : ''}`} title={v?.err || `0x200B:${reg.sub.slice(2)}`}>
                  <div className="k">{reg.name}</div>
                  <div className="v">{v ? (v.err ? 'error' : v.v) : '—'}{v && !v.err && reg.unit && <span className="u">{reg.unit}</span>}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
