import React from 'react';

/**
 * Renders the menu in one of two formats from the same data:
 *   - 'a5'      : a single dense A5 sheet (cover + all sections + full ingredients)
 *   - 'booklet' : a multi-page booklet (cover page, then paginated section pages)
 *
 * Colors/fonts come from menu.render_spec (CSS vars), so both formats share the
 * exact visual language extracted from your reference / House Brain.
 *
 * All text is contentEditable — click any field to tweak it before exporting.
 */

const BOOKLET_ITEMS_PER_PAGE = 5;
const BOOKLET_H_ITEMS_PER_PAGE = 4; // landscape pages are shorter vertically

export default function MenuTemplate({ menu, format = 'a5', columns = 1, onEdit }) {
  if (!menu) return null;

  const spec = menu.render_spec || {};
  const styleVars = {
    '--m-bg': spec.background || '#0c0d0e',
    '--m-text': spec.text_primary || '#e8e4db',
    '--m-muted': spec.text_muted || '#9a958c',
    '--m-accent': spec.accent || '#9a7b3f',
    '--m-display': `'${spec.display_font || 'Cormorant Garamond'}'`,
    '--m-body': `'${spec.body_font || 'Archivo Narrow'}'`,
  };

  const edit = (path, value) => onEdit && onEdit(path, value);

  // ── shared editable pieces ────────────────────────────────
  const Cocktail = ({ c, si, ci }) => (
    <div className="m-item">
      <div className="m-item-head">
        <span className="m-name" contentEditable suppressContentEditableWarning
          onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'name'], e.target.innerText)}>
          {c.name}
        </span>
        <span className="m-price" contentEditable suppressContentEditableWarning
          onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'price'], e.target.innerText.replace(/[£$€]/g, ''))}>
          {c.price}
        </span>
      </div>
      <div className="m-desc" contentEditable suppressContentEditableWarning
        onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'description'], e.target.innerText)}>
        {c.description}
      </div>
      <div className="m-ing" contentEditable suppressContentEditableWarning
        onBlur={(e) => edit(['sections', si, 'cocktails', ci, 'ingredients'], e.target.innerText)}>
        {c.ingredients}
      </div>
    </div>
  );

  const SectionTitle = ({ section, si }) => (
    <div className="m-section" contentEditable suppressContentEditableWarning
      onBlur={(e) => edit(['sections', si, 'title'], e.target.innerText)}>
      {section.title}
    </div>
  );

  const Cover = ({ mini }) => (
    <>
      <div className="m-kicker">Cocktails</div>
      <h2 className={'m-title' + (mini ? ' m-title-mini' : '')} contentEditable suppressContentEditableWarning
        onBlur={(e) => edit(['bar_name'], e.target.innerText)}>
        {menu.bar_name}
      </h2>
      <div className="m-tagline" contentEditable suppressContentEditableWarning
        onBlur={(e) => edit(['tagline'], e.target.innerText)}>
        {menu.tagline}
      </div>
      <div className="m-divider"><span className="m-orn">✦</span></div>
    </>
  );

  const Footer = () =>
    menu.note ? (
      <div className="m-footer">
        <div className="m-footer-text" contentEditable suppressContentEditableWarning
          onBlur={(e) => edit(['note'], e.target.innerText)}>
          {menu.note}
        </div>
      </div>
    ) : null;

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
  // Build a flat list of render blocks, then pack into pages.
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
    // section title starts a fresh page if the current one is already half full
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
