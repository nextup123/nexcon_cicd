import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, HelpCircle, Lock, Search, X } from 'lucide-react';
import { api } from '../api';
import { stateLabel, stateTone } from '../lib/format';

/* ── Modal ──────────────────────────────────────────────── */
export function Modal({ open, onClose, size = '', children, dismissable = true, labelledBy }) {
  useEffect(() => {
    if (!open || !dismissable) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div>
    </div>
  );
}

/* ── Confirm dialog (promise based, module-level like toasts) ── */
let confirmListener = null;
export function confirmDialog(opts) {
  return new Promise((resolve) => {
    if (!confirmListener) return resolve(window.confirm(opts.message || opts.title));
    confirmListener({ ...opts, resolve });
  });
}

const TONE_ICON = { danger: AlertTriangle, warn: AlertTriangle, info: HelpCircle, ok: HelpCircle };

export function ConfirmHost() {
  const [state, setState] = useState(null);
  const okRef = useRef(null);
  useEffect(() => {
    confirmListener = setState;
    return () => { confirmListener = null; };
  }, []);
  useEffect(() => { if (state) setTimeout(() => okRef.current?.focus(), 30); }, [state]);
  if (!state) return null;
  const close = (v) => { state.resolve(v); setState(null); };
  const tone = state.tone || 'info';
  const Icon = state.icon || TONE_ICON[tone] || HelpCircle;
  const btnClass = { danger: 'btn-danger', ok: 'btn-success', warn: 'btn-danger' }[tone] || 'btn-primary';
  return (
    <Modal open onClose={() => close(false)} labelledBy="confirm-title">
      <div className="modal-head">
        <div className={`modal-icon ${tone}`}><Icon size={18} /></div>
        <h3 id="confirm-title">{state.title}</h3>
      </div>
      <div className="modal-body">
        {state.message && <p className="modal-message">{state.message}</p>}
        {state.detail && <div className="detail-box">{state.detail}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={() => close(false)}>{state.cancelText || 'Cancel'}</button>
        <button ref={okRef} className={`btn ${btnClass}`} onClick={() => close(true)}>{state.confirmText || 'Confirm'}</button>
      </div>
    </Modal>
  );
}

/* ── Password dialog: verified by the server ─────────────── */
export function PasswordDialog({ open, title, message, detail, confirmText = 'Unlock', onClose, onSubmit }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setPw(''); setError(''); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setError('');
    try {
      const err = await onSubmit(pw);
      if (err) { setError(err); setPw(''); inputRef.current?.focus(); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="pw-title">
      <form onSubmit={submit}>
        <div className="modal-head">
          <div className="modal-icon"><Lock size={17} /></div>
          <h3 id="pw-title">{title}</h3>
        </div>
        <div className="modal-body stack">
          {message && <p className="modal-message">{message}</p>}
          {detail && <div className="detail-box" style={{ marginTop: 0 }}>{detail}</div>}
          <input ref={inputRef} className={`input mono ${error ? 'invalid' : ''}`} type="password" placeholder="Password"
            value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!pw || busy}>
            {busy && <span className="spinner" />}{confirmText}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Returns an error message, or null when the password is accepted. */
export async function verifyPassword(pw) {
  try {
    const r = await api.verifyPassword(pw);
    return r?.success ? null : (r?.message || 'Incorrect password');
  } catch (err) {
    return err.message;
  }
}

/* ── Small pieces ───────────────────────────────────────── */
export function Spinner({ large }) {
  return <span className={`spinner ${large ? 'spinner-lg' : ''}`} aria-label="Loading" />;
}

export function Progress({ value, tone = '' }) {
  return <div className={`progress ${tone}`}><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={30} strokeWidth={1.5} />}
      {title && <strong>{title}</strong>}
      {children && <div>{children}</div>}
    </div>
  );
}

export function StateBadge({ state }) {
  const tone = stateTone(state);
  const cls = { ok: 'badge-ok', warn: 'badge-warn', danger: 'badge-danger' }[tone] || '';
  return <span className={`badge ${cls}`} title={`EtherCAT state: ${state || 'unknown'}`}>{stateLabel(state)}</span>;
}

export function Chevron({ open }) {
  return <ChevronDown size={16} className={`chev ${open ? 'open' : ''}`} />;
}

/** Highlights `term` inside `text` without injecting HTML. */
export function Highlight({ text, term }) {
  const str = String(text ?? '');
  if (!term) return str;
  const lower = str.toLowerCase();
  const t = term.toLowerCase();
  const parts = [];
  let i = 0;
  let k = 0;
  while (i < str.length) {
    const j = lower.indexOf(t, i);
    if (j === -1) { parts.push(str.slice(i)); break; }
    if (j > i) parts.push(str.slice(i, j));
    parts.push(<mark key={k++}>{str.slice(j, j + t.length)}</mark>);
    i = j + t.length;
  }
  return parts;
}

export function SearchInput({ value, onChange, placeholder, autoFocus, inputRef }) {
  return (
    <div className="input-icon" style={{ position: 'relative' }}>
      <Search size={15} />
      <input ref={inputRef} className="input" value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', right: 4, top: 4 }}
          onClick={() => onChange('')} aria-label="Clear"><X size={14} /></button>
      )}
    </div>
  );
}

/**
 * Searchable picker. `items` are filtered by `filter(item, query)`, rendered
 * with `render(item)`; keyboard ↑ ↓ Enter Esc supported.
 */
export function SearchSelect({ items, filter, render, onPick, placeholder, limit = 60, clearOnPick = true }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const query = q.trim().toLowerCase();
  const matches = (query ? items.filter((it) => filter(it, query)) : items).slice(0, limit);

  const pick = (it) => {
    onPick(it);
    if (clearOnPick) setQ('');
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[hi]) pick(matches[hi]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="ss" ref={wrapRef}>
      <div className="input-icon">
        <Search size={15} />
        <input className="input" value={q} placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey} />
      </div>
      {open && (
        <div className="ss-menu">
          {matches.length === 0 && <div className="ss-empty">No matches</div>}
          {matches.map((it, i) => (
            <div key={i} className={`ss-opt ${i === hi ? 'hi' : ''}`} onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }}>
              {render(it)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
