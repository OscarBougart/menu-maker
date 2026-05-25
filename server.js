// server.js — tiny local proxy that holds your Anthropic API key.
// The browser NEVER sees the key; it just calls /api/* on localhost.

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const MODEL = process.env.MENU_MODEL || 'claude-sonnet-4-20250514';

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('\n⚠  No ANTHROPIC_API_KEY found. Copy .env.example to .env and add your key.\n');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// in-memory upload (we forward bytes straight to the API, never to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const RULES_DIR = path.join(__dirname, 'rules');
const MENUS_DIR = path.join(__dirname, 'menus');
for (const d of [RULES_DIR, MENUS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// Strip ```json fences and parse defensively
function parseJson(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/* ─────────────────────────────────────────────
   1. EXTRACT RULES FROM AN UPLOADED MENU PHOTO
   ───────────────────────────────────────────── */
app.post('/api/extract-rules', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

    const mediaType = req.file.mimetype || 'image/jpeg';
    const base64 = req.file.buffer.toString('base64');

    const prompt = `You are a senior brand & menu designer. Study this cocktail/bar menu image and reverse-engineer its complete design system so it can be reused as a template.

AVAILABLE FONTS — you must only recommend fonts from these two lists:
Display (headings, drink names): Cormorant Garamond, Playfair Display, EB Garamond, Cinzel, Bodoni Moda, DM Serif Display, Libre Baskerville
Body (ingredients, labels): Archivo Narrow, Inter Tight, Jost, Barlow Condensed, DM Sans, Outfit

Return ONLY valid JSON, no markdown:
{
  "aesthetic_summary": "one vivid sentence naming the overall vibe",
  "palette": {
    "background": "#hex",
    "text_primary": "#hex",
    "text_muted": "#hex",
    "accent": "#hex",
    "accent_secondary": "#hex (or null)"
  },
  "typography": {
    "display_style": "describe the heading/name typeface character (e.g. high-contrast serif, geometric sans, classical roman caps)",
    "body_style": "describe the ingredient/label typeface character",
    "case_treatment": "how names/headings/ingredients are cased",
    "notes": "letter-spacing, weight contrast, anything distinctive",
    "recommended_display_font": "pick the single closest match from the Display list above",
    "recommended_body_font": "pick the single closest match from the Body list above"
  },
  "layout": {
    "structure": "how items are arranged (columns, dividers, alignment)",
    "price_placement": "where & how prices appear",
    "use_of_space": "dense | airy | balanced + notes"
  },
  "copy_voice": "how drink names and descriptions read (tone, length, literary devices)",
  "decorative_elements": "borders, ornaments, illustrations, textures, motifs",
  "design_rules": ["8-12 concrete, reusable rules a generator should follow"]
}`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = msg.content.map((b) => b.text || '').join('');
    const rules = parseJson(text);
    res.json(rules);
  } catch (err) {
    console.error('extract-rules error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   2. GENERATE A MENU FROM RULES + A PROMPT
   ───────────────────────────────────────────── */
app.post('/api/generate-menu', async (req, res) => {
  try {
    const { rules, prompt, drinks } = req.body;

    const sys = `You are the creative director of a world-class dark cocktail bar. You generate menus that obey an extracted design system precisely.`;

    const recommendedDisplay = rules?.typography?.recommended_display_font || null;
    const recommendedBody = rules?.typography?.recommended_body_font || null;
    const fontHint = recommendedDisplay
      ? `The design system recommends "${recommendedDisplay}" for display and "${recommendedBody}" for body — use these unless the brief overrides the mood.`
      : '';

    const userPrompt = `DESIGN SYSTEM (extracted from a reference menu the bar owner loves — obey it):
${JSON.stringify(rules, null, 2)}

THIS MENU'S BRIEF (colors, mood, count, anything the owner typed):
${prompt || '(none — use the design system defaults)'}

${drinks && drinks.trim()
  ? `DRINKS TO INCLUDE (honour names exactly; add 1-2 only if needed to complete the arc):\n${drinks}`
  : 'Compose 6-7 original cocktails fitting the brief and design system.'}

AVAILABLE FONTS — you must only use fonts from these lists:
Display: Cormorant Garamond, Playfair Display, EB Garamond, Cinzel, Bodoni Moda, DM Serif Display, Libre Baskerville
Body: Archivo Narrow, Inter Tight, Jost, Barlow Condensed, DM Sans, Outfit
${fontHint}
Choose the pairing that best matches the extracted typography character and brief mood.

Return ONLY valid JSON, no markdown. Echo back a final palette/type spec so the renderer can match the reference:
{
  "bar_name": "string",
  "tagline": "string — atmospheric",
  "note": "string — one-line front-of-house note",
  "render_spec": {
    "background": "#hex", "text_primary": "#hex", "text_muted": "#hex",
    "accent": "#hex",
    "display_font": "one font name from the Display list",
    "body_font": "one font name from the Body list"
  },
  "sections": [
    { "title": "string",
      "cocktails": [
        { "name":"string", "description":"string", "ingredients":"string (CAPS, spirit first)", "price":"string — a realistic price for an upscale cocktail bar, e.g. '14' or '16' (digits only, no currency symbol)" }
      ] } ]
}`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: sys,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = msg.content.map((b) => b.text || '').join('');
    const menu = parseJson(text);
    res.json(menu);
  } catch (err) {
    console.error('generate-menu error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   3. SAVE / LOAD RULE SETS + MENUS (to disk)
   ───────────────────────────────────────────── */
const MASTER_FILE = path.join(RULES_DIR, '_master.json');

// Save a single reference's extracted rules as its own named template
app.post('/api/save-rules', (req, res) => {
  const { name, rules } = req.body;
  const safe = (name || 'untitled').replace(/[^a-z0-9-_]/gi, '_');
  fs.writeFileSync(path.join(RULES_DIR, `${safe}.json`), JSON.stringify(rules, null, 2));
  res.json({ ok: true, file: `rules/${safe}.json`, key: safe });
});

// List available rule sources for the generate dropdown.
// Returns { master: bool, templates: [names] } — master listed separately.
app.get('/api/list-rules', (req, res) => {
  const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.json'));
  const templates = files
    .map((f) => f.replace('.json', ''))
    .filter((n) => n !== '_master');
  res.json({ master: fs.existsSync(MASTER_FILE), templates });
});

/* ─────────────────────────────────────────────
   ADD TO HOUSE BRAIN — intelligent reconcile
   Sends the existing master + the new extraction to Claude,
   which merges overlapping rules, keeps the palette as a
   library, and flags genuine divergences as options.
   ───────────────────────────────────────────── */
app.post('/api/merge-master', async (req, res) => {
  try {
    const { name, newRules } = req.body;
    const sourceName = (name || 'a menu').trim();

    const existing = fs.existsSync(MASTER_FILE)
      ? JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'))
      : null;

    // First menu ever — seed the master directly, no reconciliation needed.
    if (!existing) {
      const seeded = {
        aesthetic_summary: newRules.aesthetic_summary,
        source_menus: [sourceName],
        palette_library: labelPalette(newRules.palette, sourceName),
        typography_options: newRules.typography ? [{ from: sourceName, ...newRules.typography }] : [],
        layout_principles: newRules.layout ? [{ from: sourceName, ...newRules.layout }] : [],
        copy_voice: newRules.copy_voice ? [{ from: sourceName, voice: newRules.copy_voice }] : [],
        decorative_elements: newRules.decorative_elements ? [{ from: sourceName, notes: newRules.decorative_elements }] : [],
        design_rules: (newRules.design_rules || []).map((r) => ({ rule: r, sources: [sourceName] })),
        divergences: [],
      };
      fs.writeFileSync(MASTER_FILE, JSON.stringify(seeded, null, 2));
      return res.json({ ok: true, master: seeded, seeded: true });
    }

    const prompt = `You maintain a bar's MASTER design system ("house brain") that accumulates wisdom from multiple reference menus the owner loves. A new menu's rules are being added. Reconcile them into the master intelligently.

RULES:
- Merge overlapping/duplicate rules into single entries; track which source menus support each (sources array).
- Keep the palette as a LIBRARY of labelled swatches (don't collapse to one scheme).
- Where the new menu genuinely CONTRADICTS the master (e.g. serif names vs mono names), DO NOT overwrite — record both under "divergences" as named options.
- Preserve everything useful from the existing master; only add or refine.
- Add the new source name to source_menus.

EXISTING MASTER:
${JSON.stringify(existing, null, 2)}

NEW MENU ("${sourceName}") EXTRACTION:
${JSON.stringify(newRules, null, 2)}

Return ONLY the updated master as valid JSON, no markdown, same shape as the existing master (keys: aesthetic_summary, source_menus, palette_library, typography_options, layout_principles, copy_voice, decorative_elements, design_rules [array of {rule, sources}], divergences [array of {topic, options:[{label, value, source}]}]).`;

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content.map((b) => b.text || '').join('');
    const merged = parseJson(text);
    fs.writeFileSync(MASTER_FILE, JSON.stringify(merged, null, 2));
    res.json({ ok: true, master: merged, seeded: false });
  } catch (err) {
    console.error('merge-master error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper: label a palette object's hexes with their source menu
function labelPalette(palette, source) {
  if (!palette) return [];
  return Object.entries(palette)
    .filter(([, v]) => v)
    .map(([role, hex]) => ({ role, hex, source }));
}

app.get('/api/load-rules/:name', (req, res) => {
  const safe = req.params.name.replace(/[^a-z0-9-_]/gi, '_');
  const fp = path.join(RULES_DIR, `${safe}.json`);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
});

app.post('/api/save-menu', (req, res) => {
  const { name, menu } = req.body;
  const safe = (name || 'menu-' + Date.now()).replace(/[^a-z0-9-_]/gi, '_');
  fs.writeFileSync(path.join(MENUS_DIR, `${safe}.json`), JSON.stringify(menu, null, 2));
  res.json({ ok: true, file: `menus/${safe}.json`, key: safe });
});

app.get('/api/list-menus', (req, res) => {
  if (!fs.existsSync(MENUS_DIR)) return res.json([]);
  const files = fs.readdirSync(MENUS_DIR).filter((f) => f.endsWith('.json'));
  const menus = files.map((f) => {
    const key = f.replace('.json', '');
    try {
      const data = JSON.parse(fs.readFileSync(path.join(MENUS_DIR, f), 'utf8'));
      return { key, bar_name: data.bar_name || key, tagline: data.tagline || '', render_spec: data.render_spec || {} };
    } catch { return { key, bar_name: key, tagline: '', render_spec: {} }; }
  });
  res.json(menus);
});

app.get('/api/load-menu/:name', (req, res) => {
  const safe = req.params.name.replace(/[^a-z0-9-_]/gi, '_');
  const fp = path.join(MENUS_DIR, `${safe}.json`);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
});

app.delete('/api/delete-menu/:name', (req, res) => {
  const safe = req.params.name.replace(/[^a-z0-9-_]/gi, '_');
  const fp = path.join(MENUS_DIR, `${safe}.json`);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'not found' });
  fs.unlinkSync(fp);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  ☠  Menu Maker server running on http://localhost:${PORT}`);
  console.log(`     Model: ${MODEL}`);
  console.log(`     Run "npm run dev" and open the Vite URL it prints.\n`);
});
