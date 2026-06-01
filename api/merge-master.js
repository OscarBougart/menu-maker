// POST /api/merge-master — reconcile a new extraction into an existing master.
// Body: { name, newRules, existing }  (existing master comes from the browser)
// The "first menu ever" seeding case is handled client-side (no AI needed).
import { anthropic, MODEL, parseJson, textOf, rateLimit, tooMany } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req)) return tooMany(res);

  try {
    const { name, newRules, existing } = req.body || {};
    const sourceName = (name || 'a menu').trim();

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

    res.json({ ok: true, master: parseJson(textOf(msg)), seeded: false });
  } catch (err) {
    console.error('merge-master error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
