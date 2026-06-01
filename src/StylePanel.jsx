import React from 'react';

const DISPLAY_FONTS = [
  'Cormorant Garamond', 'Playfair Display', 'EB Garamond',
  'Cinzel', 'Bodoni Moda', 'DM Serif Display', 'Libre Baskerville',
];
const BODY_FONTS = [
  'Archivo Narrow', 'Jost', 'Inter Tight',
  'Barlow Condensed', 'DM Sans', 'Outfit',
];

export default function StylePanel({
  menu,
  columns,
  contentAlign,
  ornaments,
  selectedKeys,
  onEditMenu,
  onSetColumns,
  onSetContentAlign,
  onSetOrnaments,
}) {
  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <div className="kicker">Menu Style</div>
        <h2>Style</h2>
      </div>
      {menu ? (
        <>
          <div className="block">
            <div className="block-title">Colors</div>
            <div className="style-row">
              {[
                { key: 'background',   label: 'BG'     },
                { key: 'text_primary', label: 'Text'   },
                { key: 'accent',       label: 'Accent' },
                { key: 'text_muted',   label: 'Muted'  },
              ].map(({ key, label }) => (
                <label key={key} className="color-swatch-wrap" title={label}>
                  <input type="color" className="color-input"
                    value={menu.render_spec?.[key] || '#888888'}
                    onChange={(e) => onEditMenu(['render_spec', key], e.target.value)}
                  />
                  <span className="color-name">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="block">
            <div className="block-title">Fonts</div>
            <span className="src-label">Display</span>
            <div className="font-grid">
              {DISPLAY_FONTS.map(f => (
                <button key={f}
                  className={'font-chip' + ((menu.render_spec?.display_font || 'Cormorant Garamond') === f ? ' active' : '')}
                  aria-pressed={(menu.render_spec?.display_font || 'Cormorant Garamond') === f}
                  style={{ fontFamily: `'${f}', serif` }}
                  onClick={() => onEditMenu(['render_spec', 'display_font'], f)}
                >{f}</button>
              ))}
            </div>
            <span className="src-label">Body</span>
            <div className="font-grid">
              {BODY_FONTS.map(f => (
                <button key={f}
                  className={'font-chip' + ((menu.render_spec?.body_font || 'Archivo Narrow') === f ? ' active' : '')}
                  aria-pressed={(menu.render_spec?.body_font || 'Archivo Narrow') === f}
                  style={{ fontFamily: `'${f}', sans-serif` }}
                  onClick={() => onEditMenu(['render_spec', 'body_font'], f)}
                >{f}</button>
              ))}
            </div>
          </div>

          <div className="block">
            <div className="block-title">Layout</div>
            <span className="src-label">Columns</span>
            <div className="style-row" style={{ marginBottom: 12 }}>
              {[1, 2, 3].map((n) => (
                <button key={n} aria-pressed={columns === n} className={'style-chip' + (columns === n ? ' active' : '')} onClick={() => onSetColumns(n)}>{n}</button>
              ))}
            </div>
            <span className="src-label">Alignment</span>
            <div className="style-row" style={{ marginBottom: 12 }}>
              {['Left', 'Center', 'Right'].map((label) => {
                const value = label.toLowerCase();
                return (
                  <button key={value}
                    className={'style-chip' + (contentAlign === value ? ' active' : '')}
                    onClick={() => onSetContentAlign(value)}
                    aria-pressed={contentAlign === value}
                  >{label}</button>
                );
              })}
            </div>
            <div className="stepper-row">
              <div className="stepper-group">
                <span className="src-label">Title</span>
                <div className="style-row">
                  <button className="style-chip"
                    onClick={() => onEditMenu(['render_spec', 'title_scale'], Math.max(0.4, +((menu.render_spec?.title_scale || 1) - 0.05).toFixed(2)))}
                    aria-label="Smaller title">−</button>
                  <span className="per-page-num">{Math.round((menu.render_spec?.title_scale || 1) * 42)}px</span>
                  <button className="style-chip"
                    onClick={() => onEditMenu(['render_spec', 'title_scale'], Math.min(2.5, +((menu.render_spec?.title_scale || 1) + 0.05).toFixed(2)))}
                    aria-label="Larger title">+</button>
                </div>
              </div>
              <div className="stepper-group">
                <span className="src-label">Cocktails</span>
                <div className="style-row">
                  <button className="style-chip"
                    onClick={() => onEditMenu(['render_spec', 'items_per_page'], Math.min(20, (menu.render_spec?.items_per_page || 7) + 1))}
                    aria-label="Smaller cocktails">−</button>
                  <span className="per-page-num">{Math.round(19 * 553 / ((menu.render_spec?.items_per_page || 7) * 81))}px</span>
                  <button className="style-chip"
                    onClick={() => onEditMenu(['render_spec', 'items_per_page'], Math.max(3, (menu.render_spec?.items_per_page || 7) - 1))}
                    aria-label="Larger cocktails">+</button>
                </div>
              </div>
            </div>
            <div className="stepper-group" style={{ marginTop: 12 }}>
              <span className="src-label">Spacing</span>
              <div className="style-row">
                <button className="style-chip"
                  onClick={() => onEditMenu(['render_spec', 'line_height'], Math.max(0.8, +((menu.render_spec?.line_height || 1.5) - 0.05).toFixed(2)))}
                  aria-label="Tighter spacing">−</button>
                <span className="per-page-num">{(menu.render_spec?.line_height || 1.5).toFixed(1)}</span>
                <button className="style-chip"
                  onClick={() => onEditMenu(['render_spec', 'line_height'], Math.min(3, +((menu.render_spec?.line_height || 1.5) + 0.05).toFixed(2)))}
                  aria-label="Looser spacing">+</button>
              </div>
            </div>
          </div>

          {(() => {
            if (selectedKeys.size !== 1) return null;
            const selKey = Array.from(selectedKeys)[0];
            const m = selKey.match(/^_layout\.sections\.(\d+)\.cocktails\.(\d+)$/);
            if (!m) return null;
            const si = +m[1], ci = +m[2];
            const itemScale = menu._layout?.sections?.[si]?.cocktails?.[ci]?.scale ?? 1;
            return (
              <div className="block">
                <div className="block-title">Selected Item</div>
                <div className="stepper-group">
                  <span className="src-label">Size</span>
                  <div className="style-row">
                    <button className="style-chip"
                      onClick={() => onEditMenu(['_layout', 'sections', si, 'cocktails', ci, 'scale'], Math.max(0.5, +(itemScale - 0.05).toFixed(2)))}
                      aria-label="Smaller item">−</button>
                    <span className="per-page-num">{Math.round(itemScale * 100)}%</span>
                    <button className="style-chip"
                      onClick={() => onEditMenu(['_layout', 'sections', si, 'cocktails', ci, 'scale'], Math.min(2, +(itemScale + 0.05).toFixed(2)))}
                      aria-label="Larger item">+</button>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="block">
            <div className="block-title">Content</div>
            <div className="style-row content-toggles">
              {[
                { key: 'show_description', label: 'Description'  },
                { key: 'show_ingredients', label: 'Ingredients' },
                { key: 'show_prices',      label: 'Prices'      },
              ].map(({ key, label }) => {
                const on = menu.render_spec?.[key] !== false;
                return (
                  <button key={key}
                    className={'style-chip toggle-chip' + (on ? ' active' : '')}
                    onClick={() => onEditMenu(['render_spec', key], !on)}
                    aria-pressed={on}
                  >{label}</button>
                );
              })}
            </div>
          </div>

          <div className="block">
            <div className="block-title">Ornaments</div>
            <div className="style-row" style={{ marginBottom: 10 }}>
              <button
                className={'style-chip toggle-chip' + (ornaments.border ? ' active' : '')}
                onClick={() => onSetOrnaments(o => ({ ...o, border: !o.border }))}
                aria-pressed={ornaments.border}
              >Border frame</button>
            </div>
            <span className="src-label">Style</span>
            <select className="src-select"
              value={ornaments.style}
              onChange={(e) => onSetOrnaments(o => ({ ...o, style: e.target.value }))}>
              <option value="none">None</option>
              <option value="baroque">Baroque</option>
              <option value="art_nouveau">Art Nouveau</option>
              <option value="victorian">Victorian</option>
              <option value="minimal">Minimal</option>
              <option value="art_deco">Art Deco</option>
              <option value="gothic">Gothic</option>
              <option value="neoclassical">Neoclassical</option>
              <option value="celtic">Celtic</option>
              <option value="japanese">Japanese</option>
              <option value="hairline">Hairline</option>
              <option value="bauhaus">Bauhaus</option>
            </select>
            {ornaments.style !== 'none' && (
              <>
                <span className="src-label" style={{ marginTop: 10 }}>Placement</span>
                <div className="placement-grid">
                  {[
                    { key: 'corners',   label: 'Corners'   },
                    { key: 'cartouche', label: 'Cartouche' },
                    { key: 'allPages',  label: 'All pages' },
                    { key: 'sections',  label: 'Sections'  },
                    { key: 'items',     label: 'Items'     },
                  ].map(({ key, label }) => {
                    const on = ornaments.placement[key];
                    return (
                      <button key={key}
                        className={'style-chip toggle-chip' + (on ? ' active' : '')}
                        onClick={() => onSetOrnaments(o => ({
                          ...o, placement: { ...o.placement, [key]: !on }
                        }))}
                        aria-pressed={on}
                      >{label}</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="panel-empty">Generate a menu to adjust its style.</div>
      )}
    </aside>
  );
}
