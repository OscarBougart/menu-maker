// Each slot: { viewBox, path, strokeOnly? }
// strokeOnly=true → rendered with fill="none" stroke="currentColor"
// default        → rendered with fill="currentColor"

const mk = (viewBox, path, strokeOnly = false) => ({ viewBox, path, strokeOnly });

// ── CORNERS (top-left, 40×40 — CSS mirrors for other three) ─────────────────
const CORNERS = {
  baroque:      mk('0 0 40 40',
    // Curved filled L-bracket + inner scroll circle
    'M 3,37 L 3,10 Q 3,3 10,3 L 37,3 L 37,8 L 13,8 Q 8,8 8,13 L 8,37 Z ' +
    'M 19,19 A 5,5 0 1 0 29,19 A 5,5 0 1 0 19,19 Z'),
  art_nouveau:  mk('0 0 40 40',
    // Flowing S-curve organic bracket
    'M 3,37 C 3,28 3,22 6,18 C 9,12 14,10 18,10 C 24,10 28,7 32,3 L 38,3', true),
  victorian:    mk('0 0 40 40',
    // Straight filled L + inner diamond accent
    'M 3,37 L 3,3 L 37,3 L 37,8 L 8,8 L 8,37 Z ' +
    'M 20,14 L 27,21 L 20,28 L 13,21 Z'),
  minimal:      mk('0 0 40 40',
    // Clean L bracket + terminal dot
    'M 3,35 L 3,3 L 35,3 M 1,3 A 2.5,2.5 0 1 0 5.5,3 A 2.5,2.5 0 1 0 1,3', true),
  art_deco:     mk('0 0 40 40',
    // Stepped staircase emanating from corner
    'M 3,37 L 3,3 L 37,3 ' +
    'M 3,28 L 12,28 L 12,3 ' +
    'M 3,19 L 21,19 L 21,3 ' +
    'M 3,10 L 30,10 L 30,3', true),
  gothic:       mk('0 0 40 40',
    // Pointed-arch filled bracket
    'M 3,37 L 3,3 L 37,3 L 37,8 L 8,8 L 8,37 Z ' +
    'M 14,10 L 14,24 Q 14,30 20,30 Q 26,30 26,24 L 26,10 Z ' +
    'M 17,10 L 17,24 Q 17,27 20,27 Q 23,27 23,24 L 23,10'),
  neoclassical: mk('0 0 40 40',
    // Filled L + Greek key square in corner
    'M 3,37 L 3,3 L 37,3 L 37,8 L 8,8 L 8,37 Z ' +
    'M 12,12 L 12,24 L 24,24 L 24,12 Z ' +
    'M 15,15 L 15,21 L 21,21 L 21,15 Z'),
  celtic:       mk('0 0 40 40',
    // Interlace-hinting S-knot stroke
    'M 3,37 L 3,14 Q 3,3 14,3 L 37,3 ' +
    'M 14,14 C 18,10 24,10 26,14 C 28,18 24,22 20,20 C 16,18 18,12 22,12 C 26,12 28,16 24,18', true),
  japanese:     mk('0 0 40 40',
    // Asymmetric brushstroke — bold horizontal arm, lighter vertical
    'M 3,36 L 3,8 Q 4,3 9,3 L 38,3 M 3,22 Q 6,18 10,18', true),
  hairline:     mk('0 0 40 40',
    // Two thin concentric L brackets
    'M 3,36 L 3,3 L 36,3 M 6,36 L 6,6 L 36,6', true),
  bauhaus:      mk('0 0 40 40',
    // Two thick rule arms + filled circle at the elbow
    'M 3,38 L 3,3 L 38,3 L 38,10 L 10,10 L 10,38 Z ' +
    'M 12,12 A 8,8 0 1 0 28,12 A 8,8 0 1 0 12,12 Z'),
};

// ── CARTOUCHE (full portrait page frame, 460×653, stroke only) ──────────────
const CARTOUCHES = {
  baroque:      mk('0 0 460 653',
    // Two concentric rounded-corner rectangles
    'M 28,16 Q 16,16 16,28 L 16,625 Q 16,637 28,637 L 432,637 Q 444,637 444,625 L 444,28 Q 444,16 432,16 Z ' +
    'M 32,22 Q 22,22 22,32 L 22,621 Q 22,631 32,631 L 428,631 Q 438,631 438,621 L 438,32 Q 438,22 428,22 Z', true),
  art_nouveau:  mk('0 0 460 653',
    // Organic rounded rectangle with flowing corner curves
    'M 40,16 Q 16,16 16,40 L 16,613 Q 16,637 40,637 L 420,637 Q 444,637 444,613 L 444,40 Q 444,16 420,16 Z', true),
  victorian:    mk('0 0 460 653',
    // Angled chamfer rectangle — two concentric
    'M 36,16 L 424,16 L 444,36 L 444,617 L 424,637 L 36,637 L 16,617 L 16,36 Z ' +
    'M 40,22 L 420,22 L 438,40 L 438,613 L 420,631 L 40,631 L 22,613 L 22,40 Z', true),
  minimal:      mk('0 0 460 653',
    'M 20,20 L 440,20 L 440,633 L 20,633 Z', true),
  art_deco:     mk('0 0 460 653',
    // Hard-chamfered corners, double line
    'M 50,16 L 410,16 L 444,50 L 444,603 L 410,637 L 50,637 L 16,603 L 16,50 Z ' +
    'M 52,20 L 408,20 L 440,52 L 440,601 L 408,633 L 52,633 L 20,601 L 20,52 Z', true),
  gothic:       mk('0 0 460 653',
    // Pointed top arch + straight sides
    'M 16,80 Q 16,16 80,16 L 380,16 Q 444,16 444,80 L 444,573 Q 444,637 380,637 L 80,637 Q 16,637 16,573 Z ' +
    'M 22,80 Q 22,22 80,22 L 380,22 Q 438,22 438,80 L 438,573 Q 438,631 380,631 L 80,631 Q 22,631 22,573 Z', true),
  neoclassical: mk('0 0 460 653',
    // Plain rectangle + corner bracket insets (Greek key hint)
    'M 16,16 L 444,16 L 444,637 L 16,637 Z ' +
    'M 22,22 L 438,22 L 438,631 L 22,631 Z ' +
    'M 22,22 L 56,22 L 56,56 M 438,22 L 404,22 L 404,56 ' +
    'M 438,631 L 404,631 L 404,597 M 22,631 L 56,631 L 56,597', true),
  celtic:       mk('0 0 460 653',
    // Double rounded rectangle (plaited border implied by spacing)
    'M 24,16 Q 16,16 16,24 L 16,629 Q 16,637 24,637 L 436,637 Q 444,637 444,629 L 444,24 Q 444,16 436,16 Z ' +
    'M 30,24 Q 24,24 24,30 L 24,623 Q 24,629 30,629 L 430,629 Q 436,629 436,623 L 436,30 Q 436,24 430,24 Z', true),
  japanese:     mk('0 0 460 653',
    // Rectangle with single angled notch at top-right corner
    'M 16,16 L 400,16 L 444,60 L 444,637 L 16,637 Z', true),
  hairline:     mk('0 0 460 653',
    // Three concentric hairline rectangles
    'M 14,14 L 446,14 L 446,639 L 14,639 Z ' +
    'M 18,18 L 442,18 L 442,635 L 18,635 Z ' +
    'M 22,22 L 438,22 L 438,631 L 22,631 Z', true),
  bauhaus:      mk('0 0 460 653',
    // Plain rectangle + filled circles at each corner
    'M 16,16 L 444,16 L 444,637 L 16,637 Z ' +
    'M 16,16 A 14,14 0 1 0 16.01,16 M 444,16 A 14,14 0 1 0 444.01,16 ' +
    'M 16,637 A 14,14 0 1 0 16.01,637 M 444,637 A 14,14 0 1 0 444.01,637', true),
};

// ── DIVIDERS (replaces ✦ in .m-divider, 200×20) ──────────────────────────────
const DIVIDERS = {
  baroque:      mk('0 0 200 20',
    // Gradient lines + heavy oval medallion centre
    'M 0,10 L 68,10 M 132,10 L 200,10 ' +
    'M 100,2 C 88,2 82,10 88,16 C 94,20 106,20 112,14 C 118,8 112,2 100,2 Z ' +
    'M 100,5 C 92,5 88,10 92,15 C 96,19 104,19 108,14 C 112,9 108,5 100,5 Z'),
  art_nouveau:  mk('0 0 200 20',
    // Flowing S-wave centre with line tails
    'M 0,10 L 55,10 C 65,10 70,4 80,4 C 90,4 95,16 105,16 C 115,16 120,10 130,10 C 140,10 145,4 155,10 L 200,10', true),
  victorian:    mk('0 0 200 20',
    // Lines + central diamond + flanking dots
    'M 0,10 L 80,10 M 120,10 L 200,10 ' +
    'M 100,4 L 108,10 L 100,16 L 92,10 Z ' +
    'M 86,10 A 3,3 0 1 0 92,10 A 3,3 0 1 0 86,10 Z ' +
    'M 108,10 A 3,3 0 1 0 114,10 A 3,3 0 1 0 108,10 Z'),
  minimal:      mk('0 0 200 20',
    'M 40,10 L 160,10 M 98,10 A 2,2 0 1 0 102,10 A 2,2 0 1 0 98,10', true),
  art_deco:     mk('0 0 200 20',
    // Lines + bold zigzag centre
    'M 0,10 L 62,10 M 138,10 L 200,10 ' +
    'M 62,10 L 72,4 L 82,10 L 92,4 L 100,10 L 108,16 L 118,10 L 128,16 L 138,10', true),
  gothic:       mk('0 0 200 20',
    // Lines + pointed arch (quatrefoil hint)
    'M 0,10 L 74,10 M 126,10 L 200,10 ' +
    'M 87,10 L 87,6 Q 87,2 93,2 Q 100,2 100,6 ' +
    'M 113,10 L 113,6 Q 113,2 107,2 Q 100,2 100,6 ' +
    'M 93,10 Q 93,6 96,5 Q 100,4 104,5 Q 107,6 107,10'),
  neoclassical: mk('0 0 200 20',
    // Lines + laurel-arc centre
    'M 0,10 L 64,10 M 136,10 L 200,10 ' +
    'M 68,14 C 76,6 84,6 92,10 C 100,14 108,14 116,10 C 124,6 132,6 136,14', true),
  celtic:       mk('0 0 200 20',
    // Triquetra-simplified centre
    'M 0,10 L 65,10 M 135,10 L 200,10 ' +
    'M 100,3 C 107,3 113,8 111,14 C 109,18 103,18 100,14 ' +
    'M 100,3 C 93,3 87,8 89,14 C 91,18 97,18 100,14 ' +
    'M 89,14 C 91,18 100,20 111,14', true),
  japanese:     mk('0 0 200 20',
    // Short centre dash + open enso circle
    'M 45,10 L 82,10 M 118,10 L 155,10 ' +
    'M 107,4 A 7,7 0 1 0 107,16 A 7,7 0 0 0 107,4', true),
  hairline:     mk('0 0 200 20',
    // Double hairline rule
    'M 0,8 L 200,8 M 0,12 L 200,12', true),
  bauhaus:      mk('0 0 200 20',
    // Lines + circle with diameter
    'M 0,10 L 80,10 M 120,10 L 200,10 ' +
    'M 90,10 A 10,10 0 1 0 110,10 A 10,10 0 1 0 90,10 Z ' +
    'M 90,10 L 110,10'),
};

// ── SECTION ACCENTS (flanks section title, 16×16) ────────────────────────────
const SECTION_ACCENTS = {
  baroque:      mk('0 0 16 16',
    // Filled lozenge / diamond
    'M 8,1 L 14,7 L 8,15 L 2,7 Z M 8,4 L 12,7 L 8,12 L 4,7 Z'),
  art_nouveau:  mk('0 0 16 16',
    // Lily-bud: leaf + small circle
    'M 8,15 C 4,12 3,7 5,4 C 7,1 9,1 11,4 C 13,7 12,12 8,15 Z ' +
    'M 8,7 A 2,2 0 1 0 8.01,7', true),
  victorian:    mk('0 0 16 16',
    // Eight-point star
    'M 8,1 L 9.5,6 L 15,8 L 9.5,10 L 8,15 L 6.5,10 L 1,8 L 6.5,6 Z'),
  minimal:      mk('0 0 16 16',
    // Single dot
    'M 5,8 A 3,3 0 1 0 11,8 A 3,3 0 1 0 5,8'),
  art_deco:     mk('0 0 16 16',
    // Nested diamonds
    'M 8,1 L 15,8 L 8,15 L 1,8 Z M 8,4 L 12,8 L 8,12 L 4,8 Z'),
  gothic:       mk('0 0 16 16',
    // Trefoil (three arcs meeting at centre)
    'M 8,8 C 8,4 4,2 3,5 C 2,8 5,10 8,8 ' +
    'M 8,8 C 12,4 14,2 13,5 C 12,8 10,10 8,8 ' +
    'M 8,8 C 6,12 6,15 8,15 C 10,15 10,12 8,8', true),
  neoclassical: mk('0 0 16 16',
    // Small wreath-arc (two curved leaves)
    'M 3,8 C 5,4 8,3 8,3 C 8,3 11,4 13,8 ' +
    'M 3,8 C 5,12 8,13 8,13 C 8,13 11,12 13,8', true),
  celtic:       mk('0 0 16 16',
    // Simple knotwork square
    'M 4,4 L 12,4 L 12,12 L 4,12 Z ' +
    'M 4,4 C 8,4 12,8 12,12 M 12,4 C 8,4 4,8 4,12', true),
  japanese:     mk('0 0 16 16',
    // Open circle (enso)
    'M 4,8 A 4,4 0 1 0 4.01,8', true),
  hairline:     mk('0 0 16 16',
    // EM dash
    'M 2,8 L 14,8', true),
  bauhaus:      mk('0 0 16 16',
    // Filled triangle pointing right
    'M 2,3 L 14,8 L 2,13 Z'),
};

// ── ITEM RULES (thin top-rule above each cocktail, 200×8) ────────────────────
const ITEM_RULES = {
  baroque:      mk('0 0 200 8',
    // Beaded wave rule
    'M 0,4 L 24,4 C 36,0 44,8 56,4 C 68,0 76,8 88,4 C 100,0 108,8 120,4 C 132,0 140,8 152,4 C 164,0 172,8 184,4 L 200,4', true),
  art_nouveau:  mk('0 0 200 8',
    // Single smooth S-wave
    'M 0,4 C 50,0 100,8 150,4 L 200,4', true),
  victorian:    mk('0 0 200 8',
    // Dash-dot-dot pattern
    'M 0,4 L 30,4 M 36,4 A 3,3 0 1 0 36.01,4 M 44,4 A 3,3 0 1 0 44.01,4 ' +
    'M 50,4 L 80,4 M 86,4 A 3,3 0 1 0 86.01,4 M 94,4 A 3,3 0 1 0 94.01,4 ' +
    'M 100,4 L 130,4 M 136,4 A 3,3 0 1 0 136.01,4 M 144,4 A 3,3 0 1 0 144.01,4 ' +
    'M 150,4 L 200,4', true),
  minimal:      mk('0 0 200 8',
    'M 20,4 L 180,4', true),
  art_deco:     mk('0 0 200 8',
    // Three-line rule
    'M 0,1 L 200,1 M 0,4 L 200,4 M 0,7 L 200,7', true),
  gothic:       mk('0 0 200 8',
    // Small pointed arches along the rule
    'M 0,7 L 18,7 Q 18,1 24,1 Q 30,1 30,7 L 48,7 Q 48,1 54,1 Q 60,1 60,7 L 78,7 Q 78,1 84,1 Q 90,1 90,7 L 108,7 Q 108,1 114,1 Q 120,1 120,7 L 138,7 Q 138,1 144,1 Q 150,1 150,7 L 168,7 Q 168,1 174,1 Q 180,1 180,7 L 200,7', true),
  neoclassical: mk('0 0 200 8',
    // Meander-hint: line with small Greek key return at intervals
    'M 0,4 L 200,4 M 50,4 L 50,1 L 60,1 L 60,7 M 140,4 L 140,1 L 150,1 L 150,7', true),
  celtic:       mk('0 0 200 8',
    // Interlace over-under hint
    'M 0,4 L 30,4 C 40,0 50,8 60,4 C 70,0 80,8 90,4 C 100,0 110,8 120,4 C 130,0 140,8 150,4 C 160,0 170,8 180,4 L 200,4', true),
  japanese:     mk('0 0 200 8',
    // Short restrained centre rule
    'M 60,4 L 140,4', true),
  hairline:     mk('0 0 200 8',
    'M 0,4 L 200,4', true),
  bauhaus:      mk('0 0 200 8',
    // Thick + thin double rule
    'M 0,2 L 200,2 M 0,6 L 200,6', true),
};

// ── ASSEMBLE ─────────────────────────────────────────────────────────────────
const PACK_KEYS = [
  'baroque', 'art_nouveau', 'victorian', 'minimal',
  'art_deco', 'gothic', 'neoclassical', 'celtic',
  'japanese', 'hairline', 'bauhaus',
];

export const ORNAMENT_STYLES = Object.fromEntries(
  PACK_KEYS.map(k => [k, {
    corner:        CORNERS[k],
    cartouche:     CARTOUCHES[k],
    divider:       DIVIDERS[k],
    sectionAccent: SECTION_ACCENTS[k],
    itemRule:      ITEM_RULES[k],
  }])
);
