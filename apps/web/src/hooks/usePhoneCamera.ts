"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UsePhoneCameraOptions {
  /** Initial facing mode (default: "environment" for back camera) */
  initialFacingMode?: "user" | "environment";
  /** Whether to attempt enabling torch when available */
  enableTorch?: boolean;
}

export interface UsePhoneCameraReturn {
  /** The video stream */
  stream: MediaStream | null;
  /** Whether the camera is loading */
  isLoading: boolean;
  /** Error message if camera failed */
  error: string | null;
  /** Current facing mode */
  facingMode: "user" | "environment";
  /** Whether torch is currently on */
  isTorchOn: boolean;
  /** Whether torch is available on this device */
  isTorchAvailable: boolean;
  /** Available camera devices */
  availableDevices: MediaDeviceInfo[];
  /** Start the camera */
  start: () => Promise<void>;
  /** Stop the camera */
  stop: () => void;
  /** Flip between front and back camera */
  flipCamera: () => Promise<void>;
  /** Toggle torch on/off */
  toggleTorch: () => Promise<void>;
  /** Set torch state explicitly */
  setTorch: (on: boolean) => Promise<void>;
}

/**
 * Hook for managing phone camera with flip and torch support
 *
 * Designed for mobile devices, defaults to back-facing camera.
 */
export function usePhoneCamera(
  options: UsePhoneCameraOptions = {},
): UsePhoneCameraReturn {
  const { initialFacingMode = "environment", enableTorch = false } = options;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    initialFacingMode,
  );
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isTorchAvailable, setIsTorchAvailable] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>(
    [],
  );

  // Track if component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Stop all tracks in the current stream
   */
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsTorchOn(false);
    }
  }, [stream]);

  /**
   * Check if torch is available on the current track
   */
  const checkTorchAvailability = useCallback(
    (track: MediaStreamTrack): boolean => {
      try {
        const capabilities =
          track.getCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
          };
        return capabilities.torch === true;
      } catch {
        return false;
      }
    },
    [],
  );

  /**
   * Apply torch setting to track
   */
  const applyTorch = useCallback(
    async (track: MediaStreamTrack, on: boolean): Promise<boolean> => {
      try {
        await track.applyConstraints({
          advanced: [{ torch: on } as MediaTrackConstraintSet],
        });
        return true;
      } catch (err) {
        console.warn("[usePhoneCamera] Failed to apply torch:", err);
        return false;
      }
    },
    [],
  );

  /**
   * Start camera with specified facing mode
   */
  const startCamera = useCallback(
    async (targetFacingMode: "user" | "environment") => {
      setIsLoading(true);
      setError(null);

      try {
        // Stop any existing stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        // Request camera with specified facing mode
        // Prefer widest angle lens (zoom: 1 = no zoom = widest)
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: targetFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // @ts-expect-error - zoom is valid but not in TS types
            zoom: { ideal: 1 },
          },
          audio: false,
        };

        const newStream =
          await navigator.mediaDevices.getUserMedia(constraints);

        if (!isMountedRef.current) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }

        // Check torch availability
        const videoTrack = newStream.getVideoTracks()[0];
        const torchAvailable = videoTrack
          ? checkTorchAvailability(videoTrack)
          : false;
        setIsTorchAvailable(torchAvailable);

        // Apply initial torch setting if requested and available
        if (enableTorch && torchAvailable && videoTrack) {
          const success = await applyTorch(videoTrack, true);
          setIsTorchOn(success);
        } else {
          setIsTorchOn(false);
        }

        // Enumerate devices for UI
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput",
        );
        setAvailableDevices(videoDevices);

        setStream(newStream);
        setFacingMode(targetFacingMode);
        setError(null);
      } catch (err) {
        console.error("[usePhoneCamera] Failed to start camera:", err);

        if (!isMountedRef.current) return;

        if (err instanceof Error) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            setError("Camera permission denied. Please allow camera access.");
          } else if (
            err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError"
          ) {
            setError("No camera found on this device.");
          } else if (
            err.name === "NotReadableError" ||
            err.name === "TrackStartError"
          ) {
            setError("Camera is in use by another application.");
          } else if (err.name === "OverconstrainedError") {
            // If the facing mode constraint failed, try without it
            try {
              const fallbackStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });

              if (!isMountedRef.current) {
                fallbackStream.getTracks().forEach((track) => track.stop());
                return;
              }

              const videoTrack = fallbackStream.getVideoTracks()[0];
              const torchAvailable = videoTrack
                ? checkTorchAvailability(videoTrack)
                : false;
              setIsTorchAvailable(torchAvailable);

              setStream(fallbackStream);
              setError(null);
              return;
            } catch {
              setError("Could not access any camera.");
            }
          } else {
            setError(`Camera error: ${err.message}`);
          }
        } else {
          setError("Unknown camera error occurred.");
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [stream, checkTorchAvailability, applyTorch, enableTorch],
  );

  /**
   * Start the camera with current facing mode
   */
  const start = useCallback(async () => {
    await startCamera(facingMode);
  }, [startCamera, facingMode]);

  /**
   * Stop the camera
   */
  const stop = useCallback(() => {
    stopStream();
    setError(null);
  }, [stopStream]);

  /**
   * Flip between front and back camera
   */
  const flipCamera = useCallback(async () => {
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    await startCamera(newFacingMode);
  }, [facingMode, startCamera]);

  /**
   * Toggle torch on/off
   */
  const toggleTorch = useCallback(async () => {
    if (!stream || !isTorchAvailable) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const newState = !isTorchOn;
    const success = await applyTorch(videoTrack, newState);
    if (success) {
      setIsTorchOn(newState);
    }
  }, [stream, isTorchAvailable, isTorchOn, applyTorch]);

  /**
   * Set torch state explicitly
   */
  const setTorch = useCallback(
    async (on: boolean) => {
      if (!stream || !isTorchAvailable) return;

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;

      const success = await applyTorch(videoTrack, on);
      if (success) {
        setIsTorchOn(on);
      }
    },
    [stream, isTorchAvailable, applyTorch],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    stream,
    isLoading,
    error,
    facingMode,
    isTorchOn,
    isTorchAvailable,
    availableDevices,
    start,
    stop,
    flipCamera,
    toggleTorch,
    setTorch,
  };
}
