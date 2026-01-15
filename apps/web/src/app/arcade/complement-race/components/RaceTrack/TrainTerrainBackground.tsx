'use client'

import { memo } from 'react'

interface TrainTerrainBackgroundProps {
  ballastPath: string
  groundTextureCircles: Array<{
    key: string
    cx: number
    cy: number
    r: number
  }>
}

export const TrainTerrainBackground = memo(
  ({ ballastPath, groundTextureCircles }: TrainTerrainBackgroundProps) => {
    return (
      <>
        {/* Gradient definitions for mountain shading and ground */}
        <defs>
          <linearGradient id="mountainGradientLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#a0a0a0', stopOpacity: 0.8 }} />
            <stop offset="50%" style={{ stopColor: '#7a7a7a', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#5a5a5a', stopOpacity: 0.4 }} />
          </linearGradient>
          <linearGradient id="mountainGradientRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#5a5a5a', stopOpacity: 0.4 }} />
            <stop offset="50%" style={{ stopColor: '#7a7a7a', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#a0a0a0', stopOpacity: 0.8 }} />
          </linearGradient>
          <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#6a8759', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: '#8B7355', stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        {/* Ground layer - extends full width and height to cover entire track area */}
        <rect x="-50" y="120" width="900" height="530" fill="#8B7355" />

        {/* Ground surface gradient for depth */}
        <rect x="-50" y="120" width="900" height="60" fill="url(#groundGradient)" />

        {/* Ground texture - scattered rocks/pebbles */}
        {groundTextureCircles.map((circle) => (
          <circle
            key={circle.key}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill="#654321"
            opacity={0.3}
          />
        ))}

        {/* Railroad ballast (gravel bed) */}
        <path d={ballastPath} fill="none" stroke="#8B7355" strokeWidth="40" strokeLinecap="round" />

        {/* Left mountain and tunnel */}
        <g data-element="left-tunnel">
          {/* Mountain base - extends from left edge */}
          <rect x="-50" y="200" width="120" height="450" fill="#6b7280" />

          {/* Mountain peak - triangular slope */}
          <path d="M -50 200 L 70 200 L 20 -50 L -50 100 Z" fill="#8b8b8b" />

          {/* Mountain ridge shading */}
          <path d="M -50 200 L 70 200 L 20 -50 Z" fill="url(#mountainGradientLeft)" />

          {/* Tunnel depth/interior (dark entrance) */}
          <ellipse cx="20" cy="300" rx="50" ry="55" fill="#0a0a0a" />

          {/* Tunnel arch opening */}
          <path
            d="M 20 355 L -50 355 L -50 245 Q -50 235, 20 235 Q 70 235, 70 245 L 70 355 Z"
            fill="#1a1a1a"
            stroke="#4a4a4a"
            strokeWidth="3"
          />

          {/* Tunnel arch rim (stone bricks) */}
          <path
            d="M -50 245 Q -50 235, 20 235 Q 70 235, 70 245"
            fill="none"
            stroke="#8b7355"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Stone brick texture around arch */}
          <path
            d="M -50 245 Q -50 235, 20 235 Q 70 235, 70 245"
            fill="none"
            stroke="#654321"
            strokeWidth="2"
            strokeDasharray="15,10"
          />
        </g>

        {/* Right mountain and tunnel */}
        <g data-element="right-tunnel">
          {/* Mountain base - extends to right edge */}
          <rect x="680" y="200" width="170" height="450" fill="#6b7280" />

          {/* Mountain peak - triangular slope */}
          <path d="M 730 200 L 850 200 L 850 100 L 780 -50 Z" fill="#8b8b8b" />

          {/* Mountain ridge shading */}
          <path d="M 730 200 L 850 150 L 780 -50 Z" fill="url(#mountainGradientRight)" />

          {/* Tunnel depth/interior (dark entrance) */}
          <ellipse cx="780" cy="300" rx="50" ry="55" fill="#0a0a0a" />

          {/* Tunnel arch opening */}
          <path
            d="M 780 355 L 730 355 L 730 245 Q 730 235, 780 235 Q 850 235, 850 245 L 850 355 Z"
            fill="#1a1a1a"
            stroke="#4a4a4a"
            strokeWidth="3"
          />

          {/* Tunnel arch rim (stone bricks) */}
          <path
            d="M 730 245 Q 730 235, 780 235 Q 850 235, 850 245"
            fill="none"
            stroke="#8b7355"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Stone brick texture around arch */}
          <path
            d="M 730 245 Q 730 235, 780 235 Q 850 235, 850 245"
            fill="none"
            stroke="#654321"
            strokeWidth="2"
            strokeDasharray="15,10"
          />
        </g>
      </>
    )
  }
)

TrainTerrainBackground.displayName = 'TrainTerrainBackground'
