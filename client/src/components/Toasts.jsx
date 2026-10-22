import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

/*
 * Module-level toast store: `toast()` can be called from anywhere (hooks,
 * plain functions) and only <Toasts/> re-renders when one appears.
 */
let items = [];
let nextId = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l(items));

export function dismissToast(id) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(message, type = 'info', ms = 3500) {
  const id = ++nextId;
  items = [...items.slice(-4), { id, message, type }];
  emit();
  setTimeout(() => dismissToast(id), ms);
}

const ICONS = { success: CheckCircle2, error: XCircle, warn: AlertTriangle, info: Info };

export function Toasts() {
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    return () => listeners.delete(setList);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon size={16} />
            <div className="toast-msg">{t.message}</div>
            <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
