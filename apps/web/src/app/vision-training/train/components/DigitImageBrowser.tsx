"use client";

import { useCallback, useState } from "react";
import { css } from "../../../../../styled-system/css";

export interface TrainingImageMeta {
  filename: string;
  digit: number;
  timestamp: number;
  playerId: string;
  sessionId: string;
  columnIndex: number;
  imageUrl: string;
}

interface DigitImageBrowserProps {
  /** The digit being browsed */
  digit: number;
  /** Images for this digit */
  images: TrainingImageMeta[];
  /** Loading state */
  loading?: boolean;
  /** Callback when an image is deleted */
  onDeleteImage?: (image: TrainingImageMeta) => Promise<void>;
  /** Callback when images are bulk deleted */
  onBulkDeleteImages?: (images: TrainingImageMeta[]) => Promise<void>;
  /** Callback when an image is reclassified to a different digit */
  onReclassifyImage?: (
    image: TrainingImageMeta,
    newDigit: number,
  ) => Promise<void>;
  /** Callback when images are bulk reclassified */
  onBulkReclassifyImages?: (
    images: TrainingImageMeta[],
    newDigit: number,
  ) => Promise<void>;
  /** Whether deletion is in progress */
  deleting?: boolean;
}

/**
 * Image browser for a single digit. Shows a grid of training images
 * with delete and reclassify actions.
 */
export function DigitImageBrowser({
  digit,
  images,
  loading = false,
  onDeleteImage,
  onBulkDeleteImages,
  onReclassifyImage,
  onBulkReclassifyImages,
  deleting = false,
}: DigitImageBrowserProps) {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [reclassifyingImage, setReclassifyingImage] = useState<string | null>(
    null,
  );
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const [showBulkReclassify, setShowBulkReclassify] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const toggleSelect = useCallback(
    (filename: string, index: number, shiftKey: boolean) => {
      setSelectedImages((prev) => {
        const next = new Set(prev);

        // Shift+click for range selection/deselection
        if (shiftKey && lastClickedIndex !== null) {
          const start = Math.min(lastClickedIndex, index);
          const end = Math.max(lastClickedIndex, index);
          // Action based on clicked item: if it's selected, deselect range; if not, select range
          const shouldSelect = !prev.has(filename);
          for (let i = start; i <= end; i++) {
            if (shouldSelect) {
              next.add(images[i].filename);
            } else {
              next.delete(images[i].filename);
            }
          }
        } else {
          // Normal toggle
          if (next.has(filename)) {
            next.delete(filename);
          } else {
            next.add(filename);
          }
        }

        return next;
      });

      // Always update last clicked index (but not for shift clicks to allow extending range)
      if (!shiftKey) {
        setLastClickedIndex(index);
      }
    },
    [lastClickedIndex, images],
  );

  const selectAll = useCallback(() => {
    setSelectedImages(new Set(images.map((img) => img.filename)));
  }, [images]);

  const clearSelection = useCallback(() => {
    setSelectedImages(new Set());
  }, []);

  const handleDelete = useCallback(
    async (image: TrainingImageMeta) => {
      if (onDeleteImage) {
        await onDeleteImage(image);
      }
    },
    [onDeleteImage],
  );

  const handleReclassify = useCallback(
    async (image: TrainingImageMeta, newDigit: number) => {
      if (onReclassifyImage && newDigit !== image.digit) {
        setReclassifyingImage(image.filename);
        try {
          await onReclassifyImage(image, newDigit);
        } finally {
          setReclassifyingImage(null);
        }
      }
    },
    [onReclassifyImage],
  );

  // Get selected image objects
  const selectedImageObjects = images.filter((img) =>
    selectedImages.has(img.filename),
  );

  const handleBulkDelete = useCallback(async () => {
    if (onBulkDeleteImages && selectedImageObjects.length > 0) {
      setBulkActionInProgress(true);
      try {
        await onBulkDeleteImages(selectedImageObjects);
        setSelectedImages(new Set());
      } finally {
        setBulkActionInProgress(false);
      }
    }
  }, [onBulkDeleteImages, selectedImageObjects]);

  const handleBulkReclassify = useCallback(
    async (newDigit: number) => {
      if (
        onBulkReclassifyImages &&
        selectedImageObjects.length > 0 &&
        newDigit !== digit
      ) {
        setBulkActionInProgress(true);
        setShowBulkReclassify(false);
        try {
          await onBulkReclassifyImages(selectedImageObjects, newDigit);
          setSelectedImages(new Set());
        } finally {
          setBulkActionInProgress(false);
        }
      }
    },
    [onBulkReclassifyImages, selectedImageObjects, digit],
  );

  if (loading) {
    return (
      <div
        data-component="digit-image-browser"
        data-state="loading"
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "200px",
          color: "gray.500",
        })}
      >
        <span
          data-element="loading-spinner"
          className={css({ animation: "spin 1s linear infinite", mr: 2 })}
        >
          ⏳
        </span>
        <span data-element="loading-text">Loading images...</span>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div
        data-component="digit-image-browser"
        data-state="empty"
        data-digit={digit}
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "200px",
          color: "gray.500",
          textAlign: "center",
          p: 4,
        })}
      >
        <div
          data-element="empty-icon"
          className={css({ fontSize: "3xl", mb: 2, opacity: 0.5 })}
        >
          📭
        </div>
        <div data-element="empty-message" className={css({ fontSize: "sm" })}>
          No images for digit{" "}
          <strong className={css({ color: "gray.300" })}>{digit}</strong>
        </div>
        <div
          data-element="empty-hint"
          className={css({ fontSize: "xs", mt: 1, color: "gray.600" })}
        >
          Use the capture panel to add training images
        </div>
      </div>
    );
  }

  return (
    <div
      data-component="digit-image-browser"
      data-digit={digit}
      data-image-count={images.length}
    >
      {/* Header with selection controls */}
      <div
        data-element="browser-header"
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
          pb: 2,
          borderBottom: "1px solid",
          borderColor: "gray.800",
        })}
      >
        <div
          data-element="image-count"
          className={css({ fontSize: "sm", color: "gray.400" })}
        >
          <strong className={css({ color: "gray.200" })}>
            {images.length}
          </strong>{" "}
          images
          {selectedImages.size > 0 && (
            <span
              data-element="selection-count"
              className={css({ color: "blue.400", ml: 2 })}
            >
              ({selectedImages.size} selected)
            </span>
          )}
        </div>
        <div
          data-element="selection-actions"
          className={css({ display: "flex", gap: 2 })}
        >
          {selectedImages.size > 0 ? (
            <>
              {/* Bulk delete button */}
              {onBulkDeleteImages && (
                <button
                  type="button"
                  data-action="bulk-delete"
                  onClick={handleBulkDelete}
                  disabled={bulkActionInProgress}
                  className={css({
                    px: 2,
                    py: 1,
                    fontSize: "xs",
                    color: "red.400",
                    bg: "transparent",
                    border: "1px solid",
                    borderColor: "red.800",
                    borderRadius: "md",
                    cursor: bulkActionInProgress ? "not-allowed" : "pointer",
                    opacity: bulkActionInProgress ? 0.5 : 1,
                    _hover: { borderColor: "red.600", bg: "red.900/30" },
                  })}
                >
                  🗑️ Delete {selectedImages.size}
                </button>
              )}

              {/* Bulk reclassify button */}
              {onBulkReclassifyImages && (
                <div
                  data-element="bulk-reclassify-wrapper"
                  className={css({ position: "relative" })}
                >
                  <button
                    type="button"
                    data-action="bulk-reclassify"
                    onClick={() => setShowBulkReclassify(!showBulkReclassify)}
                    disabled={bulkActionInProgress}
                    className={css({
                      px: 2,
                      py: 1,
                      fontSize: "xs",
                      color: "blue.400",
                      bg: "transparent",
                      border: "1px solid",
                      borderColor: "blue.800",
                      borderRadius: "md",
                      cursor: bulkActionInProgress ? "not-allowed" : "pointer",
                      opacity: bulkActionInProgress ? 0.5 : 1,
                      _hover: { borderColor: "blue.600", bg: "blue.900/30" },
                    })}
                  >
                    ↻ Move {selectedImages.size}
                  </button>

                  {showBulkReclassify && (
                    <div
                      data-element="bulk-reclassify-menu"
                      className={css({
                        position: "absolute",
                        top: "100%",
                        right: 0,
                        mt: 1,
                        p: 2,
                        bg: "gray.800",
                        borderRadius: "md",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                        border: "1px solid",
                        borderColor: "gray.700",
                        zIndex: 100,
                      })}
                    >
                      <div
                        data-element="bulk-reclassify-label"
                        className={css({
                          fontSize: "xs",
                          color: "gray.400",
                          mb: 2,
                        })}
                      >
                        Move to digit:
                      </div>
                      <div
                        data-element="bulk-reclassify-digit-grid"
                        className={css({
                          display: "grid",
                          gridTemplateColumns: "repeat(5, 1fr)",
                          gap: 1,
                        })}
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                          <button
                            key={d}
                            type="button"
                            data-action="bulk-reclassify-to"
                            data-target-digit={d}
                            data-current={d === digit}
                            onClick={() => handleBulkReclassify(d)}
                            disabled={d === digit}
                            className={css({
                              width: "28px",
                              height: "28px",
                              fontSize: "sm",
                              fontWeight: "bold",
                              fontFamily: "mono",
                              color: d === digit ? "gray.600" : "gray.200",
                              bg: d === digit ? "gray.900" : "gray.700",
                              border: "none",
                              borderRadius: "sm",
                              cursor: d === digit ? "not-allowed" : "pointer",
                              _hover:
                                d === digit
                                  ? {}
                                  : { bg: "blue.600", color: "white" },
                            })}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Clear selection button */}
              <button
                type="button"
                data-action="clear-selection"
                onClick={clearSelection}
                className={css({
                  px: 2,
                  py: 1,
                  fontSize: "xs",
                  color: "gray.400",
                  bg: "transparent",
                  border: "1px solid",
                  borderColor: "gray.700",
                  borderRadius: "md",
                  cursor: "pointer",
                  _hover: { borderColor: "gray.600", color: "gray.300" },
                })}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              type="button"
              data-action="select-all"
              onClick={selectAll}
              className={css({
                px: 2,
                py: 1,
                fontSize: "xs",
                color: "gray.400",
                bg: "transparent",
                border: "1px solid",
                borderColor: "gray.700",
                borderRadius: "md",
                cursor: "pointer",
                _hover: { borderColor: "gray.600", color: "gray.300" },
              })}
            >
              Select All
            </button>
          )}
        </div>
      </div>

      {/* Image grid - parent controls scrolling */}
      <div
        data-element="image-grid"
        className={css({
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))",
          gap: 2,
        })}
      >
        {images.map((image, index) => {
          const isSelected = selectedImages.has(image.filename);
          const isReclassifying = reclassifyingImage === image.filename;

          return (
            <div
              key={image.filename}
              data-element="image-card"
              data-filename={image.filename}
              data-selected={isSelected}
              data-reclassifying={isReclassifying}
              className={css({
                position: "relative",
                aspectRatio: "1",
                borderRadius: "md",
                // Note: NO overflow:hidden here - allows dropdown to escape
                border: "2px solid",
                borderColor: isSelected ? "blue.500" : "transparent",
                bg: "gray.850",
                cursor: "pointer",
                transition: "all 0.15s ease",
                _hover: {
                  borderColor: isSelected ? "blue.400" : "gray.600",
                  '& [data-element="image-actions"]': {
                    opacity: 1,
                  },
                },
              })}
              onClick={(e) => toggleSelect(image.filename, index, e.shiftKey)}
            >
              {/* Image wrapper with overflow hidden for rounded corners */}
              <div
                data-element="image-wrapper"
                className={css({
                  position: "absolute",
                  inset: 0,
                  borderRadius: "md",
                  overflow: "hidden",
                })}
              >
                <img
                  data-element="image-thumbnail"
                  src={image.imageUrl}
                  alt={`Digit ${image.digit}`}
                  className={css({
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: isReclassifying ? 0.5 : 1,
                  })}
                />
              </div>

              {/* Hover actions */}
              <div
                data-element="image-actions"
                className={css({
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  gap: 1,
                  p: 1,
                  bg: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                  opacity: 0,
                  transition: "opacity 0.15s ease",
                })}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Delete button */}
                <button
                  type="button"
                  data-action="delete-image"
                  onClick={() => handleDelete(image)}
                  disabled={deleting}
                  className={css({
                    flex: 1,
                    py: 1,
                    fontSize: "2xs",
                    color: "red.400",
                    bg: "gray.900/80",
                    border: "none",
                    borderRadius: "sm",
                    cursor: deleting ? "not-allowed" : "pointer",
                    _hover: { bg: "red.900/80" },
                  })}
                >
                  🗑️
                </button>

                {/* Reclassify dropdown */}
                <ReclassifyDropdown
                  currentDigit={image.digit}
                  onSelect={(newDigit) => handleReclassify(image, newDigit)}
                  disabled={isReclassifying}
                />
              </div>

              {/* Reclassifying overlay */}
              {isReclassifying && (
                <div
                  data-element="reclassifying-overlay"
                  className={css({
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bg: "gray.900/70",
                  })}
                >
                  <span
                    className={css({ animation: "spin 1s linear infinite" })}
                  >
                    🔄
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Dropdown for reclassifying an image to a different digit
 */
function ReclassifyDropdown({
  currentDigit,
  onSelect,
  disabled = false,
}: {
  currentDigit: number;
  onSelect: (digit: number) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      data-element="reclassify-dropdown"
      className={css({ position: "relative", flex: 1 })}
    >
      <button
        type="button"
        data-action="open-reclassify"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={css({
          width: "100%",
          py: 1,
          fontSize: "2xs",
          color: "blue.400",
          bg: "gray.900/80",
          border: "none",
          borderRadius: "sm",
          cursor: disabled ? "not-allowed" : "pointer",
          _hover: { bg: "blue.900/80" },
        })}
      >
        ↻
      </button>

      {isOpen && (
        <div
          data-element="reclassify-menu"
          className={css({
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            mb: 1,
            p: 2,
            bg: "gray.800",
            borderRadius: "md",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            border: "1px solid",
            borderColor: "gray.700",
            zIndex: 100,
          })}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            data-element="reclassify-digit-grid"
            className={css({
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 1,
            })}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                data-action="reclassify-to"
                data-target-digit={d}
                data-current={d === currentDigit}
                onClick={() => {
                  onSelect(d);
                  setIsOpen(false);
                }}
                disabled={d === currentDigit}
                className={css({
                  width: "28px",
                  height: "28px",
                  fontSize: "sm",
                  fontWeight: "bold",
                  fontFamily: "mono",
                  color: d === currentDigit ? "gray.600" : "gray.200",
                  bg: d === currentDigit ? "gray.900" : "gray.700",
                  border: "none",
                  borderRadius: "sm",
                  cursor: d === currentDigit ? "not-allowed" : "pointer",
                  _hover:
                    d === currentDigit
                      ? {}
                      : { bg: "blue.600", color: "white" },
                })}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DigitImageBrowser;
