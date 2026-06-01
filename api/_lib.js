// _lib.js — shared helpers for the Vercel serverless API functions.
// (Files prefixed with "_" are NOT exposed as routes by Vercel.)

import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.MENU_MODEL || 'claude-sonnet-4-20250514';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Strip ```json fences and parse defensively.
export function parseJson(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export function textOf(msg) {
  return msg.content.map((b) => b.text || '').join('');
}

/* ── Per-IP rate limiting ──────────────────────────────────
   In-memory token bucket. Serverless instances are ephemeral and
   not shared, so this is best-effort — a soft brake against a single
   client hammering one warm instance, NOT a hard guarantee. The real
   safety net is the monthly spend cap you set in the Anthropic Console.
   ────────────────────────────────────────────────────────── */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_HOUR || 20);
const hits = new Map(); // ip -> number[] (timestamps)

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Returns true if the request is allowed; false if rate-limited.
export function rateLimit(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export function tooMany(res) {
  res.status(429).json({ error: 'Rate limit reached — please try again later.' });
}
