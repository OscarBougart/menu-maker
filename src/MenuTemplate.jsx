import React, { useRef, useState, useCallback } from 'react';
import { MENU_DEFAULTS } from './theme.js';
import { ORNAMENT_STYLES } from './ornaments.js';


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

// Returns mousedown handler that drags the block on hold/move, ignores quick clicks
function useDragBlock(path, offset, onDrag) {
  const startMouse = useRef(null);
  const startOffset = useRef(null);
  const dragging = useRef(false);

  return useCallback((e) => {
    if (!onDrag) return;
    if (e.button !== 0) return;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    dragging.current = false;

    const handleMove = (e) => {
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      if (!dragging.current && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!dragging.current) {
        dragging.current = true;
        document.activeElement?.blur();
      }
      onDrag(path, { x: startOffset.current.x + dx, y: startOffset.current.y + dy });
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [path, offset, onDrag]);
}

// Editable span: read-only until double-clicked or Enter/F2, saves on blur
function Editable({ className, value, onSave, multiline = false, style, role, 'aria-label': ariaLabel }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);

  const activate = (e) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => {
      ref.current?.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }, 0);
  };

  const handleBlur = (e) => {
    setEditing(false);
    onSave(e.target.innerText);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.target.blur(); }
    if (!multiline && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  };

  const handleKeyDownInactive = (e) => {
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); activate(e); }
  };

  return (
    <span
      ref={ref}
      className={className}
      tabIndex={0}
      style={{ ...style, display: 'block', cursor: editing ? 'text' : 'inherit', userSelect: editing ? 'text' : 'none' }}
      contentEditable={editing}
      suppressContentEditableWarning
      role={role || 'textbox'}
      aria-multiline={multiline}
      aria-label={ariaLabel}
      aria-readonly={!editing}
      onDoubleClick={activate}
      onBlur={editing ? handleBlur : undefined}
      onKeyDown={editing ? handleKeyDown : handleKeyDownInactive}
      onMouseDown={editing ? (e) => e.stopPropagation() : undefined}
    >
      {value}
    </span>
  );
}

// ── Ornament components — hoisted so React can memoize across re-renders ──────

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
  const isLandscape = format === 'a5h' || format === 'bookleth';
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

export default function MenuTemplate({ menu, format = 'a5', columns = 1, onEdit, onDrag, ornaments = { style: 'none', placement: {} }, contentAlign = 'center' }) {
  if (!menu) return null;

  const pack = ORNAMENT_STYLES[ornaments.style] || null;
  const pl = ornaments.placement || {};

  const spec = menu.render_spec || {};

  const N = Math.max(1, spec.items_per_page || 7);
  const ITEM_H_BASE = 81; // name+desc+ing+margins at item_scale=1
  const titleScale = spec.title_scale || 1;
  const COVER_H = 113 + (titleScale * 42); // kicker+tagline+divider(113) + title height(varies with S/M/L)
  const CONTENT_H = {
    a5:       653 - 100 - COVER_H, // 409px — cover shares this page
    a5h:      460 - 80,            // 380px — cover is in left column
    booklet:  653 - 100,           // 553px — cover is a separate page
    bookleth: 460 - 100,           // 360px — cover is a separate page
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

  const layout = menu._layout || {};
  const edit = (path, value) => onEdit && onEdit(path, value);

  // ── shared editable + draggable pieces ───────────────────

  const Cocktail = ({ c, si, ci }) => {
    const off = getOffset(layout, 'sections', si, 'cocktails', ci);
    const onMouseDown = useDragBlock(['_layout', 'sections', si, 'cocktails', ci], off, onDrag);
    return (
      <div className="draggable-block m-item" style={{ top: off.y, left: off.x }} onMouseDown={onDrag ? onMouseDown : undefined}>
        <ItemTopRule pack={pack} show={pl.items} />
        <div className="m-item-head">
          <Editable className="m-name" value={c.name}
            onSave={(v) => edit(['sections', si, 'cocktails', ci, 'name'], v)}
            aria-label="Cocktail name" />
          {showPrices && c.price !== '' && (
            <Editable className="m-price" value={c.price}
              onSave={(v) => edit(['sections', si, 'cocktails', ci, 'price'], v.replace(/[£$€]/g, ''))}
              aria-label="Price" />
          )}
        </div>
        <Editable className="m-desc" value={c.description} multiline
          onSave={(v) => edit(['sections', si, 'cocktails', ci, 'description'], v)}
          aria-label="Description" />
        {showIngredients && (
          <Editable className="m-ing" value={c.ingredients} multiline
            onSave={(v) => edit(['sections', si, 'cocktails', ci, 'ingredients'], v)}
            aria-label="Ingredients" />
        )}
      </div>
    );
  };

  const SectionTitle = ({ section, si }) => {
    const off = getOffset(layout, 'sections', si, 'header');
    const onMouseDown = useDragBlock(['_layout', 'sections', si, 'header'], off, onDrag);
    return (
      <div className="draggable-block" style={{ top: off.y, left: off.x }} onMouseDown={onDrag ? onMouseDown : undefined}>
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

  const Cover = ({ mini }) => {
    const kOff  = getOffset(layout, 'cover', 'kicker');
    const tOff  = getOffset(layout, 'cover', 'title');
    const tgOff = getOffset(layout, 'cover', 'tagline');
    const dOff  = getOffset(layout, 'cover', 'divider');
    const onMouseDownKicker  = useDragBlock(['_layout', 'cover', 'kicker'],  kOff,  onDrag);
    const onMouseDownTitle   = useDragBlock(['_layout', 'cover', 'title'],   tOff,  onDrag);
    const onMouseDownTagline = useDragBlock(['_layout', 'cover', 'tagline'], tgOff, onDrag);
    const onMouseDownDivider = useDragBlock(['_layout', 'cover', 'divider'], dOff,  onDrag);
    return (
      <>
        <div className="draggable-block" style={{ top: kOff.y, left: kOff.x }} onMouseDown={onDrag ? onMouseDownKicker : undefined}>
          <div className="m-kicker">Cocktails</div>
        </div>
        <div className="draggable-block" style={{ top: tOff.y, left: tOff.x }} onMouseDown={onDrag ? onMouseDownTitle : undefined}>
          <Editable className={'m-title' + (mini ? ' m-title-mini' : '')} value={menu.bar_name}
            onSave={(v) => edit(['bar_name'], v)} aria-label="Bar name" />
        </div>
        <div className="draggable-block" style={{ top: tgOff.y, left: tgOff.x }} onMouseDown={onDrag ? onMouseDownTagline : undefined}>
          <Editable className="m-tagline" value={menu.tagline} multiline
            onSave={(v) => edit(['tagline'], v)} aria-label="Tagline" />
        </div>
        <div className="draggable-block" style={{ top: dOff.y, left: dOff.x }} onMouseDown={onDrag ? onMouseDownDivider : undefined}>
          <div className="m-divider"><OrnamentDivider pack={pack} /></div>
        </div>
      </>
    );
  };

  const Footer = () => {
    const off = getOffset(layout, 'footer');
    const onMouseDown = useDragBlock(['_layout', 'footer'], off, onDrag);
    return menu.note ? (
      <div className="draggable-block" style={{ top: off.y, left: off.x }} onMouseDown={onDrag ? onMouseDown : undefined}>
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

  /* ── A5 PORTRAIT: paginated like booklet when items > N ─── */
  if (format === 'a5') {
    const totalCocktails = sections.reduce((s, sec) => s + (sec.cocktails || []).length, 0);
    const needsPagination = totalCocktails > N;

    if (!needsPagination) {
      return (
        <div
          className={`menu-sheet sheet-a5${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`}
          id="menu-sheet"
          style={styleVars}
        >
          {pl.corners && pack && <CornerSet pack={pack} />}
          <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
          <div className="menu-pad">
            <Cover mini />
            <SectionList />
            {menu.note && <Footer />}
          </div>
        </div>
      );
    }

    // Paginate: cover+first-batch on page 1, then content-only pages
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
      <div className="booklet" id="menu-sheet" style={styleVars}>
        {/* Page 1: cover + first batch */}
        <div className={`menu-sheet sheet-a5${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`}>
          {pl.corners && pack && <CornerSet pack={pack} />}
          <CartoucheFrame pack={pack} format={format} show={pl.cartouche} />
          <div className="menu-pad">
            <Cover mini />
            <SectionList blocks={coverBlocks} />
          </div>
        </div>
        {/* Subsequent content pages */}
        {restPages.map((page, pi) => (
          <div key={pi} className={`menu-sheet sheet-a5${noBorder ? ' no-border' : ''}`}
               style={{ '--m-item-scale': finalItemScaleBooklet }}>
            {pl.allPages && pack && <CornerSet pack={pack} />}
            <div className="menu-pad">
              <SectionList blocks={page.blocks} />
            </div>
          </div>
        ))}
        {/* Footer page */}
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
    );
  }

  /* ── A5 LANDSCAPE: two-column — cover left, drinks right ─── */
  if (format === 'a5h') {
    return (
      <div className={`menu-sheet sheet-a5h${pl.cartouche && pack ? ' has-cartouche' : ''}${noBorder ? ' no-border' : ''}`} id="menu-sheet" style={styleVars}>
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
    );
  }

  /* ── BOOKLET LANDSCAPE: cover page + paginated interior pages */
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
      <div className="booklet" id="menu-sheet" style={styleVars}>
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
    );
  }

  /* ── BOOKLET PORTRAIT: cover page + paginated interior pages ─ */
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
    <div className="booklet" id="menu-sheet" style={styleVars}>
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
  );
}
