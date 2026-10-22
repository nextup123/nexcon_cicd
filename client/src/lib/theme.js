// v3 key: the default changed from dark to light, so older saved choices are not reused.
const KEY = 'ethercat_theme_v3';
const BG = { light: '#f3f4f6', dark: '#0b0f14' };

export function initialTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch { /* ignore */ }
  return 'light';
}

export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BG[t]);
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}
