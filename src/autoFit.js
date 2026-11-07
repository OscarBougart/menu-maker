// autoFit.js — shrink drink text per page until it fits the sheet.
//
// Pages are split by item count, and every sheet is overflow:hidden, so long
// descriptions, long names or extra sections used to be silently cut off.
// After each render we measure each sheet; if content runs past the bottom
// margin we lower that sheet's --m-fit multiplier (used by every item font
// size and spacing in styles.css) with a short binary search — never below a
// readable minimum. Sheets that still overflow at the minimum are reported so
// the editor can warn the user instead of clipping silently.

// Cocktail-name size the user picks in the Style panel, in px on a full A5
// page. Older menus stored a drinks-per-page count instead (items_per_page).
export const ITEM_PX = { min: 10, max: 40 };
const FULL_PAGE_H = 553;   // booklet page content height (MenuTemplate CONTENT_H.booklet)
const ITEM_H_BASE = 81;    // height of one drink block at scale 1

export function itemPx(spec = {}) {
  if (spec.item_px) return spec.item_px;
  // Older menus: the drink count set a nominal size that auto-fit then
  // trimmed to ~80% in practice, so start from what was actually rendered
  // (7 per page → 15px) and existing menus keep their look.
  const n = Math.max(1, spec.items_per_page || 7);
  const px = Math.round(0.8 * BASE_NAME_PX * FULL_PAGE_H / (n * ITEM_H_BASE));
  return Math.min(ITEM_PX.max, Math.max(ITEM_PX.min, px));
}

/** Equivalent drinks-per-full-page for the chosen size (not an integer). */
export function itemSizeN(spec = {}) {
  return (BASE_NAME_PX * FULL_PAGE_H) / (itemPx(spec) * ITEM_H_BASE);
}

const MEASURED = '.m-title, .m-tagline, .m-section, .m-item, .m-footer';
const BOTTOM_MARGIN = 0.045;  // keep content clear of the bottom edge / frame
const BASE_NAME_PX = 19;      // .m-name font-size at scale 1 (styles.css)
const MIN_NAME_PX = { a6: 6, a6h: 6, default: 10 };

/** Layout bottom of `el` relative to `sheet`, ignoring drag transforms. */
function layoutBottom(el, sheet) {
  let y = 0;
  let node = el;
  while (node && node !== sheet) {
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return node === sheet ? y + el.offsetHeight : null;
}

function overflows(sheet) {
  const limit = sheet.clientHeight * (1 - BOTTOM_MARGIN);
  for (const el of sheet.querySelectorAll(MEASURED)) {
    if (!el.offsetParent) continue; // display:none
    const bottom = layoutBottom(el, sheet);
    if (bottom !== null && bottom > limit) return true;
  }
  return false;
}

const itemScaleOf = (sheet) =>
  parseFloat(getComputedStyle(sheet).getPropertyValue('--m-item-scale')) || 1;

function minFitFor(sheet, format, floor) {
  const minPx = MIN_NAME_PX[format] ?? MIN_NAME_PX.default;
  return Math.min(1, Math.max(0.3, floor, minPx / (BASE_NAME_PX * itemScaleOf(sheet))));
}

/**
 * Fit every sheet under `root` (the #menu-sheet element: a sheet itself, or a
 * booklet wrapper holding several). Returns { pages, shrunk, overflowing }.
 *
 * `floor` is the smallest fit multiplier allowed (e.g. 0.8 = never shrink
 * below 80% of the chosen size); formats that can add pages use it so drinks
 * move to a new page before text gets small. The readable minimum always applies.
 */
export function fitSheets(root, format, { floor = 0 } = {}) {
  if (!root) return { pages: 0, shrunk: 0, overflowing: 0 };
  const sheets = root.classList.contains('menu-sheet')
    ? [root]
    : Array.from(root.querySelectorAll('.menu-sheet'));

  let shrunk = 0;
  let overflowing = 0;
  for (const sheet of sheets) {
    sheet.style.setProperty('--m-fit', '1');
    if (!overflows(sheet)) continue;

    shrunk++;
    let lo = minFitFor(sheet, format, floor);
    let hi = 1;
    sheet.style.setProperty('--m-fit', String(lo));
    if (overflows(sheet)) { overflowing++; continue; } // smallest readable size still too big

    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      sheet.style.setProperty('--m-fit', String(mid));
      if (overflows(sheet)) hi = mid; else lo = mid;
    }
    sheet.style.setProperty('--m-fit', lo.toFixed(4));
  }

  // Keep drink text the same size on every page: match the smallest effective
  // size any page needed (shrinking further can never cause overflow).
  const drinkSheets = sheets.filter((sh) => sh.querySelector('.m-item'));
  if (drinkSheets.length > 1) {
    const effective = (sh) => itemScaleOf(sh) * (parseFloat(sh.style.getPropertyValue('--m-fit')) || 1);
    const target = Math.min(...drinkSheets.map(effective));
    for (const sh of drinkSheets) {
      const fit = Math.min(1, target / itemScaleOf(sh));
      sh.style.setProperty('--m-fit', fit.toFixed(4));
    }
  }
  return { pages: sheets.length, shrunk, overflowing };
}
