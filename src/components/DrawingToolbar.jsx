import { 
  MousePointer2, Pencil, Highlighter, Type, Square, Circle, 
  Minus, ArrowUpRight, Trash2, RotateCcw, Undo2, Redo2, Hash 
} from 'lucide-react';
import { useState } from 'react';

const CURATED_COLORS = [
  '#111827', '#4F46E5', '#059669', '#DC2626', 
  '#D97706', '#2563EB', '#DB2777', '#7C3AED',
];

export default function DrawingToolbar({ 
  activeTool, setActiveTool, 
  brushColor, setBrushColor, 
  brushSize, setBrushSize, 
  onAddShape, onClear, onDelete,
  onUndo, onRedo
}) {
  const [showHex, setShowHex] = useState(false);
  const [hexValue, setHexValue] = useState(brushColor);

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'draw', icon: Pencil, label: 'Draw' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
  ];

  const shapes = [
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  ];

  return (
    <div className="bg-white border-b border-border h-12 flex items-center px-4 gap-4 shrink-0 shadow-sm z-30 overflow-x-auto no-scrollbar">
      
      {/* Primary Tools */}
      <div className="flex items-center bg-surface p-1 rounded-lg gap-0.5">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`p-1.5 rounded-md transition-all ${activeTool === tool.id ? 'bg-white text-accent shadow-sm' : 'text-secondary hover:text-primary'}`}
            title={tool.label}
          >
            <tool.icon size={16} />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Shapes */}
      <div className="flex items-center gap-0.5">
        {shapes.map(shape => (
          <button
            key={shape.id}
            onClick={() => onAddShape(shape.id)}
            className="p-1.5 rounded-md text-secondary hover:bg-surface hover:text-primary transition-all"
            title={shape.label}
          >
            <shape.icon size={16} />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Colors */}
      <div className="flex items-center gap-1.5">
        {CURATED_COLORS.map(color => (
          <button
            key={color}
            onClick={() => { setBrushColor(color); setHexValue(color); }}
            className={`w-5 h-5 rounded-full transition-transform ${brushColor === color ? 'ring-2 ring-offset-1 ring-accent scale-110' : 'hover:scale-110'}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <div className="relative flex items-center">
          <button 
            onClick={() => setShowHex(!showHex)}
            className={`p-1 rounded-md transition-colors ${showHex ? 'text-accent bg-accent-light' : 'text-muted hover:text-secondary'}`}
          >
            <Hash size={16} />
          </button>
          {showHex && (
            <input 
              type="text"
              value={hexValue}
              onChange={(e) => { setHexValue(e.target.value); if (/^#[0-9A-F]{6}$/i.test(e.target.value)) setBrushColor(e.target.value); }}
              className="absolute left-8 w-20 bg-white border border-border rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-accent shadow-lg"
              placeholder="#000000"
              autoFocus
            />
          )}
        </div>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Size */}
      <div className="flex items-center gap-3 min-w-[120px]">
        <span className="text-[10px] font-bold text-secondary uppercase w-4">{brushSize}px</span>
        <input
          type="range"
          min="1" max="12"
          value={brushSize}
          onChange={e => setBrushSize(parseInt(e.target.value))}
          className="flex-1 accent-accent h-1"
        />
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <button onClick={onUndo} className="p-1.5 rounded-md text-secondary hover:bg-surface hover:text-primary" title="Undo"><Undo2 size={16}/></button>
        <button onClick={onRedo} className="p-1.5 rounded-md text-secondary hover:bg-surface hover:text-primary" title="Redo"><Redo2 size={16}/></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={onDelete} className="p-1.5 rounded-md text-secondary hover:bg-red-50 hover:text-error" title="Delete Selected"><Trash2 size={16}/></button>
        <button onClick={onClear} className="p-1.5 rounded-md text-secondary hover:bg-surface hover:text-primary" title="Clear All"><RotateCcw size={16}/></button>
      </div>
      
    </div>
  );
}
