import './DrawingToolbar.css';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];

export default function DrawingToolbar({ activeTool, setActiveTool, brushColor, setBrushColor, brushSize, setBrushSize, onAddShape, onClear, onDelete }) {
  return (
    <div className="drawing-toolbar">
      <div className="toolbar-group">
        <button className={`toolbar-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')} title="Select">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
        </button>
        <button className={`toolbar-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => setActiveTool('draw')} title="Draw">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
        </button>
        <button className={`toolbar-btn ${activeTool === 'highlighter' ? 'active' : ''}`} onClick={() => setActiveTool('highlighter')} title="Highlighter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4"/></svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={() => onAddShape('text')} title="Text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
        </button>
        <button className="toolbar-btn" onClick={() => onAddShape('rect')} title="Rectangle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>
        <button className="toolbar-btn" onClick={() => onAddShape('circle')} title="Circle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
        </button>
        <button className="toolbar-btn" onClick={() => onAddShape('line')} title="Line">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-colors">
        {COLORS.map(c => (
          <button key={c} className={`color-swatch ${brushColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setBrushColor(c)} />
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <label className="size-control" title="Brush Size">
          <input type="range" min="1" max="12" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="size-slider" />
          <span className="size-value">{brushSize}px</span>
        </label>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onDelete} title="Delete Selected">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
        <button className="toolbar-btn" onClick={onClear} title="Clear All">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
        </button>
      </div>
    </div>
  );
}
