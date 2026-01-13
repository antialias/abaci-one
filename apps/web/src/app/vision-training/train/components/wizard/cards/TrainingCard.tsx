'use client'

import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsInstance } from 'echarts-for-react'
import { css } from '../../../../../../../styled-system/css'
import type { EpochData, InferenceSample } from '../types'

/**
 * Displays a single inference sample with predicted vs ground truth corners overlay
 */
function InferenceSampleDisplay({ sample, index }: { sample: InferenceSample; index: number }) {
  // Extract coordinates (TL, TR, BL, BR order from Python)
  // predicted/groundTruth arrays are [tl_x, tl_y, tr_x, tr_y, bl_x, bl_y, br_x, br_y]
  const pred = {
    tl: { x: sample.predicted[0], y: sample.predicted[1] },
    tr: { x: sample.predicted[2], y: sample.predicted[3] },
    bl: { x: sample.predicted[4], y: sample.predicted[5] },
    br: { x: sample.predicted[6], y: sample.predicted[7] },
  }
  const gt = {
    tl: { x: sample.groundTruth[0], y: sample.groundTruth[1] },
    tr: { x: sample.groundTruth[2], y: sample.groundTruth[3] },
    bl: { x: sample.groundTruth[4], y: sample.groundTruth[5] },
    br: { x: sample.groundTruth[6], y: sample.groundTruth[7] },
  }

  return (
    <div
      data-element="inference-sample"
      data-index={index}
      className={css({
        position: 'relative',
        borderRadius: 'md',
        overflow: 'hidden',
        bg: 'gray.900',
      })}
    >
      {/* Base64 image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/jpeg;base64,${sample.imageBase64}`}
        alt={`Sample ${index + 1}`}
        className={css({
          width: '100%',
          height: 'auto',
          display: 'block',
        })}
      />
      {/* SVG overlay with corners */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        })}
      >
        {/* Ground truth quadrilateral (purple, dashed) */}
        <polygon
          points={`${gt.tl.x * 100},${gt.tl.y * 100} ${gt.tr.x * 100},${gt.tr.y * 100} ${gt.br.x * 100},${gt.br.y * 100} ${gt.bl.x * 100},${gt.bl.y * 100}`}
          fill="none"
          stroke="rgba(168, 85, 247, 0.8)"
          strokeWidth="0.8"
          strokeDasharray="2,1"
        />
        {/* Predicted quadrilateral (green, solid) */}
        <polygon
          points={`${pred.tl.x * 100},${pred.tl.y * 100} ${pred.tr.x * 100},${pred.tr.y * 100} ${pred.br.x * 100},${pred.br.y * 100} ${pred.bl.x * 100},${pred.bl.y * 100}`}
          fill="rgba(34, 197, 94, 0.1)"
          stroke="rgba(34, 197, 94, 0.9)"
          strokeWidth="0.8"
        />
        {/* Ground truth corners (purple dots) */}
        <circle cx={gt.tl.x * 100} cy={gt.tl.y * 100} r="2" fill="#a855f7" />
        <circle cx={gt.tr.x * 100} cy={gt.tr.y * 100} r="2" fill="#a855f7" />
        <circle cx={gt.bl.x * 100} cy={gt.bl.y * 100} r="2" fill="#a855f7" />
        <circle cx={gt.br.x * 100} cy={gt.br.y * 100} r="2" fill="#a855f7" />
        {/* Predicted corners (green dots) */}
        <circle cx={pred.tl.x * 100} cy={pred.tl.y * 100} r="2" fill="#22c55e" />
        <circle cx={pred.tr.x * 100} cy={pred.tr.y * 100} r="2" fill="#22c55e" />
        <circle cx={pred.bl.x * 100} cy={pred.bl.y * 100} r="2" fill="#22c55e" />
        <circle cx={pred.br.x * 100} cy={pred.br.y * 100} r="2" fill="#22c55e" />
      </svg>
      {/* Pixel error badge */}
      <div
        className={css({
          position: 'absolute',
          bottom: 1,
          right: 1,
          px: 1,
          py: 0.5,
          bg: 'gray.900/80',
          borderRadius: 'sm',
          fontSize: '8px',
          fontFamily: 'mono',
          color:
            sample.pixelError < 5 ? 'green.400' : sample.pixelError < 10 ? 'yellow.400' : 'red.400',
        })}
      >
        {sample.pixelError.toFixed(1)}px
      </div>
    </div>
  )
}

interface TrainingCardProps {
  currentEpoch: EpochData | null
  epochHistory: EpochData[]
  totalEpochs: number
  bestAccuracy: number
  bestPixelError: number | null
  statusMessage?: string
  onCancel: () => void
  onStopAndSave?: () => void
}

export function TrainingCard({
  currentEpoch,
  epochHistory,
  totalEpochs,
  bestAccuracy,
  bestPixelError,
  statusMessage,
  onCancel,
  onStopAndSave,
}: TrainingCardProps) {
  // Ref for chart instance to handle cleanup
  const chartRef = useRef<EChartsInstance>(null)

  // Check if this is boundary detector training (has pixel error data)
  const isBoundaryDetector = currentEpoch?.val_pixel_error !== undefined

  // Chart configuration - dual axis for loss and pixel error (or accuracy)
  const chartOption = useMemo(() => {
    if (epochHistory.length < 2) return null

    const epochs = epochHistory.map((e) => e.epoch)
    const trainLoss = epochHistory.map((e) => e.loss)
    const valLoss = epochHistory.map((e) => e.val_loss)

    // Use pixel error for boundary detector, accuracy for column classifier
    const hasPixelError = epochHistory.some((e) => e.val_pixel_error !== undefined)
    const rightAxisData = hasPixelError
      ? epochHistory.map((e) => e.val_pixel_error ?? 0)
      : epochHistory.map((e) => e.val_accuracy * 100)

    const rightAxisName = hasPixelError ? 'Px Err' : 'Acc %'
    const rightAxisColor = hasPixelError ? '#f6ad55' : '#68d391' // Orange for error, green for accuracy
    const seriesName = hasPixelError ? 'Px Error' : 'Val Acc'

    return {
      animation: false,
      grid: {
        top: 25,
        right: 45,
        bottom: 25,
        left: 45,
      },
      xAxis: {
        type: 'category',
        data: epochs,
        axisLine: { lineStyle: { color: '#4a5568' } },
        axisLabel: { color: '#718096', fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Loss',
          position: 'left',
          axisLine: { lineStyle: { color: '#63b3ed' } },
          axisLabel: { color: '#718096', fontSize: 9 },
          splitLine: { lineStyle: { color: '#2d3748' } },
          nameTextStyle: { color: '#63b3ed', fontSize: 9 },
        },
        {
          type: 'value',
          name: rightAxisName,
          position: 'right',
          min: 0,
          max: hasPixelError ? undefined : 100, // Auto scale for pixel error
          axisLine: { lineStyle: { color: rightAxisColor } },
          axisLabel: { color: '#718096', fontSize: 9 },
          splitLine: { show: false },
          nameTextStyle: { color: rightAxisColor, fontSize: 9 },
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a202c',
        borderColor: '#4a5568',
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (
          params: Array<{
            seriesName: string
            value: number
            axisValue: number
            color: string
          }>
        ) => {
          const epoch = params[0]?.axisValue
          const lines = params.map((p) => {
            let val: string
            if (typeof p.value === 'number') {
              if (p.seriesName.includes('Px Error')) {
                val = p.value.toFixed(1) + 'px'
              } else if (p.seriesName.includes('Acc')) {
                val = p.value.toFixed(1) + '%'
              } else {
                val = p.value.toFixed(4)
              }
            } else {
              val = String(p.value)
            }
            return `<span style="color:${p.color}">●</span> ${p.seriesName}: ${val}`
          })
          return `<b>Epoch ${epoch}</b><br/>${lines.join('<br/>')}`
        },
      },
      legend: {
        data: ['Train Loss', 'Val Loss', seriesName],
        textStyle: { color: '#a0aec0', fontSize: 9 },
        top: 0,
        itemWidth: 12,
        itemHeight: 8,
        itemGap: 8,
      },
      series: [
        {
          name: 'Train Loss',
          type: 'line',
          yAxisIndex: 0,
          data: trainLoss,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#63b3ed', width: 1.5 },
        },
        {
          name: 'Val Loss',
          type: 'line',
          yAxisIndex: 0,
          data: valLoss,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#90cdf4', width: 1.5, type: 'dashed' },
        },
        {
          name: seriesName,
          type: 'line',
          yAxisIndex: 1,
          data: rightAxisData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: rightAxisColor, width: 2 },
        },
      ],
    }
  }, [epochHistory])

  if (!currentEpoch) {
    return (
      <div className={css({ textAlign: 'center', py: 6 })}>
        <div
          className={css({
            fontSize: '2xl',
            mb: 3,
            animation: 'spin 1s linear infinite',
          })}
        >
          🏋️
        </div>
        <div className={css({ color: 'gray.300', fontWeight: 'medium', mb: 1 })}>
          Preparing to Train
        </div>
        <div className={css({ color: 'gray.500', fontSize: 'sm' })}>
          {statusMessage || 'Initializing...'}
        </div>
      </div>
    )
  }

  const progressPercent = Math.round((currentEpoch.epoch / currentEpoch.total_epochs) * 100)

  return (
    <div className={css({ textAlign: 'center' })}>
      {/* Epoch counter */}
      <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 1 })}>
        Epoch {currentEpoch.epoch} of {totalEpochs}
      </div>

      {/* Main metric - pixel error for boundary detector, accuracy for column classifier */}
      {isBoundaryDetector ? (
        <>
          <div
            className={css({
              fontSize: '3xl',
              fontWeight: 'bold',
              color: 'orange.400',
              mb: 0.5,
            })}
          >
            {currentEpoch.val_pixel_error?.toFixed(1)}px
          </div>
          <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 2 })}>Avg Corner Error</div>

          {/* Inference samples visualization (boundary detector only) */}
          {currentEpoch.inference_samples && currentEpoch.inference_samples.length > 0 && (
            <div className={css({ mb: 3 })}>
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.600',
                  mb: 1,
                  textAlign: 'left',
                })}
              >
                <span className={css({ color: 'green.400' })}>●</span> Predicted{' '}
                <span className={css({ color: 'purple.400' })}>●</span> Ground Truth
              </div>
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 1,
                })}
              >
                {currentEpoch.inference_samples.map((sample, idx) => (
                  <InferenceSampleDisplay key={idx} sample={sample} index={idx} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div
            className={css({
              fontSize: '3xl',
              fontWeight: 'bold',
              color: 'green.400',
              mb: 0.5,
            })}
          >
            {(currentEpoch.val_accuracy * 100).toFixed(1)}%
          </div>
          <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 3 })}>
            Validation Accuracy
          </div>
        </>
      )}

      {/* Loss chart */}
      {chartOption && (
        <div className={css({ mb: 3, mx: -2 })}>
          <ReactECharts
            option={chartOption}
            style={{ height: 140 }}
            opts={{ renderer: 'svg' }}
            notMerge
          />
        </div>
      )}

      {/* Progress bar */}
      <div className={css({ mb: 3 })}>
        <div
          className={css({
            height: '8px',
            bg: 'gray.700',
            borderRadius: 'full',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              height: '100%',
              bg: 'blue.500',
              borderRadius: 'full',
              transition: 'width 0.3s ease',
            })}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className={css({ fontSize: 'xs', color: 'gray.600', mt: 1 })}>
          {progressPercent}% complete
        </div>
      </div>

      {/* Metrics grid */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          p: 2,
          bg: 'gray.900',
          borderRadius: 'lg',
          fontSize: 'xs',
          mb: 2,
        })}
      >
        <div>
          <div className={css({ color: 'gray.600' })}>Loss</div>
          <div className={css({ fontFamily: 'mono', color: 'gray.300' })}>
            {currentEpoch.loss.toFixed(4)}
          </div>
        </div>
        {isBoundaryDetector ? (
          <>
            <div>
              <div className={css({ color: 'gray.600' })}>Val Loss</div>
              <div className={css({ fontFamily: 'mono', color: 'gray.300' })}>
                {currentEpoch.val_loss.toFixed(4)}
              </div>
            </div>
            <div>
              <div className={css({ color: 'gray.600' })}>Best</div>
              <div className={css({ fontFamily: 'mono', color: 'orange.400' })}>
                {bestPixelError?.toFixed(1) ?? '—'}px
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className={css({ color: 'gray.600' })}>Train Acc</div>
              <div className={css({ fontFamily: 'mono', color: 'gray.300' })}>
                {(currentEpoch.accuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className={css({ color: 'gray.600' })}>Best</div>
              <div className={css({ fontFamily: 'mono', color: 'green.400' })}>
                {(bestAccuracy * 100).toFixed(1)}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* Per-head accuracy (bead position detection - column classifier only) */}
      {currentEpoch.val_heaven_accuracy !== undefined && (
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 2,
            p: 2,
            bg: 'gray.900',
            borderRadius: 'lg',
            fontSize: 'xs',
            mb: 4,
          })}
        >
          <div>
            <div className={css({ color: 'gray.600' })}>Heaven (5s)</div>
            <div className={css({ fontFamily: 'mono', color: 'purple.400' })}>
              {((currentEpoch.val_heaven_accuracy ?? 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className={css({ color: 'gray.600' })}>Earth (1s)</div>
            <div className={css({ fontFamily: 'mono', color: 'blue.400' })}>
              {((currentEpoch.val_earth_accuracy ?? 0) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className={css({ display: 'flex', gap: 2, justifyContent: 'center' })}>
        {onStopAndSave && (
          <button
            type="button"
            onClick={onStopAndSave}
            className={css({
              px: 4,
              py: 2,
              bg: 'green.600',
              color: 'white',
              fontSize: 'sm',
              fontWeight: 'medium',
              borderRadius: 'lg',
              border: 'none',
              cursor: 'pointer',
              _hover: { bg: 'green.500' },
            })}
          >
            Stop & Save
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className={css({
            px: 4,
            py: 2,
            bg: 'transparent',
            color: 'gray.500',
            fontSize: 'sm',
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: 'gray.700',
            cursor: 'pointer',
            _hover: { borderColor: 'gray.600', color: 'gray.400' },
          })}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
