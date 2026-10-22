import { useDeferredValue, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Chevron, Empty, Highlight, SearchInput, Spinner } from '../components/ui';
import { faultCategory, flattenDb } from '../lib/faults';
import { useFaultDb } from '../lib/hooks';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Drive', label: 'Drive faults', test: (sf) => faultCategory(sf.faultRange) === 'Drive' },
  { id: 'Axis', label: 'Axis faults', test: (sf) => faultCategory(sf.faultRange) === 'Axis' },
  { id: 'Warning', label: 'Warnings', test: (sf) => faultCategory(sf.faultRange) === 'Warning' },
  { id: 'Yes', label: 'Resettable', test: (sf) => sf.resettable === 'Yes' },
  { id: 'No', label: 'Not resettable', test: (sf) => sf.resettable === 'No' },
];

function matches(fault, sf, term) {
  if (!term) return true;
  const hay = [
    fault.faultCode, fault.faultName, sf.subFaultCode, sf.name, sf.errorCode603Fh, sf.auxiliaryCode203Fh,
    ...(sf.causesAndSolutions || []).flatMap((c) => [c.cause, c.solution, c.confirmingMethod]),
  ];
  return hay.some((h) => String(h || '').toLowerCase().includes(term));
}

function SubFault({ sf, term, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const cat = faultCategory(sf.faultRange);
  return (
    <div className="sub">
      <div className="sub-head" onClick={() => setOpen(!open)}>
        <span className="sub-code"><Highlight text={sf.subFaultCode} term={term} /></span>
        <span style={{ flex: 1, minWidth: 0 }}><Highlight text={sf.name} term={term} /></span>
        {cat !== '—' && <span className={`badge ${cat === 'Warning' ? 'badge-warn' : cat === 'Axis' ? 'badge-info' : ''}`}>{cat}</span>}
        {sf.limitedInfo
          ? <span className="badge" title="Listed in the SV660N manuals but not described in detail">Limited info</span>
          : <span className={`badge ${sf.resettable === 'Yes' ? 'badge-ok' : 'badge-danger'}`}>{sf.resettable === 'Yes' ? 'Resettable' : 'No reset'}</span>}
        <Chevron open={open} />
      </div>
      {open && (
        <div className="sub-body">
          <div className="row-wrap mono small muted">
            <span>603Fh <Highlight text={sf.errorCode603Fh || '—'} term={term} /></span>
            <span>203Fh <Highlight text={sf.auxiliaryCode203Fh || '—'} term={term} /></span>
            <span>Type {sf.type || '—'}</span>
          </div>
          {(sf.causesAndSolutions || []).map((cs, i) => (
            <div className="cause" key={i}>
              <div className="k">Cause {i + 1}</div>
              <div><Highlight text={cs.cause} term={term} /></div>
              {cs.confirmingMethod && <div className="confirm"><strong>Check:</strong> <Highlight text={cs.confirmingMethod} term={term} /></div>}
              {cs.solution && <div className="solution"><strong>Fix:</strong> <Highlight text={cs.solution} term={term} /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaultGroup({ fault, subs, term, autoOpen }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <div className="acc">
      <div className="acc-head" onClick={() => setOpen(!open)}>
        <span className="acc-code"><Highlight text={fault.faultCode} term={term} /></span>
        <span style={{ flex: 1, fontWeight: 550 }}><Highlight text={fault.faultName} term={term} /></span>
        <span className="muted small">{subs.length} sub-fault{subs.length === 1 ? '' : 's'}</span>
        <Chevron open={open} />
      </div>
      {/* Children only render when open — the old page built every cause for every fault up front. */}
      {open && (
        <div className="acc-body">
          {subs.map((sf) => <SubFault key={sf.subFaultCode} sf={sf} term={term} defaultOpen={autoOpen && subs.length === 1} />)}
        </div>
      )}
    </div>
  );
}

export default function FaultCodesPage() {
  const { db, error } = useFaultDb();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const term = useDeferredValue(query.trim().toLowerCase());

  const results = useMemo(() => {
    if (!db) return [];
    const f = FILTERS.find((x) => x.id === filter);
    const out = [];
    for (const fault of flattenDb(db)) {
      const subs = (fault.subFaults || []).filter((sf) => (!f.test || f.test(sf)) && matches(fault, sf, term));
      if (subs.length) out.push({ fault, subs });
    }
    return out;
  }, [db, filter, term]);

  if (error) return <div className="page"><div className="callout callout-danger">Could not load faults.json: {error}</div></div>;
  if (!db) return <div className="empty"><Spinner large /></div>;

  const total = results.reduce((n, r) => n + r.subs.length, 0);
  const autoOpen = !!term && results.length <= 3;

  return (
    <div className="page">
      <div className="card">
        <div className="card-body stack">
          <SearchInput value={query} onChange={setQuery} placeholder="Search code (E201, 0x2201), name, cause or solution…" autoFocus />
          <div className="row-wrap">
            <div className="tabs">
              {FILTERS.map((f) => (
                <button key={f.id} className={`tab ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            <span className="spacer" />
            <span className="muted small">{total} result{total === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
      {results.length === 0
        ? <Empty icon={BookOpen} title="No faults found">Try a different search or clear the filter.</Empty>
        : <div>{results.map(({ fault, subs }) => <FaultGroup key={`${fault.faultCode}-${term}-${filter}`} fault={fault} subs={subs} term={term} autoOpen={autoOpen} />)}</div>}
    </div>
  );
}
