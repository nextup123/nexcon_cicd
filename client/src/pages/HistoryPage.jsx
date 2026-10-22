import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, BookOpen, Bug, CheckCircle2, ChevronDown, CloudDownload, MinusCircle, FileDown, History, Power, RefreshCw, RotateCcw, SlidersHorizontal, Terminal, XCircle } from 'lucide-react';
import { api } from '../api';
import { Empty, SearchInput, Spinner } from '../components/ui';
import { formatDateTime, jointLabel } from '../lib/format';
import { csvRow, downloadFile, stamp } from '../lib/history';
import { addrLabel } from '../lib/params';

/** Older entries stored "0x200D:01"; add the H-code so every entry reads the same. */
function withEasy(address) {
  const a = String(address ?? '');
  if (/H[0-9A-F]{2}\./i.test(a)) return a;
  const m = a.match(/^(?:0x)?([0-9a-f]{1,4}):(?:0x)?([0-9a-f]{1,2})$/i);
  return m ? addrLabel(parseInt(m[1], 16), parseInt(m[2], 16)) : a;
}

const KINDS = {
  recipe: { label: 'Recipe', icon: BookOpen },
  config: { label: 'Settings', icon: SlidersHorizontal },
  sdo: { label: 'Manual write', icon: Terminal },
  reset: { label: 'Fault reset', icon: RotateCcw },
  faults: { label: 'Fault read', icon: AlertOctagon },
  node: { label: 'Communication', icon: Power },
  update: { label: 'Software update', icon: CloudDownload },
  report: { label: 'Problem report', icon: Bug },
};
const OUTCOME = { ok: ['Done', 'ok'], partial: ['Some failed', 'warn'], failed: ['Failed', 'danger'], cancelled: ['Cancelled', 'warn'], info: ['Info', ''] };

const OUTCOME_ICON = { ok: CheckCircle2, partial: AlertTriangle, failed: XCircle, cancelled: MinusCircle };
const ACTION = { read: 'Read', write: 'Write', check: 'Check' };

/** "J1 step 3 · J4 step 2" — where it went wrong, readable without opening the entry. */
export function failureSummary(entry, max = 3) {
  const f = entry.failures || [];
  if (!f.length) return '';
  const parts = f.slice(0, max).map((x) => `${jointLabel(x.drive)}${x.step ? ` ${entry.kind === 'config' ? '' : 'step '}${entry.kind === 'config' ? x.name : x.step}` : ''}`);
  return parts.join(' · ') + (f.length > max ? ` · +${f.length - max} more` : '');
}

function FailureTable({ entry }) {
  const isRecipe = entry.kind === 'recipe';
  return (
    <div className="history-failures">
      <table className="table table-compact">
        <thead><tr><th>Drive</th>{isRecipe && <th>Step</th>}<th>{isRecipe ? 'Operation' : 'Setting'}</th><th>What was sent</th><th>Why it failed</th></tr></thead>
        <tbody>
          {entry.failures.map((f, i) => (
            <tr key={i}>
              <td><strong>{f.drive === null ? '—' : jointLabel(f.drive)}</strong></td>
              {isRecipe && <td className="num">{f.step ?? '—'}</td>}
              <td>{f.name}</td>
              <td className="muted small">{ACTION[f.action] || ''} <span className="mono">{withEasy(f.address)}</span>{f.value && f.action !== 'read' ? <> = <span className="mono">{f.value}</span></> : null}</td>
              <td className="text-danger">{f.error}{f.skipped > 0 && <div className="muted small">{f.skipped} later {f.skipped === 1 ? 'step was' : 'steps were'} skipped on this drive</div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryRow({ entry, compact }) {
  const [open, setOpen] = useState(false);
  const hasFailures = entry.failures?.length > 0;
  const where = failureSummary(entry);
  const k = KINDS[entry.kind] || { label: entry.kind, icon: History };
  const [olabel, otone] = OUTCOME[entry.outcome] || OUTCOME.info;
  const Icon = k.icon;
  return (
    <div className={`history-row ${otone}`}>
      <button className="history-head" onClick={() => entry.detail && setOpen(!open)} aria-expanded={open} disabled={!entry.detail}>
        <span className={`history-icon ${otone}`}><Icon size={15} /></span>
        <span className="history-main">
          <span className="history-title">{entry.title}</span>
          <span className="history-meta">
            <span>{formatDateTime(entry.at)}</span>
            {!compact && <span>{k.label}</span>}
            {entry.drives?.length > 0 && <span>{entry.drives.map(jointLabel).join(' ')}</span>}
            {entry.stats?.writes !== undefined && <span>{entry.stats.ok}/{entry.stats.writes} ok</span>}
          </span>
          {where && <span className="history-where"><XCircle size={12} /> Failed: {where}</span>}
        </span>
        <span className={`badge ${otone ? `badge-${otone}` : ''}`}>{OUTCOME_ICON[entry.outcome] && (() => { const I = OUTCOME_ICON[entry.outcome]; return <I size={12} className="badge-ic" />; })()}{olabel}</span>
        {entry.detail && !compact && <ChevronDown size={15} className={`chev ${open ? 'open' : ''}`} />}
      </button>
      {open && (hasFailures ? <FailureTable entry={entry} /> : <pre className="history-detail">{entry.detail}</pre>)}
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setError(null);
    api.history(1000).then((r) => setEntries(r?.entries || [])).catch((err) => setError(err.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries || []).filter((e) => (kind === 'all' || e.kind === kind)
      && (!q || `${e.title} ${e.detail} ${(e.drives || []).map(jointLabel).join(' ')} ${failureSummary(e, 99)}`.toLowerCase().includes(q)));
  }, [entries, kind, query]);

  const exportCsv = () => {
    const rows = [csvRow(['Time', 'Type', 'Outcome', 'Title', 'Drives', 'Failed drive', 'Failed step', 'Operation', 'Address', 'Value', 'Error', 'Detail'])];
    for (const e of shown) {
      const base = [e.at, KINDS[e.kind]?.label || e.kind, e.outcome, e.title, (e.drives || []).map(jointLabel).join(' ')];
      if (!e.failures?.length) { rows.push(csvRow([...base, '', '', '', '', '', '', e.detail])); continue; }
      // One CSV row per failed step, so a spreadsheet filter on drive or step works.
      for (const f of e.failures) rows.push(csvRow([...base, f.drive === null ? '' : jointLabel(f.drive), f.step ?? '', f.name, withEasy(f.address), f.value, f.error, '']));
    }
    downloadFile(`history_${stamp()}.csv`, rows.join('\n'), 'text/csv');
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-body stack">
          <div className="row-wrap">
            <div style={{ flex: '1 1 240px' }}><SearchInput value={query} onChange={setQuery} placeholder="Search title, detail or drive (J3)" /></div>
            <button className="btn" onClick={load}><RefreshCw size={14} /> Refresh</button>
            <button className="btn" onClick={exportCsv} disabled={!shown.length}><FileDown size={14} /> Export CSV</button>
          </div>
          <div className="chip-row">
            {[['all', 'All'], ...Object.entries(KINDS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        {error ? <div className="card-body"><div className="callout callout-danger">Could not load history: {error}</div></div>
          : entries === null ? <div className="empty"><Spinner large /></div>
            : shown.length === 0 ? <Empty icon={History} title="No entries">Recipe runs, settings changes, fault resets, fault reads and manual writes are recorded here.</Empty>
              : <div className="history-list">{shown.map((e) => <HistoryRow key={e.id} entry={e} />)}</div>}
      </div>
    </div>
  );
}
