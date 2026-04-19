import { useEffect, useRef, useState } from 'react';
import DrawingToolbar from './DrawingToolbar';
import './RoughPage.css';

export default function RoughPage({ onClose }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const [activeTool, setActiveTool] = useState('draw');
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);

  useEffect(() => {
    const initFabric = async () => {
      const fabric = await import('fabric');
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        backgroundColor: '#1a1a2e',
        width: 800,
        height: 600
      });
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = '#ffffff';
      canvas.freeDrawingBrush.width = 3;
      fabricRef.current = canvas;

      const resize = () => {
        const container = canvasRef.current?.parentElement;
        if (container && canvas) {
          canvas.setWidth(container.offsetWidth);
          canvas.setHeight(container.offsetHeight - 50);
          canvas.renderAll();
        }
      };
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    };
    initFabric();
    return () => { if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; } };
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const update = async () => {
      const fabric = await import('fabric');
      if (activeTool === 'draw' || activeTool === 'highlighter') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = activeTool === 'highlighter' ? brushColor + '55' : brushColor;
        canvas.freeDrawingBrush.width = activeTool === 'highlighter' ? brushSize * 4 : brushSize;
      } else {
        canvas.isDrawingMode = false;
      }
    };
    update();
  }, [activeTool, brushColor, brushSize]);

  const addShape = async (type) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const fabric = await import('fabric');
    const c = { x: canvas.width / 2, y: canvas.height / 2 };
    let shape;
    if (type === 'rect') shape = new fabric.Rect({ left: c.x - 50, top: c.y - 30, width: 100, height: 60, fill: 'transparent', stroke: brushColor, strokeWidth: 2 });
    else if (type === 'circle') shape = new fabric.Ellipse({ left: c.x - 40, top: c.y - 40, rx: 40, ry: 40, fill: 'transparent', stroke: brushColor, strokeWidth: 2 });
    else if (type === 'line') shape = new fabric.Line([c.x - 60, c.y, c.x + 60, c.y], { stroke: brushColor, strokeWidth: 2 });
    else if (type === 'text') shape = new fabric.IText('Type here', { left: c.x - 40, top: c.y - 10, fontSize: 18, fill: brushColor, fontFamily: 'Inter' });
    if (shape) { canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll(); setActiveTool('select'); }
  };

  const handleClear = () => { const c = fabricRef.current; if (c) { c.clear(); c.backgroundColor = '#1a1a2e'; c.renderAll(); } };
  const handleDelete = () => {
    const c = fabricRef.current;
    if (!c) return;
    c.getActiveObjects().forEach(obj => c.remove(obj));
    c.discardActiveObject(); c.renderAll();
  };

  return (
    <div className="rough-page-overlay">
      <div className="rough-page-modal animate-scale-in">
        <div className="rough-page-header">
          <h3>Rough Work</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <DrawingToolbar activeTool={activeTool} setActiveTool={setActiveTool} brushColor={brushColor} setBrushColor={setBrushColor} brushSize={brushSize} setBrushSize={setBrushSize} onAddShape={addShape} onClear={handleClear} onDelete={handleDelete} />
        <div className="rough-page-canvas-container">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
