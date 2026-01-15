"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { Z_INDEX } from "@/constants/zIndex";
import { css } from "../../../styled-system/css";

interface PhotoUploadZoneProps {
  /** Currently selected photos */
  photos: File[];
  /** Callback when photos change */
  onPhotosChange: (photos: File[]) => void;
  /** Maximum number of photos allowed (default: unlimited) */
  maxPhotos?: number;
  /** Whether the zone is disabled */
  disabled?: boolean;
}

/**
 * Multi-photo upload zone with drag & drop, file picker, and camera capture.
 * Shows preview thumbnails with remove buttons.
 */
export function PhotoUploadZone({
  photos,
  onPhotosChange,
  maxPhotos,
  disabled = false,
}: PhotoUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create object URLs for preview (memoized per photo)
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());

  const getPreviewUrl = useCallback(
    (photo: File): string => {
      if (previewUrls.has(photo)) {
        return previewUrls.get(photo)!;
      }
      const url = URL.createObjectURL(photo);
      setPreviewUrls((prev) => new Map(prev).set(photo, url));
      return url;
    },
    [previewUrls],
  );

  const addPhotos = useCallback(
    (newFiles: File[]) => {
      setError(null);

      // Filter for images only
      const imageFiles = newFiles.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length < newFiles.length) {
        setError("Some files were skipped (not images)");
      }

      // Check max limit
      const availableSlots = maxPhotos ? maxPhotos - photos.length : Infinity;
      const filesToAdd = imageFiles.slice(0, availableSlots);

      if (filesToAdd.length < imageFiles.length) {
        setError(`Maximum ${maxPhotos} photos allowed`);
      }

      if (filesToAdd.length > 0) {
        onPhotosChange([...photos, ...filesToAdd]);
      }
    },
    [photos, onPhotosChange, maxPhotos],
  );

  const removePhoto = useCallback(
    (photoToRemove: File) => {
      // Revoke the object URL to free memory
      const url = previewUrls.get(photoToRemove);
      if (url) {
        URL.revokeObjectURL(url);
        setPreviewUrls((prev) => {
          const next = new Map(prev);
          next.delete(photoToRemove);
          return next;
        });
      }
      onPhotosChange(photos.filter((p) => p !== photoToRemove));
    },
    [photos, onPhotosChange, previewUrls],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      addPhotos(files);
    },
    [addPhotos, disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      addPhotos(files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [addPhotos],
  );

  const handleCameraCapture = useCallback(
    (file: File) => {
      addPhotos([file]);
      setShowCamera(false);
    },
    [addPhotos],
  );

  const canAddMore = !maxPhotos || photos.length < maxPhotos;

  return (
    <div data-component="photo-upload-zone">
      {/* Fullscreen Camera Modal */}
      <Dialog.Root open={showCamera} onOpenChange={setShowCamera}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={css({
              position: "fixed",
              inset: 0,
              bg: "black",
              zIndex: Z_INDEX.MODAL,
            })}
          />
          <Dialog.Content
            className={css({
              position: "fixed",
              inset: 0,
              zIndex: Z_INDEX.MODAL + 1,
              outline: "none",
            })}
          >
            <Dialog.Title className={css({ srOnly: true })}>
              Take Photo
            </Dialog.Title>
            <Dialog.Description className={css({ srOnly: true })}>
              Camera viewfinder. Tap capture to take a photo.
            </Dialog.Description>
            <FullscreenCamera
              onCapture={handleCameraCapture}
              onClose={() => setShowCamera(false)}
              disabled={disabled}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={css({
          border: "2px dashed",
          borderColor: dragOver ? "blue.400" : "gray.300",
          borderRadius: "lg",
          p: 6,
          textAlign: "center",
          bg: dragOver ? "blue.50" : "gray.50",
          transition: "all 0.2s",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        })}
        onClick={() => !disabled && canAddMore && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || !canAddMore}
          className={css({ display: "none" })}
        />

        <div className={css({ fontSize: "3xl", mb: 2 })}>📷</div>

        {photos.length === 0 ? (
          <>
            <p className={css({ color: "gray.600", mb: 1 })}>
              Drop photos here or click to browse
            </p>
            <p className={css({ fontSize: "sm", color: "gray.400" })}>
              JPG, PNG, HEIC • Multiple files supported
            </p>
          </>
        ) : canAddMore ? (
          <p className={css({ color: "gray.600" })}>
            Drop more photos or click to add
          </p>
        ) : (
          <p className={css({ color: "gray.500" })}>
            Maximum photos reached ({maxPhotos})
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div
        className={css({
          display: "flex",
          gap: 2,
          mt: 3,
          justifyContent: "center",
        })}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !canAddMore}
          className={css({
            px: 4,
            py: 2,
            bg: "blue.500",
            color: "white",
            borderRadius: "md",
            fontSize: "sm",
            fontWeight: "medium",
            cursor: "pointer",
            _hover: { bg: "blue.600" },
            _disabled: { opacity: 0.5, cursor: "not-allowed" },
          })}
        >
          Choose Files
        </button>

        <button
          type="button"
          onClick={() => setShowCamera(true)}
          disabled={disabled || !canAddMore}
          className={css({
            px: 4,
            py: 2,
            bg: "green.500",
            color: "white",
            borderRadius: "md",
            fontSize: "sm",
            fontWeight: "medium",
            cursor: "pointer",
            _hover: { bg: "green.600" },
            _disabled: { opacity: 0.5, cursor: "not-allowed" },
          })}
        >
          📷 Camera
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          className={css({
            mt: 3,
            p: 2,
            bg: "orange.50",
            border: "1px solid",
            borderColor: "orange.200",
            borderRadius: "md",
            color: "orange.700",
            fontSize: "sm",
            textAlign: "center",
          })}
        >
          {error}
        </div>
      )}

      {/* Photo previews */}
      {photos.length > 0 && (
        <div
          className={css({
            mt: 4,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 3,
          })}
        >
          {photos.map((photo, idx) => (
            <div
              key={`${photo.name}-${photo.lastModified}-${idx}`}
              className={css({
                position: "relative",
                aspectRatio: "1",
                borderRadius: "md",
                overflow: "hidden",
                bg: "gray.100",
              })}
            >
              {/* biome-ignore lint/a11y/useAltText: preview thumbnail */}
              {/* biome-ignore lint/performance/noImgElement: blob URLs for previews don't work with Next Image */}
              <img
                src={getPreviewUrl(photo)}
                className={css({
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                })}
              />

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(photo);
                }}
                disabled={disabled}
                className={css({
                  position: "absolute",
                  top: 1,
                  right: 1,
                  width: "24px",
                  height: "24px",
                  bg: "rgba(0, 0, 0, 0.6)",
                  color: "white",
                  borderRadius: "full",
                  fontSize: "sm",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  _hover: { bg: "rgba(0, 0, 0, 0.8)" },
                  _disabled: { opacity: 0.5, cursor: "not-allowed" },
                })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Fullscreen Camera Component
// =============================================================================

interface FullscreenCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  disabled?: boolean;
}

/**
 * Fullscreen camera with edge-to-edge preview and floating controls.
 */
function FullscreenCamera({
  onCapture,
  onClose,
  disabled = false,
}: FullscreenCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Start camera on mount, cleanup on unmount
  useEffect(() => {
    if (disabled) return;

    let cancelled = false;

    const startCamera = async () => {
      try {
        // Request camera with rear camera preference on mobile
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // If component unmounted while waiting for camera, stop the stream
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (!cancelled) {
            setIsReady(true);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Camera access error:", err);
        setError(
          "Camera access denied. Please allow camera access and try again.",
        );
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [disabled]);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.9,
        );
      });

      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      onCapture(file);
    } catch (err) {
      console.error("Capture error:", err);
      setError("Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div
      data-component="fullscreen-camera"
      className={css({
        position: "absolute",
        inset: 0,
        bg: "black",
        display: "flex",
        flexDirection: "column",
      })}
    >
      {/* Edge-to-edge video preview */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={css({
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        })}
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Loading overlay */}
      {!isReady && !error && (
        <div
          className={css({
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bg: "black",
          })}
        >
          <div className={css({ color: "white", fontSize: "xl" })}>
            Starting camera...
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          className={css({
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            bg: "black",
            p: 6,
          })}
        >
          <div
            className={css({
              color: "red.400",
              fontSize: "lg",
              textAlign: "center",
              mb: 4,
            })}
          >
            {error}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={css({
              px: 6,
              py: 3,
              bg: "white",
              color: "black",
              borderRadius: "full",
              fontSize: "lg",
              fontWeight: "bold",
              cursor: "pointer",
            })}
          >
            Close
          </button>
        </div>
      )}

      {/* Floating controls */}
      {!error && (
        <>
          {/* Close button - top right */}
          <button
            type="button"
            onClick={onClose}
            className={css({
              position: "absolute",
              top: 4,
              right: 4,
              width: "48px",
              height: "48px",
              bg: "rgba(0, 0, 0, 0.5)",
              color: "white",
              borderRadius: "full",
              fontSize: "2xl",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
              _hover: { bg: "rgba(0, 0, 0, 0.7)" },
            })}
          >
            ×
          </button>

          {/* Capture button - bottom center */}
          <div
            className={css({
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
            })}
          >
            <button
              type="button"
              onClick={capturePhoto}
              disabled={disabled || isCapturing || !isReady}
              className={css({
                width: "80px",
                height: "80px",
                bg: "white",
                borderRadius: "full",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                border: "4px solid",
                borderColor: "gray.300",
                transition: "all 0.15s",
                _hover: { transform: "scale(1.05)" },
                _active: { transform: "scale(0.95)" },
                _disabled: { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              {isCapturing ? (
                <div className={css({ fontSize: "sm", color: "gray.600" })}>
                  ...
                </div>
              ) : (
                <div
                  className={css({
                    width: "64px",
                    height: "64px",
                    bg: "white",
                    borderRadius: "full",
                    border: "2px solid",
                    borderColor: "gray.400",
                  })}
                />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
