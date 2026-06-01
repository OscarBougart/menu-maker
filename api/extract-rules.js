// POST /api/extract-rules — reverse-engineer a menu's design system from a photo.
// Body: { imageBase64: "<base64>", mediaType: "image/jpeg" }
import { anthropic, MODEL, parseJson, textOf, rateLimit, tooMany } from './_lib.js';

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req)) return tooMany(res);

  try {
    const { imageBase64, mediaType } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'No image uploaded.' });

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
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    res.json(parseJson(textOf(msg)));
  } catch (err) {
    console.error('extract-rules error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
