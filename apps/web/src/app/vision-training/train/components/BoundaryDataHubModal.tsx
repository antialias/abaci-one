"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { css } from "../../../../../styled-system/css";
import { Z_INDEX } from "@/constants/zIndex";
import { UnifiedDataPanel } from "./data-panel/UnifiedDataPanel";

interface BoundaryDataHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

/**
 * Boundary Data Hub Modal
 *
 * Modal wrapper for boundary detector data panel.
 * Provides quick access to boundary detector training data management.
 */
export function BoundaryDataHubModal({
  isOpen,
  onClose,
  onDataChanged,
}: BoundaryDataHubModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: "fixed",
            inset: 0,
            bg: "black/80",
            animation: "fadeIn 0.2s ease-out",
          })}
          style={{ zIndex: Z_INDEX.MODAL }}
        />
        <Dialog.Content
          className={css({
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "95vw",
            maxWidth: "1200px",
            height: "90vh",
            maxHeight: "800px",
            bg: "gray.900",
            borderRadius: "xl",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "scaleIn 0.2s ease-out",
          })}
          style={{ zIndex: Z_INDEX.MODAL + 1 }}
        >
          {/* Accessible title (visually hidden) */}
          <Dialog.Title className={css({ srOnly: true })}>
            Boundary Training Data
          </Dialog.Title>
          <Dialog.Description className={css({ srOnly: true })}>
            Manage boundary detector training samples
          </Dialog.Description>

          {/* Close button */}
          <Dialog.Close
            className={css({
              position: "absolute",
              top: 2,
              right: 2,
              p: 2,
              bg: "transparent",
              border: "none",
              color: "gray.400",
              cursor: "pointer",
              borderRadius: "md",
              zIndex: 10,
              _hover: { color: "gray.200", bg: "gray.800" },
            })}
          >
            ✕
          </Dialog.Close>

          {/* Panel content */}
          <div className={css({ flex: 1, overflow: "hidden" })}>
            <UnifiedDataPanel
              modelType="boundary-detector"
              onDataChanged={onDataChanged}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
