import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Width variant: 'sm' (400px) | 'md' (520px, default) */
  size?: "sm" | "md";
}

const Modal = ({ isOpen, onClose, title, children, size = "md" }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open / close the native <dialog>
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  // Close on Escape (native dialog does this, but also call our handler)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      onClick={handleBackdropClick}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
};

export default Modal;
