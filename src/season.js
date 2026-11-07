// season.js — decides when seasonal (Christmas) options are shown.
//
// Christmas options appear automatically from 1 November to 6 January
// (Epiphany) and hide themselves the rest of the year — no code revert needed.
//
// Override for testing / previews via the URL:
//   ?season=christmas  → always show Christmas options
//   ?season=off        → always hide them

export const CHRISTMAS_START = { month: 11, day: 1 };  // 1 Nov
export const CHRISTMAS_END = { month: 1, day: 6 };     // 6 Jan

export function isChristmasSeason(now = new Date()) {
  const override = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('season')
    : null;
  if (override === 'christmas') return true;
  if (override === 'off') return false;

  const month = now.getMonth() + 1;
  const day = now.getDate();
  const afterStart = month > CHRISTMAS_START.month || (month === CHRISTMAS_START.month && day >= CHRISTMAS_START.day);
  const beforeEnd = month < CHRISTMAS_END.month || (month === CHRISTMAS_END.month && day <= CHRISTMAS_END.day);
  return afterStart || beforeEnd;
}

// Evaluated once per page load.
export const CHRISTMAS_SEASON = isChristmasSeason();
