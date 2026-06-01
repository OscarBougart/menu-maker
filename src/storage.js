// storage.js — browser-local persistence (localStorage).
// Replaces the old server disk routes (save/load/list/delete) so the
// deployed app needs no database: each visitor keeps their own menus
// and style templates in their own browser. The AI routes (extract /
// generate / merge) still hit the server.

const RULES_KEY = 'mm.rules';      // { [name]: rulesObject }
const MASTER_KEY = 'mm.master';    // the house-brain master object (or null)
const MENUS_KEY = 'mm.menus';      // { [key]: menuObject }

const safeName = (name) => (name || 'untitled').replace(/[^a-z0-9-_]/gi, '_');

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private-mode — fail soft */
  }
}

/* ── Style templates + master ── */

export function saveRules(name, rules) {
  const key = safeName(name);
  const all = readJSON(RULES_KEY, {});
  all[key] = rules;
  writeJSON(RULES_KEY, all);
  return key;
}

export function loadRules(name) {
  if (name === '_master') return readJSON(MASTER_KEY, null);
  const all = readJSON(RULES_KEY, {});
  return all[safeName(name)] || null;
}

export function listRules() {
  const all = readJSON(RULES_KEY, {});
  return {
    master: Boolean(readJSON(MASTER_KEY, null)),
    templates: Object.keys(all),
  };
}

export function saveMaster(master) {
  writeJSON(MASTER_KEY, master);
}

export function loadMaster() {
  return readJSON(MASTER_KEY, null);
}

/* ── Saved menus ── */

export function saveMenu(name, menu) {
  const key = safeName(name || 'menu-' + Date.now());
  const all = readJSON(MENUS_KEY, {});
  all[key] = menu;
  writeJSON(MENUS_KEY, all);
  return key;
}

export function loadMenu(key) {
  const all = readJSON(MENUS_KEY, {});
  return all[safeName(key)] || null;
}

export function listMenus() {
  const all = readJSON(MENUS_KEY, {});
  return Object.entries(all).map(([key, data]) => ({
    key,
    bar_name: data.bar_name || key,
    tagline: data.tagline || '',
    render_spec: data.render_spec || {},
  }));
}

export function deleteMenu(key) {
  const all = readJSON(MENUS_KEY, {});
  delete all[safeName(key)];
  writeJSON(MENUS_KEY, all);
}
