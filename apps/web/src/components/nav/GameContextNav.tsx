import { useRoomData } from '@/hooks/useRoomData'
import { useUserId } from '@/hooks/useUserId'
import { ActivePlayersList } from './ActivePlayersList'
import { AddPlayerButton } from './AddPlayerButton'
import { FullscreenPlayerSelection } from './FullscreenPlayerSelection'
import { GameModeIndicator } from './GameModeIndicator'
import { GameTitleMenu } from './GameTitleMenu'
import { NetworkPlayerIndicator } from './NetworkPlayerIndicator'
import { PendingInvitations } from './PendingInvitations'
import { RoomInfo } from './RoomInfo'
import type { PlayerBadge } from './types'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface Player {
  id: string
  name: string
  emoji: string
}

interface NetworkPlayer {
  id: string
  emoji?: string
  name?: string
  isOnline?: boolean
  userId?: string // The user ID controlling this player
}

interface ArcadeRoomInfo {
  roomId?: string
  roomName?: string
  gameName: string | null
  playerCount: number
  joinCode?: string
}

export interface RosterWarningAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'danger'
}

export interface RosterWarning {
  heading: string
  description: string
  actions?: RosterWarningAction[]
}

interface GameContextNavProps {
  navTitle: string
  navEmoji?: string
  gameName?: 'matching' | 'memory-quiz' | 'complement-race'
  gameMode: GameMode
  activePlayers: Player[]
  inactivePlayers: Player[]
  shouldEmphasize: boolean
  showFullscreenSelection: boolean
  onAddPlayer: (playerId: string) => void
  onRemovePlayer: (playerId: string) => void
  onConfigurePlayer: (playerId: string) => void
  onExitSession?: () => void
  onSetup?: () => void
  onNewGame?: () => void
  // Arcade session info
  networkPlayers?: NetworkPlayer[]
  roomInfo?: ArcadeRoomInfo
  // Game state for turn indicator
  currentPlayerId?: string
  playerScores?: Record<string, number>
  playerStreaks?: Record<string, number>
  playerBadges?: Record<string, PlayerBadge>
  // Lifted popover state from PageWithNav
  showPopover?: boolean
  setShowPopover?: (show: boolean) => void
  activeTab?: 'add' | 'invite'
  setActiveTab?: (tab: 'add' | 'invite') => void
  // Game-specific roster warnings
  rosterWarning?: RosterWarning
  // Side assignments (for 2-player games)
  whitePlayerId?: string | null
  blackPlayerId?: string | null
  onAssignWhitePlayer?: (playerId: string | null) => void
  onAssignBlackPlayer?: (playerId: string | null) => void
  // Game phase (for showing spectating vs assign)
  gamePhase?: 'setup' | 'playing' | 'results'
  // Custom mode display (overrides player-count-based mode)
  customModeLabel?: string
  customModeEmoji?: string
  customModeColor?: string
}

export function GameContextNav({
  navTitle,
  navEmoji,
  gameName,
  gameMode,
  activePlayers,
  inactivePlayers,
  shouldEmphasize,
  showFullscreenSelection,
  onAddPlayer,
  onRemovePlayer,
  onConfigurePlayer,
  onExitSession,
  onSetup,
  onNewGame,
  networkPlayers = [],
  roomInfo,
  currentPlayerId,
  playerScores,
  playerStreaks,
  playerBadges,
  showPopover,
  setShowPopover,
  activeTab,
  setActiveTab,
  rosterWarning,
  whitePlayerId,
  blackPlayerId,
  onAssignWhitePlayer,
  onAssignBlackPlayer,
  gamePhase,
  customModeLabel,
  customModeEmoji,
  customModeColor,
}: GameContextNavProps) {
  // Get current user info for moderation
  const { data: currentUserId } = useUserId()
  const { roomData, refetch: refetchRoomData } = useRoomData()

  // Check if current user is the host
  const currentMember = roomData?.members.find((m) => m.userId === currentUserId)
  const isCurrentUserHost = currentMember?.isCreator ?? false

  // 2x2 grid layout for normal mode, column for fullscreen
  if (showFullscreenSelection) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0,
            transition: 'font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {navEmoji && `${navEmoji} `}
          {navTitle}
        </h1>

        <GameModeIndicator
          gameMode={gameMode}
          shouldEmphasize={shouldEmphasize}
          showFullscreenSelection={showFullscreenSelection}
          customModeLabel={customModeLabel}
          customModeEmoji={customModeEmoji}
          customModeColor={customModeColor}
        />

        <FullscreenPlayerSelection
          inactivePlayers={inactivePlayers}
          onSelectPlayer={onAddPlayer}
          onConfigurePlayer={onConfigurePlayer}
          isVisible={showFullscreenSelection}
        />

        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes expandIn {
            from {
              opacity: 0;
              transform: scaleY(0.8);
            }
            to {
              opacity: 1;
              transform: scaleY(1);
            }
          }
        `,
          }}
        />
      </div>
    )
  }

  // Completely flat layout: ALL components always mounted, shown/hidden via display
  // This ensures AddPlayerButton never unmounts, preserving its state
  const showPlayers = activePlayers.length > 0 || (shouldEmphasize && inactivePlayers.length > 0)

  return (
    <>
      {/* Pending Invitations Banner - Shows above nav when user has invitations */}
      <PendingInvitations
        currentRoomId={roomInfo?.roomId}
        onInvitationChange={() => refetchRoomData()}
      />

      {/* Roster Warning Banner - Game-specific warnings (e.g., too many players) */}
      {rosterWarning && (
        <div
          style={{
            width: '100%',
            padding: '12px 16px',
            background:
              'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1))',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '8px',
            marginBottom: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: '#92400e',
              }}
            >
              {rosterWarning.heading}
            </h4>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: '#78350f',
                lineHeight: '1.4',
              }}
            >
              {rosterWarning.description}
            </p>
          </div>
          {rosterWarning.actions && rosterWarning.actions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {rosterWarning.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: action.variant === 'danger' ? '#dc2626' : '#f59e0b',
                    color: 'white',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background =
                      action.variant === 'danger' ? '#b91c1c' : '#d97706'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background =
                      action.variant === 'danger' ? '#dc2626' : '#f59e0b'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background =
                      action.variant === 'danger' ? '#b91c1c' : '#d97706'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background =
                      action.variant === 'danger' ? '#dc2626' : '#f59e0b'
                  }}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          width: 'auto',
          whiteSpace: 'nowrap',
          overflow: 'visible',
        }}
      >
        {/* Game Title Section - Always mounted, hidden when in room */}
        <div
          style={{
            display: roomInfo ? 'none' : 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: 1,
          }}
        >
          <GameTitleMenu
            navTitle={navTitle}
            navEmoji={navEmoji}
            onSetup={onSetup}
            onNewGame={onNewGame}
            onQuit={onExitSession}
            showMenu={true}
          />
          <div style={{ marginLeft: 'auto' }}>
            <GameModeIndicator
              gameMode={gameMode}
              shouldEmphasize={shouldEmphasize}
              showFullscreenSelection={false}
              customModeLabel={customModeLabel}
              customModeEmoji={customModeEmoji}
              customModeColor={customModeColor}
            />
          </div>
        </div>

        {/* Room Info Section - Always mounted, hidden when not in room */}
        <div
          style={{
            display: roomInfo ? 'flex' : 'none',
            alignItems: 'flex-end',
            gap: '12px',
            padding: '6px 12px 12px 12px',
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.05))',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
          }}
        >
          <RoomInfo
            roomId={roomInfo?.roomId}
            roomName={roomInfo?.roomName}
            gameName={roomInfo?.gameName ?? ''}
            playerCount={roomInfo?.playerCount ?? 0}
            joinCode={roomInfo?.joinCode}
            shouldEmphasize={shouldEmphasize}
            gameMode={gameMode}
            modeColor={
              customModeColor ??
              (gameMode === 'battle'
                ? '#8b5cf6'
                : gameMode === 'single'
                  ? '#3b82f6'
                  : gameMode === 'tournament'
                    ? '#f59e0b'
                    : '#6b7280')
            }
            modeEmoji={
              customModeEmoji ??
              (gameMode === 'battle'
                ? '⚔️'
                : gameMode === 'single'
                  ? '🎯'
                  : gameMode === 'tournament'
                    ? '🏆'
                    : '👥')
            }
            modeLabel={
              customModeLabel ??
              (gameMode === 'battle'
                ? 'Battle'
                : gameMode === 'single'
                  ? 'Solo'
                  : gameMode === 'tournament'
                    ? 'Tournament'
                    : 'Select Players')
            }
            navTitle={navTitle}
            navEmoji={navEmoji}
            onSetup={onSetup}
            onNewGame={onNewGame}
            onQuit={onExitSession}
          />

          {/* Network Players - inside same pane as room info */}
          {networkPlayers.length > 0 && (
            <>
              <div
                style={{
                  width: '1px',
                  height: '48px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  margin: '0 4px',
                }}
              />
              {networkPlayers.map((player) => (
                <NetworkPlayerIndicator
                  key={player.id}
                  player={player}
                  shouldEmphasize={shouldEmphasize}
                  currentPlayerId={currentPlayerId}
                  playerScores={playerScores}
                  playerStreaks={playerStreaks}
                  playerBadges={playerBadges}
                  roomId={roomInfo?.roomId}
                  currentUserId={currentUserId ?? undefined}
                  isCurrentUserHost={isCurrentUserHost}
                  whitePlayerId={whitePlayerId}
                  blackPlayerId={blackPlayerId}
                  onAssignWhitePlayer={onAssignWhitePlayer}
                  onAssignBlackPlayer={onAssignBlackPlayer}
                  isInRoom={!!roomInfo}
                  gamePhase={gamePhase}
                />
              ))}
            </>
          )}
        </div>

        {/* Player Section - Always mounted, hidden when no players */}
        <div
          style={{
            display: showPlayers ? 'flex' : 'none',
            alignItems: 'flex-end',
            gap: shouldEmphasize ? '12px' : '8px',
            padding: shouldEmphasize ? '12px 20px 16px 20px' : '6px 12px 12px 12px',
            background: shouldEmphasize
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.10))'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.05))',
            borderRadius: shouldEmphasize ? '16px' : '12px',
            border: shouldEmphasize
              ? '3px solid rgba(255, 255, 255, 0.3)'
              : '2px solid rgba(255, 255, 255, 0.15)',
            boxShadow: shouldEmphasize
              ? '0 8px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.3)'
              : '0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: shouldEmphasize ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <ActivePlayersList
            activePlayers={activePlayers}
            shouldEmphasize={shouldEmphasize}
            onRemovePlayer={onRemovePlayer}
            onConfigurePlayer={onConfigurePlayer}
            currentPlayerId={currentPlayerId}
            playerScores={playerScores}
            playerStreaks={playerStreaks}
            playerBadges={playerBadges}
            whitePlayerId={whitePlayerId}
            blackPlayerId={blackPlayerId}
            onAssignWhitePlayer={onAssignWhitePlayer}
            onAssignBlackPlayer={onAssignBlackPlayer}
            isInRoom={!!roomInfo}
            isCurrentUserHost={isCurrentUserHost}
            gamePhase={gamePhase}
          />

          <AddPlayerButton
            inactivePlayers={inactivePlayers}
            shouldEmphasize={shouldEmphasize}
            onAddPlayer={onAddPlayer}
            showPopover={showPopover}
            setShowPopover={setShowPopover}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isInRoom={!!roomInfo}
            gameName={gameName || 'matching'}
          />
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes expandIn {
          from {
            opacity: 0;
            transform: scaleY(0.8);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }
      `,
          }}
        />
      </div>
    </>
  )
}
