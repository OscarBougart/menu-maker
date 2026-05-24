// ─────────────────────────────────────────────────────────────
// THEME — single source of truth for ALL colors in the app.
//
// Edit values here. They are injected as CSS variables on
// <html> at startup, so every rule in styles.css that uses
// var(--panel-bg), var(--menu-accent), etc. will update.
// ─────────────────────────────────────────────────────────────

export const THEME = {
  // ── Sidebar panels ──────────────────────────────
  'panel-bg':         '#0f2940',   // main panel background
  'panel-bg-deep':    '#0a1f33',   // deeper panel / sub-blocks
  'panel-text':       '#e8f0f8',   // primary text on panels
  'panel-text-dim':   '#8aaac8',   // secondary text on panels
  'panel-text-faint': '#4d6e88',   // faint / placeholder text on panels

  // ── Canvas (center work area) ───────────────────
  'canvas-bg':        '#f7f9fc',   // canvas background
  'canvas-text':      '#0f2940',   // primary text on canvas
  'canvas-text-dim':  '#3d6080',   // secondary text on canvas
  'canvas-text-faint':'#4d6e88',   // faint text on canvas
  'canvas-border':    '#3d6080',   // borders / dividers on canvas

  // ── Accent ──────────────────────────────────────
  'accent':           '#3b8bbc',   // primary accent (buttons, focus, icons)
  'accent-bright':    '#62b8f0',   // hover / brighter accent
  'chrome':           '#6a90aa',   // neutral icon / label color

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
