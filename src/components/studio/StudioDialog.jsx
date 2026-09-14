import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function StudioDialog({
  children,
  onClose,
  title,
  className = '',
}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`studio-dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const isOutside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (isOutside) onClose();
      }}
    >
      <button
        className="studio-icon dialog-close"
        onClick={onClose}
        aria-label={`Close ${title}`}
      >
        <X size={19} />
      </button>
      {children}
    </dialog>
  );
}
