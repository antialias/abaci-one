'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  CollisionDetection,
  rectIntersection,
  getFirstCollision,
  pointerWithin,
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
import { useSpring, animated, useTransition, config } from '@react-spring/web'
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

// Animated Champion Card Component
function ChampionCard({
  player,
  isOverlay = false,
  onConfigure,
  zone
}: {
  player: DraggablePlayer
  isOverlay?: boolean
  onConfigure?: (id: number) => void
  zone: 'roster' | 'arena'
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  // React Spring animations
  const cardStyle = useSpring({
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : 'translate3d(0px, 0px, 0)',
    scale: isDragging ? 1.05 : 1,
    opacity: isDragging && !isOverlay ? 0.5 : 1,
    rotateZ: isDragging ? (Math.random() - 0.5) * 10 : 0,
    config: config.wobbly,
  })

  const glowStyle = useSpring({
    boxShadow: zone === 'arena'
      ? `0 0 ${isDragging ? '30px' : '20px'} ${player.color}${isDragging ? '80' : '40'}`
      : `0 ${isDragging ? '12px 30px' : '8px 20px'} rgba(0, 0, 0, ${isDragging ? '0.25' : '0.15'})`,
    config: config.gentle,
  })

  const emojiStyle = useSpring({
    transform: isDragging ? 'scale(1.2) rotate(15deg)' : 'scale(1) rotate(0deg)',
    config: config.wobbly,
  })

  return (
    <animated.div
      ref={setNodeRef}
      style={cardStyle}
      {...attributes}
      {...listeners}
      className={css({
        position: 'relative',
        background: 'white',
        rounded: '2xl',
        p: '4',
        textAlign: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        border: '3px solid',
        borderColor: player.color,
        width: '120px',
        minWidth: '120px',
        flexShrink: 0,
        userSelect: 'none',
        touchAction: 'none',
        transition: 'border-color 0.3s ease',
        zIndex: isDragging ? 1000 : 1,
        transformOrigin: 'center',
      })}
    >
      <animated.div style={glowStyle} className={css({
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
      {zone === 'arena' && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            // This will be handled by the parent
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

      <animated.div
        style={emojiStyle}
        className={css({
          fontSize: '3xl',
          mb: '2',
        })}
      >
        {player.emoji}
      </animated.div>

      <div className={css({
        fontSize: 'sm',
        fontWeight: 'bold',
        color: 'gray.800'
      })}>
        {player.name}
      </div>

      <div className={css({
        fontSize: 'xs',
        color: zone === 'arena' ? 'green.700' : 'gray.600',
        fontWeight: zone === 'arena' ? 'semibold' : 'normal',
        mt: '1'
      })}>
        {zone === 'arena' ? 'READY! 🔥' : `Level ${player.level}`}
      </div>
    </animated.div>
  )
}

// Droppable Zone Component with animations
function DroppableZone({
  id,
  children,
  title,
  subtitle,
  isDragOver,
  isEmpty
}: {
  id: string
  children: React.ReactNode
  title: string
  subtitle: string
  isDragOver: boolean
  isEmpty: boolean
}) {
  const zoneStyle = useSpring({
    background: isDragOver
      ? (id === 'arena'
          ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
          : 'linear-gradient(135deg, #fef3c7, #fde68a)')
      : (id === 'arena'
          ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
          : 'linear-gradient(135deg, #f8fafc, #f1f5f9)'),
    borderColor: isDragOver ? (id === 'arena' ? '#4ade80' : '#fbbf24') : '#d1d5db',
    scale: isDragOver ? 1.02 : 1,
    config: config.gentle,
  })

  const emptyStateStyle = useSpring({
    opacity: isEmpty ? (isDragOver ? 1 : 0.6) : 0,
    transform: isEmpty ? (isDragOver ? 'scale(1.1)' : 'scale(1)') : 'scale(0.8)',
    config: config.wobbly,
  })

  return (
    <div className={css({ position: 'relative' })}>
      <h3 className={css({
        fontSize: 'xl',
        fontWeight: 'bold',
        color: 'gray.800',
        mb: '4',
        textAlign: 'center'
      })}>
        {title}
      </h3>

      <animated.div
        style={zoneStyle}
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4',
          justifyContent: 'center',
          p: '6',
          rounded: id === 'arena' ? '3xl' : '2xl',
          border: '3px dashed',
          minH: id === 'arena' ? '64' : '32',
          position: 'relative',
          transition: 'min-height 0.3s ease',
        })}
      >
        {isEmpty && (
          <animated.div
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
              fontSize: '4xl',
              mb: '4',
            })}>
              {isDragOver ? '✨' : (id === 'arena' ? '🏟️' : '🎯')}
            </div>
            <p className={css({
              color: 'gray.700',
              fontWeight: 'semibold',
              fontSize: 'lg'
            })}>
              {isDragOver ? `Drop to ${id === 'arena' ? 'enter the arena' : 'return to roster'}!` : subtitle}
            </p>
          </animated.div>
        )}
        {children}
      </animated.div>
    </div>
  )
}

export function EnhancedChampionArena({ onGameModeChange, onConfigurePlayer, className }: EnhancedChampionArenaProps) {
  const { profile } = useUserProfile()
  const { gameMode, players, setGameMode, updatePlayer } = useGameMode()
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Custom collision detection for better drop zone detection
  const customCollisionDetection: CollisionDetection = (args) => {
    const pointerIntersections = pointerWithin(args)
    const intersections = pointerIntersections.length > 0
      ? pointerIntersections
      : rectIntersection(args)

    return getFirstCollision(intersections, 'id')
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over) return

    const playerId = active.id as number
    const targetZone = over.id as string

    // Handle moving between zones
    if (targetZone === 'arena' || targetZone === 'roster') {
      const shouldActivate = targetZone === 'arena'
      updatePlayer(playerId, { isActive: shouldActivate })

      // Update game mode based on arena players count
      const newArenaCount = shouldActivate
        ? arenaPlayers.length + 1
        : arenaPlayers.length - (arenaPlayers.find(p => p.id === playerId) ? 1 : 0)

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

  // Animated transitions for players
  const rosterTransitions = useTransition(availablePlayers, {
    from: { opacity: 0, transform: 'scale(0.8) rotate(180deg)' },
    enter: { opacity: 1, transform: 'scale(1) rotate(0deg)' },
    leave: { opacity: 0, transform: 'scale(0.8) rotate(-180deg)' },
    config: config.wobbly,
    trail: 100,
  })

  const arenaTransitions = useTransition(arenaPlayers, {
    from: { opacity: 0, transform: 'scale(0.8) translateY(50px)' },
    enter: { opacity: 1, transform: 'scale(1) translateY(0px)' },
    leave: { opacity: 0, transform: 'scale(0.8) translateY(-50px)' },
    config: config.wobbly,
    trail: 150,
  })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={css({
        background: 'white',
        rounded: '3xl',
        p: '8',
        border: '2px solid',
        borderColor: 'gray.200',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease'
      }) + (className ? ` ${className}` : '')}>

        {/* Header */}
        <div className={css({
          textAlign: 'center',
          mb: '8'
        })}>
          <h2 className={css({
            fontSize: { base: '2xl', md: '3xl' },
            fontWeight: 'bold',
            color: 'gray.900',
            mb: '2'
          })}>
            🏟️ Champion Arena
          </h2>
          <p className={css({
            color: 'gray.600',
            fontSize: 'lg',
            mb: '4'
          })}>
            Drag champions to experience the most tactile arena ever built!
          </p>

          {/* Mode Indicator with Spring Animation */}
          <animated.div
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2',
              background: arenaPlayers.length === 0
                ? 'linear-gradient(135deg, #f3f4f6, #e5e7eb)'
                : gameMode === 'single'
                ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)'
                : gameMode === 'battle'
                ? 'linear-gradient(135deg, #e9d5ff, #ddd6fe)'
                : 'linear-gradient(135deg, #fef3c7, #fde68a)',
              px: '4',
              py: '2',
              rounded: 'full',
              border: '2px solid',
              borderColor: arenaPlayers.length === 0
                ? 'gray.300'
                : gameMode === 'single'
                ? 'blue.300'
                : gameMode === 'battle'
                ? 'purple.300'
                : 'yellow.300'
            })}
          >
            <span className={css({ fontSize: 'lg' })}>
              {arenaPlayers.length === 0 ? '🎯' : gameMode === 'single' ? '👤' : gameMode === 'battle' ? '⚔️' : '🏆'}
            </span>
            <span className={css({
              fontWeight: 'bold',
              color: arenaPlayers.length === 0 ? 'gray.700' : gameMode === 'single' ? 'blue.800' : gameMode === 'battle' ? 'purple.800' : 'yellow.800',
              textTransform: 'uppercase',
              fontSize: 'sm'
            })}>
              {arenaPlayers.length === 0 ? 'Select Champions' : gameMode === 'single' ? 'Solo Mode' : gameMode === 'battle' ? 'Battle Mode' : 'Tournament Mode'}
            </span>
          </animated.div>
        </div>

        <div className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' },
          gap: '8',
          alignItems: 'start'
        })}>

          {/* Available Champions Roster */}
          <div className={css({ order: { base: 2, lg: 1 } })}>
            <SortableContext items={availablePlayers.map(p => p.id)} strategy={rectSortingStrategy}>
              <DroppableZone
                id="roster"
                title="🎯 Available Champions"
                subtitle="Drag champions here to remove from arena"
                isDragOver={overId === 'roster'}
                isEmpty={availablePlayers.length === 0}
              >
                {rosterTransitions((style, player) => (
                  <animated.div key={player.id} style={style}>
                    <ChampionCard
                      player={player}
                      zone="roster"
                      onConfigure={onConfigurePlayer}
                    />
                  </animated.div>
                ))}
              </DroppableZone>
            </SortableContext>
          </div>

          {/* Arena Drop Zone */}
          <div className={css({ order: { base: 1, lg: 2 } })}>
            <SortableContext items={arenaPlayers.map(p => p.id)} strategy={rectSortingStrategy}>
              <DroppableZone
                id="arena"
                title="🏟️ Battle Arena"
                subtitle="1 champion = Solo • 2 = Battle • 3+ = Tournament"
                isDragOver={overId === 'arena'}
                isEmpty={arenaPlayers.length === 0}
              >
                {arenaTransitions((style, player) => (
                  <animated.div key={player.id} style={style}>
                    <ChampionCard
                      player={player}
                      zone="arena"
                    />
                  </animated.div>
                ))}
              </DroppableZone>
            </SortableContext>
          </div>
        </div>

        {/* Game Selector */}
        <GameSelector
          variant="detailed"
          className={css({
            mt: '8',
            pt: '8',
            borderTop: '2px solid',
            borderColor: 'gray.200'
          })}
        />
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activePlayer ? (
          <div className={css({
            transform: 'rotate(5deg) scale(1.1)',
            filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3))',
          })}>
            <ChampionCard player={activePlayer} isOverlay zone="roster" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}