import React, { useRef } from 'react';

const BOOKLET_ITEMS_PER_PAGE = 5;
const BOOKLET_H_ITEMS_PER_PAGE = 4;

// Safe nested-read — returns { x:0, y:0 } if any key is absent
function getOffset(obj, ...keys) {
  let node = obj;
  for (const key of keys) {
    if (node == null) return { x: 0, y: 0 };
    node = node[key];
  }
  return node || { x: 0, y: 0 };
}

// Grip handle — appears on parent hover, hidden in print
function DragHandle({ path, offset, onDrag }) {
  const startMouse = useRef(null);
  const startOffset = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    startMouse.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };

    const handleMove = (e) => {
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      onDrag(path, { x: startOffset.current.x + dx, y: startOffset.current.y + dy });
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  return (
    <span
      className="drag-handle"
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => { e.stopPropagation(); onDrag(path, { x: 0, y: 0 }); }}
      title="Drag to reposition · Double-click to reset"
      aria-hidden="true"
    >⠿</span>
  );
}

export default function MenuTemplate({ menu, format = 'a5', columns = 1, onEdit, onDrag }) {
  if (!menu) return null;

  const spec = menu.render_spec || {};

  const SPACING = {
    compact:  { padV: '28px', padH: '36px', itemGap: '12px', sectionGap: '8px'  },
    balanced: { padV: '50px', padH: '46px', itemGap: '20px', sectionGap: '16px' },
    airy:     { padV: '70px', padH: '52px', itemGap: '32px', sectionGap: '26px' },
  };
  const sp = SPACING[spec.spacing] || SPACING.balanced;

  const styleVars = {
    '--m-bg':          spec.background   || '#0c0d0e',
    '--m-text':        spec.text_primary || '#e8e4db',
    '--m-muted':       spec.text_muted   || '#9a958c',
    '--m-accent':      spec.accent       || '#9a7b3f',
    '--m-display':     `'${spec.display_font || 'Cormorant Garamond'}'`,
    '--m-body':        `'${spec.body_font    || 'Archivo Narrow'}'`,
    '--m-pad-v':       sp.padV,
    '--m-pad-h':       sp.padH,
    '--m-item-gap':    sp.itemGap,
    '--m-section-gap': sp.sectionGap,
    '--m-title-size':  `${(spec.title_scale || 1) * 42}px`,
  };

  const showIngredients = spec.show_ingredients !== false;
  const showPrices      = spec.show_prices      !== false;

  const layout = menu._layout || {};
  const edit = (path, value) => onEdit && onEdit(path, value);

  // ── shared editable + draggable pieces ───────────────────

  const Cocktail = ({ c, si, ci }) => {
    const off = getOffset(layout, 'sections', si, 'cocktails', ci);
    return (
      <div className="draggable-block m-item" style={{ top: off.y, left: off.x }}>
        {onDrag && <DragHandle path={['_layout', 'sections', si, 'cocktails', ci]} offset={off} onDrag={onDrag} />}
        <div className="m-item-head">
          <span className="m-name" contentEditable suppressContentEditableWarning
            role="textbox" aria-multiline="false" aria-label="Cocktail name"
            onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'name'], e.target.innerText)}>
            {c.name}
          </span>
          {showPrices && (
            <span className="m-price" contentEditable suppressContentEditableWarning
              role="textbox" aria-multiline="false" aria-label="Price"
              onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'price'], e.target.innerText.replace(/[£$€]/g, ''))}>
              {c.price}
            </span>
          )}
        </div>
        <div className="m-desc" contentEditable suppressContentEditableWarning
          role="textbox" aria-multiline="true" aria-label="Description"
          onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'description'], e.target.innerText)}>
          {c.description}
        </div>
        {showIngredients && (
          <div className="m-ing" contentEditable suppressContentEditableWarning
            role="textbox" aria-multiline="true" aria-label="Ingredients"
            onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'ingredients'], e.target.innerText)}>
            {c.ingredients}
          </div>
        )}
      </div>
    );
  };

  const SectionTitle = ({ section, si }) => {
    const off = getOffset(layout, 'sections', si, 'header');
    return (
      <div className="draggable-block" style={{ top: off.y, left: off.x }}>
        {onDrag && <DragHandle path={['_layout', 'sections', si, 'header']} offset={off} onDrag={onDrag} />}
        <div className="m-section" contentEditable suppressContentEditableWarning
          role="textbox" aria-multiline="false" aria-label="Section title"
          onBlur={(e) => edit(['sections', si, 'title'], e.target.innerText)}>
          {section.title}
        </div>
      </div>
    );
  };

  const Cover = ({ mini }) => {
    const kOff  = getOffset(layout, 'cover', 'kicker');
    const tOff  = getOffset(layout, 'cover', 'title');
    const tgOff = getOffset(layout, 'cover', 'tagline');
    const dOff  = getOffset(layout, 'cover', 'divider');
    return (
      <>
        <div className="draggable-block" style={{ top: kOff.y, left: kOff.x }}>
          {onDrag && <DragHandle path={['_layout', 'cover', 'kicker']} offset={kOff} onDrag={onDrag} />}
          <div className="m-kicker">Cocktails</div>
        </div>
        <div className="draggable-block" style={{ top: tOff.y, left: tOff.x }}>
          {onDrag && <DragHandle path={['_layout', 'cover', 'title']} offset={tOff} onDrag={onDrag} />}
          <h2 className={'m-title' + (mini ? ' m-title-mini' : '')} contentEditable suppressContentEditableWarning
            aria-label="Bar name"
            onBlur={(e) => edit(['bar_name'], e.target.innerText)}>
            {menu.bar_name}
          </h2>
        </div>
        <div className="draggable-block" style={{ top: tgOff.y, left: tgOff.x }}>
          {onDrag && <DragHandle path={['_layout', 'cover', 'tagline']} offset={tgOff} onDrag={onDrag} />}
          <div className="m-tagline" contentEditable suppressContentEditableWarning
            role="textbox" aria-multiline="true" aria-label="Tagline"
            onBlur={(e) => edit(['tagline'], e.target.innerText)}>
            {menu.tagline}
          </div>
        </div>
        <div className="draggable-block" style={{ top: dOff.y, left: dOff.x }}>
          {onDrag && <DragHandle path={['_layout', 'cover', 'divider']} offset={dOff} onDrag={onDrag} />}
          <div className="m-divider"><span className="m-orn">✦</span></div>
        </div>
      </>
    );
  };

  const Footer = () => {
    const off = getOffset(layout, 'footer');
    return menu.note ? (
      <div className="draggable-block" style={{ top: off.y, left: off.x }}>
        {onDrag && <DragHandle path={['_layout', 'footer']} offset={off} onDrag={onDrag} />}
        <div className="m-footer">
          <div className="m-footer-text" contentEditable suppressContentEditableWarning
            role="textbox" aria-multiline="true" aria-label="Menu note"
            onBlur={(e) => edit(['note'], e.target.innerText)}>
            {menu.note}
          </div>
        </div>
      </div>
    ) : null;
  };

  const sections = menu.sections || [];

  const SectionList = () => (
    <div className="m-columns" style={{ columnCount: columns, columnGap: '32px' }}>
      {sections.map((section, si) => (
        <div key={si} style={{ breakInside: 'avoid' }}>
          <SectionTitle section={section} si={si} />
          {(section.cocktails || []).map((c, ci) => (
            <Cocktail key={ci} c={c} si={si} ci={ci} />
          ))}
        </div>
      ))}
    </div>
  );

  /* ── A5 PORTRAIT: one dense page ─────────────────────────── */
  if (format === 'a5') {
    return (
      <div className="menu-sheet sheet-a5" id="menu-sheet" style={styleVars}>
        <div className="menu-pad">
          <Cover />
          <SectionList />
          <Footer />
        </div>
      </div>
    );
  }

  /* ── A5 LANDSCAPE: two-column — cover left, drinks right ─── */
  if (format === 'a5h') {
    return (
      <div className="menu-sheet sheet-a5h" id="menu-sheet" style={styleVars}>
        <div className="menu-pad-h">
          <div className="menu-col-cover">
            <Cover />
            <Footer />
          </div>
          <div className="menu-col-divider" />
          <div className="menu-col-drinks">
            <SectionList />
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
              <div className="menu-sheet sheet-a5h page-cover-h" key={pi}>
                <div className="menu-pad-h menu-pad-h-cover">
                  <Cover />
                </div>
              </div>
            );
          }
          if (page.type === 'footer') {
            return (
              <div className="menu-sheet sheet-a5h page-footer-h" key={pi}>
                <div className="menu-pad-h menu-pad-h-cover">
                  <div className="m-divider"><span className="m-orn">✦</span></div>
                  <Footer />
                </div>
              </div>
            );
          }
          return (
            <div className="menu-sheet sheet-a5h" key={pi}>
              <div className="menu-pad">
                <div className="m-columns" style={{ columnCount: columns, columnGap: '32px' }}>
                  {page.blocks.map((b, bi) =>
                    b.kind === 'section'
                      ? <div key={bi} style={{ breakInside: 'avoid' }}><SectionTitle section={b.section} si={b.si} /></div>
                      : <div key={bi} style={{ breakInside: 'avoid' }}><Cocktail c={b.c} si={b.si} ci={b.ci} /></div>
                  )}
                </div>
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
            <div className="menu-sheet sheet-booklet page-cover" key={pi}>
              <div className="menu-pad menu-pad-cover"><Cover /></div>
            </div>
          );
        }
        if (page.type === 'footer') {
          return (
            <div className="menu-sheet sheet-booklet page-footer" key={pi}>
              <div className="menu-pad menu-pad-cover">
                <div className="m-divider"><span className="m-orn">✦</span></div>
                <Footer />
              </div>
            </div>
          );
        }
        return (
          <div className="menu-sheet sheet-booklet" key={pi}>
            <div className="menu-pad">
              <div className="m-columns" style={{ columnCount: columns, columnGap: '32px' }}>
                {page.blocks.map((b, bi) =>
                  b.kind === 'section'
                    ? <div key={bi} style={{ breakInside: 'avoid' }}><SectionTitle section={b.section} si={b.si} /></div>
                    : <div key={bi} style={{ breakInside: 'avoid' }}><Cocktail c={b.c} si={b.si} ci={b.ci} /></div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
