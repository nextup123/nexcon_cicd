import { lazy, Suspense, useEffect, useState } from 'react';
import {
  AlertOctagon, BookOpen, CloudDownload, Cpu, Gauge, History, LayoutDashboard, LifeBuoy, Menu, Moon, Network, RefreshCw, SlidersHorizontal, Sun, Terminal, X,
} from 'lucide-react';
import { useApp, useHealth } from './context/AppContext';
import NodeSwitch from './components/NodeSwitch';
import { Toasts } from './components/Toasts';
import { ConfirmHost, Spinner } from './components/ui';
import { stateTone } from './lib/format';
import { applyTheme, initialTheme } from './lib/theme';

// Pages load on demand so the first paint only ships what's on screen.
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const RecipesPage = lazy(() => import('./pages/recipes/RecipesPage'));
const FaultLogPage = lazy(() => import('./pages/FaultLogPage'));
const DriverConfigPage = lazy(() => import('./pages/DriverConfigPage'));
const SdoConsolePage = lazy(() => import('./pages/SdoConsolePage'));
const FaultCodesPage = lazy(() => import('./pages/FaultCodesPage'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const MonitorPage = lazy(() => import('./pages/MonitorPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const UpdatePage = lazy(() => import('./pages/UpdatePage'));

// The live monitor was hidden in the old UI; flip this on with VITE_ENABLE_MONITOR=1.
const SHOW_MONITOR = import.meta.env.VITE_ENABLE_MONITOR === '1';

const PAGES = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard, sub: 'All drives at a glance', component: OverviewPage, section: 'Daily work' },
  { id: 'recipes', label: 'Recipes', icon: BookOpen, sub: 'Saved step-by-step jobs for several drives', component: RecipesPage, flush: true, section: 'Daily work' },
  { id: 'faults', label: 'Faults', icon: AlertOctagon, sub: 'What went wrong on each drive, and how to fix it', component: FaultLogPage, section: 'Daily work' },
  { id: 'config', label: 'Drive settings', icon: SlidersHorizontal, sub: 'Set values for each drive and apply them in one go', component: DriverConfigPage, section: 'Daily work' },
  ...(SHOW_MONITOR ? [{ id: 'monitor', label: 'Live monitor', icon: Gauge, sub: 'Live values from the drives', component: MonitorPage, section: 'Daily work' }] : []),
  { id: 'history', label: 'History', icon: History, sub: 'Everything this tool changed on the drives', component: HistoryPage, section: 'Daily work' },
  { id: 'codes', label: 'Fault guide', icon: Cpu, sub: 'Look up any fault code', component: FaultCodesPage, section: 'Tools' },
  { id: 'network', label: 'Drives & connection', icon: Network, sub: 'Which drives are connected, and the controller link', component: NetworkPage, section: 'Tools' },
  { id: 'sdo', label: 'Manual read/write', icon: Terminal, sub: 'Read or change one value on one drive (advanced)', component: SdoConsolePage, section: 'Tools' },
  { id: 'update', label: 'Software update', icon: CloudDownload, sub: 'New versions, what changed, and reporting a problem', component: UpdatePage, section: 'Tools' },
  { id: 'help', label: 'Help', icon: LifeBuoy, sub: 'How to use this tool', component: HelpPage, section: 'Tools' },
];

const PAGE_KEY = 'ethercat_page';

function SystemStatus() {
  const h = useHealth();
  let tone = 'busy';
  let text = 'Connecting';
  if (h.state === 'offline') { tone = 'danger'; text = 'App server offline'; }
  else if (h.state === 'online' && !h.ros2) { tone = 'danger'; text = 'Controller offline'; }
  else if (h.state === 'online') { tone = 'ok'; text = h.mock ? 'Simulated' : 'Controller'; }
  return (
    <span className={`status-chip ${tone}`} title={h.rosError || h.controllerIssue ? 'Could not connect to the drive controller. See the Drives & connection page.' : text}>
      <span className="led" />
      <span className="hide-xs">{text}</span>
    </span>
  );
}

function DrivesStatus({ onOpen }) {
  const { slaves, scan, scanning } = useApp();
  const opCount = slaves.filter((s) => stateTone(s.state) === 'ok').length;
  const tone = !slaves.length ? 'idle' : opCount === slaves.length ? 'ok' : 'warn';
  return (
    <div className="status-group">
      <button className={`status-chip ${tone}`} onClick={onOpen} title="Drives ready / drives found. Open Drives & connection">
        <span className="led" />
        <span className="mono">{slaves.length ? `${opCount}/${slaves.length}` : '0'}</span>
        <span className="hide-xs">ready</span>
      </button>
      <button className="icon-btn" onClick={() => scan()} disabled={scanning} title="Find drives again" aria-label="Find drives again">
        <RefreshCw size={15} className={scanning ? 'spin' : ''} />
      </button>
    </div>
  );
}

export default function App() {
  const { version } = useHealth();
  const [pageId, setPageId] = useState(() => {
    const saved = localStorage.getItem(PAGE_KEY);
    return PAGES.some((p) => p.id === saved) ? saved : 'overview';
  });
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);

  const go = (id) => {
    setPageId(id);
    setNavOpen(false);
    try { localStorage.setItem(PAGE_KEY, id); } catch { /* ignore */ }
  };
  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); applyTheme(t); };

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const page = PAGES.find((p) => p.id === pageId) || PAGES[0];
  const Page = page.component;
  const sections = [...new Set(PAGES.map((p) => p.section))];

  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <img src="/logo_light.png" alt="NextUp Robotics" />
          <span className="brand-tag">EtherCAT config</span>
          <button className="icon-btn nav-close" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="nav">
          {sections.map((sec) => (
            <div key={sec} className="nav-group">
              <div className="nav-section">{sec}</div>
              {PAGES.filter((p) => p.section === sec).map((p) => (
                <button key={p.id} className={`nav-item ${p.id === page.id ? 'active' : ''}`} onClick={() => go(p.id)} title={p.label}
                  aria-current={p.id === page.id ? 'page' : undefined}>
                  <p.icon size={18} strokeWidth={1.75} />
                  <span className="nav-label">{p.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="theme-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span className="nav-label">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
          </button>
          <span className="version nav-label">{version ? `v${version}` : ''}</span>
        </div>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="header">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="header-titles">
            <span className="page-icon hide-xs"><page.icon size={17} /></span>
            <div>
              <h1 className="header-title">{page.label}</h1>
              <div className="header-sub">{page.sub}</div>
            </div>
          </div>
          <div className="header-right">
            <SystemStatus />
            <NodeSwitch />
            <DrivesStatus onOpen={() => go('network')} />
          </div>
        </header>
        <main className={`content ${page.flush ? 'flush' : ''}`}>
          <Suspense fallback={<div className="empty"><Spinner large /></div>}>
            <Page navigate={go} />
          </Suspense>
        </main>
      </div>

      <Toasts />
      <ConfirmHost />
    </div>
  );
}
