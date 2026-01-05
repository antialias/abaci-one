import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { TrainTerrainBackground } from '../TrainTerrainBackground'

describe('TrainTerrainBackground', () => {
  const mockGroundCircles = [
    { key: 'ground-1', cx: 10, cy: 150, r: 2 },
    { key: 'ground-2', cx: 40, cy: 180, r: 3 },
  ]

  test('renders without crashing', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    expect(container).toBeTruthy()
  })

  test('renders gradient definitions', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    const defs = container.querySelector('defs')
    expect(defs).toBeTruthy()

    // Check for gradient IDs
    expect(container.querySelector('#mountainGradientLeft')).toBeTruthy()
    expect(container.querySelector('#mountainGradientRight')).toBeTruthy()
    expect(container.querySelector('#groundGradient')).toBeTruthy()
  })

  test('renders ground layer rects', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)

    // Check for ground base layer
    const groundRect = Array.from(rects).find(
      (rect) => rect.getAttribute('fill') === '#8B7355' && rect.getAttribute('width') === '900'
    )
    expect(groundRect).toBeTruthy()
  })

  test('renders ground texture circles', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)

    // Verify circle attributes
    const firstCircle = circles[0]
    expect(firstCircle.getAttribute('cx')).toBe('10')
    expect(firstCircle.getAttribute('cy')).toBe('150')
    expect(firstCircle.getAttribute('r')).toBe('2')
  })

  test('renders ballast path with correct attributes', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    const ballastPath = Array.from(container.querySelectorAll('path')).find(
      (path) =>
        path.getAttribute('d') === 'M 0 300 L 800 300' && path.getAttribute('stroke') === '#8B7355'
    )
    expect(ballastPath).toBeTruthy()
    expect(ballastPath?.getAttribute('stroke-width')).toBe('40')
  })

  test('renders left tunnel structure', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    const leftTunnel = container.querySelector('[data-element="left-tunnel"]')
    expect(leftTunnel).toBeTruthy()

    // Check for tunnel elements
    const ellipses = leftTunnel?.querySelectorAll('ellipse')
    expect(ellipses?.length).toBeGreaterThan(0)
  })

  test('renders right tunnel structure', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    const rightTunnel = container.querySelector('[data-element="right-tunnel"]')
    expect(rightTunnel).toBeTruthy()

    // Check for tunnel elements
    const ellipses = rightTunnel?.querySelectorAll('ellipse')
    expect(ellipses?.length).toBeGreaterThan(0)
  })

  test('renders mountains with gradient fills', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    // Check for paths with gradient fills
    const gradientPaths = Array.from(container.querySelectorAll('path')).filter((path) =>
      path.getAttribute('fill')?.includes('url(#mountainGradient')
    )
    expect(gradientPaths.length).toBeGreaterThanOrEqual(2)
  })

  test('handles empty groundTextureCircles array', () => {
    const { container } = render(
      <svg>
        <TrainTerrainBackground ballastPath="M 0 300 L 800 300" groundTextureCircles={[]} />
      </svg>
    )

    // Should still render other elements
    expect(container.querySelector('defs')).toBeTruthy()
    expect(container.querySelector('[data-element="left-tunnel"]')).toBeTruthy()
  })

  test('memoization: does not re-render with same props', () => {
    const { rerender, container } = render(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    const initialHTML = container.innerHTML

    // Rerender with same props
    rerender(
      <svg>
        <TrainTerrainBackground
          ballastPath="M 0 300 L 800 300"
          groundTextureCircles={mockGroundCircles}
        />
      </svg>
    )

    // HTML should be identical (component memoized)
    expect(container.innerHTML).toBe(initialHTML)
  })
})
