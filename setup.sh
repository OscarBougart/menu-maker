#!/usr/bin/env bash
# ── The Menu Maker · one-click setup (macOS / Linux) ──
set -e

echo ""
echo "  Setting up The Menu Maker..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  [!] Node.js not found. Install from https://nodejs.org first, then re-run."
  exit 1
fi

echo "  Installing dependencies..."
npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  [*] Created .env  --  OPEN IT and paste your Anthropic API key"
  echo "      after ANTHROPIC_API_KEY="
  echo "      Get a key at https://console.anthropic.com/settings/keys"
else
  echo "  [*] .env already exists, leaving it as-is."
fi

echo ""
echo "  Done. Next:"
echo "    1. Put your API key in .env (if you haven't)"
echo "    2. Run:  npm run dev"
echo "    3. Open the http://localhost:5173 link it prints"
echo ""
