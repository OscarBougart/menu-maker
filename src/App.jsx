import React, { useState, useRef, useEffect } from 'react';
import MenuTemplate from './MenuTemplate.jsx';
import { MENU_DEFAULTS, THEME } from './theme.js';


const DISPLAY_FONTS = [
  'Cormorant Garamond', 'Playfair Display', 'EB Garamond',
  'Cinzel', 'Bodoni Moda', 'DM Serif Display', 'Libre Baskerville',
];
const BODY_FONTS = [
  'Archivo Narrow', 'Jost', 'Inter Tight',
  'Barlow Condensed', 'DM Sans', 'Outfit',
];

export default function App() {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [rules, setRules] = useState(null);
  const [refName, setRefName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [drinks, setDrinks] = useState('');
  const [menu, setMenu] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState('a5');

  const [sources, setSources] = useState({ master: false, templates: [] });
  const [selectedSource, setSelectedSource] = useState('master');
  const [masterInfo, setMasterInfo] = useState(null);
  const [savedMenus, setSavedMenus] = useState([]);
  const [columns, setColumns] = useState(1);
  const [ornaments, setOrnaments] = useState({
    style: 'none',
    placement: { corners: true, cartouche: false, allPages: false, sections: true, items: false },
    border: true,
  });
  const [contentAlign, setContentAlign] = useState('center');
  const [zoom, setZoom] = useState(1);
  const [extracting, setExtracting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  const [confirmBrain, setConfirmBrain] = useState(false);
  const [printHint, setPrintHint] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showSaveStyle, setShowSaveStyle] = useState(false);
  const fileRef = useRef(null);

  const refreshSources = async () => {
    try {
      const res = await fetch('/api/list-rules');
      const data = await res.json();
      setSources(data);
      if (data.master) {
        const m = await (await fetch('/api/load-rules/_master')).json();
        setMasterInfo(m);
      }
    } catch { /* server not up yet */ }
  };

  const refreshMenus = async () => {
    try {
      const data = await (await fetch('/api/list-menus')).json();
      setSavedMenus(data);
    } catch { /* server not up yet */ }
  };

  useEffect(() => { refreshSources(); refreshMenus(); }, []);
  useEffect(() => {
    Object.entries(THEME).forEach(([k, v]) =>
      document.documentElement.style.setProperty(`--${k}`, v)
    );
  }, []);

  /* ── image loading shared by click, drop, and paste ── */
  const loadImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setRules(null);
    setConfirmBrain(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  /* clipboard paste anywhere in the page */
  useEffect(() => {
    const handlePaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
      if (item) loadImageFile(item.getAsFile());
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  /* 1. Upload + extract */
  const onPickFile = (e) => loadImageFile(e.target.files?.[0]);

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); loadImageFile(e.dataTransfer.files?.[0]); };

  const extractRules = async () => {
    if (!imageFile) return;
    setExtracting(true); setBusy(true); setError(null); setStatus('Extracting design rules…');
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const res = await fetch('/api/extract-rules', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRules(data);
      setShowSaveStyle(false);
      setStatus('Design rules extracted');
    } catch (err) { setError(err.message); setStatus('Error: ' + err.message); }
    finally { setBusy(false); setExtracting(false); }
  };

  /* save this reference as its own template */
  const saveTemplate = async () => {
    if (!rules) return;
    const name = (refName || rules.aesthetic_summary?.slice(0, 24) || 'untitled').trim();
    setBusy(true);
    try {
      await fetch('/api/save-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rules }),
      });
      setStatus('Saved "' + name + '" template');
      refreshSources();
    } catch (err) { setError(err.message); setStatus('Error: ' + err.message); }
    finally { setBusy(false); }
  };

  /* add this reference into the master house brain */
  const addToHouseBrain = async () => {
    if (!rules) return;
    const name = (refName || rules.aesthetic_summary?.slice(0, 24) || 'a menu').trim();
    setBusy(true); setMerging(true); setError(null); setStatus('Merging into House Brain…');
    try {
      const res = await fetch('/api/merge-master', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, newRules: rules }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMasterInfo(data.master);
      setStatus(data.seeded ? 'House Brain created' : 'Merged into House Brain — ' + name);
      refreshSources();
    } catch (err) { setError(err.message); setStatus('Error: ' + err.message); }
    finally { setBusy(false); setMerging(false); }
  };

  /* 2. Generate from the selected source */
  const generate = async () => {
    const prevMenu = menu;
    setMenu(null);
    setBusy(true); setError(null); setStatus('Composing menu…');
    try {
      let sourceRules = rules || {};
      if (selectedSource === 'master' && sources.master) {
        sourceRules = await (await fetch('/api/load-rules/_master')).json();
      } else if (selectedSource && selectedSource !== 'current' && selectedSource !== 'master') {
        sourceRules = await (await fetch('/api/load-rules/' + selectedSource)).json();
      }
      const res = await fetch('/api/generate-menu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: sourceRules, prompt, drinks }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMenu(data);
      setStatus('Menu composed');
    } catch (err) { setError(err.message); setStatus('Error: ' + err.message); setMenu(prevMenu); }
    finally { setBusy(false); }
  };

  const editMenu = (path, value) => {
    setMenu((prev) => {
      const next = structuredClone(prev);
      let node = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (node[path[i]] == null) node[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
        node = node[path[i]];
      }
      node[path[path.length - 1]] = value;
      return next;
    });
  };

  const exportPDF = () => { setPrintHint(true); window.print(); };

  const saveAsPDF = async () => {
    const el = document.getElementById('menu-sheet');
    if (!el) return;
    setBusy(true);
    setStatus('Generating PDF…');
    try {
      // Wait for all fonts (Google Fonts) to finish loading before capture
      await document.fonts.ready;

      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const isLandscape = format === 'a5h' || format === 'bookleth';
      const orientation = isLandscape ? 'landscape' : 'portrait';

      const sheets = el.classList.contains('booklet')
        ? Array.from(el.querySelectorAll('.menu-sheet'))
        : [el];

      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a5' });

      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const isSheetLandscape = sheet.classList.contains('sheet-a5h');
        const bgColor = getComputedStyle(sheet).getPropertyValue('--m-bg').trim() || '#1a1a1a';
        const canvas = await html2canvas(sheet, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: bgColor,
        });
        const imgData = canvas.toDataURL('image/png');
        if (i > 0) {
          pdf.addPage('a5', isSheetLandscape ? 'landscape' : 'portrait');
        }
        const w = isSheetLandscape ? 210 : 148;
        const h = isSheetLandscape ? 148 : 210;
        pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      }

      const filename = (menu?.bar_name || 'menu').replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.pdf';
      pdf.save(filename);
      setStatus('PDF saved');
    } catch (err) {
      setError(err.message);
      setStatus('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  };
  const saveMenu = async () => {
    if (!menu) return;
    setBusy(true);
    try {
      await fetch('/api/save-menu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: menu.bar_name, menu: { ...menu, columns } }),
      });
      setStatus('Saved to /menus');
      refreshMenus();
    } catch (err) { setError(err.message); setStatus('Error: ' + err.message); }
    finally { setBusy(false); }
  };

  const loadMenu = async (key) => {
    setDeleteConfirm(null);
    setBusy(true);
    try {
      const data = await (await fetch('/api/load-menu/' + key)).json();
      if (data.error) throw new Error(data.error);
      setMenu(data);
      setColumns(data.columns || 1);
      setStatus('Loaded · ' + (data.bar_name || key));
    } catch (err) { setError(err.message); setStatus('Error: ' + err.message); }
    finally { setBusy(false); }
  };

  const deleteMenu = async (key) => {
    try {
      await fetch('/api/delete-menu/' + key, { method: 'DELETE' });
      setDeleteConfirm(null);
      refreshMenus();
      setStatus('Deleted');
    } catch (err) { setError(err.message); setStatus('Error: ' + err.message); }
  };

  return (
    <div className="app">
      <aside className="panel">
        <div className="panel-header">
          <div className="kicker">Local Studio</div>
          <h1>The Menu Maker</h1>
          {status !== 'Ready' && (
            <div className="status-inline" role="status" aria-live="polite">
              <span className={`status-inline-dot${busy ? ' busy' : ''}`} />
              <span>{status}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <span className="error-msg">{error}</span>
            <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
          </div>
        )}

        {/* STEP 1 */}
        <div className="block">
          <div className="block-title"><span className="step-num">1</span> Reference Menu</div>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a reference menu photo"
            className={'dropzone' + (imagePreview ? ' has-image' : '') + (dragOver ? ' drag-over' : '')}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {imagePreview
              ? <img src={imagePreview} alt="reference" />
              : <><div className="dropzone-icon">↑</div><div className="dropzone-hint">{dragOver ? 'Release to load image' : 'Drop, paste, or click to upload a photo of a menu you admire.'}</div></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
          {imageFile && <button className="btn" onClick={extractRules} disabled={busy}>Extract Design Rules</button>}
          {extracting && (
            <div className="extract-progress" aria-live="polite" aria-label="Extracting design rules">
              <div className="dots"><span className="dot" /><span className="dot" /><span className="dot" /></div>
              <span className="extract-label">Reading image, this takes a moment…</span>
            </div>
          )}

          {rules && (
            <>
              <div className="rules-card">
                <div className="rules-summary">{rules.aesthetic_summary}</div>
                {rules.palette && (
                  <div className="swatch-row">
                    {Object.entries(rules.palette).filter(([, hex]) => Boolean(hex)).map(([role, hex]) => (
                      <div className="swatch" key={role} style={{ background: hex }} title={role.replace(/_/g, ' ') + ' · ' + hex} />
                    ))}
                  </div>
                )}
                {(rules.design_rules || []).slice(0, 5).map((r, i) => <div className="rule-line" key={i}>{r}</div>)}
              </div>

              <button
                className="save-style-toggle"
                onClick={() => setShowSaveStyle(s => !s)}
                aria-expanded={showSaveStyle}
              >{showSaveStyle ? '↑ Collapse' : '+ Save this style'}</button>

              {showSaveStyle && (
                <>
                  <input
                    type="text" aria-label="Style name" placeholder="Name this style… e.g. Death & Co"
                    value={refName} onChange={(e) => setRefName(e.target.value)}
                    maxLength={40}
                  />
                  <button className="btn" onClick={saveTemplate} disabled={busy}>Save as Template</button>
                  <p className="btn-caption">Saves as a standalone, reusable style.</p>
                  {!confirmBrain
                    ? <button className="btn btn-blood" onClick={() => setConfirmBrain(true)} disabled={busy}>+ Add to House Brain</button>
                    : <div className="confirm-brain">
                        <span className="confirm-text">Merge "{(refName || rules.aesthetic_summary?.slice(0, 24) || 'this style').trim()}" into the master library?</span>
                        <div className="confirm-row-btns">
                          <button className="btn btn-sm" onClick={() => setConfirmBrain(false)}>Cancel</button>
                          <button className="btn btn-blood btn-sm" onClick={() => { setConfirmBrain(false); addToHouseBrain(); }} disabled={busy}>Merge</button>
                        </div>
                      </div>
                  }
                  <p className="btn-caption">Merges into your master library, combining with prior styles.</p>
                  {merging && (
                    <div className="extract-progress" aria-live="polite" aria-label="Merging into House Brain">
                      <div className="dots"><span className="dot" /><span className="dot" /><span className="dot" /></div>
                      <span className="extract-label">Merging into House Brain…</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* HOUSE BRAIN STATUS */}
        {masterInfo && (
          <div className="block block-secondary">
            <div className="block-title">House Brain</div>
            <div className="rules-card">
              <div className="rules-summary">{masterInfo.aesthetic_summary}</div>
              <div className="rule-line rule-line--built">
                Built from: {(masterInfo.source_menus || []).join(' · ')}
              </div>
              {(masterInfo.palette_library || []).length > 0 && (
                <div className="swatch-row">
                  {masterInfo.palette_library.slice(0, 10).map((p, i) => (
                    <div className="swatch" key={i} style={{ background: p.hex }} title={(p.role || '') + ' · ' + (p.source || '')} />
                  ))}
                </div>
              )}
              {(masterInfo.divergences || []).length > 0 && (
                <div className="rule-line rule-line--divergence">
                  {masterInfo.divergences.length} style divergence{masterInfo.divergences.length > 1 ? 's' : ''} tracked as options
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        <div className="block">
          <div className="block-title"><span className="step-num">2</span> Compose</div>

          <label className="src-label" htmlFor="source-select">Draw rules from</label>
          <select id="source-select" className="src-select" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
            {sources.master && <option value="master">House Brain (all menus)</option>}
            {rules && <option value="current">Current extraction</option>}
            {sources.templates.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            {!sources.master && !rules && sources.templates.length === 0 && <option value="current">(extract a menu first)</option>}
          </select>

          <textarea
            aria-label="Menu brief"
            rows={4}
            placeholder="e.g. deep oxblood + bone, brass accents, 6 mezcal drinks, occult apothecary vibe"
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!busy) generate(); } }}
          />
          <div className="kbd-hint">Ctrl+Enter to compose</div>
          <div className="preset-row" role="group" aria-label="Prompt presets">
            {[
              { label: 'Apothecary', value: 'oxblood + bone, brass accents, 8 mezcal cocktails, occult apothecary' },
              { label: 'Speakeasy', value: 'navy + cream, gold serif, 10 whisky cocktails, 1920s speakeasy' },
              { label: 'Botanical', value: 'deep forest + ivory, 6 low-ABV botanical cocktails, minimal' },
              { label: 'Late-night', value: 'charcoal + warm amber, 8 cocktails, underground jazz bar' },
            ].map(({ label, value }) => (
              <button key={label} type="button" className={'preset-chip' + (prompt === value ? ' active' : '')}
                onClick={() => setPrompt(prompt === value ? '' : value)} title={value}>{label}</button>
            ))}
          </div>
          <textarea
            aria-label="Drink names"
            rows={3}
            placeholder="Your drinks (optional): Oaxacan Old Fashioned, Black Manhattan…"
            value={drinks} onChange={(e) => setDrinks(e.target.value)}
          />
          <button className="btn-primary" onClick={generate} disabled={busy}>Compose Menu</button>
        </div>
        {/* SAVED MENUS */}
        {savedMenus.length > 0 && (
          <div className="block block-secondary">
            <div className="block-title">Saved Menus</div>
            <div className="menu-grid">
              {savedMenus.map((m) => {
                const bg = m.render_spec?.background || MENU_DEFAULTS.bg;
                const accent = m.render_spec?.accent || MENU_DEFAULTS.accent;
                const fg = m.render_spec?.text_primary || MENU_DEFAULTS.text;
                return (
                  <div
                    key={m.key}
                    role="button"
                    tabIndex={0}
                    className="menu-card"
                    style={{ '--card-bg': bg, '--card-accent': accent, '--card-fg': fg }}
                    onClick={() => loadMenu(m.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadMenu(m.key); } }}
                    aria-label={`Load ${m.bar_name}`}
                  >
                    <div className="menu-card-name">{m.bar_name}</div>
                    {m.tagline && <div className="menu-card-tag">{m.tagline}</div>}
                    {deleteConfirm === m.key
                      ? <div className="menu-card-del-confirm" onClick={(e) => e.stopPropagation()}>
                          <button className="menu-card-del-yes" onClick={() => deleteMenu(m.key)} aria-label={`Confirm delete ${m.bar_name}`}>Delete?</button>
                          <button className="menu-card-del menu-card-del--shown" onClick={() => setDeleteConfirm(null)} aria-label="Cancel">×</button>
                        </div>
                      : <button
                          className="menu-card-del"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(m.key); }}
                          aria-label={`Delete ${m.bar_name}`}
                        >×</button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      <main className="canvas">
        <div className="canvas-bar">
          <span className="canvas-label">Menu Preview</span>
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))} aria-label="Zoom out" title="Zoom out">−</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} aria-label="Zoom in" title="Zoom in">+</button>
            <button className="zoom-btn zoom-btn-reset" onClick={() => setZoom(1)} aria-label="Reset zoom" title="Reset zoom">⟳</button>
          </div>
          <div className="format-toggle">
            <button aria-pressed={format === 'a5'} title="A5 Portrait — single dense page" className={'fmt-btn' + (format === 'a5' ? ' active' : '')} onClick={() => setFormat('a5')}>A5</button>
            <button aria-pressed={format === 'a5h'} title="A5 Landscape — cover left, drinks right" className={'fmt-btn' + (format === 'a5h' ? ' active' : '')} onClick={() => setFormat('a5h')}>A5 ↔</button>
            <button aria-pressed={format === 'booklet'} title="Booklet Portrait — paginated spreads" className={'fmt-btn' + (format === 'booklet' ? ' active' : '')} onClick={() => setFormat('booklet')}>Booklet</button>
            <button aria-pressed={format === 'bookleth'} title="Booklet Landscape — paginated spreads" className={'fmt-btn' + (format === 'bookleth' ? ' active' : '')} onClick={() => setFormat('bookleth')}>Booklet ↔</button>
          </div>
        </div>

        {menu ? (
          <>
            <div className="zoom-wrapper" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
              <MenuTemplate menu={menu} format={format} columns={columns} onEdit={editMenu} onDrag={editMenu} ornaments={ornaments} contentAlign={contentAlign} />
            </div>
            <div className="edit-hint">Hold and drag to reposition blocks · Double-click text to edit</div>
            <div className="export-bar">
              <button className="export-btn" onClick={saveAsPDF} disabled={busy}>Save as PDF</button>
              <button className="export-btn" onClick={saveMenu}>Save to /menus</button>
            </div>
            {printHint && (
              <div className="print-hint" role="note">
                <span>In the print dialog, enable <strong>Background graphics</strong> to preserve colors and textures.</span>
                <button className="print-hint-dismiss" onClick={() => setPrintHint(false)} aria-label="Dismiss print hint">×</button>
              </div>
            )}
          </>
        ) : busy ? (
          <div className="empty">
            <div className="dots"><span className="dot" /><span className="dot" /><span className="dot" /></div>
            <div className="empty-text">{status}</div>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-text">Upload a reference, write a brief,<br/>compose your menu.</div>
          </div>
        )}
      </main>

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
                      onChange={(e) => editMenu(['render_spec', key], e.target.value)}
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
                    onClick={() => editMenu(['render_spec', 'display_font'], f)}
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
                    onClick={() => editMenu(['render_spec', 'body_font'], f)}
                  >{f}</button>
                ))}
              </div>
            </div>

            <div className="block">
              <div className="block-title">Layout</div>
              <span className="src-label">Columns</span>
              <div className="style-row" style={{ marginBottom: 12 }}>
                {[1, 2, 3].map((n) => (
                  <button key={n} aria-pressed={columns === n} className={'style-chip' + (columns === n ? ' active' : '')} onClick={() => setColumns(n)}>{n}</button>
                ))}
              </div>
              <span className="src-label">Alignment</span>
              <div className="style-row" style={{ marginBottom: 12 }}>
                {['Left', 'Center', 'Right'].map((label) => {
                  const value = label.toLowerCase();
                  return (
                    <button key={value}
                      className={'style-chip' + (contentAlign === value ? ' active' : '')}
                      onClick={() => setContentAlign(value)}
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
                      onClick={() => editMenu(['render_spec', 'title_scale'], Math.max(0.4, +((menu.render_spec?.title_scale || 1) - 0.05).toFixed(2)))}
                      aria-label="Smaller title">−</button>
                    <span className="per-page-num">{Math.round((menu.render_spec?.title_scale || 1) * 42)}px</span>
                    <button className="style-chip"
                      onClick={() => editMenu(['render_spec', 'title_scale'], Math.min(2.5, +((menu.render_spec?.title_scale || 1) + 0.05).toFixed(2)))}
                      aria-label="Larger title">+</button>
                  </div>
                </div>
                <div className="stepper-group">
                  <span className="src-label">Cocktails</span>
                  <div className="style-row">
                    <button className="style-chip"
                      onClick={() => editMenu(['render_spec', 'items_per_page'], Math.min(20, (menu.render_spec?.items_per_page || 7) + 1))}
                      aria-label="Smaller cocktails">−</button>
                    <span className="per-page-num">{Math.round(19 * 553 / ((menu.render_spec?.items_per_page || 7) * 81))}px</span>
                    <button className="style-chip"
                      onClick={() => editMenu(['render_spec', 'items_per_page'], Math.max(3, (menu.render_spec?.items_per_page || 7) - 1))}
                      aria-label="Larger cocktails">+</button>
                  </div>
                </div>
              </div>
              <div className="stepper-group" style={{ marginTop: 12 }}>
                <span className="src-label">Spacing</span>
                <div className="style-row">
                  <button className="style-chip"
                    onClick={() => editMenu(['render_spec', 'line_height'], Math.max(0.8, +((menu.render_spec?.line_height || 1.5) - 0.05).toFixed(2)))}
                    aria-label="Tighter spacing">−</button>
                  <span className="per-page-num">{(menu.render_spec?.line_height || 1.5).toFixed(1)}</span>
                  <button className="style-chip"
                    onClick={() => editMenu(['render_spec', 'line_height'], Math.min(3, +((menu.render_spec?.line_height || 1.5) + 0.05).toFixed(2)))}
                    aria-label="Looser spacing">+</button>
                </div>
              </div>
            </div>

            <div className="block">
              <div className="block-title">Content</div>
              <div className="style-row">
                {[
                  { key: 'show_ingredients', label: 'Ingredients' },
                  { key: 'show_prices',      label: 'Prices'      },
                ].map(({ key, label }) => {
                  const on = menu.render_spec?.[key] !== false;
                  return (
                    <button key={key}
                      className={'style-chip toggle-chip' + (on ? ' active' : '')}
                      onClick={() => editMenu(['render_spec', key], !on)}
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
                  onClick={() => setOrnaments(o => ({ ...o, border: !o.border }))}
                  aria-pressed={ornaments.border}
                >Border frame</button>
              </div>
              <span className="src-label">Style</span>
              <select className="src-select"
                value={ornaments.style}
                onChange={(e) => setOrnaments(o => ({ ...o, style: e.target.value }))}>
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
                          onClick={() => setOrnaments(o => ({
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
    </div>
  );
}
