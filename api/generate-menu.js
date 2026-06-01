// POST /api/generate-menu — compose a menu from extracted rules + a brief.
// Body: { rules, prompt, drinks }
import { anthropic, MODEL, parseJson, textOf, rateLimit, tooMany } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req)) return tooMany(res);

  try {
    const { rules, prompt, drinks } = req.body || {};

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

    res.json(parseJson(textOf(msg)));
  } catch (err) {
    console.error('generate-menu error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
