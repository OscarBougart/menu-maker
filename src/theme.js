// ─────────────────────────────────────────────────────────────
// THEME — single source of truth for ALL colors in the app.
//
// Edit values here. They are injected as CSS variables on
// <html> at startup, so every rule in styles.css that uses
// var(--panel-bg), var(--menu-accent), etc. will update.
// ─────────────────────────────────────────────────────────────

export const THEME = {
  // ── Sidebar panels ──────────────────────────────
  'panel-bg':         '#102236',   // main panel background
  'panel-bg-deep':    '#091b2c',   // deeper panel / sub-blocks
  'panel-text':       '#d0e4f5',   // primary text on panels
  'panel-text-dim':   '#7aaec6',   // secondary text on panels
  'panel-text-faint': '#527d97',   // faint / placeholder text on panels

  // ── Canvas (center work area — dark printing surface) ──
  'canvas-bg':        '#0d1920',   // dark canvas: menus pop regardless of paper color
  'canvas-text':      '#adc8de',   // primary text on canvas
  'canvas-text-dim':  '#5e8daa',   // secondary text on canvas
  'canvas-text-faint':'#3a6280',   // faint text on canvas
  'canvas-border':    '#1d3a50',   // borders / dividers on canvas

  // ── Accent ──────────────────────────────────────
  'accent':           '#1e7eb5',   // ink blue — specific, not generic SaaS
  'accent-bright':    '#45a8d8',   // hover / brighter accent
  'chrome':           '#5a8da8',   // neutral icon / label color

  // ── Menu sheet defaults ─────────────────────────
  'menu-bg':          '#ffffff',   // menu paper background
  'menu-text':        '#1a2535',   // menu primary text
  'menu-muted':       '#6b7a8d',   // menu secondary / muted text
  'menu-accent':      '#1b4f72',   // menu accent (lines, prices, ornaments)

  // ── Error ────────────────────────────────────────
  'error-bg':         '#7b1d1d',
  'error':            '#b91c1c',
  'error-text':       '#f87171',
};

// Shorthand used by MenuTemplate and App for JS-side fallbacks
export const MENU_DEFAULTS = {
  bg:     THEME['menu-bg'],
  text:   THEME['menu-text'],
  muted:  THEME['menu-muted'],
  accent: THEME['menu-accent'],
};
