import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RegionListPanel } from '../RegionListPanel'

// Mock Panda CSS
vi.mock('@styled/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

describe('RegionListPanel', () => {
  const defaultRegions = ['France', 'Germany', 'Spain', 'Italy', 'Poland']

  describe('rendering', () => {
    it('renders all region names', () => {
      render(<RegionListPanel regions={defaultRegions} />)

      expect(screen.getByText('France')).toBeInTheDocument()
      expect(screen.getByText('Germany')).toBeInTheDocument()
      expect(screen.getByText('Spain')).toBeInTheDocument()
      expect(screen.getByText('Italy')).toBeInTheDocument()
      expect(screen.getByText('Poland')).toBeInTheDocument()
    })

    it('sorts regions alphabetically by default', () => {
      const unsorted = ['Zambia', 'Argentina', 'France']
      render(<RegionListPanel regions={unsorted} />)

      const items = screen.getAllByText(/^(Argentina|France|Zambia)$/)
      expect(items[0]).toHaveTextContent('Argentina')
      expect(items[1]).toHaveTextContent('France')
      expect(items[2]).toHaveTextContent('Zambia')
    })

    it('preserves order when sortAlphabetically is false', () => {
      const unsorted = ['Zambia', 'Argentina', 'France']
      render(<RegionListPanel regions={unsorted} sortAlphabetically={false} />)

      const items = screen.getAllByText(/^(Argentina|France|Zambia)$/)
      expect(items[0]).toHaveTextContent('Zambia')
      expect(items[1]).toHaveTextContent('Argentina')
      expect(items[2]).toHaveTextContent('France')
    })

    it('renders empty list when no regions provided', () => {
      const { container } = render(<RegionListPanel regions={[]} />)

      // Should still render the container
      expect(container.querySelector('[data-element="region-list-panel"]')).toBeInTheDocument()
    })

    it('has correct data-element attribute', () => {
      const { container } = render(<RegionListPanel regions={defaultRegions} />)

      expect(container.querySelector('[data-element="region-list-panel"]')).toBeInTheDocument()
    })
  })

  describe('hover interactions', () => {
    it('calls onRegionHover with region name on mouse enter', () => {
      const onRegionHover = vi.fn()
      render(<RegionListPanel regions={defaultRegions} onRegionHover={onRegionHover} />)

      fireEvent.mouseEnter(screen.getByText('France'))

      expect(onRegionHover).toHaveBeenCalledWith('France')
    })

    it('calls onRegionHover with null on mouse leave', () => {
      const onRegionHover = vi.fn()
      render(<RegionListPanel regions={defaultRegions} onRegionHover={onRegionHover} />)

      fireEvent.mouseLeave(screen.getByText('France'))

      expect(onRegionHover).toHaveBeenCalledWith(null)
    })

    it('does not throw when onRegionHover is not provided', () => {
      render(<RegionListPanel regions={defaultRegions} />)

      // Should not throw
      expect(() => {
        fireEvent.mouseEnter(screen.getByText('France'))
        fireEvent.mouseLeave(screen.getByText('France'))
      }).not.toThrow()
    })
  })

  describe('styling props', () => {
    it('accepts isDark prop', () => {
      // Just verify it renders without error
      const { container } = render(<RegionListPanel regions={defaultRegions} isDark={true} />)

      expect(container.querySelector('[data-element="region-list-panel"]')).toBeInTheDocument()
    })

    it('accepts maxHeight prop', () => {
      // Just verify it renders without error
      const { container } = render(<RegionListPanel regions={defaultRegions} maxHeight="300px" />)

      expect(container.querySelector('[data-element="region-list-panel"]')).toBeInTheDocument()
    })
  })

  describe('large lists', () => {
    it('handles many regions efficiently', () => {
      const manyRegions = Array.from({ length: 100 }, (_, i) => `Region ${i + 1}`)
      render(<RegionListPanel regions={manyRegions} />)

      // Should render first and last
      expect(screen.getByText('Region 1')).toBeInTheDocument()
      expect(screen.getByText('Region 100')).toBeInTheDocument()
    })

    it('handles long region names', () => {
      const longNames = [
        'Democratic Republic of the Congo',
        'United Kingdom of Great Britain and Northern Ireland',
      ]
      render(<RegionListPanel regions={longNames} />)

      expect(screen.getByText('Democratic Republic of the Congo')).toBeInTheDocument()
      expect(
        screen.getByText('United Kingdom of Great Britain and Northern Ireland')
      ).toBeInTheDocument()
    })
  })
})
