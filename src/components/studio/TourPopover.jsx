import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function TourPopover({ targetId, step, onClose, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    const previousFocus = document.activeElement;
    const target = targetId ? document.querySelector(`[data-tour="${targetId}"]`) : null;
    target?.classList.add('tour-highlight');
    const position = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const box = panel.getBoundingClientRect();
      const rect = target?.getBoundingClientRect();
      let left = width - box.width - 20;
      let top = height - box.height - 20;
      if (rect) {
        if (rect.right + box.width + 32 < width) {
          left = rect.right + 16;
          top = Math.max(16, Math.min(rect.top, height - box.height - 16));
        } else if (rect.bottom + box.height + 32 < height) {
          left = Math.max(16, Math.min(rect.left, width - box.width - 16));
          top = rect.bottom + 16;
        } else if (rect.top - box.height > 32) {
          top = rect.top - box.height - 16;
        }
      }
      panel.style.left = `${Math.max(12, left)}px`;
      panel.style.top = `${Math.max(12, top)}px`;
    };
    // Reserve space below the document so even its last section can be lifted above the guide.
    const oldPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `${panel.offsetHeight + 40}px`;
    if (target) window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - 90, behavior: 'instant' });
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    if (target) observer.observe(target);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    const escape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => {
      observer.disconnect();
      target?.classList.remove('tour-highlight');
      document.body.style.paddingBottom = oldPadding;
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('keydown', escape);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [targetId, step, onClose]);
  return createPortal(<section ref={ref} className="tour-popover" role="dialog" aria-label="Welcome tour" aria-modal="false" aria-live="polite">
    <button className="studio-icon tour-close" aria-label="Close welcome tour" onClick={onClose}><X size={18} /></button>
    {children}
  </section>, document.body);
}
