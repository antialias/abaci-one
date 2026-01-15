"use client";

import { css } from "../../../../../../../styled-system/css";
import type { TrainingConfig, ModelType } from "../types";

interface ConfigCardProps {
  config: TrainingConfig;
  setConfig: (
    config: TrainingConfig | ((prev: TrainingConfig) => TrainingConfig),
  ) => void;
  isGpu: boolean;
  onStartTraining: () => void;
  canStart: boolean;
  /** Total number of training images */
  totalImages: number;
  /** Which model type is being trained */
  modelType: ModelType | null;
}

interface Preset {
  epochs: number;
  batchSize: number;
  label: string;
  desc: string;
}

export function ConfigCard({
  config,
  setConfig,
  isGpu,
  onStartTraining,
  canStart,
  totalImages,
  modelType,
}: ConfigCardProps) {
  // Recommend batch size based on dataset size
  // Goal: at least 10-20 batches per epoch for meaningful gradient updates
  const getRecommendedBatchSize = (images: number, hasGpu: boolean): number => {
    if (images < 200) return 8;
    if (images < 500) return 16;
    if (images < 2000) return 32;
    return hasGpu ? 64 : 32;
  };

  const recommendedBatchSize = getRecommendedBatchSize(totalImages, isGpu);
  const batchesPerEpoch = Math.floor(totalImages / config.batchSize);

  // Hardware and dataset-aware presets
  const presets: Record<string, Preset> = isGpu
    ? {
        quick: {
          epochs: 10,
          batchSize: recommendedBatchSize,
          label: "⚡ Quick",
          desc: "~2 min",
        },
        balanced: {
          epochs: 50,
          batchSize: recommendedBatchSize,
          label: "⚖️ Balanced",
          desc: "~10 min",
        },
        best: {
          epochs: 100,
          batchSize: recommendedBatchSize,
          label: "✨ Best",
          desc: "~20 min",
        },
      }
    : {
        quick: {
          epochs: 5,
          batchSize: recommendedBatchSize,
          label: "⚡ Quick",
          desc: "~5 min",
        },
        balanced: {
          epochs: 25,
          batchSize: recommendedBatchSize,
          label: "⚖️ Balanced",
          desc: "~15 min",
        },
        best: {
          epochs: 50,
          batchSize: recommendedBatchSize,
          label: "✨ Best",
          desc: "~30 min",
        },
      };

  const applyPreset = (preset: Preset) => {
    setConfig((prev) => ({
      ...prev,
      epochs: preset.epochs,
      batchSize: preset.batchSize,
    }));
  };

  const isPresetActive = (preset: Preset) =>
    config.epochs === preset.epochs && config.batchSize === preset.batchSize;

  return (
    <div>
      {/* Presets */}
      <div className={css({ mb: 4 })}>
        <div className={css({ fontSize: "xs", color: "gray.500", mb: 2 })}>
          Presets
        </div>
        <div className={css({ display: "flex", gap: 2 })}>
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(preset)}
              className={css({
                flex: 1,
                py: 2,
                px: 2,
                borderRadius: "lg",
                border: "2px solid",
                borderColor: isPresetActive(preset) ? "blue.500" : "gray.700",
                bg: isPresetActive(preset) ? "blue.900" : "gray.800",
                color: isPresetActive(preset) ? "blue.300" : "gray.300",
                cursor: "pointer",
                transition: "all 0.2s",
                _hover: { borderColor: "blue.400" },
              })}
            >
              <div className={css({ fontSize: "sm", fontWeight: "medium" })}>
                {preset.label}
              </div>
              <div className={css({ fontSize: "xs", color: "gray.500" })}>
                {preset.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Epochs slider */}
      <div className={css({ mb: 4 })}>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            mb: 1,
          })}
        >
          <span className={css({ fontSize: "xs", color: "gray.500" })}>
            Training Rounds
          </span>
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "medium",
              color: "gray.200",
            })}
          >
            {config.epochs}
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={isGpu ? 150 : 75}
          value={config.epochs}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              epochs: parseInt(e.target.value, 10),
            }))
          }
          className={css({
            width: "100%",
            height: "6px",
            borderRadius: "full",
            bg: "gray.700",
            appearance: "none",
            cursor: "pointer",
            "&::-webkit-slider-thumb": {
              appearance: "none",
              width: "16px",
              height: "16px",
              borderRadius: "full",
              bg: "blue.500",
              cursor: "pointer",
            },
          })}
        />
      </div>

      {/* Batch size */}
      <div className={css({ mb: 4 })}>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            mb: 1,
          })}
        >
          <span className={css({ fontSize: "xs", color: "gray.500" })}>
            Batch Size
          </span>
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "medium",
              color: "gray.200",
            })}
          >
            {config.batchSize}
            {config.batchSize === recommendedBatchSize && (
              <span className={css({ color: "green.400", ml: 1 })}>
                (recommended)
              </span>
            )}
          </span>
        </div>
        <div className={css({ display: "flex", gap: 2 })}>
          {[8, 16, 32, 64].map((size) => {
            const isRecommended = size === recommendedBatchSize;
            return (
              <button
                key={size}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, batchSize: size }))
                }
                className={css({
                  flex: 1,
                  py: 1.5,
                  borderRadius: "md",
                  border: "1px solid",
                  borderColor:
                    config.batchSize === size
                      ? "blue.500"
                      : isRecommended
                        ? "green.700"
                        : "gray.700",
                  bg: config.batchSize === size ? "blue.900" : "transparent",
                  color: config.batchSize === size ? "blue.300" : "gray.400",
                  fontSize: "sm",
                  cursor: "pointer",
                  _hover: { borderColor: "blue.400" },
                })}
              >
                {size}
              </button>
            );
          })}
        </div>
        {/* Batch size guidance */}
        <div className={css({ fontSize: "xs", color: "gray.500", mt: 2 })}>
          {totalImages === 0 ? (
            <span>
              Smaller = better for small datasets, larger = faster training
            </span>
          ) : batchesPerEpoch < 10 ? (
            <span className={css({ color: "yellow.400" })}>
              ⚠️ Only {batchesPerEpoch} batches/epoch — consider smaller batch
              size
            </span>
          ) : (
            <span>
              {batchesPerEpoch} batches/epoch • Smaller = better for small
              datasets, larger = faster training
            </span>
          )}
        </div>
      </div>

      {/* Color augmentation toggle - only for boundary detector */}
      {modelType === "boundary-detector" && (
        <div className={css({ mb: 4 })}>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            })}
          >
            <div>
              <span className={css({ fontSize: "sm", color: "gray.300" })}>
                Color Augmentation
              </span>
              <div className={css({ fontSize: "xs", color: "gray.500" })}>
                Random brightness/contrast/saturation variations
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  colorAugmentation: !prev.colorAugmentation,
                }))
              }
              className={css({
                width: "48px",
                height: "26px",
                borderRadius: "full",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
                bg: config.colorAugmentation ? "green.600" : "gray.700",
              })}
              data-setting="color-augmentation"
            >
              <div
                className={css({
                  position: "absolute",
                  top: "3px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "full",
                  bg: "white",
                  transition: "left 0.2s",
                  left: config.colorAugmentation ? "25px" : "3px",
                })}
              />
            </button>
          </div>
        </div>
      )}

      {/* Start button */}
      <button
        type="button"
        onClick={onStartTraining}
        disabled={!canStart}
        className={css({
          width: "100%",
          py: 3,
          bg: canStart ? "green.600" : "gray.700",
          color: canStart ? "white" : "gray.500",
          borderRadius: "lg",
          border: "none",
          cursor: canStart ? "pointer" : "not-allowed",
          fontWeight: "bold",
          fontSize: "md",
          transition: "all 0.2s",
          _hover: canStart ? { bg: "green.500" } : {},
        })}
      >
        {canStart ? "Start Training →" : "Complete previous steps first"}
      </button>
    </div>
  );
}
