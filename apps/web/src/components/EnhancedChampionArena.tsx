'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
  SortableContext as SortableContextType,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSpring, animated, config } from '@react-spring/web'
import { css } from '../../styled-system/css'
import { useUserProfile } from '../contexts/UserProfileContext'
import { useGameMode } from '../contexts/GameModeContext'
import { GameSelector } from './GameSelector'

interface EnhancedChampionArenaProps {
  onGameModeChange?: (mode: 'single' | 'battle' | 'tournament') => void
  onConfigurePlayer?: (playerId: number) => void
  className?: string
}

interface DraggablePlayer {
  id: number
  name: string
  emoji: string
  color: string
  isActive: boolean
  level: number
}

// We'll handle animations within ChampionCard to avoid ref conflicts

// Animated Champion Card Component
function ChampionCard({
  player,
  isOverlay = false,
  onConfigure,
  onToggleArena,
  zone,
  crossZoneDrag = false
}: {
  player: DraggablePlayer
  isOverlay?: boolean
  onConfigure?: (id: number) => void
  onToggleArena?: (id: number) => void
  zone: 'roster' | 'arena'
  crossZoneDrag?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  // React Spring animations with subtle entry effect and cross-zone "making way" animations
  const cardStyle = useSpring({
    from: { opacity: 0, transform: 'translateY(5px)' },
    to: {
      opacity: isDragging && !isOverlay ? 0.7 : 1,
      transform: transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0) rotateZ(${isDragging ? (Math.random() - 0.5) * 2 : 0}deg)`
        : crossZoneDrag
        ? `translate3d(1px, 0px, 0) scale(0.98) rotateZ(0.5deg)`
        : `translateY(0px)`
    },
    config: config.gentle,
  })

  const glowStyle = useSpring({
    boxShadow: zone === 'arena'
      ? `0 0 ${isDragging ? '30px' : '20px'} ${player.color}${isDragging ? '80' : '40'}`
      : `0 ${isDragging ? '12px 30px' : '8px 20px'} rgba(0, 0, 0, ${isDragging ? '0.25' : '0.15'})`,
    config: config.gentle,
  })

  const emojiStyle = useSpring({
    transform: isDragging ? 'rotate(10deg)' : 'rotate(0deg)',
    config: config.wobbly,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e: React.MouseEvent) => {
        // Only handle click if not dragging and we have the toggle handler
        if (!isDragging && onToggleArena) {
          e.stopPropagation()
          onToggleArena(player.id)
        }
      }}
      className={css({
        position: 'relative',
        background: 'white',
        rounded: { base: 'md', md: 'lg' },
        p: { base: '1', md: '1.5' },
        textAlign: 'center',
        cursor: isDragging ? 'grabbing' : 'pointer',
        border: { base: '2px solid', md: '2px solid' },
        borderColor: player.color,
        width: { base: '50px', md: '60px', lg: '70px' },
        minWidth: { base: '50px', md: '60px', lg: '70px' },
        flexShrink: 0,
        userSelect: 'none',
        touchAction: 'none',
        transition: 'border-color 0.3s ease, transform 0.2s ease',
        zIndex: isDragging ? 1000 : 1,
        transformOrigin: 'center',
        _hover: {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }
      })}
      style={cardStyle}
    >
      <div style={glowStyle} className={css({
        position: 'absolute',
        top: '-3px',
        left: '-3px',
        right: '-3px',
        bottom: '-3px',
        rounded: '2xl',
        pointerEvents: 'none',
      })} />

      {/* Configure Button */}
      {onConfigure && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onConfigure(player.id)
          }}
          className={css({
            position: 'absolute',
            top: '2',
            right: '2',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid',
            borderColor: 'gray.300',
            rounded: 'full',
            w: '6',
            h: '6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'xs',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10,
            _hover: {
              background: 'white',
              borderColor: player.color,
              transform: 'scale(1.1)'
            }
          })}
        >
          ⚙️
        </button>
      )}

      {/* Remove Button for Arena */}
      {zone === 'arena' && onToggleArena && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleArena(player.id)
          }}
          className={css({
            position: 'absolute',
            top: '-2',
            right: '-2',
            w: '6',
            h: '6',
            background: 'red.500',
            rounded: 'full',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'xs',
            color: 'white',
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.3s ease',
            zIndex: 10,
            _hover: {
              background: 'red.600',
              transform: 'scale(1.1)'
            }
          })}
        >
          ✕
        </button>
      )}

      <div
        style={emojiStyle}
        className={css({
          fontSize: { base: 'md', md: 'lg' },
          mb: { base: '0', md: '0.5' },
        })}
      >
        {player.emoji}
      </div>

      <div className={css({
        fontSize: { base: '2xs', md: 'xs' },
        fontWeight: 'bold',
        color: 'gray.800',
        lineHeight: '1.1'
      })}>
        {player.name}
      </div>

      <div className={css({
        fontSize: { base: '3xs', md: '2xs' },
        color: zone === 'arena' ? 'green.700' : 'gray.600',
        fontWeight: zone === 'arena' ? 'semibold' : 'normal',
        mt: { base: '0.5', md: '0.5' }
      })}>
        {zone === 'arena' ? 'READY! 🔥' : `Level ${player.level}`}
      </div>
    </div>
  )
}

// Droppable Zone Component with animations
function DroppableZone({
  id,
  children,
  title,
  subtitle,
  isEmpty
}: {
  id: string
  children: React.ReactNode
  title: string
  subtitle: string
  isEmpty: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  })

  const zoneStyle = useSpring({
    background: isOver
      ? (id === 'arena'
          ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
          : 'linear-gradient(135deg, #fef3c7, #fde68a)')
      : (id === 'arena'
          ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
          : 'linear-gradient(135deg, #f8fafc, #f1f5f9)'),
    borderColor: isOver ? (id === 'arena' ? '#4ade80' : '#fbbf24') : '#d1d5db',
    scale: isOver ? 1.02 : 1,
    config: config.gentle,
  })

  const emptyStateStyle = useSpring({
    opacity: isEmpty ? (isOver ? 1 : 0.6) : 0,
    transform: isEmpty ? (isOver ? 'scale(1.1)' : 'scale(1)') : 'scale(0.8)',
    config: config.wobbly,
  })

  return (
    <div className={css({
      position: 'relative',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    })}>
      <h3 className={css({
        fontSize: { base: 'sm', md: 'md' },
        fontWeight: 'bold',
        color: 'gray.800',
        mb: { base: '0.5', md: '1' },
        textAlign: 'center',
        flexShrink: 0
      })}>
        {title}
      </h3>

      <div
        ref={setNodeRef}
        style={zoneStyle}
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: { base: '1', md: '1.5' },
          justifyContent: 'center',
          alignContent: 'flex-start',
          p: { base: '1.5', md: '2' },
          rounded: id === 'arena' ? '2xl' : 'xl',
          border: { base: '2px dashed', md: '3px dashed' },
          flex: 1,
          position: 'relative',
          transition: 'all 0.3s ease',
          overflow: 'auto',
          minHeight: { base: '30px', md: '40px' }
        })}
      >
        {isEmpty && (
          <div
            style={emptyStateStyle}
            className={css({
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            })}
          >
            <div className={css({
              fontSize: { base: 'xl', md: '2xl' },
              mb: { base: '1', md: '2' },
            })}>
              {isOver ? '✨' : (id === 'arena' ? '🏟️' : '🎯')}
            </div>
            <p className={css({
              color: 'gray.700',
              fontWeight: 'semibold',
              fontSize: { base: 'xs', md: 'sm' }
            })}>
              {isOver ? `Drop to ${id === 'arena' ? 'enter' : 'return'}!` : subtitle}
            </p>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function EnhancedChampionArena({ onGameModeChange, onConfigurePlayer, className }: EnhancedChampionArenaProps) {
  const { profile } = useUserProfile()
  const { gameMode, players, setGameMode, updatePlayer } = useGameMode()
  const [activeId, setActiveId] = useState<number | null>(null)
  const [dragOverZone, setDragOverZone] = useState<'roster' | 'arena' | null>(null)

  // Transform players into draggable format
  const availablePlayers = useMemo(() =>
    players
      .filter(player => !player.isActive)
      .map(player => ({
        id: player.id,
        name: player.id === 1 ? profile.player1Name : player.id === 2 ? profile.player2Name : player.name,
        emoji: player.id === 1 ? profile.player1Emoji : player.id === 2 ? profile.player2Emoji : player.emoji,
        color: player.color,
        isActive: false,
        level: Math.floor((profile.gamesPlayed || 0) / 5) + 1,
      })),
    [players, profile]
  )

  const arenaPlayers = useMemo(() =>
    players
      .filter(player => player.isActive)
      .map(player => ({
        id: player.id,
        name: player.id === 1 ? profile.player1Name : player.id === 2 ? profile.player2Name : player.name,
        emoji: player.id === 1 ? profile.player1Emoji : player.id === 2 ? profile.player2Emoji : player.emoji,
        color: player.color,
        isActive: true,
        level: Math.floor((profile.gamesPlayed || 0) / 5) + 1,
      })),
    [players, profile]
  )

  // Enhanced sensors for better touch and mouse support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Use default collision detection
  const collisionDetection = closestCenter

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) {
      setDragOverZone(null)
      return
    }

    const activeId = active.id as number
    const overId = over.id

    // Find which containers the active and over items belong to
    const activePlayer = [...availablePlayers, ...arenaPlayers].find(p => p.id === activeId)
    const overPlayer = [...availablePlayers, ...arenaPlayers].find(p => p.id === overId)

    if (!activePlayer) return

    // Determine which zone is being hovered
    let hoveredZone: 'roster' | 'arena' | null = null
    if (overId === 'roster' || (overPlayer && !overPlayer.isActive)) {
      hoveredZone = 'roster'
    } else if (overId === 'arena' || (overPlayer && overPlayer.isActive)) {
      hoveredZone = 'arena'
    }

    // Set drag over zone if it's different from the active player's current zone
    if (hoveredZone && ((hoveredZone === 'arena' && !activePlayer.isActive) || (hoveredZone === 'roster' && activePlayer.isActive))) {
      setDragOverZone(hoveredZone)
    } else {
      setDragOverZone(null)
    }

    // If we're dragging over a player in a different zone, move to that zone
    if (overPlayer && activePlayer.isActive !== overPlayer.isActive) {
      const shouldActivate = overPlayer.isActive
      updatePlayer(activeId, { isActive: shouldActivate })

      // Update game mode
      const newArenaCount = shouldActivate
        ? arenaPlayers.length + (activePlayer.isActive ? 0 : 1)
        : arenaPlayers.length - (activePlayer.isActive ? 1 : 0)

      let newMode: 'single' | 'battle' | 'tournament' = 'single'
      if (newArenaCount === 1) newMode = 'single'
      else if (newArenaCount === 2) newMode = 'battle'
      else if (newArenaCount >= 3) newMode = 'tournament'

      setGameMode(newMode)
      onGameModeChange?.(newMode)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setDragOverZone(null)

    if (!over) return

    const playerId = active.id as number
    const overId = over.id

    // Check if we're dragging over a player (for reordering within same zone)
    const overPlayer = [...availablePlayers, ...arenaPlayers].find(p => p.id === overId)

    if (overPlayer) {
      // Reordering within the same zone
      const activePlayer = [...availablePlayers, ...arenaPlayers].find(p => p.id === playerId)
      if (activePlayer && activePlayer.isActive === overPlayer.isActive) {
        // Same zone reordering - this is handled automatically by SortableContext
        return
      }
    }

    // Handle moving between zones (when dropping on zone itself)
    const targetZone = overId as string
    if (targetZone === 'arena' || targetZone === 'roster') {
      const shouldActivate = targetZone === 'arena'

      // Don't update if already in correct state
      const currentPlayer = [...availablePlayers, ...arenaPlayers].find(p => p.id === playerId)
      if (currentPlayer && currentPlayer.isActive === shouldActivate) {
        return
      }

      updatePlayer(playerId, { isActive: shouldActivate })

      // Update game mode based on arena players count
      const currentArenaPlayer = arenaPlayers.find(p => p.id === playerId)
      const newArenaCount = shouldActivate
        ? arenaPlayers.length + 1
        : arenaPlayers.length - (currentArenaPlayer ? 1 : 0)

      let newMode: 'single' | 'battle' | 'tournament' = 'single'
      if (newArenaCount === 1) newMode = 'single'
      else if (newArenaCount === 2) newMode = 'battle'
      else if (newArenaCount >= 3) newMode = 'tournament'

      setGameMode(newMode)
      onGameModeChange?.(newMode)
    }
  }

  // Find the active player for the drag overlay
  const activePlayer = activeId
    ? [...availablePlayers, ...arenaPlayers].find(p => p.id === activeId)
    : null

  // Handle single-click toggle for arena
  const handleToggleArena = (playerId: number) => {
    const player = [...availablePlayers, ...arenaPlayers].find(p => p.id === playerId)
    if (!player) return

    const shouldActivate = !player.isActive
    updatePlayer(playerId, { isActive: shouldActivate })

    // Update game mode based on new arena count
    const newArenaCount = shouldActivate
      ? arenaPlayers.length + 1
      : arenaPlayers.length - 1

    let newMode: 'single' | 'battle' | 'tournament' = 'single'
    if (newArenaCount === 1) newMode = 'single'
    else if (newArenaCount === 2) newMode = 'battle'
    else if (newArenaCount >= 3) newMode = 'tournament'

    setGameMode(newMode)
    onGameModeChange?.(newMode)
  }

  // Entry animations are now handled within ChampionCard component
  // to avoid ref conflicts with dnd-kit

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={css({
        background: 'white',
        rounded: '3xl',
        p: { base: '1.5', md: '2.5' },
        border: '2px solid',
        borderColor: 'gray.200',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }) + (className ? ` ${className}` : '')}>

        {/* Ultra-Compact Header */}
        <div className={css({
          textAlign: 'center',
          mb: { base: '1', md: '2' },
          flexShrink: 0
        })}>
          {/* Mode Indicator - now the main header */}
          <div
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: { base: '1.5', md: '2' },
              background: arenaPlayers.length === 0
                ? 'linear-gradient(135deg, #f3f4f6, #e5e7eb)'
                : gameMode === 'single'
                ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)'
                : gameMode === 'battle'
                ? 'linear-gradient(135deg, #e9d5ff, #ddd6fe)'
                : 'linear-gradient(135deg, #fef3c7, #fde68a)',
              px: { base: '2', md: '2.5' },
              py: { base: '1', md: '1.5' },
              rounded: 'full',
              border: { base: '1px solid', md: '2px solid' },
              borderColor: arenaPlayers.length === 0
                ? 'gray.300'
                : gameMode === 'single'
                ? 'blue.300'
                : gameMode === 'battle'
                ? 'purple.300'
                : 'yellow.300'
            })}
          >
            <span className={css({ fontSize: { base: 'xs', md: 'sm' } })}>
              {arenaPlayers.length === 0 ? '🎯' : gameMode === 'single' ? '👤' : gameMode === 'battle' ? '⚔️' : '🏆'}
            </span>
            <span className={css({
              fontWeight: 'bold',
              color: arenaPlayers.length === 0 ? 'gray.700' : gameMode === 'single' ? 'blue.800' : gameMode === 'battle' ? 'purple.800' : 'yellow.800',
              textTransform: 'uppercase',
              fontSize: { base: '3xs', md: '2xs' }
            })}>
              {arenaPlayers.length === 0 ? 'Select Champions' : gameMode === 'single' ? 'Solo Mode' : gameMode === 'battle' ? 'Battle Mode' : 'Tournament Mode'}
            </span>
          </div>

          <p className={css({
            color: 'gray.600',
            fontSize: { base: '2xs', md: 'xs' },
            mt: { base: '0.5', md: '1' },
            display: { base: 'none', md: 'block' }
          })}>
            Drag champions between zones • Click to toggle
          </p>
        </div>

        {/* Champion Zones - constrained to small fixed space */}
        <div className={css({
          height: { base: '140px', md: '160px' },
          display: 'grid',
          gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' },
          gap: { base: '1', md: '1.5' },
          alignItems: 'stretch',
          flexShrink: 0
        })}>

          {/* Available Champions Roster */}
          <div className={css({
            order: { base: 2, lg: 1 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          })}>
            <SortableContext items={availablePlayers.map(p => p.id)} strategy={rectSortingStrategy}>
              <DroppableZone
                id="roster"
                title="Available"
                subtitle="Tap to add"
                isEmpty={availablePlayers.length === 0}
              >
                {availablePlayers.map(player => (
                  <ChampionCard
                    key={`roster-${player.id}`}
                    player={player}
                    zone="roster"
                    onConfigure={onConfigurePlayer}
                    onToggleArena={handleToggleArena}
                    crossZoneDrag={dragOverZone === 'roster' && activeId !== player.id}
                  />
                ))}
              </DroppableZone>
            </SortableContext>
          </div>

          {/* Arena Drop Zone */}
          <div className={css({
            order: { base: 1, lg: 2 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          })}>
            <SortableContext items={arenaPlayers.map(p => p.id)} strategy={rectSortingStrategy}>
              <DroppableZone
                id="arena"
                title="Arena"
                subtitle="Drop here"
                isEmpty={arenaPlayers.length === 0}
              >
                {arenaPlayers.map(player => (
                  <ChampionCard
                    key={`arena-${player.id}`}
                    player={player}
                    zone="arena"
                    onToggleArena={handleToggleArena}
                    crossZoneDrag={dragOverZone === 'arena' && activeId !== player.id}
                  />
                ))}
              </DroppableZone>
            </SortableContext>
          </div>
        </div>

        {/* Prominent Game Selector - takes remaining space */}
        <div className={css({
          flex: 1,
          mt: { base: '1', md: '2' },
          pt: { base: '1', md: '2' },
          borderTop: '2px solid',
          borderColor: 'gray.200',
          minHeight: 0,
          overflow: 'auto'
        })}>
          <GameSelector
            variant="detailed"
            showHeader={true}
          />
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activePlayer ? (
          <div className={css({
            transform: 'rotate(5deg) scale(1.1)',
            filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3))',
          })}>
            <ChampionCard
              player={activePlayer}
              isOverlay
              zone={activePlayer.isActive ? "arena" : "roster"}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}