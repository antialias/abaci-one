import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { GameControlButtons } from '../GameControlButtons'

describe('GameControlButtons', () => {
  it('renders no buttons when no callbacks provided', () => {
    const { container } = render(<GameControlButtons />)
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders Setup button when onSetup is provided', () => {
    const onSetup = vi.fn()
    render(<GameControlButtons onSetup={onSetup} />)

    const setupButton = screen.getByLabelText('Setup game')
    expect(setupButton).toBeInTheDocument()
    expect(setupButton).toHaveTextContent('Setup')
  })

  it('renders New Game button when onNewGame is provided', () => {
    const onNewGame = vi.fn()
    render(<GameControlButtons onNewGame={onNewGame} />)

    const newGameButton = screen.getByLabelText('Start new game')
    expect(newGameButton).toBeInTheDocument()
    expect(newGameButton).toHaveTextContent('New Game')
  })

  it('renders Quit button when onQuit is provided', () => {
    const onQuit = vi.fn()
    render(<GameControlButtons onQuit={onQuit} />)

    const quitButton = screen.getByLabelText('Quit to arcade')
    expect(quitButton).toBeInTheDocument()
    expect(quitButton).toHaveTextContent('Quit')
  })

  it('renders all buttons when all callbacks are provided', () => {
    const onSetup = vi.fn()
    const onNewGame = vi.fn()
    const onQuit = vi.fn()

    render(<GameControlButtons onSetup={onSetup} onNewGame={onNewGame} onQuit={onQuit} />)

    expect(screen.getByLabelText('Setup game')).toBeInTheDocument()
    expect(screen.getByLabelText('Start new game')).toBeInTheDocument()
    expect(screen.getByLabelText('Quit to arcade')).toBeInTheDocument()
  })

  it('calls onSetup when Setup button is clicked', () => {
    const onSetup = vi.fn()
    render(<GameControlButtons onSetup={onSetup} />)

    const setupButton = screen.getByLabelText('Setup game')
    fireEvent.click(setupButton)

    expect(onSetup).toHaveBeenCalledTimes(1)
  })

  it('calls onNewGame when New Game button is clicked', () => {
    const onNewGame = vi.fn()
    render(<GameControlButtons onNewGame={onNewGame} />)

    const newGameButton = screen.getByLabelText('Start new game')
    fireEvent.click(newGameButton)

    expect(onNewGame).toHaveBeenCalledTimes(1)
  })

  it('calls onQuit when Quit button is clicked', () => {
    const onQuit = vi.fn()
    render(<GameControlButtons onQuit={onQuit} />)

    const quitButton = screen.getByLabelText('Quit to arcade')
    fireEvent.click(quitButton)

    expect(onQuit).toHaveBeenCalledTimes(1)
  })

  it('has proper styling to prevent text wrapping', () => {
    const onNewGame = vi.fn()
    render(<GameControlButtons onNewGame={onNewGame} />)

    const newGameButton = screen.getByLabelText('Start new game')
    const textSpan = newGameButton.querySelector('span:last-child')

    expect(textSpan).toHaveStyle({ whiteSpace: 'nowrap' })
  })

  it('container has flexWrap nowrap to prevent button wrapping', () => {
    const onSetup = vi.fn()
    const onNewGame = vi.fn()
    const onQuit = vi.fn()

    const { container } = render(
      <GameControlButtons onSetup={onSetup} onNewGame={onNewGame} onQuit={onQuit} />
    )

    const buttonContainer = container.firstChild as HTMLElement
    expect(buttonContainer).toHaveStyle({ flexWrap: 'nowrap' })
  })
})
