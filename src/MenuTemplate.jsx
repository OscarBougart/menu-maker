import React, { useRef, useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MENU_DEFAULTS } from './theme.js';
import { ORNAMENT_STYLES } from './ornaments.js';

function SnapGuidesOverlay({ guides }) {
  if (!guides || (guides.v == null && guides.h == null)) return null;
  const { v, h, sheetRect, zoom } = guides;
  const z = zoom || 1;
  return ReactDOM.createPortal(
    <div className="snap-guides-overlay" aria-hidden="true">
      {v != null && (
        <div className="snap-guide snap-guide--v" style={{
          left: sheetRect.left + v * z,
          top: sheetRect.top,
          height: sheetRect.height,
        }} />
      )}
      {h != null && (
        <div className="snap-guide snap-guide--h" style={{
          top: sheetRect.top + h * z,
          left: sheetRect.left,
          width: sheetRect.width,
        }} />
      )}
    </div>,
    document.body
  );
}

function GroupSelectionBox({ selectedKeys, menu, onEdit, onSnapshot, onCommit, zoom }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (selectedKeys.size < 2) { setRect(null); return; }
    let raf = 0;
    let last = null;
    const tick = () => {
      const blocks = document.querySelectorAll('.draggable-block.drag-selected');
      if (blocks.length < 2) { setRect(null); raf = requestAnimationFrame(tick); return; }
      let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
      blocks.forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.left < minL) minL = r.left;
        if (r.top < minT) minT = r.top;
        if (r.right > maxR) maxR = r.right;
        if (r.bottom > maxB) maxB = r.bottom;
      });
      if (isFinite(minL)) {
        const next = { left: minL, top: minT, width: maxR - minL, height: maxB - minT };
        if (!last || last.left !== next.left || last.top !== next.top || last.width !== next.width || last.height !== next.height) {
          last = next;
          setRect(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selectedKeys, zoom]);

  if (selectedKeys.size < 2 || !rect) return null;

  // Read a scale value at a given key
  const parseKey = (key) => key.split('.').map(s => /^\d+$/.test(s) ? +s : s);
  const readNode = (path) => {
    let n = menu;
    for (const k of path) { if (n == null) return null; n = n[k]; }
    return n;
  };

  const startCornerResize = (e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    const snapshot = onSnapshot?.();
    const startX = e.clientX;
    const startY = e.clientY;
    const z = zoom || 1;
    // Snapshot each element's current scale + offset
    const keys = Array.from(selectedKeys);
    const starts = keys.map(k => {
      const path = parseKey(k);
      const node = readNode(path) || {};
      return { key: k, path, scale: node.scale ?? 1, x: node.x ?? 0, y: node.y ?? 0 };
    });
    let committed = false;

    const handleMove = (mv) => {
      if (!committed) { committed = true; onCommit?.(snapshot); }
      const dx = (mv.clientX - startX) / z;
      const dy = (mv.clientY - startY) / z;
      const sign = (corner === 'br' || corner === 'tr') ? 1 : -1;
      const delta = (dx + dy) / 2 * sign;
      const mult = Math.max(0.4, Math.min(3, 1 + delta * 0.008));
      starts.forEach(({ path, scale }) => {
        const newScale = Math.max(0.4, Math.min(3, scale * mult));
        onEdit([...path, 'scale'], newScale);
      });
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  return ReactDOM.createPortal(
    <div className="group-sel-box" style={{
      left: rect.left - 6, top: rect.top - 6,
      width: rect.width + 12, height: rect.height + 12,
    }} aria-hidden="true">
      {['tl','tr','br','bl'].map(c => (
        <div key={c}
             className={`sel-handle sel-corner sel-corner--${c}`}
             onMouseDown={(e) => startCornerResize(e, c)} />
      ))}
    </div>,
    document.body
  );
}

function FloatingToolbar({ activeKey, menu, onEdit, zoom }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!activeKey) { setPos(null); return; }
    let raf = 0;
    let last = null;
    const tick = () => {
      const target = document.querySelector('.draggable-block.sel-active');
      if (!target) { setPos(null); raf = requestAnimationFrame(tick); return; }
      const r = target.getBoundingClientRect();
      const next = { left: r.left + r.width / 2, top: r.top - 8 };
      if (!last || last.left !== next.left || last.top !== next.top) {
        last = next;
        setPos(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeKey, zoom]);

  if (!activeKey || !pos || !menu) return null;

  // Read current style overrides from layout path
  const segs = activeKey.split('.').map(s => /^\d+$/.test(s) ? +s : s);
  let node = menu;
  for (const k of segs) { if (node == null) break; node = node[k]; }
  const style = node?.style || {};
  const scale = node?.scale ?? 1;
  const locked = !!node?.locked;
  const hidden = !!node?.hidden;

  const setStyle = (patch) => {
    onEdit([...segs, 'style'], { ...style, ...patch });
  };
  const setScale = (s) => {
    onEdit([...segs, 'scale'], Math.max(0.4, Math.min(3, s)));
  };
  const toggleLocked = () => onEdit([...segs, 'locked'], !locked);
  const toggleHidden = () => onEdit([...segs, 'hidden'], !hidden);

  return ReactDOM.createPortal(
    <div className="floating-toolbar" style={{ left: pos.left, top: pos.top }}
         onMouseDown={(e) => e.stopPropagation()}
         onClick={(e) => e.stopPropagation()}>
      <button className="ft-btn" title="Smaller" onClick={() => setScale(+(scale - 0.1).toFixed(2))} disabled={locked}>A−</button>
      <span className="ft-val">{Math.round(scale * 100)}%</span>
      <button className="ft-btn" title="Larger" onClick={() => setScale(+(scale + 0.1).toFixed(2))} disabled={locked}>A+</button>
      <span className="ft-sep" />
      <button className={'ft-btn ft-toggle' + (style.bold ? ' active' : '')}
              title="Bold" onClick={() => setStyle({ bold: !style.bold })} disabled={locked}><b>B</b></button>
      <button className={'ft-btn ft-toggle' + (style.italic ? ' active' : '')}
              title="Italic" onClick={() => setStyle({ italic: !style.italic })} disabled={locked}><i>I</i></button>
      <span className="ft-sep" />
      <label className={'ft-color' + (locked ? ' ft-color--disabled' : '')} title="Text color">
        <span className="ft-color-swatch" style={{ background: style.color || '#000' }} />
        <input type="color" value={style.color || '#000000'}
               onChange={(e) => setStyle({ color: e.target.value })} disabled={locked} />
      </label>
      {style.color && (
        <button className="ft-btn ft-btn--mini" title="Clear color"
                onClick={() => setStyle({ color: undefined })} disabled={locked}>×</button>
      )}
      <span className="ft-sep" />
      <button className={'ft-btn ft-toggle' + (locked ? ' active' : '')}
              title={locked ? 'Unlock (allow edits)' : 'Lock (prevent edits)'}
              aria-pressed={locked}
              onClick={toggleLocked}>{locked ? '🔒' : '🔓'}</button>
      <button className={'ft-btn ft-toggle' + (hidden ? ' active' : '')}
              title={hidden ? 'Show block' : 'Hide block'}
              aria-pressed={hidden}
              onClick={toggleHidden}>{hidden ? '🙈' : '👁'}</button>
    </div>,
    document.body
  );
}


function groupBlocks(blocks) {
  const groups = [];
  blocks.forEach((b) => {
    if (b.kind === 'section') {
      groups.push({ section: b.section, si: b.si, cocktails: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].cocktails.push(b);
    }
  });
  return groups;
}

// Safe nested-read — returns { x:0, y:0 } if any key is absent
function getOffset(obj, ...keys) {
  let node = obj;
  for (const key of keys) {
    if (node == null) return { x: 0, y: 0 };
    node = node[key];
  }
  return node || { x: 0, y: 0 };
}

// Safe nested-read for a single value with a default
function getLayoutVal(obj, keys, def) {
  let node = obj;
  for (const key of keys) {
    if (node == null) return def;
    node = node[key];
  }
  return node ?? def;
}

// Stable key for a layout path (used for selection set membership)
function pathKey(path) { return path.join('.'); }

// Returns mousedown handler. Supports group drag when selection context is active.
function useDragBlock(path, offset, onDrag, onSnapshot, onCommit, getGroupDrags, onSnap, zoom, onSelect) {
  const startMouse = useRef(null);
  const startOffset = useRef(null);
  const groupSnapshot = useRef(null);
  const dragging = useRef(false);
  const key = pathKey(path);

  return useCallback((e) => {
    if (!onDrag) return;
    if (e.button !== 0) return;
    if (e.shiftKey) return;
    // Prevent browser text selection while dragging
    e.preventDefault();
    // Capture snapshot synchronously at mousedown — before any edit fires
    const snapshot = onSnapshot?.();
    startMouse.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    groupSnapshot.current = getGroupDrags ? getGroupDrags(key) : null;
    dragging.current = false;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    // Pre-compute snap targets from sibling draggable-blocks + page bounds
    const z = zoom || 1;
    const block = e.currentTarget.closest('.draggable-block');
    const sheet = block?.closest('.menu-sheet');
    // Collect DOM nodes to translate during drag (single or group)
    const group = groupSnapshot.current;
    const liveTargets = (group && group.length > 0)
      ? Array.from(document.querySelectorAll('.draggable-block.drag-selected'))
          .map(el => ({ el, baseLeft: parseFloat(el.style.left) || 0, baseTop: parseFloat(el.style.top) || 0 }))
      : (block ? [{ el: block, baseLeft: parseFloat(block.style.left) || 0, baseTop: parseFloat(block.style.top) || 0 }] : []);
    let finalDx = 0;
    let finalDy = 0;
    let lastSnapKey = '';
    let snapTargets = null;
    let initialBlockRect = null;
    if (block && sheet) {
      const sheetRect = sheet.getBoundingClientRect();
      initialBlockRect = block.getBoundingClientRect();
      const sheetLeft = sheetRect.left;
      const sheetTop = sheetRect.top;
      const sheetW = sheetRect.width;
      const sheetH = sheetRect.height;
      const verticals = [
        { pos: 0, kind: 'edge' },
        { pos: sheetW / 2, kind: 'center' },
        { pos: sheetW, kind: 'edge' },
      ];
      const horizontals = [
        { pos: 0, kind: 'edge' },
        { pos: sheetH / 2, kind: 'center' },
        { pos: sheetH, kind: 'edge' },
      ];
      sheet.querySelectorAll('.draggable-block').forEach(b => {
        if (b === block) return;
        const r = b.getBoundingClientRect();
        const left = (r.left - sheetLeft) / z;
        const right = (r.right - sheetLeft) / z;
        const top = (r.top - sheetTop) / z;
        const bottom = (r.bottom - sheetTop) / z;
        verticals.push({ pos: left, kind: 'sibling' }, { pos: (left + right) / 2, kind: 'sibling' }, { pos: right, kind: 'sibling' });
        horizontals.push({ pos: top, kind: 'sibling' }, { pos: (top + bottom) / 2, kind: 'sibling' }, { pos: bottom, kind: 'sibling' });
      });
      snapTargets = { verticals, horizontals, sheetLeft, sheetTop, sheetW, sheetH };
    }

    const handleMove = (mv) => {
      const rawDx = mv.clientX - startMouse.current.x;
      const rawDy = mv.clientY - startMouse.current.y;
      if (!dragging.current && Math.abs(rawDx) + Math.abs(rawDy) < 4) return;
      if (!dragging.current) {
        dragging.current = true;
        document.activeElement?.blur();
        // Don't commit snapshot here — it triggers a re-render that remounts the block
        // mid-drag. Commit on mouseup instead.
      }
      let dx = rawDx / z;
      let dy = rawDy / z;
      let guideV = null;
      let guideH = null;

      // Snap logic — only for single drag, not group
      const SNAP_THRESHOLD = 6;
      if (snapTargets && initialBlockRect && (!group || group.length === 0)) {
        // Block's would-be position relative to sheet (in layout coords)
        const blockW = initialBlockRect.width / z;
        const blockH = initialBlockRect.height / z;
        const newLeft = (initialBlockRect.left - snapTargets.sheetLeft) / z + dx;
        const newRight = newLeft + blockW;
        const newCenterX = newLeft + blockW / 2;
        const newTop = (initialBlockRect.top - snapTargets.sheetTop) / z + dy;
        const newBottom = newTop + blockH;
        const newCenterY = newTop + blockH / 2;

        let bestV = { diff: SNAP_THRESHOLD + 1 };
        snapTargets.verticals.forEach(t => {
          [{ edge: newLeft, kind: 'left' }, { edge: newCenterX, kind: 'cx' }, { edge: newRight, kind: 'right' }].forEach(e => {
            const d = t.pos - e.edge;
            if (Math.abs(d) < Math.abs(bestV.diff)) bestV = { diff: d, pos: t.pos };
          });
        });
        let bestH = { diff: SNAP_THRESHOLD + 1 };
        snapTargets.horizontals.forEach(t => {
          [{ edge: newTop, kind: 'top' }, { edge: newCenterY, kind: 'cy' }, { edge: newBottom, kind: 'bottom' }].forEach(e => {
            const d = t.pos - e.edge;
            if (Math.abs(d) < Math.abs(bestH.diff)) bestH = { diff: d, pos: t.pos };
          });
        });
        if (Math.abs(bestV.diff) <= SNAP_THRESHOLD) { dx += bestV.diff; guideV = bestV.pos; }
        if (Math.abs(bestH.diff) <= SNAP_THRESHOLD) { dy += bestH.diff; guideH = bestH.pos; }
      }

      // Live-move via direct DOM mutation on top/left — no React re-render, no text reflow
      finalDx = dx;
      finalDy = dy;
      const applyTransform = () => {
        liveTargets.forEach(({ el, baseLeft, baseTop }) => {
          el.style.left = `${baseLeft + dx}px`;
          el.style.top = `${baseTop + dy}px`;
        });
      };
      applyTransform();

      if (onSnap) {
        const snapKey = `${guideV ?? 'x'}|${guideH ?? 'x'}`;
        if (snapKey !== lastSnapKey) {
          lastSnapKey = snapKey;
          if (guideV != null || guideH != null) {
            const sr = sheet.getBoundingClientRect();
            onSnap({ v: guideV, h: guideH, sheetRect: { left: sr.left, top: sr.top, width: sr.width, height: sr.height }, zoom: z });
          } else {
            onSnap(null);
          }
          // Re-apply transform after React re-renders from the snap state change
          requestAnimationFrame(applyTransform);
        }
      }
    };
    const handleUp = () => {
      if (onSnap) onSnap(null);
      document.body.style.userSelect = prevUserSelect;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (!dragging.current) {
        // It was a click, not a drag — select now
        if (onSelect) onSelect();
        return;
      }
      // Reset to base position — React commit below will set the new top/left
      liveTargets.forEach(({ el, baseLeft, baseTop }) => {
        el.style.left = `${baseLeft}px`;
        el.style.top = `${baseTop}px`;
      });
      // Now push the snapshot to history (was deferred from drag start)
      onCommit?.(snapshot);
      // Commit final position to state once
      if (group && group.length > 0) {
        group.forEach(({ dragPath, startOff }) => {
          onDrag([...dragPath, 'x'], startOff.x + finalDx);
          onDrag([...dragPath, 'y'], startOff.y + finalDy);
        });
      } else {
        onDrag([...path, 'x'], startOffset.current.x + finalDx);
        onDrag([...path, 'y'], startOffset.current.y + finalDy);
      }
      if (onSelect) onSelect();
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [path, offset, onDrag, onSnapshot, onCommit, getGroupDrags, key, onSnap, zoom, onSelect]);
}

// Corner resize: drags produce a new scale multiplier
function useCornerResize(layoutPath, currentScale, onEdit, onSnapshot, onCommit, zoom) {
  return useCallback((e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    const snapshot = onSnapshot?.();  // capture at mousedown, before any edit
    const startX = e.clientX;
    const startY = e.clientY;
    const startScale = currentScale;
    let committed = false;

    const handleMove = (mv) => {
      if (!committed) { committed = true; onCommit?.(snapshot); }
      const dx = (mv.clientX - startX) / (zoom || 1);
      const dy = (mv.clientY - startY) / (zoom || 1);
      const sign = (corner === 'br' || corner === 'tr') ? 1 : -1;
      const delta = (dx + dy) / 2 * sign;
      const newScale = Math.max(0.4, Math.min(3, startScale + delta * 0.008));
      onEdit([...layoutPath, 'scale'], newScale);
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [layoutPath, currentScale, onEdit, onSnapshot, onCommit, zoom]);
}

// Side resize: the handle follows the mouse exactly.
// Right handle: width = mouseX - blockLeft (block stays put).
// Left handle: moves the left edge with the mouse, keeping the right edge fixed.
function useSideResize(layoutPath, currentWidth, currentX, onEdit, onSnapshot, onCommit, zoom) {
  return useCallback((e, side) => {
    e.preventDefault();
    e.stopPropagation();
    const snapshot = onSnapshot?.();  // capture at mousedown, before any edit
    const block = e.currentTarget.closest('.draggable-block');
    const rect = block ? block.getBoundingClientRect() : null;
    const z = zoom || 1;
    const startRight = rect ? rect.right / z : (currentX || 0) + (currentWidth || 200);
    let committed = false;

    const handleMove = (mv) => {
      if (!committed) { committed = true; onCommit?.(snapshot); }
      if (!rect) return;
      if (side === 'right') {
        const newW = Math.max(60, (mv.clientX - rect.left) / z);
        onEdit([...layoutPath, 'width'], newW);
      } else {
        const mouseLayout = mv.clientX / z;
        const newW = Math.max(60, startRight - mouseLayout);
        const newX = (currentX || 0) + ((currentWidth || rect.width / z) - newW);
        onEdit([...layoutPath, 'width'], newW);
        onEdit([...layoutPath, 'x'], newX);
      }
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [layoutPath, currentWidth, currentX, onEdit, onSnapshot, onCommit, zoom]);
}

// The Canva-style selection overlay rendered inside a selected block
function SelectionBox({ layoutPath, scale, width, currentX, onEdit, onSnapshot, onCommit, zoom }) {
  const onCorner = useCornerResize(layoutPath, scale, onEdit, onSnapshot, onCommit, zoom);
  const onSide = useSideResize(layoutPath, width, currentX, onEdit, onSnapshot, onCommit, zoom);

  return (
    <div className="sel-box" aria-hidden="true">
      {['tl','tr','br','bl'].map(c => (
        <div
          key={c}
          className={`sel-handle sel-corner sel-corner--${c}`}
          onMouseDown={(e) => onCorner(e, c)}
        />
      ))}
      <div className="sel-handle sel-side sel-side--left"  onMouseDown={(e) => onSide(e, 'left')} />
      <div className="sel-handle sel-side sel-side--right" onMouseDown={(e) => onSide(e, 'right')} />
    </div>
  );
}

// Editable span: locked until double-clicked, then fully editable.
// contentEditable is always true so toggling it never wipes the browser selection.
function Editable({ className, value, onSave, multiline = false, style, role, 'aria-label': ariaLabel }) {
  const ref = useRef(null);
  const editingRef = useRef(false);  // tracks state without causing re-renders

  // Sync prop → DOM only when not editing (editing keeps user's typed content)
  useEffect(() => {
    if (!editingRef.current && ref.current) {
      ref.current.innerText = value ?? '';
    }
  }, [value]);

  const lock = () => {
    ref.current.style.userSelect = 'none';
    ref.current.style.cursor = 'inherit';
    ref.current.setAttribute('data-locked', 'true');
    editingRef.current = false;
  };

  const unlock = () => {
    ref.current.style.userSelect = 'text';
    ref.current.style.cursor = 'text';
    ref.current.removeAttribute('data-locked');
    editingRef.current = true;
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    // Don't allow text editing if the parent block is locked
    if (ref.current?.closest('.draggable-block.is-locked')) return;
    unlock();
    // Don't touch selection — let browser word-select stand
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleBlur = (e) => {
    if (!editingRef.current) return;
    onSave(e.currentTarget.innerText);
    lock();
  };

  const handleKeyDown = (e) => {
    if (!editingRef.current) {
      if (e.key === 'Enter' || e.key === 'F2') {
        if (ref.current?.closest('.draggable-block.is-locked')) return;
        e.preventDefault(); unlock(); ref.current?.focus();
      }
      return;
    }
    if (e.key === 'Escape') { e.currentTarget.blur(); }
    if (!multiline && e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
  };

  // Eat single clicks and mousedown when locked so parent drag still works
  const handleMouseDown = (e) => {
    if (!editingRef.current) return; // let event bubble to draggable-block
    e.stopPropagation();
  };

  return (
    <span
      ref={ref}
      className={className}
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      data-locked="true"
      style={{ ...style, display: 'block', userSelect: 'none', cursor: 'inherit' }}
      role={role || 'textbox'}
      aria-multiline={multiline}
      aria-label={ariaLabel}
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
    />
  );
}

// ── Ornament components ──────────────────────────────────────────────────────

const OrnSvg = React.memo(function OrnSvg({ pack, slot, className, style: extraStyle = {} }) {
  if (!pack) return null;
  const s = pack[slot];
  if (!s) return null;
  return (
    <svg className={className} viewBox={s.viewBox}
         style={{ color: 'var(--m-accent)', ...extraStyle }}
         aria-hidden="true">
      <path d={s.path}
        fill={s.strokeOnly ? 'none' : 'currentColor'}
        stroke={s.strokeOnly ? 'currentColor' : 'none'}
        strokeWidth={s.strokeOnly ? 1.5 : 0} />
    </svg>
  );
});

const CornerSet = React.memo(function CornerSet({ pack }) {
  if (!pack) return null;
  return (
    <>
      {[
        { pos: 'tl', transform: 'none' },
        { pos: 'tr', transform: 'scaleX(-1)' },
        { pos: 'br', transform: 'rotate(180deg)' },
        { pos: 'bl', transform: 'scaleY(-1)' },
      ].map(({ pos, transform }) => (
        <OrnSvg key={pos} pack={pack} slot="corner"
          className={`ornament-corner ornament-corner--${pos}`}
          style={{ color: 'var(--m-accent)', transform }} />
      ))}
    </>
  );
});

const CartoucheFrame = React.memo(function CartoucheFrame({ pack, format, show }) {
  if (!pack || !show) return null;
  const isLandscape = format === 'a5h' || format === 'bookleth' || format === 'a6h';
  const c = (isLandscape && pack.cartoucheH) ? pack.cartoucheH : pack.cartouche;
  return (
    <svg className="ornament-cartouche" viewBox={c.viewBox}
         style={{ color: 'var(--m-accent)' }} aria-hidden="true">
      <path d={c.path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
});

const OrnamentDivider = React.memo(function OrnamentDivider({ pack }) {
  if (!pack) return <span className="m-orn">✦</span>;
  return <OrnSvg pack={pack} slot="divider" className="ornament-divider" />;
});

const SectionAccent = React.memo(function SectionAccent({ pack, show }) {
  if (!pack || !show) return null;
  return <OrnSvg pack={pack} slot="sectionAccent" className="ornament-section-accent" />;
});

const ItemTopRule = React.memo(function ItemTopRule({ pack, show }) {
  if (!pack || !show) return null;
  return <OrnSvg pack={pack} slot="itemRule" className="ornament-item-rule" />;
});

export default function MenuTemplate({ menu, format = 'a5', columns = 1, onEdit, onDrag, onSnapshot, onCommit, ornaments = { style: 'none', placement: {} }, contentAlign = 'center', selectedKeys: selectedKeysProp, onSelectionChange, activeKey: activeKeyProp, onActiveKeyChange, zoom = 1 }) {
  if (!menu) return null;

  // ── Selection state ────────────────────────────────────────────────────────
  const [localSelectedKeys, setLocalSelectedKeys] = useState(new Set());
  const selectedKeys = selectedKeysProp ?? localSelectedKeys;
  const setSelectedKeys = onSelectionChange ?? setLocalSelectedKeys;

  const [localActiveKey, setLocalActiveKey] = useState(null);
  const activeKey = activeKeyProp !== undefined ? activeKeyProp : localActiveKey;
  const setActiveKey = onActiveKeyChange || setLocalActiveKey;

  const toggleSelected = useCallback((key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, [setSelectedKeys]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setActiveKey(null);
  }, [setSelectedKeys]);

  // Click anywhere not inside a draggable-block clears selection
  const handleCanvasClick = useCallback((e) => {
    if (!e.target.closest('.draggable-block')) clearSelection();
  }, [clearSelection]);

  // ── Snap guides ────────────────────────────────────────────────────────────
  const [snapGuides, setSnapGuides] = useState(null);
  const onSnap = useCallback((g) => setSnapGuides(g), []);

  // ── Drag registry ──────────────────────────────────────────────────────────
  const dragRegistry = useRef({});

  const registerDraggable = useCallback((key, path, offset) => {
    dragRegistry.current[key] = { path, offset };
  }, []);

  const getGroupDrags = useCallback((key) => {
    if (!selectedKeys.has(key)) return null;
    return Array.from(selectedKeys).map(k => {
      const entry = dragRegistry.current[k];
      return entry ? { dragPath: entry.path, startOff: { ...entry.offset } } : null;
    }).filter(Boolean);
  }, [selectedKeys]);

  const pack = ORNAMENT_STYLES[ornaments.style] || null;
  const pl = ornaments.placement || {};

  const spec = menu.render_spec || {};

  const N = Math.max(1, spec.items_per_page || 7);
  const ITEM_H_BASE = 81;
  const titleScale = spec.title_scale || 1;
  const COVER_H = 113 + (titleScale * 42);
  const CONTENT_H = {
    a5:       653 - 100 - COVER_H,
    a5h:      460 - 80,
    a6:       327 - 50 - COVER_H,
    a6h:      230 - 40,
    booklet:  653 - 100,
    bookleth: 460 - 100,
  };
  const availableH = CONTENT_H[format] ?? CONTENT_H.booklet;
  const finalItemScale         = availableH           / (N * ITEM_H_BASE);
  const finalItemScaleBooklet  = CONTENT_H.booklet    / (N * ITEM_H_BASE);
  const finalItemScaleBookletH = CONTENT_H.bookleth   / (N * ITEM_H_BASE);
  const BOOKLET_ITEMS_PER_PAGE   = N;
  const BOOKLET_H_ITEMS_PER_PAGE = N;

  const styleVars = {
    '--m-bg':          spec.background   || MENU_DEFAULTS.bg,
    '--m-text':        spec.text_primary || MENU_DEFAULTS.text,
    '--m-muted':       spec.text_muted   || MENU_DEFAULTS.muted,
    '--m-accent':      spec.accent       || MENU_DEFAULTS.accent,
    '--m-display':     `'${spec.display_font || 'Cormorant Garamond'}'`,
    '--m-body':        `'${spec.body_font    || 'Archivo Narrow'}'`,
    '--m-pad-v':       '50px',
    '--m-pad-h':       '46px',
    '--m-section-gap': '16px',
    '--m-title-size':  `${(spec.title_scale || 1) * 42}px`,
    '--m-title-scale': `${spec.title_scale || 1}`,
    '--m-line-height': `${spec.line_height || 1.5}`,
    '--m-item-scale':  `${finalItemScale}`,
    '--m-content-align': contentAlign === 'right' ? 'right' : contentAlign === 'left' ? 'left' : 'center',
    '--m-content-justify': contentAlign === 'right' ? 'flex-end' : contentAlign === 'left' ? 'flex-start' : 'center',
  };

  const showIngredients = spec.show_ingredients !== false;
  const showPrices      = spec.show_prices      !== false;
  const showDescription = spec.show_description !== false;

  const layout = menu._layout || {};
  const edit = (path, value) => onEdit && onEdit(path, value);

  // ── Draggable block with Canva-style selection ────────────────────────────

  const Cocktail = ({ c, si, ci }) => {
    const layoutPath = ['_layout', 'sections', si, 'cocktails', ci];
    const editPath   = ['sections', si, 'cocktails', ci];
    const key = pathKey(layoutPath);
    const off = getOffset(layout, 'sections', si, 'cocktails', ci);
    const baseItemScale = layout.sections?.[si]?.cocktails?.[ci]?.scale ?? 1;
    const elemWidth = getLayoutVal(layout, ['sections', si, 'cocktails', ci, 'width'], null);
    const elemStyle = getLayoutVal(layout, ['sections', si, 'cocktails', ci, 'style'], null) || {};
    const locked = !!getLayoutVal(layout, ['sections', si, 'cocktails', ci, 'locked'], false);
    const hidden = !!getLayoutVal(layout, ['sections', si, 'cocktails', ci, 'hidden'], false);
    if (hidden) return null;
    registerDraggable(key, layoutPath, off);
    const isActive = activeKey === key;
    const isSelected = selectedKeys.has(key);
    const onMouseDownDrag = useDragBlock(layoutPath, off, onDrag, onSnapshot, onCommit, getGroupDrags, onSnap, zoom, () => {
      if (!isSelected) setSelectedKeys(new Set([key]));
      setActiveKey(key);
    });

    const handleMouseDown = onDrag ? (e) => {
      if (e.shiftKey) { e.preventDefault(); toggleSelected(key); return; }
      if (locked) {
        e.preventDefault();
        if (!isSelected) setSelectedKeys(new Set([key]));
        setActiveKey(key);
        return;
      }
      onMouseDownDrag(e);
    } : undefined;

    const handleClick = (e) => {
      e.stopPropagation();
    };

    const combinedScale = baseItemScale;

    return (
      <div
        className={'draggable-block m-item' + (isSelected ? ' drag-selected' : '') + (isActive ? ' sel-active' : '') + (locked ? ' is-locked' : '')}
        style={{
          top: off.y, left: off.x,
          transform: combinedScale !== 1 ? `scale(${combinedScale})` : undefined,
          transformOrigin: 'top left',
          marginBottom: combinedScale !== 1 ? `${(combinedScale - 1) * ITEM_H_BASE * finalItemScale}px` : undefined,
          width: elemWidth ? `${elemWidth}px` : undefined,
          '--elem-color': elemStyle.color || undefined,
        }}
        data-elem-color={elemStyle.color || undefined}
        data-elem-bold={elemStyle.bold ? '' : undefined}
        data-elem-italic={elemStyle.italic ? '' : undefined}
        data-locked-block={locked ? '' : undefined}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {isActive && !isGroupSelection && !locked && (
          <SelectionBox
            layoutPath={['_layout', 'sections', si, 'cocktails', ci]}
            scale={baseItemScale}
            width={elemWidth}
            currentX={off.x}
            onEdit={edit}
            onSnapshot={onSnapshot}
            onCommit={onCommit}
            zoom={zoom}
          />
        )}
        <ItemTopRule pack={pack} show={pl.items} />
        <div className="m-item-head">
          <Editable className="m-name" value={c.name}
            onSave={(v) => edit([...editPath, 'name'], v)}
            aria-label="Cocktail name" />
          {showPrices && c.price !== '' && (
            <Editable className="m-price" value={c.price}
              onSave={(v) => edit([...editPath, 'price'], v.replace(/[£$€]/g, ''))}
              aria-label="Price" />
          )}
        </div>
        {showDescription && (
          <Editable className="m-desc" value={c.description} multiline
            onSave={(v) => edit([...editPath, 'description'], v)}
            aria-label="Description" />
        )}
        {showIngredients && (
          <Editable className="m-ing" value={c.ingredients} multiline
            onSave={(v) => edit([...editPath, 'ingredients'], v)}
            aria-label="Ingredients" />
        )}
      </div>
    );
  };

  const SectionTitle = ({ section, si }) => {
    const layoutPath = ['_layout', 'sections', si, 'header'];
    const key = pathKey(layoutPath);
    const off = getOffset(layout, 'sections', si, 'header');
    const headerScale = getLayoutVal(layout, ['sections', si, 'header', 'scale'], 1);
    const headerWidth = getLayoutVal(layout, ['sections', si, 'header', 'width'], null);
    const headerStyle = getLayoutVal(layout, ['sections', si, 'header', 'style'], null) || {};
    const locked = !!getLayoutVal(layout, ['sections', si, 'header', 'locked'], false);
    const hidden = !!getLayoutVal(layout, ['sections', si, 'header', 'hidden'], false);
    if (hidden) return null;
    registerDraggable(key, layoutPath, off);
    const isActive = activeKey === key;
    const isSelected = selectedKeys.has(key);
    const onMouseDownDrag = useDragBlock(layoutPath, off, onDrag, onSnapshot, onCommit, getGroupDrags, onSnap, zoom, () => {
      if (!isSelected) setSelectedKeys(new Set([key]));
      setActiveKey(key);
    });

    const handleMouseDown = onDrag ? (e) => {
      if (e.shiftKey) { e.preventDefault(); toggleSelected(key); return; }
      if (locked) {
        e.preventDefault();
        if (!isSelected) setSelectedKeys(new Set([key]));
        setActiveKey(key);
        return;
      }
      onMouseDownDrag(e);
    } : undefined;

    const handleClick = (e) => {
      e.stopPropagation();
    };

    return (
      <div
        className={'draggable-block' + (isSelected ? ' drag-selected' : '') + (isActive ? ' sel-active' : '') + (locked ? ' is-locked' : '')}
        style={{
          top: off.y, left: off.x,
          transform: headerScale !== 1 ? `scale(${headerScale})` : undefined,
          transformOrigin: 'top center',
          width: headerWidth ? `${headerWidth}px` : undefined,
          '--elem-color': headerStyle.color || undefined,
        }}
        data-elem-color={headerStyle.color || undefined}
        data-elem-bold={headerStyle.bold ? '' : undefined}
        data-elem-italic={headerStyle.italic ? '' : undefined}
        data-locked-block={locked ? '' : undefined}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {isActive && !isGroupSelection && !locked && (
          <SelectionBox
            layoutPath={['_layout', 'sections', si, 'header']}
            scale={headerScale}
            width={headerWidth}
            currentX={off.x}
            onEdit={edit}
            onSnapshot={onSnapshot}
            onCommit={onCommit}
            zoom={zoom}
          />
        )}
        <div className="m-section">
          <SectionAccent pack={pack} show={pl.sections} />
          <Editable value={section.title}
            onSave={(v) => edit(['sections', si, 'title'], v)}
            aria-label="Section title" />
          <SectionAccent pack={pack} show={pl.sections} />
        </div>
      </div>
    );
  };

  // Cover sub-blocks (kicker, title, tagline, divider)
  const CoverBlock = ({ layoutSubPath, children }) => {
    const layoutPath = ['_layout', 'cover', ...layoutSubPath];
    const key = pathKey(layoutPath);
    const off = getOffset(layout, 'cover', ...layoutSubPath);
    const blockScale = getLayoutVal(layout, ['cover', ...layoutSubPath, 'scale'], 1);
    const blockWidth = getLayoutVal(layout, ['cover', ...layoutSubPath, 'width'], null);
    const blockStyle = getLayoutVal(layout, ['cover', ...layoutSubPath, 'style'], null) || {};
    const locked = !!getLayoutVal(layout, ['cover', ...layoutSubPath, 'locked'], false);
    const hidden = !!getLayoutVal(layout, ['cover', ...layoutSubPath, 'hidden'], false);
    if (hidden) return null;
    registerDraggable(key, layoutPath, off);
    const isActive = activeKey === key;
    const isSelected = selectedKeys.has(key);
    const onMouseDownDrag = useDragBlock(layoutPath, off, onDrag, onSnapshot, onCommit, getGroupDrags, onSnap, zoom, () => {
      if (!isSelected) setSelectedKeys(new Set([key]));
      setActiveKey(key);
    });

    const handleMouseDown = onDrag ? (e) => {
      if (e.shiftKey) { e.preventDefault(); toggleSelected(key); return; }
      if (locked) {
        e.preventDefault();
        if (!isSelected) setSelectedKeys(new Set([key]));
        setActiveKey(key);
        return;
      }
      onMouseDownDrag(e);
    } : undefined;

    const handleClick = (e) => {
      e.stopPropagation();
    };

    return (
      <div
        className={'draggable-block' + (isSelected ? ' drag-selected' : '') + (isActive ? ' sel-active' : '') + (locked ? ' is-locked' : '')}
        data-locked-block={locked ? '' : undefined}
        style={{
          top: off.y, left: off.x,
          transform: blockScale !== 1 ? `scale(${blockScale})` : undefined,
          transformOrigin: 'top center',
          width: blockWidth ? `${blockWidth}px` : undefined,
          '--elem-color': blockStyle.color || undefined,
        }}
        data-elem-color={blockStyle.color || undefined}
        data-elem-bold={blockStyle.bold ? '' : undefined}
        data-elem-italic={blockStyle.italic ? '' : undefined}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {isActive && !isGroupSelection && !locked && (
          <SelectionBox
            layoutPath={['_layout', 'cover', ...layoutSubPath]}
            scale={blockScale}
            width={blockWidth}
            currentX={off.x}
            onEdit={edit}
            onSnapshot={onSnapshot}
            onCommit={onCommit}
            zoom={zoom}
          />
        )}
        {children}
      </div>
    );
  };

  const Cover = ({ mini }) => (
    <>
    
      <CoverBlock layoutSubPath={['title']}>
        <Editable className={'m-title' + (mini ? ' m-title-mini' : '')} value={menu.bar_name}
          onSave={(v) => edit(['bar_name'], v)} aria-label="Bar name" />
      </CoverBlock>
      <CoverBlock layoutSubPath={['tagline']}>
        <Editable className="m-tagline" value={menu.tagline} multiline
          onSave={(v) => edit(['tagline'], v)} aria-label="Tagline" />
      </CoverBlock>
      <CoverBlock layoutSubPath={['divider']}>
        <div className="m-divider"><OrnamentDivider pack={pack} /></div>
      </CoverBlock>
    </>
  );

  const Footer = () => {
    const layoutPath = ['_layout', 'footer'];
    const key = pathKey(layoutPath);
    const off = getOffset(layout, 'footer');
    const footerScale = getLayoutVal(layout, ['footer', 'scale'], 1);
    const footerWidth = getLayoutVal(layout, ['footer', 'width'], null);
    const footerStyle = getLayoutVal(layout, ['footer', 'style'], null) || {};
    const locked = !!getLayoutVal(layout, ['footer', 'locked'], false);
    const hidden = !!getLayoutVal(layout, ['footer', 'hidden'], false);
    const isActive = activeKey === key;
    const isSelected = selectedKeys.has(key);
    const onMouseDownDrag = useDragBlock(layoutPath, off, onDrag, onSnapshot, onCommit, getGroupDrags, onSnap, zoom, () => {
      if (!isSelected) setSelectedKeys(new Set([key]));
      setActiveKey(key);
    });

    const handleMouseDown = onDrag ? (e) => {
      if (e.shiftKey) { e.preventDefault(); toggleSelected(key); return; }
      if (locked) {
        e.preventDefault();
        if (!isSelected) setSelectedKeys(new Set([key]));
        setActiveKey(key);
        return;
      }
      onMouseDownDrag(e);
    } : undefined;

    const handleClick = (e) => {
      e.stopPropagation();
    };

    if (hidden) return null;
    return menu.note ? (
      <div
        className={'draggable-block' + (isSelected ? ' drag-selected' : '') + (isActive ? ' sel-active' : '') + (locked ? ' is-locked' : '')}
        style={{
          top: off.y, left: off.x,
          transform: footerScale !== 1 ? `scale(${footerScale})` : undefined,
          transformOrigin: 'top center',
          width: footerWidth ? `${footerWidth}px` : undefined,
          '--elem-color': footerStyle.color || undefined,
        }}
        data-elem-color={footerStyle.color || undefined}
        data-elem-bold={footerStyle.bold ? '' : undefined}
        data-elem-italic={footerStyle.italic ? '' : undefined}
        data-locked-block={locked ? '' : undefined}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {isActive && !isGroupSelection && !locked && (
          <SelectionBox
            layoutPath={['_layout', 'footer']}
            scale={footerScale}
            width={footerWidth}
            currentX={off.x}
            onEdit={edit}
            onSnapshot={onSnapshot}
            onCommit={onCommit}
            zoom={zoom}
          />
        )}
        <div className="m-footer">
          <Editable className="m-footer-text" value={menu.note} multiline
            onSave={(v) => edit(['note'], v)} aria-label="Menu note" />
        </div>
      </div>
    ) : null;
  };

  const sections = menu.sections || [];
  const hasCartouche = !!(pack && pl.cartouche);
  const noBorder = ornaments.border === false || hasCartouche;

  const isGroupSelection = selectedKeys.size > 1;

  const overlays = (
    <>
      <SnapGuidesOverlay guides={snapGuides} />
      <GroupSelectionBox selectedKeys={selectedKeys} menu={menu} onEdit={edit} onSnapshot={onSnapshot} onCommit={onCommit} zoom={zoom} />
      <FloatingToolbar activeKey={activeKey} menu={menu} onEdit={edit} zoom={zoom} />
    </>
  );

  const SectionList = ({ blocks }) => {
    const rows = blocks
      ? groupBlocks(blocks)
      : sections.map((section, si) => ({ section, si, cocktails: (section.cocktails || []).map((c, ci) => ({ c, si, ci })) }));
    return (
      <div className="m-columns" style={{ columnCount: columns, columnGap: '32px' }}>
        {rows.map((g, gi) => (
          <div key={gi}>
            <SectionTitle section={g.section} si={g.si} />
            {g.cocktails.map((b, bi) => (
              <Cocktail key={bi} c={b.c} si={b.si} ci={b.ci} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  /* ── A5 PORTRAIT ─────────────────────────────────────────────────────────── */
  if (format === 'a5') {
    const totalCocktails = sections.reduce((s, sec) => s + (sec.cocktails || []).length, 0);
    const needsPagination = totalCocktails > N;

    if (!needsPagination) {
      return (
        <>
          {overlays}
          <div
            className={`menu-sheet sheet-a5${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`}
            id="menu-sheet"
            style={styleVars}
            onClick={handleCanvasClick}
          >
            {pl.corners && pack && <CornerSet pack={pack} />}
            <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
            <div className="menu-pad">
              <Cover mini />
              <SectionList />
              {menu.note && <Footer />}
            </div>
          </div>
        </>
      );
    }

    const a5Pages = [];
    let a5Current = { blocks: [] };
    let a5Count = 0;
    const pushA5Page = () => {
      if (a5Current.blocks.length) a5Pages.push({ ...a5Current });
      a5Current = { blocks: [] };
      a5Count = 0;
    };

    sections.forEach((section, si) => {
      if (a5Count > 0 && a5Count >= N - 1) pushA5Page();
      a5Current.blocks.push({ kind: 'section', section, si });
      (section.cocktails || []).forEach((c, ci) => {
        if (a5Count >= N) pushA5Page();
        a5Current.blocks.push({ kind: 'cocktail', c, si, ci });
        a5Count++;
      });
    });
    pushA5Page();

    const coverBlocks = a5Pages[0]?.blocks || [];
    const restPages = a5Pages.slice(1);

    return (
      <>
        {overlays}
        <div className="booklet" id="menu-sheet" style={styleVars} onClick={handleCanvasClick}>
          <div className={`menu-sheet sheet-a5${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`}>
            {pl.corners && pack && <CornerSet pack={pack} />}
            <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
            <div className="menu-pad">
              <Cover mini />
              <SectionList blocks={coverBlocks} />
            </div>
          </div>
          {restPages.map((page, pi) => (
            <div key={pi} className={`menu-sheet sheet-a5${noBorder ? ' no-border' : ''}`}
                 style={{ '--m-item-scale': finalItemScaleBooklet }}>
              {pl.allPages && pack && <CornerSet pack={pack} />}
              <div className="menu-pad">
                <SectionList blocks={page.blocks} />
              </div>
            </div>
          ))}
          {menu.note && (
            <div className={`menu-sheet sheet-a5${noBorder ? ' no-border' : ''}`}>
              {pl.allPages && pack && <CornerSet pack={pack} />}
              <div className="menu-pad">
                <div className="m-divider"><OrnamentDivider pack={pack} /></div>
                <Footer />
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── A5 LANDSCAPE ────────────────────────────────────────────────────────── */
  if (format === 'a5h') {
    return (
      <>
        {overlays}
        <div className={`menu-sheet sheet-a5h${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`} id="menu-sheet" style={styleVars} onClick={handleCanvasClick}>
          {pl.corners && pack && <CornerSet pack={pack} />}
          <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
          <div className="menu-pad-h">
            <div className="menu-col-cover">
              <Cover />
              <Footer />
            </div>
            <div className="menu-col-divider" />
            <div className="menu-col-drinks">
              <SectionList blocks={null} />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── A6 PORTRAIT ─────────────────────────────────────────────────────────── */
  if (format === 'a6') {
    const totalCocktails = sections.reduce((s, sec) => s + (sec.cocktails || []).length, 0);
    const needsPagination = totalCocktails > N;

    if (!needsPagination) {
      return (
        <>
          {overlays}
          <div
            className={`menu-sheet sheet-a6${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`}
            id="menu-sheet"
            style={styleVars}
            onClick={handleCanvasClick}
          >
            {pl.corners && pack && <CornerSet pack={pack} />}
            <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
            <div className="menu-pad">
              <Cover mini />
              <SectionList />
              {menu.note && <Footer />}
            </div>
          </div>
        </>
      );
    }

    const a6Pages = [];
    let a6Current = { blocks: [] };
    let a6Count = 0;
    const pushA6Page = () => {
      if (a6Current.blocks.length) a6Pages.push({ ...a6Current });
      a6Current = { blocks: [] };
      a6Count = 0;
    };

    sections.forEach((section, si) => {
      if (a6Count > 0 && a6Count >= N - 1) pushA6Page();
      a6Current.blocks.push({ kind: 'section', section, si });
      (section.cocktails || []).forEach((c, ci) => {
        if (a6Count >= N) pushA6Page();
        a6Current.blocks.push({ kind: 'cocktail', c, si, ci });
        a6Count++;
      });
    });
    pushA6Page();

    const coverBlocks = a6Pages[0]?.blocks || [];
    const restPages = a6Pages.slice(1);

    return (
      <>
        {overlays}
        <div className="booklet" id="menu-sheet" style={styleVars} onClick={handleCanvasClick}>
          <div className={`menu-sheet sheet-a6${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`}>
            {pl.corners && pack && <CornerSet pack={pack} />}
            <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
            <div className="menu-pad">
              <Cover mini />
              <SectionList blocks={coverBlocks} />
            </div>
          </div>
          {restPages.map((page, pi) => (
            <div key={pi} className={`menu-sheet sheet-a6${noBorder ? ' no-border' : ''}`}
                 style={{ '--m-item-scale': finalItemScaleBooklet }}>
              {pl.allPages && pack && <CornerSet pack={pack} />}
              <div className="menu-pad">
                <SectionList blocks={page.blocks} />
              </div>
            </div>
          ))}
          {menu.note && (
            <div className={`menu-sheet sheet-a6${noBorder ? ' no-border' : ''}`}>
              {pl.allPages && pack && <CornerSet pack={pack} />}
              <div className="menu-pad">
                <div className="m-divider"><OrnamentDivider pack={pack} /></div>
                <Footer />
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── A6 LANDSCAPE ────────────────────────────────────────────────────────── */
  if (format === 'a6h') {
    return (
      <>
        {overlays}
        <div className={`menu-sheet sheet-a6h${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`} id="menu-sheet" style={styleVars} onClick={handleCanvasClick}>
          {pl.corners && pack && <CornerSet pack={pack} />}
          <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
          <div className="menu-pad-h">
            <div className="menu-col-cover">
              <Cover />
              <Footer />
            </div>
            <div className="menu-col-divider" />
            <div className="menu-col-drinks">
              <SectionList blocks={null} />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── BOOKLET LANDSCAPE ───────────────────────────────────────────────────── */
  if (format === 'bookleth') {
    const hPages = [];
    hPages.push({ type: 'cover' });

    let hCurrent = { type: 'content', blocks: [] };
    let hCount = 0;
    const pushHPage = () => {
      if (hCurrent.blocks.length) hPages.push(hCurrent);
      hCurrent = { type: 'content', blocks: [] };
      hCount = 0;
    };

    sections.forEach((section, si) => {
      if (hCount > 0 && hCount >= BOOKLET_H_ITEMS_PER_PAGE - 1) pushHPage();
      hCurrent.blocks.push({ kind: 'section', section, si });
      (section.cocktails || []).forEach((c, ci) => {
        if (hCount >= BOOKLET_H_ITEMS_PER_PAGE) pushHPage();
        hCurrent.blocks.push({ kind: 'cocktail', c, si, ci });
        hCount++;
      });
    });
    pushHPage();
    hPages.push({ type: 'footer' });

    return (
      <>
        {overlays}
        <div className="booklet" id="menu-sheet" style={styleVars} onClick={handleCanvasClick}>
        {hPages.map((page, pi) => {
          if (page.type === 'cover') {
            return (
              <div className={`menu-sheet sheet-a5h page-cover-h${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`} key={pi}>
                {pl.corners && pack && <CornerSet pack={pack} />}
                <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
                <div className="menu-pad-h menu-pad-h-cover">
                  <Cover />
                </div>
              </div>
            );
          }
          if (page.type === 'footer') {
            return (
              <div className={`menu-sheet sheet-a5h page-footer-h${noBorder ? ' no-border' : ''}`} key={pi}>
                {pl.allPages && pack && <CornerSet pack={pack} />}
                <div className="menu-pad-h menu-pad-h-cover">
                  <div className="m-divider"><OrnamentDivider pack={pack} /></div>
                  <Footer />
                </div>
              </div>
            );
          }
          return (
            <div className={`menu-sheet sheet-a5h${noBorder ? ' no-border' : ''}`} key={pi}
                 style={{ '--m-item-scale': finalItemScaleBookletH }}>
              {pl.allPages && pack && <CornerSet pack={pack} />}
              <div className="menu-pad">
                <SectionList blocks={page.blocks} />
              </div>
            </div>
          );
        })}
        </div>
      </>
    );
  }

  /* ── BOOKLET PORTRAIT ────────────────────────────────────────────────────── */
  const pages = [];
  pages.push({ type: 'cover' });

  let current = { type: 'content', blocks: [] };
  let count = 0;
  const pushPage = () => {
    if (current.blocks.length) pages.push(current);
    current = { type: 'content', blocks: [] };
    count = 0;
  };

  sections.forEach((section, si) => {
    if (count > 0 && count >= BOOKLET_ITEMS_PER_PAGE - 1) pushPage();
    current.blocks.push({ kind: 'section', section, si });
    (section.cocktails || []).forEach((c, ci) => {
      if (count >= BOOKLET_ITEMS_PER_PAGE) pushPage();
      current.blocks.push({ kind: 'cocktail', c, si, ci });
      count++;
    });
  });
  pushPage();
  pages.push({ type: 'footer' });

  return (
    <>
      {overlays}
      <div className="booklet" id="menu-sheet" style={styleVars} onClick={handleCanvasClick}>
      {pages.map((page, pi) => {
        if (page.type === 'cover') {
          return (
            <div className={`menu-sheet sheet-booklet page-cover${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`} key={pi}>
              {pl.corners && pack && <CornerSet pack={pack} />}
              <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
              <div className="menu-pad menu-pad-cover"><Cover /></div>
            </div>
          );
        }
        if (page.type === 'footer') {
          return (
            <div className={`menu-sheet sheet-booklet page-footer${noBorder ? ' no-border' : ''}`} key={pi}>
              {pl.allPages && pack && <CornerSet pack={pack} />}
              <div className="menu-pad menu-pad-cover">
                <div className="m-divider"><OrnamentDivider pack={pack} /></div>
                <Footer />
              </div>
            </div>
          );
        }
        return (
          <div className={`menu-sheet sheet-booklet${noBorder ? ' no-border' : ''}`} key={pi}
               style={{ '--m-item-scale': finalItemScaleBooklet }}>
            {pl.allPages && pack && <CornerSet pack={pack} />}
            <div className="menu-pad">
              <SectionList blocks={page.blocks} />
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}
