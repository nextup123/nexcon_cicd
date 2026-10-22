/**
 * All HTTP calls live here. URLs are relative ("/api/…"), so the UI works
 * from any machine on the network — the old build hard-coded
 * http://localhost:3045 and only worked in a browser on the robot PC.
 */

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body, { timeout = 20000, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(signal?.aborted ? 'Request cancelled' : `Request timed out after ${timeout / 1000}s`, 0);
    }
    throw new ApiError('App server unreachable — is it running?', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty / non-JSON body */ }

  // SDO-style endpoints answer errors as { success:false, ... } — hand
  // those back so the caller can show the drive's message.
  if (!res.ok && !(data && typeof data === 'object' && 'success' in data)) {
    throw new ApiError(data?.error || data?.message || `HTTP ${res.status}`, res.status);
  }
  return data;
}

const get = (p, o) => request('GET', p, undefined, o);
const post = (p, b, o) => request('POST', p, b ?? {}, o);
const put = (p, b, o) => request('PUT', p, b, o);
const patch = (p, b, o) => request('PATCH', p, b, o);

export const api = {
  health: () => get('/health', { timeout: 4000 }),
  verifyPassword: (password) => post('/auth/verify', { password }),

  slaves: (master = 0) => get(`/slaves?master=${master}`, { timeout: 15000 }),

  sdoGet: (payload, opts) => post('/sdo/get', payload, opts),
  sdoSet: (payload, opts) => post('/sdo/set', payload, opts),
  resetDrive: (master_id, slave_position) => post('/reset', { master_id, slave_position }),
  readFaultSlot: (master_id, slave_position, slot, opts) => post('/faults/read-slot', { master_id, slave_position, slot }, opts),

  presets: () => get('/presets'),
  faultDb: () => get('/fault'),
  driverConfig: () => get('/driver-config'),
  parameterCatalog: () => get('/parameter-catalog'),
  saveDriverDefault: (index, subindex, defaultValue) => patch('/driver-config', { index, subindex, defaultValue }),
  saveDriverConfig: (registers) => put('/driver-config', { registers }),

  recipes: () => get('/recipes'),
  saveRecipes: (data) => put('/recipes', data),
  markRecipeExecuted: (id) => post(`/recipes/${encodeURIComponent(id)}/executed`),

  driveProfiles: () => get('/drive-profiles'),
  saveDriveProfiles: (drives) => put('/drive-profiles', { drives }),

  history: (limit = 200) => get(`/history?limit=${limit}`),
  addHistory: (entry) => post('/history', entry),

  saveErrorLog: (snapshot) => post('/error-log', snapshot, { timeout: 30000 }),

  updateStatus: () => get('/updates/status'),
  checkUpdates: () => post('/updates/check', {}, { timeout: 15 * 60 * 1000 }),
  installUpdate: (version, password) => post('/updates/install', { version, password }),
  rollbackUpdate: (password, restoreData = true) => post('/updates/rollback', { password, restoreData }),
  activity: (id, what, active) => post('/activity', { id, what, active }),
  restartApp: (password) => post('/updates/restart', { password }),
  saveUpdateSettings: (data, password) => put('/updates/settings', { ...data, password }),
  updateHistory: () => get('/updates/history'),
  reports: () => get('/reports'),
  sendReport: (report) => post('/reports', report, { timeout: 30000 }),
  sendWaitingReports: () => post('/reports/send', {}, { timeout: 60000 }),

  nodeStart: (password, node_name, package_name) => post('/node/start', { password, node_name, package_name }, { timeout: 15000 }),
  nodeStop: () => post('/node/stop'),
};

/** Cache read-only reference data (presets, fault DB) for the session. */
const cache = new Map();
export function cached(key, loader) {
  if (!cache.has(key)) {
    const p = loader().catch((err) => { cache.delete(key); throw err; });
    cache.set(key, p);
  }
  return cache.get(key);
}
