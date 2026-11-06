// ─────────────────────────────────────────────────────────────
// CHRISTMAS ORNAMENT PACKS — holly, snowflake, evergreen, gilded_star
//
// Same slot contract as ornaments.js: { viewBox, path, strokeOnly? }
//   corner 0 0 40 40 · cartouche 0 0 460 653 · cartoucheH 0 0 653 460
//   divider 0 0 200 20 · sectionAccent 0 0 16 16 · itemRule 0 0 200 8
//
// Paths are built from small geometry helpers so the motifs stay precise.
// Filled slots: every sub-path is wound clockwise so overlapping shapes
// union under the non-zero fill rule instead of punching holes.
// ─────────────────────────────────────────────────────────────

const mk = (viewBox, path, strokeOnly = false) => ({ viewBox, path, strokeOnly });
const n = (v) => Math.round(v * 100) / 100;
const pt = ([x, y]) => `${n(x)},${n(y)}`;
const rad = (deg) => (deg * Math.PI) / 180;
const join = (...parts) => parts.flat().filter(Boolean).join(' ');

// ── Primitives ───────────────────────────────────────────────
const line = (x1, y1, x2, y2) => `M ${pt([x1, y1])} L ${pt([x2, y2])}`;

const rect = (x, y, w, h) =>
  `M ${pt([x, y])} L ${pt([x + w, y])} L ${pt([x + w, y + h])} L ${pt([x, y + h])} Z`;

const circle = (cx, cy, r) =>
  `M ${pt([cx - r, cy])} A ${n(r)},${n(r)} 0 1 1 ${pt([cx + r, cy])} ` +
  `A ${n(r)},${n(r)} 0 1 1 ${pt([cx - r, cy])} Z`;

const polygon = (points) => `M ${points.map(pt).join(' L ')} Z`;

/** Star with `points` tips; `outer` may be a number or an array cycled per tip. */
function star(cx, cy, outer, inner, points, rotDeg = -90) {
  const radii = Array.isArray(outer) ? outer : [outer];
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radii[(i / 2) % radii.length] : inner;
    const a = rad(rotDeg + (i * 180) / points);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return polygon(pts);
}

/** Six-armed snowflake drawn as strokes. `branches` = fractions along each arm. */
function snowflake(cx, cy, r, branches = [0.45, 0.72]) {
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const a = rad(k * 60 - 90);
    const ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
    parts.push(line(cx, cy, ex, ey));
    branches.forEach((t, i) => {
      const bx = cx + r * t * Math.cos(a), by = cy + r * t * Math.sin(a);
      const len = r * (i === 0 ? 0.3 : 0.22);
      [-45, 45].forEach((off) => {
        const b = a + rad(off);
        parts.push(line(bx, by, bx + len * Math.cos(b), by + len * Math.sin(b)));
      });
    });
  }
  return join(parts);
}

/** Holly leaf, base at (x, y), pointing at `angleDeg`. Scalloped, spiky edge. */
function hollyLeaf(x, y, len, w, angleDeg) {
  const a = rad(angleDeg);
  const T = ([px, py]) => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)];
  // spike tips along the upper edge (negative y), tip of leaf at (len, 0)
  const upper = [[0, 0], [0.26 * len, -w], [0.55 * len, -1.05 * w], [0.82 * len, -0.72 * w], [len, 0]];
  const lower = upper.slice(0, -1).reverse().map(([px, py]) => [px, -py]); // back along the lower edge
  const edge = [...upper, ...lower];
  let d = `M ${pt(T(edge[0]))}`;
  for (let i = 1; i < edge.length; i++) {
    const [px, py] = edge[i - 1], [qx, qy] = edge[i];
    // concave scallop: control point pulled toward the midrib
    const c = [(px + qx) / 2, ((py + qy) / 2) * 0.35];
    d += ` Q ${pt(T(c))} ${pt(T(edge[i]))}`;
  }
  return d + ' Z';
}

/**
 * Pine needles along a sampled polyline. Needles alternate sides and sweep
 * forward toward the tip, like a real fir sprig (paired chevrons read as arrows).
 */
function needles(points, maxLen, minLen = maxLen * 0.45) {
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [px, py] = points[i], [qx, qy] = points[i + 1];
    const dir = Math.atan2(qy - py, qx - px);
    const t = i / Math.max(1, points.length - 2);
    const L = maxLen + (minLen - maxLen) * t;
    const side = i % 2 === 0 ? -1 : 1;
    const b = dir + side * rad(55);
    parts.push(line(px, py, px + L * Math.cos(b), py + L * Math.sin(b)));
  }
  return join(parts);
}

const sampleLine = (x1, y1, x2, y2, steps) =>
  Array.from({ length: steps + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps]);

const sampleQuad = (p0, c, p1, steps) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
  });

const polyline = (points) => `M ${points.map(pt).join(' L ')}`;

/** Repeat a corner motif at all four corners of a W×H frame (mirrored). */
function fourCorners(W, H, motif) {
  return join(
    motif((x, y) => [x, y]),
    motif((x, y) => [W - x, y]),
    motif((x, y) => [W - x, H - y]),
    motif((x, y) => [x, H - y]),
  );
}

/** Double rule frame inset 16/22 (matches existing packs). */
const doubleRule = (W, H) => join(rect(16, 16, W - 32, H - 32), rect(22, 22, W - 44, H - 44));

// ── HOLLY ────────────────────────────────────────────────────
const hollyCorner = mk('0 0 40 40', join(
  rect(3, 3, 34, 1.4), rect(3, 3, 1.4, 34),          // fine L bracket
  hollyLeaf(9, 9, 19, 4.6, 12),                       // leaf along the top
  hollyLeaf(9, 9, 19, 4.6, 78),                       // leaf down the side
  circle(9, 9, 2.6), circle(13.6, 8.4, 2.1), circle(8.4, 13.6, 2.1), // berries
));

const hollyDivider = mk('0 0 200 20', join(
  rect(0, 9.4, 74, 1.2), rect(126, 9.4, 74, 1.2),
  hollyLeaf(100, 9.5, 23, 5.2, 192),
  hollyLeaf(100, 9.5, 23, 5.2, -12),
  circle(100, 11.5, 3), circle(95, 14, 2.4), circle(105, 14, 2.4),
));

const hollyAccent = mk('0 0 16 16', join(
  hollyLeaf(8, 9.5, 7.6, 2.3, 200), hollyLeaf(8, 9.5, 7.6, 2.3, -20),
  circle(8, 10.6, 1.9), circle(5.9, 13, 1.5), circle(10.1, 13, 1.5),
));

const hollyItemRule = mk('0 0 200 8', join(
  rect(0, 3.5, 88, 1), rect(112, 3.5, 88, 1),
  circle(93.5, 4, 1.7), circle(100, 4, 2.3), circle(106.5, 4, 1.7),
));

const hollyFrame = (W, H) => join(
  doubleRule(W, H),
  fourCorners(W, H, (P) => {
    // build the cluster at the top-left, then map every point through P
    const leafA = hollyLeaf(0, 0, 50, 12, 14), leafB = hollyLeaf(0, 0, 50, 12, 76);
    const mapPath = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) =>
      pt(P(34 + Number(x), 34 + Number(y))));
    const [b1, b2, b3] = [[34, 34], [46, 32], [32, 46]].map(([x, y]) => P(x, y));
    return join(mapPath(leafA), mapPath(leafB),
      circle(b1[0], b1[1], 6), circle(b2[0], b2[1], 5), circle(b3[0], b3[1], 5));
  }),
);

// ── SNOWFLAKE ────────────────────────────────────────────────
const snowCorner = mk('0 0 40 40', join(
  'M 3,37 L 3,3 L 37,3',
  snowflake(15, 15, 9.5, [0.55]),
  circle(30, 9, 0.9), circle(9, 30, 0.9),
), true);

const snowDivider = mk('0 0 200 20', join(
  line(0, 10, 70, 10), line(130, 10, 200, 10),
  circle(78, 10, 1.1), circle(122, 10, 1.1),
  snowflake(100, 10, 9.5),
), true);

const snowAccent = mk('0 0 16 16', snowflake(8, 8, 6.8, [0.55]), true);

const snowItemRule = mk('0 0 200 8', join(
  line(0, 4, 42, 4), line(58, 4, 92, 4), line(108, 4, 142, 4), line(158, 4, 200, 4),
  snowflake(50, 4, 3.2, []), snowflake(100, 4, 3.6, []), snowflake(150, 4, 3.2, []),
), true);

const snowFrame = (W, H) => join(
  rect(16, 16, W - 32, H - 32), rect(20, 20, W - 40, H - 40),
  fourCorners(W, H, (P) => {
    const [a, b, c] = [[46, 46], [80, 34], [34, 80]].map(([x, y]) => P(x, y));
    return join(snowflake(a[0], a[1], 15), snowflake(b[0], b[1], 6, [0.55]), snowflake(c[0], c[1], 6, [0.55]));
  }),
);

// ── EVERGREEN ────────────────────────────────────────────────
const pineCorner = mk('0 0 40 40', join(
  line(4, 4, 37, 4), line(4, 4, 4, 37),
  needles(sampleLine(4, 4, 37, 4, 12), 5.5, 2.6),
  needles(sampleLine(4, 4, 4, 37, 12), 5.5, 2.6),
  circle(9, 9, 2.4),
), true);

const pineDivider = mk('0 0 200 20', (() => {
  const left = sampleQuad([8, 5], [54, 22], [100, 6], 22);
  const right = sampleQuad([100, 6], [146, 22], [192, 5], 22);
  return join(
    polyline(left), polyline(right),
    needles(left, 5, 5), needles(right, 5, 5),
    circle(100, 6, 3.2), circle(8, 5, 2), circle(192, 5, 2),
  );
})(), true);

const pineAccent = mk('0 0 16 16', join(
  polygon([[8, 1], [12, 6], [10.2, 6], [13.6, 10.4], [11.2, 10.4], [14.6, 14], [1.4, 14], [4.8, 10.4], [2.4, 10.4], [5.8, 6], [4, 6]]),
  rect(7, 14, 2, 2),
));

const pineItemRule = mk('0 0 200 8', join(
  line(24, 4, 176, 4),
  // fine needle ticks, alternating above/below, longest at the centre
  Array.from({ length: 29 }, (_, i) => {
    const x = 30 + i * 5;
    const h = 3.2 - Math.abs(i - 14) * 0.13;
    const dy = i % 2 === 0 ? -h : h;
    return line(x, 4, x + h * 0.8, 4 + dy);
  }),
), true);

const pineFrame = (W, H) => {
  const swagRow = (y, dir, count) => {
    const x0 = 22, span = (W - 44) / count;
    const parts = [];
    for (let i = 0; i < count; i++) {
      const a = x0 + i * span, b = a + span;
      const pts = sampleQuad([a, y], [(a + b) / 2, y + dir * 44], [b, y], 26);
      parts.push(polyline(pts), needles(pts, 8, 8));
    }
    // baubles hanging at every swag join (skip the two frame corners)
    for (let i = 1; i < count; i++) {
      const x = x0 + i * span;
      parts.push(line(x, y, x, y + dir * 10), circle(x, y + dir * 15, 5));
    }
    return join(parts);
  };
  const count = W > H ? 6 : 4;
  return join(doubleRule(W, H), swagRow(22, 1, count), swagRow(H - 22, -1, count));
};

// ── GILDED STAR ──────────────────────────────────────────────
const starCorner = mk('0 0 40 40', join(
  rect(3, 3, 34, 1.4), rect(3, 3, 1.4, 34),
  star(13, 13, 7.5, 1.8, 4),
  star(24, 9, 3, 0.8, 4), star(9, 24, 3, 0.8, 4),
));

const starDivider = mk('0 0 200 20', join(
  rect(0, 9.5, 76, 1), rect(124, 9.5, 76, 1),
  circle(83, 10, 1.3), circle(117, 10, 1.3),
  star(100, 10, [9.8, 5.6], 2.6, 8),
));

const starAccent = mk('0 0 16 16', star(8, 8, [7.6, 4.4], 2, 8));

const starItemRule = mk('0 0 200 8', join(
  rect(0, 3.6, 62, 0.8), rect(138, 3.6, 62, 0.8),
  [[70, 2.2], [85, 3], [100, 3.9], [115, 3], [130, 2.2]].map(([x, r]) => star(x, 4, r, r * 0.26, 4)),
));

const starFrame = (W, H) => join(
  // rules break around the corner stars
  [16, 22].map((i) => join(
    line(48, i, W - 48, i), line(48, H - i, W - 48, H - i),
    line(i, 48, i, H - 48), line(W - i, 48, W - i, H - 48),
  )),
  fourCorners(W, H, (P) => {
    const [c, s1, s2] = [[19, 19], [48, 19], [19, 48]].map(([x, y]) => P(x, y));
    return join(star(c[0], c[1], 17, 4, 4), circle(c[0], c[1], 7),
      star(s1[0], s1[1], 4, 1, 4), star(s2[0], s2[1], 4, 1, 4));
  }),
  // small star at the centre of the top and bottom edges
  star(W / 2, 19, 7, 1.8, 4), star(W / 2, H - 19, 7, 1.8, 4),
);

// ── ASSEMBLE ─────────────────────────────────────────────────
const frames = (fn) => ({
  cartouche: mk('0 0 460 653', fn(460, 653), true),
  cartoucheH: mk('0 0 653 460', fn(653, 460), true),
});

export const CHRISTMAS_ORNAMENT_STYLES = {
  holly: {
    corner: hollyCorner, ...frames(hollyFrame),
    divider: hollyDivider, sectionAccent: hollyAccent, itemRule: hollyItemRule,
  },
  snowflake: {
    corner: snowCorner, ...frames(snowFrame),
    divider: snowDivider, sectionAccent: snowAccent, itemRule: snowItemRule,
  },
  evergreen: {
    corner: pineCorner, ...frames(pineFrame),
    divider: pineDivider, sectionAccent: pineAccent, itemRule: pineItemRule,
  },
  gilded_star: {
    corner: starCorner, ...frames(starFrame),
    divider: starDivider, sectionAccent: starAccent, itemRule: starItemRule,
  },
};

export const CHRISTMAS_ORNAMENT_LABELS = {
  holly: 'Holly',
  snowflake: 'Snowflake',
  evergreen: 'Evergreen',
  gilded_star: 'Gilded Star',
};

// Festive display faces — StylePanel tags these chips with the red .xmas style.
export const CHRISTMAS_FONTS = [
  'Pinyon Script', 'Great Vibes', 'UnifrakturMaguntia', 'IM Fell English', 'Mountains of Christmas',
];
