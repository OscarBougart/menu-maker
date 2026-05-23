import React, { useState, useRef, useEffect } from 'react';
import MenuTemplate from './MenuTemplate.jsx';

export default function App() {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [rules, setRules] = useState(null);          // freshly extracted rules
  const [refName, setRefName] = useState('');         // name for this reference (e.g. "Death & Co")
  const [prompt, setPrompt] = useState('');
  const [drinks, setDrinks] = useState('');
  const [menu, setMenu] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState('a5'); // 'a5' | 'booklet'

  // sources for the generate dropdown
  const [sources, setSources] = useState({ master: false, templates: [] });
  const [selectedSource, setSelectedSource] = useState('master');
  const [masterInfo, setMasterInfo] = useState(null); // master contents for the panel
  const [savedMenus, setSavedMenus] = useState([]);
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

  /* 1. Upload + extract */
  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRules(null);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const extractRules = async () => {
    if (!imageFile) return;
    setBusy(true); setStatus('Reading the reference…');
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const res = await fetch('/api/extract-rules', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRules(data);
      setStatus('Rules extracted');
    } catch (err) { setStatus('Error: ' + err.message); }
    finally { setBusy(false); }
  };

  /* save this reference as its own template */
  const saveTemplate = async () => {
    if (!rules) return;
    const name = (refName || rules.aesthetic_summary?.slice(0, 24) || 'untitled').trim();
    await fetch('/api/save-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rules }),
    });
    setStatus('Saved "' + name + '" template');
    refreshSources();
  };

  /* add this reference into the master house brain */
  const addToHouseBrain = async () => {
    if (!rules) return;
    const name = (refName || rules.aesthetic_summary?.slice(0, 24) || 'a menu').trim();
    setBusy(true); setStatus('Reconciling into House Brain…');
    try {
      const res = await fetch('/api/merge-master', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, newRules: rules }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMasterInfo(data.master);
      setStatus(data.seeded ? 'House Brain created' : 'Merged into House Brain');
      refreshSources();
    } catch (err) { setStatus('Error: ' + err.message); }
    finally { setBusy(false); }
  };

  /* 2. Generate from the selected source */
  const generate = async () => {
    setBusy(true); setStatus('Composing menu…');
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
      setStatus('Composed');
    } catch (err) { setStatus('Error: ' + err.message); }
    finally { setBusy(false); }
  };

  const editMenu = (path, value) => {
    setMenu((prev) => {
      const next = structuredClone(prev);
      let node = next;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = value;
      return next;
    });
  };

  const exportPDF = () => window.print();
  const saveMenu = async () => {
    if (!menu) return;
    await fetch('/api/save-menu', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: menu.bar_name, menu }),
    });
    setStatus('Saved to /menus');
    refreshMenus();
  };

  const loadMenu = async (key) => {
    try {
      const data = await (await fetch('/api/load-menu/' + key)).json();
      if (data.error) throw new Error(data.error);
      setMenu(data);
      setStatus('Loaded · ' + (data.bar_name || key));
    } catch (err) { setStatus('Error: ' + err.message); }
  };

  const deleteMenu = async (key, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete "' + key.replace(/_/g, ' ') + '"?')) return;
    await fetch('/api/delete-menu/' + key, { method: 'DELETE' });
    refreshMenus();
    setStatus('Deleted');
  };

  return (
    <div className="app">
      <aside className="panel">
        <div className="panel-header">
          <div className="kicker">Local Studio</div>
          <h1>The Menu Maker</h1>
        </div>

        {/* STEP 1 */}
        <div className="block">
          <div className="block-title"><span className="step-num">1</span> Reference Menu</div>
          <div className={'dropzone' + (imagePreview ? ' has-image' : '')} onClick={() => fileRef.current?.click()}>
            {imagePreview
              ? <img src={imagePreview} alt="reference" />
              : <><div className="dropzone-icon">&#9023;</div><div className="dropzone-hint">Click to upload a photo of a menu you love.<br/>AI extracts its design rules.</div></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
          {imageFile && <button className="btn" onClick={extractRules} disabled={busy}>Extract Design Rules</button>}

          {rules && (
            <>
              <div className="rules-card">
                <div className="rules-summary">{rules.aesthetic_summary}</div>
                {rules.palette && (
                  <div className="swatch-row">
                    {Object.values(rules.palette).filter(Boolean).map((hex, i) => (
                      <div className="swatch" key={i} style={{ background: hex }} title={hex} />
                    ))}
                  </div>
                )}
                {(rules.design_rules || []).slice(0, 5).map((r, i) => <div className="rule-line" key={i}>{r}</div>)}
              </div>

              <input
                type="text" placeholder="Name this style… e.g. Death & Co"
                value={refName} onChange={(e) => setRefName(e.target.value)}
                style={{ marginTop: 10 }}
              />
              <button className="btn" onClick={saveTemplate} disabled={busy}>Save as Template</button>
              <button className="btn btn-blood" onClick={addToHouseBrain} disabled={busy}>+ Add to House Brain</button>
            </>
          )}
        </div>

        {/* HOUSE BRAIN STATUS */}
        {masterInfo && (
          <div className="block">
            <div className="block-title">&#8984; House Brain</div>
            <div className="rules-card">
              <div className="rules-summary">{masterInfo.aesthetic_summary}</div>
              <div className="rule-line" style={{ marginBottom: 8 }}>
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
                <div className="rule-line" style={{ color: 'var(--brass-bright)' }}>
                  {masterInfo.divergences.length} style divergence{masterInfo.divergences.length > 1 ? 's' : ''} tracked as options
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        <div className="block">
          <div className="block-title"><span className="step-num">2</span> Compose</div>

          <label className="src-label">Draw rules from</label>
          <select className="src-select" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
            {sources.master && <option value="master">House Brain (all menus)</option>}
            {rules && <option value="current">Current extraction</option>}
            {sources.templates.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            {!sources.master && !rules && sources.templates.length === 0 && <option value="current">— extract a menu first —</option>}
          </select>

          <textarea
            rows={4} style={{ marginTop: 10 }}
            placeholder="Colors, mood, count… e.g. 'deep oxblood + bone, brass accents, 6 mezcal drinks, occult apothecary vibe'"
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
          />
          <div style={{ height: 8 }} />
          <textarea
            rows={3}
            placeholder="Your drinks (optional) — Oaxacan Old Fashioned, Black Manhattan…"
            value={drinks} onChange={(e) => setDrinks(e.target.value)}
          />
          <button className="btn btn-blood" onClick={generate} disabled={busy}>Compose Menu</button>
        </div>
        {/* SAVED MENUS */}
        {savedMenus.length > 0 && (
          <div className="block">
            <div className="block-title">&#9783; Saved Menus</div>
            <div className="menu-grid">
              {savedMenus.map((m) => {
                const bg = m.render_spec?.background || '#0c0d0e';
                const accent = m.render_spec?.accent || '#9a7b3f';
                const fg = m.render_spec?.text_primary || '#e8e4db';
                return (
                  <div
                    key={m.key}
                    className="menu-card"
                    style={{ '--card-bg': bg, '--card-accent': accent, '--card-fg': fg }}
                    onClick={() => loadMenu(m.key)}
                    title={'Load · ' + m.bar_name}
                  >
                    <div className="menu-card-name">{m.bar_name}</div>
                    {m.tagline && <div className="menu-card-tag">{m.tagline}</div>}
                    <button
                      className="menu-card-del"
                      onClick={(e) => deleteMenu(m.key, e)}
                      title="Delete"
                    >✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      <main className="canvas">
        <div className="canvas-bar">
          <span className="canvas-label">Menu Preview · {format === 'a5' ? 'A5 Sheet' : 'Booklet'}</span>
          <div className="format-toggle">
            <button className={'fmt-btn' + (format === 'a5' ? ' active' : '')} onClick={() => setFormat('a5')}>A5 Sheet</button>
            <button className={'fmt-btn' + (format === 'booklet' ? ' active' : '')} onClick={() => setFormat('booklet')}>Booklet</button>
          </div>
          <span className="status">{busy ? '\u25CC ' : ''}{status}</span>
        </div>

        {menu ? (
          <>
            <MenuTemplate menu={menu} format={format} onEdit={editMenu} />
            <div className="edit-hint">Click any text on the menu to edit it before exporting.</div>
            <div className="export-bar">
              <button className="export-btn" onClick={exportPDF}>Export PDF</button>
              <button className="export-btn" onClick={saveMenu}>Save to /menus</button>
            </div>
          </>
        ) : busy ? (
          <div className="empty">
            <div className="dots"><span className="dot" /><span className="dot" /><span className="dot" /></div>
            <div className="empty-text">{status}</div>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">&#9760;</div>
            <div className="empty-text">Upload a reference, write a brief,<br/>compose your menu.</div>
          </div>
        )}
      </main>
    </div>
  );
}
