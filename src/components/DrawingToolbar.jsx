import { createElement } from 'react';
import {
  Circle,
  Eraser,
  Highlighter,
  MousePointer2,
  PenLine,
  Redo2,
  Slash,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import './DrawingToolbar.css';

const COLORS = ['#ef565c', '#d58815', '#0d8064', '#146dcc', '#173653', '#ffffff', '#111827'];

const TOOL_BUTTONS = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'draw', label: 'Draw', icon: PenLine },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'eraser', label: 'Erase stroke or object', icon: Eraser },
];

const SHAPE_BUTTONS = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'line', label: 'Line', icon: Slash },
];

export default function DrawingToolbar({
  activeTool,
  setActiveTool,
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  onAddShape,
  onDelete,
  onClear,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  canDelete = false,
  hasAnnotations = false,
  showDestructiveActions = true,
}) {
  return (
    <div className="drawing-toolbar" aria-label="Annotation tools">
      <div className="toolbar-group" role="group" aria-label="Tools">
        {TOOL_BUTTONS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`toolbar-btn ${activeTool === id ? 'active' : ''}`}
            onClick={() => setActiveTool(id)}
            title={label}
            aria-label={label}
          >
            {createElement(icon, { size: 16, 'aria-hidden': 'true' })}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group" role="group" aria-label="Shapes">
        {SHAPE_BUTTONS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className="toolbar-btn"
            onClick={() => onAddShape(id)}
            title={label}
            aria-label={label}
          >
            {createElement(icon, { size: 16, 'aria-hidden': 'true' })}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-colors" role="group" aria-label="Ink colors">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-swatch ${brushColor === color ? 'active' : ''}`}
            style={{ '--swatch-color': color }}
            onClick={() => setBrushColor(color)}
            title={color}
            aria-label={`Use color ${color}`}
          />
        ))}
      </div>

      <div className="toolbar-divider" />

      <label className="size-control" title="Brush size">
        <input
          type="range"
          min="1"
          max="12"
          value={brushSize}
          onChange={(event) => setBrushSize(parseInt(event.target.value, 10))}
          className="size-slider"
          aria-label="Brush size"
        />
        <span className="size-value">{brushSize}px</span>
      </label>

      <div className="toolbar-divider" />

      <div className="toolbar-group" role="group" aria-label="Canvas actions">
        <button type="button" className="toolbar-btn" onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo">
          <Undo2 size={16} aria-hidden="true" />
        </button>
        <button type="button" className="toolbar-btn" onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo">
          <Redo2 size={16} aria-hidden="true" />
        </button>
        {showDestructiveActions && <button type="button" className="toolbar-btn" onClick={onDelete} disabled={!canDelete} title={canDelete ? 'Delete selected' : 'Select an annotation to delete'} aria-label="Delete selected" aria-disabled={!canDelete}>
          <Trash2 size={16} aria-hidden="true" />
        </button>}
        {showDestructiveActions && <button type="button" className="toolbar-btn" onClick={onClear} disabled={!hasAnnotations} title={hasAnnotations ? 'Clear all annotations' : 'There are no annotations to clear'} aria-label="Clear all annotations" aria-disabled={!hasAnnotations}>
          Clear
        </button>}
      </div>
    </div>
  );
}
