import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GripVertical, RotateCcw, Pencil, Highlighter, Eraser, Square, Circle, Minus, Type, MousePointer2 } from 'lucide-react';

const STORAGE_KEY = 'roughPageData';

export default function RoughPage({ onClose }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(Math.min(600, window.innerWidth * 0.45));
  const [isResizing, setIsResizing] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(3000);
  
  const [activeTool, setActiveTool] = useState('draw');
  const [brushColor, setBrushColor] = useState('#111827');
  const [brushSize, setBrushSize] = useState(3);

  // Resize logic
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 350 && newWidth < window.innerWidth * 0.8) setWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizing]);

  // Init fabric — single init, load saved data
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let disposed = false;
    let canvas = null;

    const initFabric = async () => {
      const fabric = await import('fabric');
      if (disposed) return;
      if (fabricRef.current) { try { fabricRef.current.dispose(); } catch (e) {} fabricRef.current = null; }

      const w = containerRef.current.offsetWidth;
      canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true, backgroundColor: '#FFFFFF', width: w, height: canvasHeight
      });
      fabricRef.current = canvas;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = brushColor;
      canvas.freeDrawingBrush.width = brushSize;

      // Load saved rough work
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          canvas.loadFromJSON(JSON.parse(saved), () => canvas.renderAll());
        } catch (e) { console.warn('Could not load saved rough work'); }
      }

      // Auto-save on every change
      canvas.on('object:added', saveToSession);
      canvas.on('object:modified', saveToSession);
      canvas.on('object:removed', saveToSession);
    };

    initFabric();
    return () => {
      disposed = true;
      if (canvas) { saveToSession(); try { canvas.dispose(); } catch (e) {} }
      fabricRef.current = null;
    };
  }, []);

  // Extend canvas when user scrolls near bottom (infinite scroll)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight > canvasHeight - 200) {
        setCanvasHeight(h => h + 1500);
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [canvasHeight]);

  // Resize canvas when height extends or width changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas && containerRef.current) {
      canvas.setDimensions({ width: containerRef.current.offsetWidth, height: canvasHeight });
      canvas.renderAll();
    }
  }, [width, canvasHeight]);

  // Update brush/tool
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const update = async () => {
      const fabric = await import('fabric');
      if (activeTool === 'draw') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = brushColor;
        canvas.freeDrawingBrush.width = brushSize;
      } else if (activeTool === 'highlighter') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = brushColor + '44';
        canvas.freeDrawingBrush.width = brushSize * 5;
      } else if (activeTool === 'eraser') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = '#FFFFFF';
        canvas.freeDrawingBrush.width = brushSize * 3;
      } else {
        canvas.isDrawingMode = false;
      }
    };
    update();
  }, [activeTool, brushColor, brushSize]);

  const saveToSession = () => {
    if (fabricRef.current) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fabricRef.current.toJSON())); } catch (e) {}
    }
  };

  const addShape = async (type) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const fabric = await import('fabric');
    const scrollTop = scrollRef.current?.scrollTop || 0;
    const cx = canvas.getWidth() / 2;
    const cy = scrollTop + 200;
    let shape;
    if (type === 'rect') shape = new fabric.Rect({ left: cx - 50, top: cy, width: 100, height: 60, fill: 'transparent', stroke: brushColor, strokeWidth: 2 });
    else if (type === 'circle') shape = new fabric.Ellipse({ left: cx - 40, top: cy, rx: 40, ry: 40, fill: 'transparent', stroke: brushColor, strokeWidth: 2 });
    else if (type === 'line') shape = new fabric.Line([cx - 60, cy, cx + 60, cy], { stroke: brushColor, strokeWidth: 2 });
    else if (type === 'text') shape = new fabric.IText('Type here', { left: cx - 40, top: cy, fontSize: 18, fill: brushColor, fontFamily: 'Inter, sans-serif' });
    if (shape) { canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll(); setActiveTool('select'); }
  };

  const handleClear = () => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = '#FFFFFF';
      fabricRef.current.renderAll();
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleDeleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  };

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'draw', icon: Pencil, label: 'Draw' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlight' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  const shapes = [
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'text', icon: Type, label: 'Text' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto" onClick={onClose} />
        
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{ width }} className="relative bg-white shadow-2xl flex flex-col border-l border-border pointer-events-auto">
          
          {/* Resize handle */}
          <div onMouseDown={() => setIsResizing(true)}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-accent/30 transition-colors z-10" />

          {/* Header */}
          <header className="h-11 border-b border-border flex items-center justify-between px-4 shrink-0 bg-white">
            <h3 className="font-bold text-sm text-primary">📝 Rough Work</h3>
            <div className="flex items-center gap-1">
              <button onClick={handleDeleteSelected} className="p-1.5 text-secondary hover:text-error text-[11px] transition-colors" title="Delete selected">🗑️</button>
              <button onClick={handleClear} className="p-1.5 text-secondary hover:text-primary transition-colors" title="Clear all"><RotateCcw size={14}/></button>
              <button onClick={onClose} className="p-1.5 text-secondary hover:text-primary transition-colors"><X size={18}/></button>
            </div>
          </header>

          {/* Toolbar */}
          <div className="bg-white border-b border-border flex items-center px-3 py-1.5 gap-1 shrink-0 flex-wrap">
            {/* Tools */}
            <div className="flex items-center bg-surface rounded-lg p-0.5 gap-0.5">
              {tools.map(t => (
                <button key={t.id} onClick={() => setActiveTool(t.id)} title={t.label}
                  className={`p-1.5 rounded-md transition-all ${activeTool === t.id ? 'bg-white text-accent shadow-sm' : 'text-secondary hover:text-primary'}`}>
                  <t.icon size={14} />
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-border mx-1" />
            {/* Shapes */}
            <div className="flex items-center gap-0.5">
              {shapes.map(s => (
                <button key={s.id} onClick={() => addShape(s.id)} title={s.label}
                  className="p-1.5 rounded-md text-secondary hover:bg-surface hover:text-primary transition-all">
                  <s.icon size={14} />
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-border mx-1" />
            {/* Colors */}
            <div className="flex items-center gap-1">
              {['#111827','#4F46E5','#DC2626','#059669','#D97706','#2563EB'].map(c => (
                <button key={c} onClick={() => setBrushColor(c)}
                  className={`w-4 h-4 rounded-full transition-transform ${brushColor === c ? 'ring-2 ring-offset-1 ring-accent scale-125' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="w-px h-5 bg-border mx-1" />
            {/* Size */}
            <input type="range" min="1" max="12" value={brushSize} onChange={e => setBrushSize(+e.target.value)} className="w-14 accent-accent h-1" />
            <span className="text-[9px] text-secondary font-mono w-5">{brushSize}</span>
          </div>

          {/* Canvas area — scrollable, infinite */}
          <div className="flex-1 relative overflow-y-auto bg-surface" ref={(el) => { scrollRef.current = el; containerRef.current = el; }}>
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]" 
              style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px', height: canvasHeight }} />
            <canvas ref={canvasRef} className="absolute top-0 left-0" />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
