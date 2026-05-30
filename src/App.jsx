import React, { useState, useRef, useEffect, useCallback } from 'react';
import MenuTemplate from './MenuTemplate.jsx';
import StylePanel from './StylePanel.jsx';
import { MENU_DEFAULTS, THEME } from './theme.js';

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
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [activeKey, setActiveKey] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  const [confirmBrain, setConfirmBrain] = useState(false);
  const [printHint, setPrintHint] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showSaveStyle, setShowSaveStyle] = useState(false);
  const fileRef = useRef(null);
  const menuRef = useRef(menu);

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
  menuRef.current = menu;
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

  /* Keyboard shortcuts: undo/redo, delete, copy/paste/duplicate, nudge */
  useEffect(() => {
    const isEditingField = (target) => {
      if (!target) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      // contentEditable that is unlocked (data-locked absent)
      if (target.isContentEditable && !target.hasAttribute('data-locked')) return true;
      return false;
    };

    const handleKey = (e) => {
      const editing = isEditingField(e.target);

      // Undo / redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
        if (editing) return;
        if (e.key === 'c' || e.key === 'C') { if (activeKey) { e.preventDefault(); copyElement(activeKey); } return; }
        if (e.key === 'v' || e.key === 'V') { if (clipboard) { e.preventDefault(); pasteElement(); } return; }
        if (e.key === 'd' || e.key === 'D') { if (activeKey) { e.preventDefault(); duplicateElement(activeKey); } return; }
        return;
      }

      if (editing) return;

      // Delete selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeKey) {
        e.preventDefault();
        deleteElement(activeKey);
        return;
      }

      // Arrow nudge (1px, or 10px with Shift)
      if (activeKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp')    nudgeActive(0, -step);
        if (e.key === 'ArrowDown')  nudgeActive(0, step);
        if (e.key === 'ArrowLeft')  nudgeActive(-step, 0);
        if (e.key === 'ArrowRight') nudgeActive(step, 0);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [history, future, menu, activeKey, clipboard]);

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

  const applyEdit = (prev, path, value) => {
    const next = structuredClone(prev);
    let node = next;
    for (let i = 0; i < path.length - 1; i++) {
      if (node[path[i]] == null) node[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
      node = node[path[i]];
    }
    node[path[path.length - 1]] = value;
    return next;
  };

  // Text edits — push a history entry each time
  const editMenu = (path, value) => {
    setMenu((prev) => {
      setHistory(h => [...h.slice(-49), prev]);
      setFuture([]);
      return applyEdit(prev, path, value);
    });
  };

  // Drag/resize — mutates silently, no history entry per frame
  const editMenuSilent = (path, value) => {
    setMenu((prev) => applyEdit(prev, path, value));
  };

  // Returns a snapshot of the current menu — call at mousedown, pass result to commitSnapshot
  const snapshotMenu = useCallback(() => menuRef.current, []);

  // Pushes a pre-captured snapshot into history — call at first actual move
  const commitSnapshot = useCallback((snapshot) => {
    setHistory(h => [...h.slice(-49), snapshot]);
    setFuture([]);
  }, []);

  const undo = () => {
    setHistory(h => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture(f => [menu, ...f.slice(0, 49)]);
      setMenu(prev);
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[0];
      setHistory(h => [...h.slice(-49), menu]);
      setMenu(next);
      return f.slice(1);
    });
  };

  // Parse a layout key like "_layout.sections.0.cocktails.2" into path segments
  const parseKey = (key) => key.split('.').map(s => /^\d+$/.test(s) ? +s : s);

  // Read a value at a path (returns undefined if any segment missing)
  const readPath = (obj, path) => {
    let n = obj;
    for (const k of path) { if (n == null) return undefined; n = n[k]; }
    return n;
  };

  // Push current menu to history then apply mutator
  const mutateWithHistory = (mutator) => {
    setMenu(prev => {
      if (!prev) return prev;
      setHistory(h => [...h.slice(-49), prev]);
      setFuture([]);
      const next = structuredClone(prev);
      mutator(next);
      return next;
    });
  };

  // Remove element by key. Returns true if removed.
  const deleteElement = (key) => {
    if (!key) return;
    // Cocktails: _layout.sections.<si>.cocktails.<ci>
    let m = key.match(/^_layout\.sections\.(\d+)\.cocktails\.(\d+)$/);
    if (m) {
      const si = +m[1], ci = +m[2];
      mutateWithHistory(next => {
        next.sections?.[si]?.cocktails?.splice(ci, 1);
        next._layout?.sections?.[si]?.cocktails?.splice(ci, 1);
      });
      setActiveKey(null);
      setSelectedKeys(new Set());
      return;
    }
    // Section header: _layout.sections.<si>.header → remove whole section
    m = key.match(/^_layout\.sections\.(\d+)\.header$/);
    if (m) {
      const si = +m[1];
      mutateWithHistory(next => {
        next.sections?.splice(si, 1);
        next._layout?.sections?.splice(si, 1);
      });
      setActiveKey(null);
      setSelectedKeys(new Set());
      return;
    }
    // Cover sub-blocks and footer — clear text content + reset layout
    m = key.match(/^_layout\.cover\.(kicker|title|tagline|divider)$/);
    if (m) {
      const sub = m[1];
      mutateWithHistory(next => {
        if (next._layout?.cover) next._layout.cover[sub] = { x: 0, y: 0, scale: 1 };
        if (sub === 'title') next.bar_name = '';
        if (sub === 'tagline') next.tagline = '';
      });
      setActiveKey(null);
      return;
    }
    if (key === '_layout.footer') {
      mutateWithHistory(next => {
        next.note = '';
        if (next._layout) next._layout.footer = { x: 0, y: 0, scale: 1 };
      });
      setActiveKey(null);
      return;
    }
  };

  // Copy: stash element data + layout under its key into clipboard state
  const copyElement = (key) => {
    if (!key || !menu) return;
    const layoutPath = parseKey(key);
    const layout = readPath(menu, layoutPath);
    // Determine the data path corresponding to this layout key
    let dataPath = null;
    let kind = null;
    let m = key.match(/^_layout\.sections\.(\d+)\.cocktails\.(\d+)$/);
    if (m) { kind = 'cocktail'; dataPath = ['sections', +m[1], 'cocktails', +m[2]]; }
    else if ((m = key.match(/^_layout\.sections\.(\d+)\.header$/))) { kind = 'section'; dataPath = ['sections', +m[1]]; }
    else if ((m = key.match(/^_layout\.cover\.(kicker|title|tagline|divider)$/))) { kind = 'cover'; dataPath = ['cover', m[1]]; }
    else if (key === '_layout.footer') { kind = 'footer'; dataPath = ['footer']; }
    const data = dataPath && kind !== 'cover' && kind !== 'footer' ? structuredClone(readPath(menu, dataPath)) : null;
    setClipboard({ kind, data, layout: layout ? structuredClone(layout) : null, sourceKey: key });
  };

  // Paste: insert a copy near the original (offset +20px) and select it
  const pasteElement = () => {
    if (!clipboard || !menu) return;
    const { kind, data, layout, sourceKey } = clipboard;
    if (kind === 'cocktail') {
      const m = sourceKey.match(/^_layout\.sections\.(\d+)\.cocktails\.(\d+)$/);
      if (!m) return;
      const si = +m[1], ci = +m[2];
      let newCi = ci + 1;
      mutateWithHistory(next => {
        if (!next.sections?.[si]) return;
        next.sections[si].cocktails = next.sections[si].cocktails || [];
        next.sections[si].cocktails.splice(newCi, 0, structuredClone(data));
        if (!next._layout) next._layout = {};
        if (!next._layout.sections) next._layout.sections = [];
        if (!next._layout.sections[si]) next._layout.sections[si] = { cocktails: [] };
        if (!next._layout.sections[si].cocktails) next._layout.sections[si].cocktails = [];
        const newLayout = layout ? { ...structuredClone(layout) } : { x: 0, y: 0, scale: 1 };
        newLayout.x = (newLayout.x || 0) + 20;
        newLayout.y = (newLayout.y || 0) + 20;
        next._layout.sections[si].cocktails.splice(newCi, 0, newLayout);
      });
      const newKey = `_layout.sections.${si}.cocktails.${newCi}`;
      setActiveKey(newKey);
      setSelectedKeys(new Set([newKey]));
      return;
    }
    if (kind === 'section') {
      const m = sourceKey.match(/^_layout\.sections\.(\d+)\.header$/);
      if (!m) return;
      const si = +m[1];
      const newSi = si + 1;
      mutateWithHistory(next => {
        if (!next.sections) next.sections = [];
        next.sections.splice(newSi, 0, structuredClone(data));
        if (!next._layout) next._layout = {};
        if (!next._layout.sections) next._layout.sections = [];
        const srcLayout = next._layout.sections[si] ? structuredClone(next._layout.sections[si]) : { header: { x: 0, y: 0, scale: 1 }, cocktails: [] };
        if (srcLayout.header) {
          srcLayout.header.x = (srcLayout.header.x || 0) + 20;
          srcLayout.header.y = (srcLayout.header.y || 0) + 20;
        }
        next._layout.sections.splice(newSi, 0, srcLayout);
      });
      const newKey = `_layout.sections.${newSi}.header`;
      setActiveKey(newKey);
      setSelectedKeys(new Set([newKey]));
      return;
    }
    // cover/footer — can't truly duplicate; just shift the original
    if (kind === 'cover' || kind === 'footer') {
      mutateWithHistory(next => {
        const path = parseKey(sourceKey);
        let node = next;
        for (let i = 0; i < path.length - 1; i++) {
          if (node[path[i]] == null) node[path[i]] = {};
          node = node[path[i]];
        }
        const existing = node[path[path.length - 1]] || { x: 0, y: 0, scale: 1 };
        node[path[path.length - 1]] = { ...existing, x: (existing.x || 0) + 20, y: (existing.y || 0) + 20 };
      });
    }
  };

  // Duplicate: copy + paste in one go
  const duplicateElement = (key) => {
    if (!key) return;
    copyElement(key);
    // paste uses clipboard state which won't be updated until next render — so do it inline
    const layoutPath = parseKey(key);
    const layout = readPath(menu, layoutPath);
    let m = key.match(/^_layout\.sections\.(\d+)\.cocktails\.(\d+)$/);
    if (m) {
      const si = +m[1], ci = +m[2];
      const newCi = ci + 1;
      mutateWithHistory(next => {
        if (!next.sections?.[si]) return;
        const item = structuredClone(next.sections[si].cocktails?.[ci]);
        if (!item) return;
        next.sections[si].cocktails.splice(newCi, 0, item);
        if (!next._layout?.sections?.[si]?.cocktails) return;
        const newLayout = layout ? { ...structuredClone(layout) } : { x: 0, y: 0, scale: 1 };
        newLayout.x = (newLayout.x || 0) + 20;
        newLayout.y = (newLayout.y || 0) + 20;
        next._layout.sections[si].cocktails.splice(newCi, 0, newLayout);
      });
      const newKey = `_layout.sections.${si}.cocktails.${newCi}`;
      setActiveKey(newKey);
      setSelectedKeys(new Set([newKey]));
      return;
    }
    m = key.match(/^_layout\.sections\.(\d+)\.header$/);
    if (m) {
      const si = +m[1];
      const newSi = si + 1;
      mutateWithHistory(next => {
        if (!next.sections?.[si]) return;
        next.sections.splice(newSi, 0, structuredClone(next.sections[si]));
        if (!next._layout?.sections?.[si]) return;
        const dupLayout = structuredClone(next._layout.sections[si]);
        if (dupLayout.header) {
          dupLayout.header.x = (dupLayout.header.x || 0) + 20;
          dupLayout.header.y = (dupLayout.header.y || 0) + 20;
        }
        next._layout.sections.splice(newSi, 0, dupLayout);
      });
      const newKey = `_layout.sections.${newSi}.header`;
      setActiveKey(newKey);
      setSelectedKeys(new Set([newKey]));
    }
  };

  // Nudge active element by (dx, dy) pixels with one history entry
  const nudgeActive = (dx, dy) => {
    if (!activeKey || !menu) return;
    const path = parseKey(activeKey);
    mutateWithHistory(next => {
      let node = next;
      for (let i = 0; i < path.length; i++) {
        if (node[path[i]] == null) node[path[i]] = i === path.length - 1 ? { x: 0, y: 0 } : (typeof path[i + 1] === 'number' ? [] : {});
        node = node[path[i]];
      }
      node.x = (node.x || 0) + dx;
      node.y = (node.y || 0) + dy;
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

      const isLandscape = format === 'a5h' || format === 'bookleth' || format === 'a6h';
      const orientation = isLandscape ? 'landscape' : 'portrait';

      const sheets = el.classList.contains('booklet')
        ? Array.from(el.querySelectorAll('.menu-sheet'))
        : [el];

      const pdfFormat = (format === 'a6' || format === 'a6h') ? 'a6' : 'a5';
      const pdf = new jsPDF({ orientation, unit: 'mm', format: pdfFormat });

      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const isA6Sheet = sheet.classList.contains('sheet-a6') || sheet.classList.contains('sheet-a6h');
        const isSheetLandscape = sheet.classList.contains('sheet-a5h') || sheet.classList.contains('sheet-a6h');
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
          pdf.addPage(isA6Sheet ? 'a6' : 'a5', isSheetLandscape ? 'landscape' : 'portrait');
        }
        const w = isSheetLandscape ? (isA6Sheet ? 148 : 210) : (isA6Sheet ? 105 : 148);
        const h = isSheetLandscape ? (isA6Sheet ? 105 : 148) : (isA6Sheet ? 148 : 210);
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

          <label className="src-label">Format</label>
          <div className="format-toggle format-toggle--compose">
            <button aria-pressed={format === 'a5'} title="A5 Portrait — single dense page" className={'fmt-btn' + (format === 'a5' ? ' active' : '')} onClick={() => setFormat('a5')}>A5</button>
            <button aria-pressed={format === 'a5h'} title="A5 Landscape — cover left, drinks right" className={'fmt-btn' + (format === 'a5h' ? ' active' : '')} onClick={() => setFormat('a5h')}>A5 ↔</button>
            <button aria-pressed={format === 'a6'} title="A6 Portrait — compact card" className={'fmt-btn' + (format === 'a6' ? ' active' : '')} onClick={() => setFormat('a6')}>A6</button>
            <button aria-pressed={format === 'a6h'} title="A6 Landscape — compact card, cover left, drinks right" className={'fmt-btn' + (format === 'a6h' ? ' active' : '')} onClick={() => setFormat('a6h')}>A6 ↔</button>
            <button aria-pressed={format === 'booklet'} title="Booklet Portrait — paginated spreads" className={'fmt-btn' + (format === 'booklet' ? ' active' : '')} onClick={() => setFormat('booklet')}>Booklet</button>
            <button aria-pressed={format === 'bookleth'} title="Booklet Landscape — paginated spreads" className={'fmt-btn' + (format === 'bookleth' ? ' active' : '')} onClick={() => setFormat('bookleth')}>Booklet ↔</button>
          </div>

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

      <main className="canvas" onClick={(e) => { if (!e.target.closest('.draggable-block') && !e.target.closest('.floating-toolbar')) { setSelectedKeys(new Set()); setActiveKey(null); } }}>
        <div className="canvas-bar">
          <span className="canvas-label">Menu Preview</span>
          <div className="undo-controls">
            <button className="zoom-btn" onClick={undo} disabled={!history.length} aria-label="Undo" title="Undo (Ctrl+Z)">↩</button>
            <button className="zoom-btn" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (Ctrl+Y)">↪</button>
          </div>
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))} aria-label="Zoom out" title="Zoom out">−</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} aria-label="Zoom in" title="Zoom in">+</button>
            <button className="zoom-btn zoom-btn-reset" onClick={() => setZoom(1)} aria-label="Reset zoom" title="Reset zoom">⟳</button>
          </div>
        </div>

        {menu ? (
          <>
            <div className="zoom-wrapper" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
              <MenuTemplate menu={menu} format={format} columns={columns} onEdit={editMenu} onDrag={editMenuSilent} onSnapshot={snapshotMenu} onCommit={commitSnapshot} ornaments={ornaments} contentAlign={contentAlign} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} activeKey={activeKey} onActiveKeyChange={setActiveKey} zoom={zoom} />
            </div>
            <div className="edit-hint">Click to select · Drag corners to resize · Drag side bars for width · Double-click text to edit</div>
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

      <StylePanel
        menu={menu}
        columns={columns}
        contentAlign={contentAlign}
        ornaments={ornaments}
        selectedKeys={selectedKeys}
        onEditMenu={editMenu}
        onSetColumns={setColumns}
        onSetContentAlign={setContentAlign}
        onSetOrnaments={setOrnaments}
      />
    </div>
  );
}
