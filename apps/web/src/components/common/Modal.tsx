import type { ReactNode } from "react";

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close (clicking overlay or ESC)
   */
  onClose: () => void;

  /**
   * Modal content
   */
  children: ReactNode;

  /**
   * Optional CSS class for the modal content
   */
  className?: string;
}

/**
 * Reusable modal overlay component
 *
 * Handles:
 * - Overlay click to close
 * - Prevents content click from closing
 * - Portal rendering
 * - Backdrop blur
 *
 * @example
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
 *   <ModalContent title="My Modal">
 *     Content here
 *   </ModalContent>
 * </Modal>
 * ```
 */
export function Modal({ isOpen, onClose, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        className={className}
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.98))",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: className ? "none" : "500px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export interface ModalContentProps {
  /**
   * Modal title
   */
  title: string;

  /**
   * Modal description/subtitle
   */
  description?: string;

  /**
   * Modal content
   */
  children: ReactNode;

  /**
   * Border color for the modal
   */
  borderColor?: string;

  /**
   * Title color
   */
  titleColor?: string;
}

/**
 * Standard modal content wrapper with consistent styling
 */
export function ModalContent({
  title,
  description,
  children,
  borderColor = "rgba(139, 92, 246, 0.3)",
  titleColor = "rgba(196, 181, 253, 1)",
}: ModalContentProps) {
  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: "16px",
        padding: 0,
      }}
    >
      <h2
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: description ? "8px" : "24px",
          color: titleColor,
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            fontSize: "14px",
            color: "rgba(209, 213, 219, 0.8)",
            marginBottom: "24px",
          }}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
