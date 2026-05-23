# The Menu Maker

A local menu-design studio you open in VS Code. Upload a photo of a cocktail menu
you love → AI extracts its design system → write a short brief → get a styled,
**print-ready PDF** menu you can edit inline and export.

Dark "apothecary" aesthetic by default (Death & Co. territory), but the look adapts
to whatever palette and typography the AI reads off your reference image.

---

## What you need
- **Node.js 18+** (`node -v` to check)
- An **Anthropic API key** → https://console.anthropic.com/settings/keys

## Setup (one time)

**Quick way:** double-click `setup.bat` (Windows) or run `./setup.sh` (Mac/Linux).
It checks Node, installs everything, and creates your `.env`. Then just paste your key.

**Manual way:**

```bash
# 1. open this folder in VS Code, then in the terminal:
npm install

# 2. add your API key
cp .env.example .env          # Windows PowerShell: copy .env.example .env
#    open .env and paste your key after ANTHROPIC_API_KEY=
```

## Run it

```bash
npm run dev
```

This starts two things at once:
- the **local server** (holds your key) on http://localhost:8787
- the **Vite app** — open the URL it prints (usually http://localhost:5173)

Your API key never leaves your machine — the browser only talks to the local server.

---

## How to use

1. **Upload a reference** — click the dropzone, pick a photo of a menu you admire.
   Hit **Extract Design Rules**. You'll see the palette, summary, and rules it found.
2. **Name & save it** — give the style a name (e.g. "Death & Co"), then:
   - **Save as Template** → stores it as its own reusable style in `rules/`.
   - **+ Add to House Brain** → merges it into your master design system. Claude
     reconciles it with whatever's already there: overlapping rules collapse into one
     (tracking which menus support each), the palette grows into a labelled library,
     and genuine contradictions (serif vs mono names) are kept as **divergence options**
     rather than overwriting. Upload Death & Co, then Paradiso, and the House Brain
     holds the distilled wisdom of both.
3. **Compose** — in the dropdown, pick what to draw rules from:
   *House Brain (all menus)*, the *current extraction*, or any saved template.
   Write a brief (colors, mood, count) and optionally paste your own drink names.
4. **Compose Menu** — the AI generates cocktails *and* a render spec matching the source.
5. **Pick a format** — toggle **A5 Sheet** (one dense page) or **Booklet** (cover +
   paginated section pages) in the preview bar. Same menu, two layouts.
6. **Edit inline** — click any name, description, price, or section title to change it.
7. **Export PDF** — print dialog → "Save as PDF". Pages print at A5; the booklet comes
   out as proper sequential pages. Enable "Background graphics" for the dark background.
   **Save to /menus** writes the menu JSON to disk.

### The two-tier memory
- `rules/death-and-co.json`, `rules/paradiso.json`, … — individual style templates.
- `rules/_master.json` — the **House Brain**: one growing document reconciled across
  every menu you've added, with a `source_menus` list and tracked `divergences`.

---

## Project structure

```
menu-maker/
├── menu-rules.md        ← optional: hand-written house rules (read it, tweak it)
├── server.js            ← Express proxy: vision extract + menu generate + save/load
├── .env                 ← your API key (gitignored)
├── rules/               ← saved extracted rule-sets (JSON)
├── menus/               ← saved menus (JSON)
└── src/
    ├── App.jsx          ← the Menu Maker UI
    ├── MenuTemplate.jsx ← the editable, print-ready menu sheet
    └── styles.css       ← dark studio + print styles
```

## Customising

- **Change the model**: set `MENU_MODEL` in `.env`.
- **Change the default look**: edit the `.menu-sheet` CSS variables in `src/styles.css`.
- **Add export-to-PNG later**: install `html-to-image`, snapshot `#menu-sheet`. (PDF works now via print.)
- **New fonts**: add them to the `<link>` in `index.html` and reference in the render spec list inside `server.js`.

## Notes
- The AI returns a `render_spec` (hex colors + font names) so the menu visually echoes
  your reference. If a generated color is off, just tweak the CSS vars or re-run with a
  more specific brief.
- For crispest print, in the PDF dialog enable "Background graphics".
